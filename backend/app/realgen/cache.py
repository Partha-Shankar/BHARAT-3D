import json
import os
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Iterator, Optional

CACHE_ROOT = os.path.abspath(
    os.environ.get(
        "REALGEN_CACHE_DIR",
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "generated"),
    )
)


def scene_dir(key: str) -> str:
    path = os.path.join(CACHE_ROOT, key)
    os.makedirs(path, exist_ok=True)
    return path


_snapshot: ContextVar[Optional[dict]] = ContextVar("cache_read_snapshot", default=None)


@contextmanager
def read_snapshot() -> Iterator[None]:
    """Inside this block (one thread, read-only work such as an export), each file is parsed once and the same object
    is returned to every later read_json call for it. Callers inside must not modify what they read."""
    token = _snapshot.set({})
    try:
        yield
    finally:
        _snapshot.reset(token)


def read_json(key: str, name: str) -> Optional[Any]:
    memo = _snapshot.get()
    if memo is not None and (key, name) in memo:
        return memo[(key, name)]
    path = os.path.join(CACHE_ROOT, key, name)  # reading never creates the area folder
    data = None
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    if memo is not None:
        memo[(key, name)] = data
    return data


def write_json(key: str, name: str, data: Any) -> str:
    path = os.path.join(scene_dir(key), name)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)
    return path


def file_path(key: str, name: str) -> str:
    return os.path.join(scene_dir(key), name)


def exists(key: str, name: str = "") -> bool:
    return os.path.exists(os.path.join(CACHE_ROOT, key, name))
