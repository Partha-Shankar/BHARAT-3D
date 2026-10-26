"""Build the Hugging Face Space for the BHARAT 3D API and upload it.

Usage (from the repo root, logged in with `hf auth login`):
    backend/.venv/Scripts/python deploy/hf-space/deploy_space.py [--space Partha-hegde/bharat-3d-api]

* Stages backend/, data/seed/ and the Docker files into a temporary folder and uploads it to the Space.
* Secrets come from deploy/.secrets.local (git-ignored). Missing ones are generated once with `secrets` and reused,
  so the API's signing key stays stable across deploys. Secret values are never printed.
"""
import argparse
import json
import secrets
import shutil
import sys
import tempfile
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SECRETS_FILE = ROOT / "deploy" / ".secrets.local"
SKIP = {".venv", "__pycache__", ".pytest_cache", "tests", "bharat3d.db", ".env"}


def load_secrets() -> dict:
    data = json.loads(SECRETS_FILE.read_text(encoding="utf-8")) if SECRETS_FILE.exists() else {}
    changed = False
    for k in ("SECRET_KEY", "STORE_TOKEN"):
        if not data.get(k):
            data[k] = secrets.token_urlsafe(48)
            changed = True
    if changed:
        SECRETS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data


def stage(dst: Path) -> None:
    def ignore(_dir, names):
        return [n for n in names if n in SKIP or n.endswith((".pyc", ".tmp"))]
    shutil.copytree(ROOT / "backend", dst / "backend", ignore=ignore)
    shutil.copytree(ROOT / "data" / "seed", dst / "data" / "seed")
    shutil.copy(HERE / "Dockerfile", dst / "Dockerfile")
    shutil.copy(HERE / "fetch_models.py", dst / "fetch_models.py")
    shutil.copy(HERE / "SPACE_README.md", dst / "README.md")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--space", default="Partha-hegde/bharat-3d-api")
    ap.add_argument("--message", default="Deploy BHARAT 3D API")
    args = ap.parse_args()
    api = HfApi()
    api.create_repo(args.space, repo_type="space", space_sdk="docker", private=False, exist_ok=True)
    sec = load_secrets()
    for k in ("SECRET_KEY", "STORE_TOKEN"):
        api.add_space_secret(args.space, k, sec[k])
    if sec.get("GROQ_API_KEY"):
        api.add_space_secret(args.space, "GROQ_API_KEY", sec["GROQ_API_KEY"])
    for k, v in {"STORE_URL": "https://bharat-3d.pages.dev/api/__store", "CORS_ORIGINS": "*"}.items():
        api.add_space_variable(args.space, k, v)
    with tempfile.TemporaryDirectory() as tmp:
        stage(Path(tmp))
        api.upload_folder(repo_id=args.space, repo_type="space", folder_path=tmp, commit_message=args.message,
                          delete_patterns=["backend/**", "data/**"])
    host = args.space.lower().replace("/", "-").replace("_", "-")
    print(f"uploaded: https://huggingface.co/spaces/{args.space}  (API: https://{host}.hf.space)")


if __name__ == "__main__":
    sys.exit(main())
