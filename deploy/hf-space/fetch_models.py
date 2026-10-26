"""Download the pretrained models into the image (HF_HOME) at build time."""
from huggingface_hub import hf_hub_download, snapshot_download

hf_hub_download("giswqs/geoai", "building_footprints_usa.pth")  # GeoAI building Mask R-CNN
for repo in ("IDEA-Research/grounding-dino-tiny", "facebook/sam-vit-base", "depth-anything/Depth-Anything-V2-Small-hf"):
    snapshot_download(repo, allow_patterns=["*.json", "*.safetensors", "*.txt", "*.model"])
print("models cached")
