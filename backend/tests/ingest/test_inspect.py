# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Inspection of uploaded survey files: every parser on small synthetic files built to each format's specification,
damaged and empty files, the survey-area comparison and the /api/ingest/inspect endpoint."""
from __future__ import annotations

import base64
import io
import json
import math
import struct
import zipfile
from pathlib import Path

import pytest

from app.ingest.inspect import SAMPLE_BYTES, _ecef_to_lonlat, _step_args, inspect_sample
from tests.conftest import Api, json_body

pytestmark = pytest.mark.ingest

AREA = [77.590, 12.970, 77.596, 12.975]  # survey area [W, S, E, N] in Bengaluru
WKT_UTM43 = ('PROJCS["WGS 84 / UTM zone 43N",GEOGCS["WGS 84",AUTHORITY["EPSG","4326"]],'
             'UNIT["metre",1],AUTHORITY["EPSG","32643"]]')


# ------------------------------------------------------------------------------------------------ file builders
def las(version: tuple[int, int] = (1, 4), count: int = 2_345_678, wkt: str | None = WKT_UTM43,
        bounds: tuple[float, ...] = (650_100.0, 650_000.0, 1_434_600.0, 1_434_500.0, 935.5, 880.25)) -> bytes:
    """A LAS public header block (+ one OGC WKT projection record) as LAStools would write it."""
    header_size = 375 if version >= (1, 4) else 227
    body = (wkt or "").encode()
    hdr = bytearray(header_size)
    hdr[0:4] = b"LASF"
    hdr[24], hdr[25] = version
    hdr[58:58 + 13] = b"BHARAT3D test"
    struct.pack_into("<H", hdr, 94, header_size)
    struct.pack_into("<I", hdr, 100, 1 if wkt else 0)
    hdr[104] = 6
    struct.pack_into("<I", hdr, 107, 0 if version >= (1, 4) else count)
    struct.pack_into("<6d", hdr, 179, *bounds)
    if version >= (1, 4):
        struct.pack_into("<Q", hdr, 247, count)
    if not wkt:
        return bytes(hdr)
    vlr = bytearray(54)
    vlr[2:2 + 15] = b"LASF_Projection"
    struct.pack_into("<HH", vlr, 18, 2112, len(body))
    return bytes(hdr) + bytes(vlr) + body


def geotiff(width: int = 6000, height: int = 4000, epsg: int | None = 32643, gsd_m: float = 0.031) -> bytes:
    """A little-endian GeoTIFF header: size, 3 bands, pixel scale and a projected GeoKey directory."""
    entries: list[tuple[int, int, int, bytes]] = [(256, 3, 1, struct.pack("<H", width)), (257, 3, 1, struct.pack("<H", height)),
                                                  (277, 3, 1, struct.pack("<H", 3))]
    if epsg:
        entries += [(33550, 12, 3, struct.pack("<3d", gsd_m, gsd_m, 0.0)),
                    (34735, 3, 8, struct.pack("<8H", 1, 1, 0, 1, 3072, 0, 1, epsg))]
    ifd_size = 2 + 12 * len(entries) + 4
    data_at = 8 + ifd_size
    ifd = bytearray(struct.pack("<H", len(entries)))
    blobs = bytearray()
    for tag, typ, cnt, value in entries:
        if len(value) <= 4:
            ifd += struct.pack("<HHI", tag, typ, cnt) + value.ljust(4, b"\x00")
        else:
            ifd += struct.pack("<HHII", tag, typ, cnt, data_at + len(blobs))
            blobs += value
    ifd += b"\x00\x00\x00\x00"
    return b"II*\x00" + struct.pack("<I", 8) + bytes(ifd) + bytes(blobs)


def ecef(lon: float, lat: float, h: float = 900.0) -> tuple[float, float, float]:
    a, f = 6378137.0, 1 / 298.257223563
    e2 = f * (2 - f)
    phi, lam = math.radians(lat), math.radians(lon)
    n = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    return ((n + h) * math.cos(phi) * math.cos(lam), (n + h) * math.cos(phi) * math.sin(lam), (n * (1 - e2) + h) * math.sin(phi))


DXF_R2000 = "\n".join([
    "0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1015", "9", "$INSUNITS", "70", "6", "0", "ENDSEC",
    "0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER", "5", "2", "70", "3",
    "0", "LAYER", "5", "10", "330", "2", "100", "AcDbSymbolTableRecord", "100", "AcDbLayerTableRecord", "2", "WALLS", "70", "0",
    "0", "LAYER", "5", "11", "330", "2", "100", "AcDbSymbolTableRecord", "100", "AcDbLayerTableRecord", "2", "UNITS", "70", "0",
    "0", "ENDTAB", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES", "0", "LINE", "8", "WALLS", "0", "LINE", "8", "WALLS", "0", "LWPOLYLINE", "8", "UNITS",
    "0", "ENDSEC", "0", "EOF", ""])

IFC4 = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');
FILE_NAME('tower.ifc','2026-01-05T10:00:00',('Rao, A','Iyer, B'),('Studio'),'IfcOpenShell 0.8','Revit 2024','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0a',$,'Tower',$,$,$,$,$,$);
#2=IFCBUILDINGSTOREY('0b',$,'Ground',$,$,$,$,$,.ELEMENT.,0.);
#3=IFCBUILDINGSTOREY('0c',$,'First',$,$,$,$,$,.ELEMENT.,3.2);
#4=IFCWALL('0d',$,$,$,$,$,$,$,$);
#5=IFCWALL('0e',$,$,$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;
"""


def inspect(data: bytes, name: str, **kw):
    return inspect_sample(name, data, size_bytes=kw.pop("size_bytes", len(data)), **kw)


# ------------------------------------------------------------------------------------------------ parsers
def test_las_header_with_wkt_projection() -> None:
    got = inspect(las(), "block_a.las", slot="lidar")
    assert got.recognised and got.kind == "point cloud" and got.format == "LAS 1.4"
    assert got.facts[0] == "LAS 1.4 point cloud, point format 6: 2,345,678 points"
    assert "Height range 880.25 m to 935.50 m (55.2 m)" in got.facts
    assert "Written by BHARAT3D test" in got.facts
    assert got.epsg == 32643 and "Coordinate system EPSG:32643" in got.facts
    assert got.reader == "lidar" and got.steps  # the survey reader's processing steps, by name
    assert got.warnings == []


def test_laz_12_without_crs_warns() -> None:
    got = inspect(las(version=(1, 2), count=1000, wkt=None), "old.laz")
    assert got.format == "LAZ 1.2" and "1,000 points" in got.facts[0]
    assert any("No coordinate system" in w for w in got.warnings)


def test_truncated_las_is_a_warning_not_an_error() -> None:
    got = inspect(las()[:100], "cut.las")
    assert got.recognised and got.warnings == ["The LAS header is incomplete (file shorter than 227 bytes)."]


def test_geotiff_size_crs_and_ground_sample_distance() -> None:
    got = inspect(geotiff(), "ortho.tif", slot="ortho")
    assert got.format == "GeoTIFF" and got.kind == "imagery"
    assert "GeoTIFF image 6,000 × 4,000 px, 3 bands" in got.facts
    assert "Georeferenced, EPSG:32643" in got.facts
    assert "Ground sample distance 3.1 cm per pixel" in got.facts
    assert got.warnings == []


def test_plain_tiff_warns_about_missing_georeferencing() -> None:
    got = inspect(geotiff(epsg=None), "scan.tif")
    assert got.format == "TIFF" and any("No georeferencing" in w for w in got.warnings)


def test_tiff_directory_outside_the_sample() -> None:
    got = inspect(b"II*\x00" + struct.pack("<I", 10_000_000) + b"\x00" * 64, "big.tif")
    assert got.recognised and any("beyond the part" in w for w in got.warnings)


def test_png_and_jpeg_dimensions() -> None:
    png = b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", 1920, 1080) + b"\x08\x02\x00\x00\x00"
    assert "PNG image 1,920 × 1,080 px" in inspect(png, "a.png").facts
    jpeg = (b"\xff\xd8" + b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00" + b"\x00" * 9
            + b"\xff\xc0" + struct.pack(">HBHH", 17, 8, 3000, 4000) + b"\x03" + b"\x00" * 9)
    got = inspect(jpeg, "a.jpg")
    assert "JPEG image 4,000 × 3,000 px" in got.facts and any("world file" in w for w in got.warnings)


def test_geojson_parcels_inside_the_survey_area() -> None:
    ring = [[77.591, 12.971], [77.592, 12.971], [77.592, 12.972], [77.591, 12.971]]
    doc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"ulpin": "KA232C3EMBDLHY", "use": "R"}, "geometry": {"type": "Polygon", "coordinates": [ring]}},
        {"type": "Feature", "properties": {"ulpin": "KA232C3EMBDLHZ"}, "geometry": {"type": "Polygon", "coordinates": [ring]}}]}
    got = inspect(json.dumps(doc).encode(), "parcels.geojson", area_bbox=AREA)
    assert "2 features: 2 Polygon" in got.facts
    assert "Attributes: ulpin, use" in got.facts
    assert "Parcel identifiers in the 'ulpin' attribute" in got.facts
    assert got.epsg == 4326 and "Its extent overlaps the survey area" in got.facts


def test_geojson_far_from_the_area_and_invalid_json() -> None:
    far = {"type": "Feature", "properties": {}, "geometry": {"type": "Point", "coordinates": [72.88, 19.07]}}
    got = inspect(json.dumps(far).encode(), "mumbai.geojson", area_bbox=AREA)
    assert any(w.startswith("Its extent is far from the survey area") for w in got.warnings)
    bad = inspect(b'{"type": "FeatureCollection", "features": [', "bad.geojson")
    assert any(w.startswith("Not valid JSON") for w in bad.warnings)


def test_large_geojson_is_counted_in_the_sample() -> None:
    feature = '{"type": "Feature", "properties": {}, "geometry": {"type": "Point", "coordinates": [77.59, 12.97]}},'
    data = ('{"type": "FeatureCollection", "features": [' + feature * 4000).encode()[:SAMPLE_BYTES]
    got = inspect(data, "huge.geojson", size_bytes=50_000_000)
    assert got.facts[0].startswith("Large GeoJSON:") and "features in the first 256 KB" in got.facts[0]


def test_sanction_register_csv() -> None:
    csv_text = "permit_no,ulpin,floors,height_m,approved_on\nBP/2019/12345,KA232C3EMBDLHY,5,17.2,01-02-2019\n" \
               "BP/2020/22345,KA232C3EMBDLHZ,4,14.5,11-03-2020\n"
    got = inspect(csv_text.encode(), "sanctions.csv", slot="sanctions")
    assert "Table with 5 columns and 2 rows" in got.facts
    assert "Contains permit numbers, floor counts, heights, parcel ULPINs" in got.facts
    assert got.reader is None  # a register, not a survey reading


def test_control_points_csv_with_coordinates() -> None:
    got = inspect(b"id,lat,lon,h\nGCP1,12.9712,77.5912,912.1\nGCP2,12.9731,77.5951,913.4\n", "gcp_control.csv", area_bbox=AREA)
    assert "Point coordinates in the 'lon' and 'lat' columns" in got.facts
    assert "Its extent overlaps the survey area" in got.facts


def test_nmea_fixes_and_quality() -> None:
    nmea = b"$GPGGA,101010.00,1258.2800,N,07735.4800,E,4,12,0.8,910.0,M,-86.0,M,1.0,0000*6A\n" \
           b"$GPGGA,101011.00,1258.2810,N,07735.4810,E,5,12,0.8,910.0,M,-86.0,M,1.0,0000*6B\n"
    got = inspect(nmea, "rover.nmea")
    assert got.format == "NMEA 0183" and "2 position fixes: 1 RTK fixed, 1 RTK float" in got.facts
    assert got.extent_lonlat and abs(got.extent_lonlat[1] - 12.9713) < 1e-3


def test_rinex_station_position_from_ecef() -> None:
    x, y, z = ecef(77.5946, 12.9716)
    rinex = (f"{'3.04':>9}{'':11}{'OBSERVATION DATA':20}{'M':20}RINEX VERSION / TYPE\n"
             f"{'BLR1':60}MARKER NAME\n"
             f"{x:14.4f}{y:14.4f}{z:14.4f}{'':18}APPROX POSITION XYZ\n"
             f"{'  2026    11    16     6    30    0.0000000     GPS':60}TIME OF FIRST OBS\n"
             f"{'':60}END OF HEADER\n")
    got = inspect(rinex.encode(), "blr1.obs")
    assert got.format == "RINEX 3.04" and "RINEX 3.04 observations, marker BLR1" in got.facts
    assert "Station near 12.97160° N, 77.59460° E" in got.facts
    assert "First observation 2026-11-16" in got.facts


def test_ecef_round_trip() -> None:
    lon, lat = _ecef_to_lonlat(*ecef(88.3639, 22.5726, 10.0))
    assert abs(lon - 88.3639) < 1e-7 and abs(lat - 22.5726) < 1e-7


def test_ifc_header_and_entities() -> None:
    got = inspect(IFC4.encode(), "tower.ifc", slot="plans")
    assert got.format == "IFC4" and "Building model, schema IFC4" in got.facts
    assert "Exported by Revit 2024" in got.facts  # the author list holds commas inside quotes
    assert "2 building storey(s) defined" in got.facts
    assert any(f.startswith("5 entities: 2 buildingstorey, 2 wall") for f in got.facts)
    assert got.reader == "ifc"


def test_step_arguments_respect_quotes_and_brackets() -> None:
    assert _step_args("'a.ifc','t',('A, B','C'),('O'),'p','Sys','x'") == ["'a.ifc'", "'t'", "('A, B','C')", "('O')", "'p'", "'Sys'", "'x'"]


def test_dxf_r2000_layers_units_entities() -> None:
    got = inspect(DXF_R2000.encode(), "floors.dxf", slot="plans")
    assert got.format == "DXF 2000" and "CAD drawing, DXF 2000 (AC1015)" in got.facts
    assert "Drawing units: metres" in got.facts
    assert "2 layers: WALLS, UNITS" in got.facts  # names come after handles and subclass markers
    assert "Entities: 2 line, 1 lwpolyline" in got.facts
    assert got.reader == "dxf" and got.warnings == []


def test_zipped_shapefile_missing_projection_and_excel_workbook() -> None:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for ext in ("shp", "shx", "dbf"):
            z.writestr(f"parcels.{ext}", b"x" * 10)
    got = inspect(buf.getvalue(), "parcels.zip")
    assert got.format == "ZIP archive" and "Zipped shapefile: parcels" in got.facts
    assert got.warnings == ["The shapefile set is missing .prj."]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("xl/worksheets/sheet1.xml", "<worksheet/>")
    got = inspect(buf.getvalue(), "sanctions.xlsx")
    assert got.format == "Excel workbook" and got.kind == "table" and "Excel workbook with 1 sheet(s)" in got.facts


def test_shapefile_header_in_lonlat() -> None:
    shp = bytearray(100)
    struct.pack_into(">i", shp, 0, 9994)
    struct.pack_into("<i", shp, 32, 5)
    struct.pack_into("<4d", shp, 36, 77.591, 12.971, 77.594, 12.974)
    got = inspect(bytes(shp), "parcels.shp", area_bbox=AREA)
    assert "Shapefile of polygons" in got.facts and "Its extent overlaps the survey area" in got.facts


def test_documents_and_legacy_formats() -> None:
    assert inspect(b"%PDF-1.7\n1 0 obj << /Type /Page >>\n", "plan.pdf").format == "PDF 1.7"
    dwg = inspect(b"AC1032" + b"\x00" * 100, "plan.dwg")
    assert dwg.format == "DWG 2018" and any("closed format" in w for w in dwg.warnings)
    xls = inspect(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 100, "sanctions.xls")
    assert xls.format == "Excel 97-2003 workbook" and xls.kind == "table"
    gpkg = inspect(b"SQLite format 3\x00" + b"\x10\x00" + b"\x00" * 50 + b"GPKG" + b"\x00" * 30, "parcels.gpkg")
    assert gpkg.format == "GeoPackage" and "application id GPKG" in gpkg.facts[0]


def test_empty_and_unknown_files() -> None:
    assert inspect(b"", "empty.las").warnings == ["The file is empty."]
    got = inspect(b"\x00\x01\x02 random bytes", "mystery.bin")
    assert not got.recognised and got.kind == "unknown"
    assert got.warnings == ["BIN is not a format BHARAT 3D can read; the file is listed in the survey record."]


def test_inspection_never_raises_on_garbage() -> None:
    for name in ("x.las", "x.tif", "x.dxf", "x.ifc", "x.geojson", "x.csv", "x.zip", "x.shp", "x.obs", "x.kml"):
        for data in (b"LASF" + b"\xff" * 300, b"II*\x00\xff\xff\xff\x7f", b"{" * 5000, b"\xff" * 3000, b"0\nSECTION\n2"):
            inspect_sample(name, data, size_bytes=len(data))  # must not raise


# ------------------------------------------------------------------------------------------------ API
def _payload(data: bytes, name: str, **extra) -> dict:
    return {"name": name, "size_bytes": len(data), "sample_b64": base64.b64encode(data).decode(), **extra}


def test_inspect_requires_sign_in(api: Api) -> None:
    assert api.post("/api/ingest/inspect", json=_payload(las(), "a.las")).status_code == 401


@pytest.mark.parametrize("role", ["SURVEYOR", "ADMIN", "CITIZEN"])
def test_inspect_endpoint_reads_the_file(api: Api, role: str, area_cache: Path) -> None:
    before = sorted(p.name for p in area_cache.iterdir()) if area_cache.exists() else []
    got = json_body(api.post("/api/ingest/inspect", role, json=_payload(las(), "block_a.las", slot="lidar", area_bbox=AREA)))
    assert got["recognised"] and got["format"] == "LAS 1.4" and got["epsg"] == 32643
    assert got["reader"] == "lidar" and got["steps"]
    after = sorted(p.name for p in area_cache.iterdir()) if area_cache.exists() else []
    assert after == before  # inspection never writes an area


def test_inspect_rejects_bad_input(api: Api) -> None:
    assert api.post("/api/ingest/inspect", "SURVEYOR", json={"name": "a.las", "sample_b64": "%%%"}).status_code == 422
    too_big = base64.b64encode(b"x" * (SAMPLE_BYTES + 3)).decode()
    assert api.post("/api/ingest/inspect", "SURVEYOR", json={"name": "a.las", "sample_b64": too_big}).status_code == 422
    assert api.post("/api/ingest/inspect", "SURVEYOR", json={"name": "", "sample_b64": ""}).status_code == 422
