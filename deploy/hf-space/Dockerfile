# BHARAT 3D API on a Hugging Face Space (Docker, free CPU: 2 vCPU / 16 GB).
# Enough memory for AI building detection (GeoAI + GroundingDINO/SAM) and Depth Anything V2.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    HF_HOME=/opt/hf HF_HUB_DISABLE_TELEMETRY=1

RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --upgrade pip \
 && pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu \
 && pip install -r backend/requirements.txt "transformers==5.19.0" "opencv-python-headless>=4.10" "huggingface_hub>=1.0"

# Bake the pretrained models into the image: the Space then starts without downloading anything.
COPY fetch_models.py /tmp/fetch_models.py
RUN python /tmp/fetch_models.py && chmod -R a+rX /opt/hf

COPY backend/ backend/
COPY data/seed/ data/seed/

# Spaces run the container as uid 1000: give it a writable home for the database and generated areas.
RUN useradd -m -u 1000 user && mkdir -p /data/generated && chown -R user:user /app /data
USER user
ENV HF_HUB_OFFLINE=1 \
    REALGEN_CACHE_DIR=/data/generated \
    REALGEN_SEED_DIR=/app/data/seed \
    REALGEN_DISABLE_ML=false \
    DATABASE_URL=sqlite+aiosqlite:////data/bharat3d.db \
    ENVIRONMENT=production

WORKDIR /app/backend
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--proxy-headers", "--forwarded-allow-ips", "*"]
