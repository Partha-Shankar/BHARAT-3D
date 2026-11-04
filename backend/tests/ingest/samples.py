# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Synthetic file headers for the sniffer tests (made up here; no real survey data)."""

LAS_HEAD = b"LASF" + b"\x00" * 20 + bytes([1, 4]) + b"TEST SYSTEM".ljust(32, b"\x00") + b"\x00" * 300
IFC4_HEAD = (b"ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\n"
             b"FILE_NAME('test.ifc','2026-01-01T00:00:00',(''),(''),'','','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\n")
IFC2X3_HEAD = IFC4_HEAD.replace(b"'IFC4'", b"'IFC2X3'")
STEP_CAD_HEAD = IFC4_HEAD.replace(b"'IFC4'", b"'AUTOMOTIVE_DESIGN'")
DXF_HEAD = b"  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1032\n  9\n$INSUNITS\n 70\n     4\n  0\nENDSEC\n"
DXF_CRLF_HEAD = DXF_HEAD.replace(b"\n", b"\r\n")
DXF_COMMENT_HEAD = b"999\nexported by a test\n" + DXF_HEAD
DXF_BINARY_HEAD = b"AutoCAD Binary DXF\r\n\x1a\x00" + b"\x00" * 64
RINEX_HEAD = (b"     3.04           OBSERVATION DATA    M                   RINEX VERSION / TYPE\n"
              b"TEST                TEST                20260101 000000 UTC PGM / RUN BY / DATE\n")
NMEA_HEAD = (b"$GPRMC,123519,A,2314.000,N,07724.000,E,000.0,000.0,010126,,*00\r\n"
             b"$GNGGA,123519,2314.000,N,07724.000,E,4,12,0.8,523.1,M,-56.0,M,1.0,0000*4F\r\n")
GPGGA_HEAD = b"$GPGGA,123519,2314.000,N,07724.000,E,1,08,0.9,523.1,M,-56.0,M,,*47\r\n"
CSV_HEAD = b"id,lat,lon,h,sigma\nGCP-01,23.2333,77.4000,523.10,0.02\n"
CSV_LONG_NAMES_HEAD = b"\xef\xbb\xbfPoint;Latitude;Longitude;Ellipsoidal_Height\nP1;23.2;77.4;520.0\n"
PNG_HEAD = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
