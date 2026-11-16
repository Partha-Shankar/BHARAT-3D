# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Inspect an uploaded survey file: what it really is and what its header says.

The web app sends the first ``SAMPLE_BYTES`` of a file the visitor attaches (plus its name and full size). This module
reads that sample for real, with small dependency-free parsers, and reports facts a surveyor can check: format and
version, point / feature / entity counts, extent, coordinate reference system, layers or columns. It also says whether
the file's extent overlaps the survey area when the file is in longitude / latitude.

Inspection never mints identifiers and never changes an area: the 3D record of an area is still built from the
records the server already holds for it. Every parser is defensive; a damaged file yields a warning, never an error.
"""
from __future__ import annotations

import csv
import io
import json
import math
import re
import struct
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from typing import Any

from app.ingest.base import extension
from app.ingest.registry import detect_reader

SAMPLE_BYTES = 256 * 1024  # the most the web app sends: enough for every header below, small enough to upload fast

LAS_SIGNATURE = b"LASF"
TIFF_LE, TIFF_BE = b"II*\x00", b"MM\x00*"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
SQLITE_SIGNATURE = b"SQLite format 3\x00"
ZIP_SIGNATURE = b"PK\x03\x04"
OLE2_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # old Excel (.xls) and other legacy Office files
SHP_FILE_CODE = 9994

DXF_VERSIONS = {"AC1009": "R12", "AC1012": "R13", "AC1014": "R14", "AC1015": "2000", "AC1018": "2004",
                "AC1021": "2007", "AC1024": "2010", "AC1027": "2013", "AC1032": "2018"}
DXF_UNITS = {0: "unitless", 1: "inches", 2: "feet", 4: "millimetres", 5: "centimetres", 6: "metres", 7: "kilometres"}
SHAPE_TYPES = {1: "points", 3: "lines", 5: "polygons", 8: "multipoints", 11: "points (Z)", 13: "lines (Z)",
               15: "polygons (Z)", 18: "multipoints (Z)", 21: "points (M)", 23: "lines (M)", 25: "polygons (M)"}
GEO_KEY_PROJECTED, GEO_KEY_GEOGRAPHIC = 3072, 2048
TAG_WIDTH, TAG_HEIGHT, TAG_SAMPLES = 256, 257, 277
TAG_PIXEL_SCALE, TAG_TIEPOINT, TAG_GEOKEYS = 33550, 33922, 34735
TIFF_TYPES = {1: ("B", 1), 2: ("c", 1), 3: ("H", 2), 4: ("I", 4), 5: ("II", 8), 6: ("b", 1), 8: ("h", 2),
              9: ("i", 4), 11: ("f", 4), 12: ("d", 8), 16: ("Q", 8)}
NMEA_GGA = re.compile(r"^\$G[PNLA]GGA,[^,]*,(\d{2})(\d{2}\.\d+),([NS]),(\d{3})(\d{2}\.\d+),([EW]),(\d)", re.MULTILINE)
GPS_QUALITY = {"1": "standalone", "2": "differential", "4": "RTK fixed", "5": "RTK float"}


@dataclass
class Inspection:
    """What a file sample shows. ``facts`` are read from the file; ``warnings`` are problems a surveyor should fix."""

    name: str
    format: str
    kind: str  # point cloud | imagery | vector | building model | drawing | gnss | table | archive | document | unknown
    recognised: bool
    facts: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    extent_lonlat: list[float] | None = None  # [west, south, east, north] when the file is in longitude / latitude
    epsg: int | None = None
    reader: str | None = None  # survey reader of the processing pipeline for this format, if any
    steps: list[str] = field(default_factory=list)  # that reader's processing steps, by name
    sampled_bytes: int = 0
    size_bytes: int | None = None

    def to_dict(self) -> dict[str, Any]:
        """JSON-ready form for the API."""
        return asdict(self)


# ------------------------------------------------------------------------------------------------ small helpers
def _fmt_int(n: float) -> str:
    return f"{int(n):,}"


def _text(sample: bytes) -> str:
    return sample.decode("utf-8", errors="replace")


def _is_lonlat(box: list[float]) -> bool:
    w, s, e, n = box
    return -180 <= w <= e <= 180 and -90 <= s <= n <= 90


def _extend(box: list[float] | None, x: float, y: float) -> list[float]:
    if box is None:
        return [x, y, x, y]
    return [min(box[0], x), min(box[1], y), max(box[2], x), max(box[3], y)]


def _walk_coords(coords: Any, box: list[float] | None) -> list[float] | None:
    """Bounding box of nested GeoJSON coordinate arrays."""
    if isinstance(coords, (list, tuple)):
        if len(coords) >= 2 and all(isinstance(v, (int, float)) for v in coords[:2]):
            return _extend(box, float(coords[0]), float(coords[1]))
        for c in coords:
            box = _walk_coords(c, box)
    return box


def _epsg_from_wkt(text: str) -> int | None:
    found = re.findall(r'(?:AUTHORITY|ID)\[\s*"EPSG"\s*,\s*"?(\d{4,5})"?\s*\]', text)
    return int(found[-1]) if found else None  # the outermost (last) authority is the CRS itself


def _geokeys_epsg(values: tuple[int, ...]) -> int | None:
    """EPSG code from a GeoTIFF GeoKeyDirectory (shorts): projected first, then geographic."""
    if len(values) < 4:
        return None
    keys = {}
    for i in range(values[3]):
        entry = values[4 + 4 * i:8 + 4 * i]
        if len(entry) == 4 and entry[1] == 0:  # location 0: the value is stored in the entry itself
            keys[entry[0]] = entry[3]
    code = keys.get(GEO_KEY_PROJECTED) or keys.get(GEO_KEY_GEOGRAPHIC)
    return code if code and 1024 <= code < 32767 else None


def _ecef_to_lonlat(x: float, y: float, z: float) -> tuple[float, float]:
    """WGS 84 earth-centred coordinates to longitude / latitude in degrees (Bowring's method)."""
    a, f = 6378137.0, 1 / 298.257223563
    b, e2 = a * (1 - f), f * (2 - f)
    ep2 = (a * a - b * b) / (b * b)
    p = math.hypot(x, y)
    th = math.atan2(z * a, p * b)
    lat = math.atan2(z + ep2 * b * math.sin(th) ** 3, p - e2 * a * math.cos(th) ** 3)
    return math.degrees(math.atan2(y, x)), math.degrees(lat)


def _step_args(text: str) -> list[str]:
    """Top-level arguments of a STEP (ISO 10303-21) record, respecting quotes and nested brackets."""
    args: list[str] = []
    depth, quoted, start = 0, False, 0
    for i, ch in enumerate(text):
        if ch == "'":
            quoted = not quoted
        elif not quoted and ch == "(":
            depth += 1
        elif not quoted and ch == ")":
            depth -= 1
        elif not quoted and depth == 0 and ch == ",":
            args.append(text[start:i].strip())
            start = i + 1
    args.append(text[start:].strip())
    return args


# ------------------------------------------------------------------------------------------------ point clouds
def _las(sample: bytes, out: Inspection) -> None:
    """ASPRS LAS / LAZ public header block (LAS 1.0-1.4) and its projection records."""
    if len(sample) < 227:
        out.warnings.append("The LAS header is incomplete (file shorter than 227 bytes).")
        return
    major, minor = sample[24], sample[25]
    software = sample[58:90].split(b"\x00")[0].decode("ascii", "replace").strip()
    header_size, = struct.unpack_from("<H", sample, 94)
    vlr_count, = struct.unpack_from("<I", sample, 100)
    point_format = sample[104] & 0x3F  # the two high bits flag compression in LAZ files
    count, = struct.unpack_from("<I", sample, 107)
    if (major, minor) >= (1, 4) and len(sample) >= 255:
        count = struct.unpack_from("<Q", sample, 247)[0] or count
    max_x, min_x, max_y, min_y, max_z, min_z = struct.unpack_from("<6d", sample, 179)
    out.format = f"{'LAZ' if extension(out.name) == 'LAZ' else 'LAS'} {major}.{minor}"
    out.facts.append(f"{out.format} point cloud, point format {point_format}: {_fmt_int(count)} points")
    out.facts.append(f"Height range {min_z:.2f} m to {max_z:.2f} m ({max_z - min_z:.1f} m)")
    if software:
        out.facts.append(f"Written by {software}")
    pos = header_size  # variable-length records: OGC WKT (LAS 1.4) or GeoTIFF keys (older files)
    for _ in range(min(vlr_count, 64)):
        if pos + 54 > len(sample):
            break
        user = sample[pos + 2:pos + 18].split(b"\x00")[0]
        record_id, length = struct.unpack_from("<HH", sample, pos + 18)
        body = sample[pos + 54:pos + 54 + length]
        if user == b"LASF_Projection" and len(body) == length:
            if record_id == 2112:
                out.epsg = out.epsg or _epsg_from_wkt(body.decode("utf-8", "replace"))
            elif record_id == 34735 and length >= 8:
                out.epsg = out.epsg or _geokeys_epsg(struct.unpack_from(f"<{length // 2}H", body))
        pos += 54 + length
    box = [min_x, min_y, max_x, max_y]
    if _is_lonlat(box):
        out.extent_lonlat = box
    if out.epsg:
        out.facts.append(f"Coordinate system EPSG:{out.epsg}")
    elif not out.extent_lonlat:
        out.warnings.append("No coordinate system found in the header: the cloud cannot be placed without one.")
    if count == 0:
        out.warnings.append("The header reports zero points.")


# ------------------------------------------------------------------------------------------------ imagery
def _tiff_tags(sample: bytes) -> dict[int, tuple]:
    """Tags of the first image directory of a (Geo)TIFF whose values lie inside the sample."""
    end = "<" if sample.startswith(TIFF_LE) else ">"
    ifd, = struct.unpack_from(f"{end}I", sample, 4)
    n, = struct.unpack_from(f"{end}H", sample, ifd)
    tags: dict[int, tuple] = {}
    for i in range(min(n, 256)):
        at = ifd + 2 + 12 * i
        if at + 12 > len(sample):
            break
        tag, typ, cnt = struct.unpack_from(f"{end}HHI", sample, at)
        code, size = TIFF_TYPES.get(typ, (None, 0))
        if not code or not 0 < cnt <= 4096:
            continue
        total = size * cnt
        where = at + 8 if total <= 4 else struct.unpack_from(f"{end}I", sample, at + 8)[0]
        if where + total > len(sample):
            continue
        fmt = f"{end}{cnt * 2}I" if code == "II" else f"{end}{cnt}{code}"
        tags[tag] = struct.unpack_from(fmt, sample, where)
    return tags


def _tiff(sample: bytes, out: Inspection) -> None:
    try:
        tags = _tiff_tags(sample)
    except struct.error:
        out.warnings.append("The image directory lies beyond the part of the file that was read.")
        return
    width, height = (tags.get(TAG_WIDTH) or (0,))[0], (tags.get(TAG_HEIGHT) or (0,))[0]
    bands = (tags.get(TAG_SAMPLES) or (1,))[0]
    geo = TAG_GEOKEYS in tags or TAG_TIEPOINT in tags
    out.format = "GeoTIFF" if geo else "TIFF"
    if width and height:
        out.facts.append(f"{out.format} image {_fmt_int(width)} × {_fmt_int(height)} px, {bands} band{'s' if bands != 1 else ''}")
    if TAG_GEOKEYS in tags:
        out.epsg = _geokeys_epsg(tuple(int(v) for v in tags[TAG_GEOKEYS]))
    if out.epsg:
        out.facts.append(f"Georeferenced, EPSG:{out.epsg}")
    scale = tags.get(TAG_PIXEL_SCALE)
    if scale and out.epsg and out.epsg != 4326 and scale[0] > 0:
        out.facts.append(f"Ground sample distance {scale[0] * 100:.1f} cm per pixel")
    tie = tags.get(TAG_TIEPOINT)
    if scale and tie and len(tie) >= 6 and width and height and out.epsg in (None, 4326):
        west, north = tie[3], tie[4]
        box = [west, north - height * scale[1], west + width * scale[0], north]
        if _is_lonlat(box):
            out.extent_lonlat = box
    if not geo:
        out.warnings.append("No georeferencing tags: a plain TIFF cannot be placed on the map.")


def _png(sample: bytes, out: Inspection) -> None:
    width, height = struct.unpack_from(">II", sample, 16) if len(sample) >= 24 else (0, 0)
    out.format = "PNG"
    out.facts.append(f"PNG image {_fmt_int(width)} × {_fmt_int(height)} px")
    out.warnings.append("PNG carries no coordinates: add a world file (.pgw) or use GeoTIFF.")


def _jpeg(sample: bytes, out: Inspection) -> None:
    out.format = "JPEG"
    i = 2
    while i + 9 < len(sample):
        if sample[i] != 0xFF:
            i += 1
            continue
        marker = sample[i + 1]
        length, = struct.unpack_from(">H", sample, i + 2)
        if marker in (0xC0, 0xC1, 0xC2):  # start of frame: precision, height, width
            height, width = struct.unpack_from(">HH", sample, i + 5)
            out.facts.append(f"JPEG image {_fmt_int(width)} × {_fmt_int(height)} px")
            break
        i += 2 + length
    out.warnings.append("JPEG carries no coordinates: add a world file (.jgw) or use GeoTIFF.")


# ------------------------------------------------------------------------------------------------ vectors
def _geojson(sample: bytes, out: Inspection, complete: bool) -> None:
    text = _text(sample)
    out.format = "GeoJSON"
    if not complete:
        n = len(re.findall(r'"type"\s*:\s*"Feature"', text))
        out.facts.append(f"Large GeoJSON: {_fmt_int(n)} features in the first {len(sample) // 1024} KB")
        return
    try:
        doc = json.loads(text)
    except ValueError as exc:
        out.warnings.append(f"Not valid JSON ({str(exc)[:80]}).")
        return
    if isinstance(doc, dict) and doc.get("type") == "FeatureCollection":
        feats = doc.get("features") or []
    elif isinstance(doc, dict) and doc.get("type") == "Feature":
        feats = [doc]
    else:
        feats = []
    if not feats:
        out.warnings.append("No GeoJSON features found.")
        return
    kinds: dict[str, int] = {}
    keys: set[str] = set()
    box = None
    for f in feats:
        geometry = (f or {}).get("geometry") or {}
        kind = geometry.get("type", "none")
        kinds[kind] = kinds.get(kind, 0) + 1
        keys.update(((f or {}).get("properties") or {}).keys())
        box = _walk_coords(geometry.get("coordinates"), box)
    summary = ", ".join(f"{_fmt_int(v)} {k}" for k, v in sorted(kinds.items(), key=lambda kv: -kv[1]))
    out.facts.append(f"{_fmt_int(len(feats))} features: {summary}")
    if keys:
        shown = sorted(keys)[:8]
        out.facts.append(f"Attributes: {', '.join(shown)}{' …' if len(keys) > 8 else ''}")
    ulpin = next((k for k in keys if k.lower() in ("ulpin", "ulpin_id", "bhu_aadhaar", "parcel_id")), None)
    if ulpin:
        out.facts.append(f"Parcel identifiers in the '{ulpin}' attribute")
    if box and _is_lonlat(box):
        out.extent_lonlat, out.epsg = box, 4326
    elif box:
        out.warnings.append("Coordinates are not longitude / latitude; GeoJSON should use WGS 84 (EPSG:4326).")


def _kml(sample: bytes, out: Inspection) -> None:
    text = _text(sample)
    out.format = "KML"
    placemarks = len(re.findall(r"<Placemark[\s>]", text))
    partial = "" if len(sample) < SAMPLE_BYTES else " in the first 256 KB"
    out.facts.append(f"KML with {_fmt_int(placemarks)} placemarks{partial}")
    box = None
    for block in re.findall(r"<coordinates>(.*?)</coordinates>", text, flags=re.DOTALL)[:2000]:
        for triple in block.split():
            parts = triple.split(",")
            try:
                box = _extend(box, float(parts[0]), float(parts[1]))
            except (ValueError, IndexError):
                continue
    if box and _is_lonlat(box):
        out.extent_lonlat, out.epsg = box, 4326


def _shapefile(sample: bytes, out: Inspection) -> None:
    if len(sample) < 100:
        out.warnings.append("The shapefile header is incomplete.")
        return
    shape_type, = struct.unpack_from("<i", sample, 32)
    xmin, ymin, xmax, ymax = struct.unpack_from("<4d", sample, 36)
    out.format = "Shapefile"
    out.facts.append(f"Shapefile of {SHAPE_TYPES.get(shape_type, f'type {shape_type}')}")
    box = [xmin, ymin, xmax, ymax]
    if _is_lonlat(box):
        out.extent_lonlat, out.epsg = box, 4326
    out.warnings.append("A .shp needs its .dbf, .shx and .prj next to it: upload the set as one .zip.")


def _zip(sample: bytes, out: Inspection) -> None:
    names: list[str] = []
    i = 0
    while len(names) < 200:
        i = sample.find(ZIP_SIGNATURE, i)
        if i < 0 or i + 30 > len(sample):
            break
        name_len, extra_len = struct.unpack_from("<HH", sample, i + 26)
        try:
            name = sample[i + 30:i + 30 + name_len].decode("utf-8")
        except UnicodeDecodeError:
            name = ""
        if 0 < len(name) < 260 and name.isprintable():
            names.append(name)
        i += 30 + name_len + extra_len
    lower = [n.lower() for n in names]
    if any(n.startswith("xl/") for n in lower) or extension(out.name) in ("XLSX", "XLS"):
        out.format, out.kind = "Excel workbook", "table"
        sheets = [n for n in names if n.startswith("xl/worksheets/") and n.endswith(".xml")]
        out.facts.append(f"Excel workbook{f' with {len(sheets)} sheet(s)' if sheets else ''}")
        return
    out.format, out.kind = "ZIP archive", "archive"
    shapefiles = sorted({n.rsplit(".", 1)[0] for n in names if n.lower().endswith(".shp")})
    if shapefiles:
        parts = {ext for n in lower for ext in (".shp", ".shx", ".dbf", ".prj") if n.endswith(ext)}
        out.facts.append(f"Zipped shapefile: {', '.join(shapefiles[:3])}")
        missing = {".shp", ".shx", ".dbf", ".prj"} - parts
        if missing:
            out.warnings.append(f"The shapefile set is missing {', '.join(sorted(missing))}.")
    elif names:
        out.facts.append(f"ZIP archive, first files: {', '.join(names[:5])}")


def _geopackage(sample: bytes, out: Inspection) -> None:
    out.format = "GeoPackage"
    page_size, = struct.unpack_from(">H", sample, 16) if len(sample) >= 18 else (0,)
    gpkg = len(sample) >= 72 and sample[68:72] == b"GPKG"
    out.facts.append(f"GeoPackage (SQLite database{', application id GPKG' if gpkg else ''}, page size {page_size} bytes)")


# ------------------------------------------------------------------------------------------------ plans and models
def _ifc(sample: bytes, out: Inspection) -> None:
    text = _text(sample)
    schema = re.search(r"FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'", text)
    out.format = schema.group(1) if schema else "IFC"
    out.facts.append(f"Building model, schema {out.format}")
    file_name = re.search(r"FILE_NAME\s*\((.*?)\)\s*;", text, flags=re.DOTALL)
    args = _step_args(file_name.group(1)) if file_name else []
    if len(args) >= 6 and args[5].strip("'"):
        out.facts.append(f"Exported by {args[5].strip(chr(39))}")
    counts: dict[str, int] = {}
    for name in re.findall(r"#\d+\s*=\s*(IFC[A-Z0-9_]+)\s*\(", text):
        counts[name] = counts.get(name, 0) + 1
    if counts:
        total = sum(counts.values())
        top = ", ".join(f"{_fmt_int(v)} {k[3:].lower()}" for k, v in sorted(counts.items(), key=lambda kv: -kv[1])[:5])
        partial = " in the first 256 KB" if len(sample) >= SAMPLE_BYTES else ""
        out.facts.append(f"{_fmt_int(total)} entities{partial}: {top}")
        storeys = counts.get("IFCBUILDINGSTOREY", 0)
        if storeys:
            out.facts.append(f"{storeys} building storey(s) defined")


def _dxf(sample: bytes, out: Inspection) -> None:
    lines = [ln.strip() for ln in _text(sample).splitlines()]
    pairs = list(zip(lines[0::2], lines[1::2], strict=False))  # DXF: (group code, value) line pairs; an odd last line is ignored
    values: dict[str, list[str]] = {}
    layers: list[str] = []
    entities: dict[str, int] = {}
    section = table = var = None
    in_layer = False
    for i, (code, value) in enumerate(pairs):
        if code == "0" and value == "SECTION" and i + 1 < len(pairs):
            section = pairs[i + 1][1]
        elif code == "0" and value == "ENDSEC":
            section = None
        elif section == "HEADER" and code == "9":
            var = value
        elif section == "HEADER" and var:
            values.setdefault(var, []).append(value)
        elif section == "TABLES" and code == "0" and value == "TABLE" and i + 1 < len(pairs):
            table = pairs[i + 1][1]
        elif section == "TABLES" and table == "LAYER" and code == "0":
            in_layer = value == "LAYER"
        elif section == "TABLES" and table == "LAYER" and in_layer and code == "2":
            layers.append(value)  # a layer's name follows its handle and subclass markers in R2000+ files
            in_layer = False
        elif section == "ENTITIES" and code == "0" and value not in ("ENDSEC", "SEQEND", "VERTEX"):
            entities[value] = entities.get(value, 0) + 1
    version = (values.get("$ACADVER") or [""])[0]
    out.format = f"DXF {DXF_VERSIONS.get(version, version)}".strip()
    out.facts.append(f"CAD drawing, {out.format}" + (f" ({version})" if version in DXF_VERSIONS else ""))
    units = (values.get("$INSUNITS") or [""])[0]
    if units.isdigit():
        out.facts.append(f"Drawing units: {DXF_UNITS.get(int(units), f'code {units}')}")
        if int(units) not in (4, 5, 6):
            out.warnings.append("Plans should be drawn in metres or millimetres to scale floors and units.")
    if layers:
        out.facts.append(f"{len(layers)} layers: {', '.join(layers[:8])}{' …' if len(layers) > 8 else ''}")
    if entities:
        top = ", ".join(f"{_fmt_int(v)} {k.lower()}" for k, v in sorted(entities.items(), key=lambda kv: -kv[1])[:5])
        out.facts.append(f"Entities: {top}")


# ------------------------------------------------------------------------------------------------ GNSS
def _gnss(sample: bytes, out: Inspection) -> None:
    text = _text(sample)
    if "RINEX VERSION / TYPE" in text:
        version = text[:9].strip()
        out.format = f"RINEX {version}"
        marker = re.search(r"^(.{0,60})MARKER NAME", text, flags=re.MULTILINE)
        name = marker.group(1).strip() if marker else ""
        out.facts.append(f"RINEX {version} observations{f', marker {name}' if name else ''}")
        pos = re.search(r"^\s*(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+APPROX POSITION XYZ", text, flags=re.MULTILINE)
        if pos:
            lon, lat = _ecef_to_lonlat(*(float(v) for v in pos.groups()))
            out.facts.append(f"Station near {lat:.5f}° N, {lon:.5f}° E")
            out.extent_lonlat, out.epsg = [lon, lat, lon, lat], 4326
        first = re.search(r"^\s*(\d{4})\s+(\d+)\s+(\d+).*TIME OF FIRST OBS", text, flags=re.MULTILINE)
        if first:
            out.facts.append(f"First observation {first.group(1)}-{int(first.group(2)):02d}-{int(first.group(3)):02d}")
        return
    fixes = NMEA_GGA.findall(text)
    if fixes:
        out.format = "NMEA 0183"
        counts: dict[str, int] = {}
        box = None
        for dlat, mlat, ns, dlon, mlon, ew, quality in fixes:
            lat = (int(dlat) + float(mlat) / 60) * (1 if ns == "N" else -1)
            lon = (int(dlon) + float(mlon) / 60) * (1 if ew == "E" else -1)
            box = _extend(box, lon, lat)
            label = GPS_QUALITY.get(quality, f"quality {quality}")
            counts[label] = counts.get(label, 0) + 1
        out.facts.append(f"{_fmt_int(len(fixes))} position fixes: " + ", ".join(f"{v} {k}" for k, v in counts.items()))
        if box and _is_lonlat(box):
            out.extent_lonlat, out.epsg = box, 4326
        if "RTK fixed" not in counts:
            out.warnings.append("No RTK-fixed positions: control points need centimetre accuracy.")
        return
    _csv(sample, out, complete=len(sample) < SAMPLE_BYTES)


# ------------------------------------------------------------------------------------------------ tables
def _csv(sample: bytes, out: Inspection, complete: bool) -> None:
    text = _text(sample)
    if not complete:
        text = text[: text.rfind("\n")]  # drop the last line, which the sample probably cut
    try:
        dialect: Any = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.reader(io.StringIO(text), dialect))
    if not rows:
        out.warnings.append("The file is empty.")
        return
    header = [h.strip() for h in rows[0]]
    out.format = "CSV"
    data_rows = [r for r in rows[1:] if any(c.strip() for c in r)]
    partial = "" if complete else " in the first 256 KB"
    out.facts.append(f"Table with {len(header)} columns and {_fmt_int(len(data_rows))} rows{partial}")
    out.facts.append(f"Columns: {', '.join(header[:8])}{' …' if len(header) > 8 else ''}")
    low = [h.lower() for h in header]
    lat_i = next((i for i, h in enumerate(low) if h in ("lat", "latitude", "y")), None)
    lon_i = next((i for i, h in enumerate(low) if h in ("lon", "lng", "long", "longitude", "x")), None)
    if lat_i is not None and lon_i is not None:
        box = None
        for r in data_rows:
            try:
                box = _extend(box, float(r[lon_i]), float(r[lat_i]))
            except (ValueError, IndexError):
                continue
        if box and _is_lonlat(box):
            out.extent_lonlat, out.epsg = box, 4326
            out.facts.append(f"Point coordinates in the '{header[lon_i]}' and '{header[lat_i]}' columns")
    wanted = {"permit": "permit numbers", "floor": "floor counts", "height": "heights", "ulpin": "parcel ULPINs"}
    found = [label for key, label in wanted.items() if any(key in h for h in low)]
    if found:
        out.facts.append(f"Contains {', '.join(found)}")


def _ole2(sample: bytes, out: Inspection) -> None:
    out.format = "Excel 97-2003 workbook" if extension(out.name) == "XLS" else "Office document (OLE2)"
    out.facts.append(f"{out.format}; save it as .xlsx or .csv so its rows can be read")


# ------------------------------------------------------------------------------------------------ documents
def _pdf(sample: bytes, out: Inspection) -> None:
    out.format = f"PDF {_text(sample[5:8]).strip()}"
    pages = len(re.findall(rb"/Type\s*/Page[^s]", sample))
    out.facts.append(f"{out.format} document{f', {pages} page(s) in the first 256 KB' if pages else ''}")
    out.warnings.append("Scanned or PDF plans have to be digitised to DXF before floors can be measured.")


def _dwg(sample: bytes, out: Inspection) -> None:
    version = _text(sample[:6])
    out.format = f"DWG {DXF_VERSIONS.get(version, version)}"
    out.facts.append(f"AutoCAD drawing, {out.format}")
    out.warnings.append("DWG is a closed format: export the plan to DXF so it can be read automatically.")


# ------------------------------------------------------------------------------------------------ dispatch
Parser = Callable[[bytes, Inspection], None]


def _detect(sample: bytes, name: str) -> tuple[str, Parser | None, bool]:
    """(kind, parser, parser takes the `complete` flag) for a sample, from magic bytes first, then text and extension."""
    ext = extension(name)
    binary: list[tuple[bool, str, Parser]] = [
        (sample.startswith(LAS_SIGNATURE), "point cloud", _las),
        (sample.startswith((TIFF_LE, TIFF_BE)), "imagery", _tiff),
        (sample.startswith(PNG_SIGNATURE), "imagery", _png),
        (sample.startswith(b"\xff\xd8\xff"), "imagery", _jpeg),
        (sample.startswith(SQLITE_SIGNATURE), "vector", _geopackage),
        (sample.startswith(ZIP_SIGNATURE), "archive", _zip),
        (sample.startswith(b"%PDF-"), "document", _pdf),
        (sample.startswith(OLE2_SIGNATURE), "table", _ole2),
        (sample[:4] == b"AC10" and ext == "DWG", "drawing", _dwg),
        (len(sample) >= 100 and struct.unpack_from(">i", sample, 0)[0] == SHP_FILE_CODE, "vector", _shapefile),
    ]
    for hit, kind, parser in binary:
        if hit:
            return kind, parser, False
    head = _text(sample[:2048]).lstrip("﻿ \r\n\t")
    if head.startswith("ISO-10303-21") or ext == "IFC":
        return "building model", _ifc, False
    if re.match(r"0\s*\r?\n\s*SECTION", head) or (ext == "DXF" and "SECTION" in head):
        return "drawing", _dxf, False
    if "RINEX VERSION / TYPE" in head or re.search(r"^\$G[PNLA](GGA|RMC)", head, flags=re.MULTILINE) \
            or ext in ("OBS", "NMEA", "RNX"):
        return "gnss", _gnss, False
    if head.startswith("{") or ext in ("GEOJSON", "JSON"):
        return "vector", _geojson, True  # type: ignore[return-value]
    if (head.startswith("<?xml") and "<kml" in head[:400]) or ext == "KML":
        return "vector", _kml, False
    if ext in ("CSV", "TXT", "TSV"):
        return "table", _csv, True  # type: ignore[return-value]
    return "unknown", None, False


def _overlap(box: list[float], area: list[float]) -> str:
    """How a file's lon/lat extent relates to the survey area's: covers, overlaps, or how far away it is."""
    w, s, e, n = box
    aw, as_, ae, an = area
    if w <= aw and s <= as_ and e >= ae and n >= an:
        return "covers the whole survey area"
    if w <= ae and e >= aw and s <= an and n >= as_:
        return "overlaps the survey area"
    ay = (as_ + an) / 2
    dx = ((w + e) / 2 - (aw + ae) / 2) * 111.32 * math.cos(math.radians(ay))
    dy = ((s + n) / 2 - ay) * 110.57
    km = math.hypot(dx, dy)
    return f"is about {km:,.1f} km from the survey area" if km < 100 else f"is far from the survey area ({km:,.0f} km)"


def inspect_sample(name: str, sample: bytes, size_bytes: int | None = None, slot: str | None = None,
                   area_bbox: list[float] | None = None) -> Inspection:
    """Inspect the first bytes of an uploaded file (see the module docstring). Never raises."""
    name = (name or "file").strip()[:200] or "file"
    sample = bytes(sample[:SAMPLE_BYTES])
    complete = size_bytes is not None and 0 <= size_bytes <= len(sample)
    out = Inspection(name=name, format=extension(name) or "UNKNOWN", kind="unknown", recognised=False,
                     sampled_bytes=len(sample), size_bytes=size_bytes)
    if not sample:
        out.warnings.append("The file is empty.")
        return out
    kind, parse, takes_complete = _detect(sample, name)
    out.kind = kind
    if parse is None:
        out.warnings.append(f"{out.format} is not a format BHARAT 3D can read; the file is listed in the survey record.")
    else:
        out.recognised = True
        try:
            if takes_complete:
                parse(sample, out, complete)  # type: ignore[call-arg]
            else:
                parse(sample, out)
        except Exception as exc:  # noqa: BLE001 - a damaged file must never fail the upload; it gets a warning instead
            out.warnings.append(f"Part of the header could not be read ({exc.__class__.__name__}).")
    if out.extent_lonlat and area_bbox and len(area_bbox) == 4:
        area = [float(v) for v in area_bbox]
        if _is_lonlat(area):
            relation = _overlap(out.extent_lonlat, area)
            (out.facts if relation.startswith(("covers", "overlaps")) else out.warnings).append(f"Its extent {relation}")
    reader = detect_reader(sample, name)
    if reader is not None:
        plan = reader.plan({"slot": slot, "name": name, "size_bytes": size_bytes, "format": out.format.split()[0]})
        out.reader, out.steps = reader.name, [s.name for s in plan.steps]
    return out
