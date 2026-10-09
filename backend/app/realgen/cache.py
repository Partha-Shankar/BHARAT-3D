import json
import os
from typing import Any, Optional

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


def read_json(key: str, name: str) -> Optional[Any]:
    path = os.path.join(CACHE_ROOT, key, name)  # reading never creates the area folder
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


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
