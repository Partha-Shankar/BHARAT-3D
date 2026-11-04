# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Cheap format detection from synthetic headers: right formats accepted, wrong headers rejected."""
import pytest

from app.ingest import READERS, SurveyReader, detect_reader
from app.ingest.dxf import DxfReader
from app.ingest.gnss import GnssReader
from app.ingest.ifc import IfcReader
from app.ingest.lidar import LidarReader
from tests.ingest import samples as s

LIDAR, IFC, DXF, GNSS = LidarReader(), IfcReader(), DxfReader(), GnssReader()


def test_every_reader_implements_the_protocol() -> None:
    assert [r.name for r in READERS] == ["lidar", "ifc", "dxf", "gnss"]
    assert all(isinstance(r, SurveyReader) for r in READERS)


@pytest.mark.parametrize("filename, fmt", [("block.las", "LAS"), ("block.laz", "LAZ"), ("BLOCK.LAZ", "LAZ"),
                                           ("no_extension", "LAS")])
def test_las_and_laz(filename: str, fmt: str) -> None:
    assert LIDAR.sniff(s.LAS_HEAD, filename) and LIDAR.detect_format(s.LAS_HEAD, filename) == fmt


@pytest.mark.parametrize("head", [b"", b"LAS", b"LASX" + b"\x00" * 8, b"lasf", s.PNG_HEAD, s.DXF_HEAD])
def test_lidar_rejects(head: bytes) -> None:
    assert not LIDAR.sniff(head, "x.las")


@pytest.mark.parametrize("head, filename, fmt", [(s.IFC4_HEAD, "model.ifc", "IFC4"), (s.IFC2X3_HEAD, "m.ifc", "IFC2X3"),
                                                 (s.IFC4_HEAD, "export.dat", "IFC4"),
                                                 (b"\xef\xbb\xbf \n" + s.IFC4_HEAD, "m.ifc", "IFC4"),
                                                 (s.STEP_CAD_HEAD, "model.ifc", "IFC")])
def test_ifc(head: bytes, filename: str, fmt: str) -> None:
    assert IFC.sniff(head, filename) and IFC.detect_format(head, filename) == fmt


@pytest.mark.parametrize("head, filename", [(s.STEP_CAD_HEAD, "part.stp"), (b"ISO-10303", "m.ifc"),
                                            (b"HEADER;ISO-10303-21;", "m.ifc"), (s.DXF_HEAD, "m.ifc"), (b"", "m.ifc")])
def test_ifc_rejects(head: bytes, filename: str) -> None:
    assert not IFC.sniff(head, filename)


@pytest.mark.parametrize("head", [s.DXF_HEAD, s.DXF_CRLF_HEAD, s.DXF_COMMENT_HEAD, s.DXF_BINARY_HEAD,
                                  b"0\nSECTION\n"])
def test_dxf(head: bytes) -> None:
    assert DXF.sniff(head, "plan.dxf") and DXF.detect_format(head, "plan.dxf") == "DXF"


@pytest.mark.parametrize("head", [b"", b"SECTION\n0\n", b"  0\nSECTIONS\n", b"  1\nSECTION\n",
                                  b" " * 2000 + b"0\nSECTION\n", s.IFC4_HEAD, s.LAS_HEAD])
def test_dxf_rejects(head: bytes) -> None:
    assert not DXF.sniff(head, "plan.dxf")


@pytest.mark.parametrize("head, fmt", [(s.RINEX_HEAD, "RINEX"), (s.NMEA_HEAD, "NMEA"), (s.GPGGA_HEAD, "NMEA"),
                                       (s.CSV_HEAD, "GNSS_CSV"), (s.CSV_LONG_NAMES_HEAD, "GNSS_CSV")])
def test_gnss(head: bytes, fmt: str) -> None:
    assert GNSS.sniff(head, "obs") and GNSS.detect_format(head, "obs") == fmt


@pytest.mark.parametrize("head", [b"", b"$GPRMC,123519,A,2314.000,N\r\n", b"id,lat,lon\n1,2,3\n",
                                  b"permit_no,floors,height,date\n", b"lat lon h\n", s.LAS_HEAD, s.PNG_HEAD,
                                  b"x$GPGGA,1\n"])
def test_gnss_rejects(head: bytes) -> None:
    assert not GNSS.sniff(head, "obs.txt")


@pytest.mark.parametrize("head, filename, reader", [(s.LAS_HEAD, "a.laz", "lidar"), (s.IFC4_HEAD, "m.ifc", "ifc"),
                                                    (s.DXF_HEAD, "f1.dxf", "dxf"), (s.RINEX_HEAD, "base.24o", "gnss"),
                                                    (s.NMEA_HEAD, "rover.nmea", "gnss"), (s.CSV_HEAD, "gcp.csv", "gnss")])
def test_detect_reader(head: bytes, filename: str, reader: str) -> None:
    found = detect_reader(head, filename)
    assert found is not None and found.name == reader


@pytest.mark.parametrize("head", [b"", s.PNG_HEAD, bytes(range(256)) * 4, b"%PDF-1.7\n"])
def test_detect_reader_unknown(head: bytes) -> None:
    assert detect_reader(head, "file.bin") is None


def test_detect_reader_ignores_non_bytes() -> None:
    assert detect_reader("LASF", "a.las") is None  # type: ignore[arg-type]
    assert detect_reader(bytearray(s.LAS_HEAD), "a.las").name == "lidar"
