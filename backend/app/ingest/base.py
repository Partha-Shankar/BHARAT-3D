# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Shared types for the pseudo-code survey readers (LiDAR, IFC, DXF, GNSS).

In this prototype a reader never parses survey data. It may look at the first few kilobytes of a file to recognise
its format (magic bytes, header labels); everything after that is a *plan*: the ordered processing steps a real
reader would run, returned as data with ``status = "PSEUDO_NOT_EXECUTED"``. Readers never mint identifiers: 3D ULPINs
are minted only by the existing pipeline, after the integrity axioms pass and a surveyor verifies the result.
"""
from __future__ import annotations

import inspect
import math
import os
from dataclasses import asdict, dataclass, field
from typing import Any, Protocol, runtime_checkable

STATUS_PSEUDO = "PSEUDO_NOT_EXECUTED"
STATUS_UNSUPPORTED = "UNSUPPORTED"
PSEUDO_NOTE = "Pseudo-code reader: real parsing is designed but not executed in this prototype."
HEAD_BYTES = 4096  # the most any reader reads from a file: enough for magic bytes and header labels

ACCURACY_CLASSES: dict[str, str] = {
    "A_SURVEY": "Field-measured: LiDAR returns or GNSS fixes, with density / precision recorded",
    "B_PLAN": "Plan-derived: approved drawings or BIM, awaiting surveyor verification on site",
}


@dataclass(frozen=True)
class ProcessingStep:
    """One step of a reader's plan."""

    name: str
    input: str
    output: str
    detail: str


@dataclass
class IngestPlan:
    """What a reader would do with one dataset. ``will_mint_ids`` is always False (enforced)."""

    format: str
    reader: str
    steps: list[ProcessingStep]
    outputs: list[str]
    accuracy_class: str | None
    will_mint_ids: bool = False
    status: str = STATUS_PSEUDO
    notes: list[str] = field(default_factory=list)
    dataset: dict[str, Any] = field(default_factory=dict)  # slot / title / name / size_bytes of the manifest item

    def __post_init__(self) -> None:
        if self.will_mint_ids:
            raise ValueError("Survey readers never mint identifiers; minting stays with the norms pipeline")

    def to_dict(self) -> dict[str, Any]:
        """JSON-ready form (for the API and ingest_plan.json)."""
        return asdict(self)


@runtime_checkable
class SurveyReader(Protocol):
    """The interface every survey reader implements."""

    name: str
    formats: tuple[str, ...]

    def sniff(self, head: bytes, filename: str) -> bool:
        """True if the first bytes of a file (and its name) look like this reader's format. Cheap, never parses."""

    def describe(self) -> dict[str, Any]:
        """Formats, outputs, accuracy class and the reader's pseudo-code, for GET /api/ingest/formats."""

    def plan(self, meta: dict[str, Any]) -> IngestPlan:
        """The ordered processing plan for a dataset described by ``meta`` (a manifest item)."""

    def process(self, path: str) -> IngestPlan:
        """The plan for a file on disk. Reads at most ``HEAD_BYTES`` to confirm the format; never the body."""


def read_head(path: str, limit: int = HEAD_BYTES) -> bytes:
    """The first ``limit`` bytes of a file (the only file read any reader performs)."""
    with open(path, "rb") as f:
        return f.read(max(0, min(limit, HEAD_BYTES)))


def clean_size(value: Any) -> int | None:
    """A declared file size as a non-negative int, or None when missing or not a number."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, float) and math.isfinite(value):
        return int(value) if value >= 0 else None
    return None


def extension(filename: str) -> str:
    """Upper-case extension without the dot: ``"Block-A.laz"`` -> ``"LAZ"``."""
    return os.path.splitext(filename or "")[1].lstrip(".").upper()


def dataset_ref(meta: dict[str, Any]) -> dict[str, Any]:
    """The identifying part of a manifest item, echoed in its plan."""
    return {"slot": meta.get("slot"), "title": meta.get("title"), "name": meta.get("name"),
            "size_bytes": clean_size(meta.get("size_bytes"))}


class PseudoReader:
    """Base class: ``describe`` from the class attributes and docstring, ``process`` via the header only."""

    name: str = ""
    formats: tuple[str, ...] = ()
    outputs: tuple[str, ...] = ()
    accuracy_class: str | None = None
    feeds: str = ""

    def sniff(self, head: bytes, filename: str) -> bool:
        raise NotImplementedError

    def plan(self, meta: dict[str, Any]) -> IngestPlan:
        raise NotImplementedError

    def detect_format(self, head: bytes, filename: str) -> str:
        """The specific format label for a file this reader accepts (subclasses refine it)."""
        return self.formats[0]

    def describe(self) -> dict[str, Any]:
        return {"reader": self.name, "formats": list(self.formats), "outputs": list(self.outputs),
                "accuracy_class": self.accuracy_class, "accuracy": ACCURACY_CLASSES.get(self.accuracy_class or ""),
                "feeds": self.feeds, "will_mint_ids": False, "status": STATUS_PSEUDO,
                "pseudocode": inspect.cleandoc(type(self).__doc__ or "")}

    def process(self, path: str) -> IngestPlan:
        # A real reader would open the file here and stream it. This prototype only confirms the format from the
        # first HEAD_BYTES and the file size, then returns the plan unexecuted. It never raises.
        name = os.path.basename(path)
        notes: list[str] = []
        try:
            size: int | None = os.path.getsize(path)
            head = read_head(path)
        except OSError as exc:
            size, head = None, b""
            notes.append(f"File could not be opened ({exc.__class__.__name__}); nothing was read.")
        recognised = bool(head) and self.sniff(head, name)
        fmt = self.detect_format(head, name) if recognised else extension(name) or "UNKNOWN"
        if size == 0:
            notes.append("File is empty; a real reader would refuse it.")
        elif head and not recognised:
            notes.append(f"Header does not look like {'/'.join(self.formats)}; a real reader would refuse the file.")
        plan = self.plan({"name": name, "size_bytes": size, "format": fmt})
        plan.notes = [*notes, *plan.notes]
        return plan

    def _plan(self, meta: dict[str, Any], fmt: str, steps: list[ProcessingStep], notes: list[str]) -> IngestPlan:
        return IngestPlan(format=fmt, reader=self.name, steps=steps, outputs=list(self.outputs),
                          accuracy_class=self.accuracy_class, notes=[PSEUDO_NOTE, *notes], dataset=dataset_ref(meta))


def size_note(size: int | None, unit_bytes: int, unit: str) -> str:
    """Deterministic note on the declared size, e.g. how many chunks a streaming reader would use."""
    if size is None:
        return "Declared size unknown; the reader would stream the file without loading it whole."
    chunks = max(1, -(-size // max(1, unit_bytes)))
    return f"Declared size {size:,} bytes: streamed as about {chunks:,} {unit}."
