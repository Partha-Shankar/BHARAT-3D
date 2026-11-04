# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""process() reads at most the header, never the body, and never raises."""
import os
import random
from pathlib import Path
from typing import Any, Self

import pytest

from app.ingest import HEAD_BYTES, PSEUDO_NOTE, READERS, STATUS_PSEUDO, base
from app.ingest.dxf import DxfReader
from app.ingest.lidar import LidarReader
from tests.ingest import samples as s


class SpiedFile:
    """Stands in for a file opened by a reader: every read is bounded, counted and served from the real file."""

    def __init__(self, spy: "ReadSpy", path: str, mode: str) -> None:
        self.spy, self.path, self.mode, self.pos = spy, path, mode, 0

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def read(self, n: int = -1) -> bytes:
        assert n is not None and n >= 0, "a reader asked for the whole file"
        with open(self.path, self.mode) as f:
            f.seek(self.pos)
            data = f.read(n)
        self.pos += len(data)
        self.spy.bytes_read += len(data)
        return data


class ReadSpy:
    """Counts every byte any reader pulls through open()."""

    def __init__(self) -> None:
        self.opened: list[str] = []
        self.bytes_read = 0

    def open(self, path: Any, mode: str = "r", *a: Any, **kw: Any) -> SpiedFile:
        assert "w" not in mode and "a" not in mode and "+" not in mode, "readers must never write"
        if not os.path.isfile(path):
            raise FileNotFoundError(path)
        self.opened.append(str(path))
        return SpiedFile(self, str(path), mode)


@pytest.fixture
def spy(monkeypatch: pytest.MonkeyPatch) -> ReadSpy:
    rs = ReadSpy()
    monkeypatch.setattr(base, "open", rs.open, raising=False)
    return rs


def _write(tmp_path: Path, name: str, data: bytes) -> str:
    p = tmp_path / name
    p.write_bytes(data)
    return str(p)


@pytest.mark.parametrize("reader", READERS, ids=[r.name for r in READERS])
def test_process_empty_file(tmp_path: Path, spy: ReadSpy, reader) -> None:
    plan = reader.process(_write(tmp_path, "empty.bin", b""))
    assert plan.status == STATUS_PSEUDO and PSEUDO_NOTE in plan.notes and plan.will_mint_ids is False
    assert "File is empty; a real reader would refuse it." in plan.notes
    assert spy.bytes_read == 0


@pytest.mark.parametrize("reader", READERS, ids=[r.name for r in READERS])
def test_process_random_binary_reads_only_the_head(tmp_path: Path, spy: ReadSpy, reader) -> None:
    data = random.Random(11).randbytes(3 * 1024 * 1024)
    plan = reader.process(_write(tmp_path, "noise.bin", data))
    assert plan.status == STATUS_PSEUDO and plan.steps
    assert any(n.startswith("Header does not look like") for n in plan.notes)
    assert spy.opened == [str(tmp_path / "noise.bin")] and spy.bytes_read <= HEAD_BYTES


def test_process_real_looking_las_reads_only_the_head(tmp_path: Path, spy: ReadSpy) -> None:
    path = _write(tmp_path, "block.laz", s.LAS_HEAD + os.urandom(2 * 1024 * 1024))
    plan = LidarReader().process(path)
    assert plan.format == "LAZ" and plan.reader == "lidar" and plan.status == STATUS_PSEUDO
    assert plan.dataset["name"] == "block.laz" and plan.dataset["size_bytes"] == os.path.getsize(path)
    assert not any(n.startswith("Header does not look like") for n in plan.notes)
    assert spy.bytes_read == HEAD_BYTES


def test_process_huge_declared_size(tmp_path: Path, spy: ReadSpy, monkeypatch: pytest.MonkeyPatch) -> None:
    path = _write(tmp_path, "floors.dxf", s.DXF_HEAD)
    monkeypatch.setattr(base.os.path, "getsize", lambda p: 10 ** 15)
    plan = DxfReader().process(path)
    assert plan.dataset["size_bytes"] == 10 ** 15 and "1,000,000,000,000,000 bytes" in plan.notes[-1]
    assert spy.bytes_read == len(s.DXF_HEAD) <= HEAD_BYTES


@pytest.mark.parametrize("reader", READERS, ids=[r.name for r in READERS])
def test_process_missing_or_unreadable_path_never_raises(tmp_path: Path, reader) -> None:
    for path in (str(tmp_path / "missing.las"), str(tmp_path)):  # a missing file, then a directory
        plan = reader.process(path)
        assert plan.status == STATUS_PSEUDO and plan.steps
        assert any(n.startswith("File could not be opened") for n in plan.notes)


def test_read_head_is_capped(tmp_path: Path) -> None:
    path = _write(tmp_path, "big.bin", b"x" * (HEAD_BYTES * 3))
    assert len(base.read_head(path)) == HEAD_BYTES
    assert len(base.read_head(path, limit=10 ** 9)) == HEAD_BYTES
    assert base.read_head(path, limit=-1) == b""
    assert base.read_head(path, limit=8) == b"x" * 8
