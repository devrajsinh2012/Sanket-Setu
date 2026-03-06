# ─────────────────────────────────────────────────────────────────────────────
# SanketSetu Backend — Dockerfile
# Build context: repo root (SanketSetu/)
#
#   docker build -t sanketsetu-backend .
#   docker run -p 8000:8000 sanketsetu-backend
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim AS base

# System libraries needed by OpenCV headless + Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies (cached layer) ───────────────────────────────────────
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ── Application source ────────────────────────────────────────────────────────
COPY backend/app/ ./app/

# ── Model artefacts ───────────────────────────────────────────────────────────
# Copied to /models so the container is fully self-contained.
# Override at runtime with -e WEIGHTS_DIR=/mnt/models + bind-mount if preferred.
COPY Mediapipe_XGBoost/       /models/Mediapipe_XGBoost/
COPY CNN_Autoencoder_LightGBM/ /models/CNN_Autoencoder_LightGBM/
COPY CNN_PreTrained/           /models/CNN_PreTrained/

# ── Runtime environment ───────────────────────────────────────────────────────
# PORT=7860 is the Hugging Face Spaces default; override with -e PORT=xxxx if needed.
ENV WEIGHTS_DIR=/models \
    PORT=7860 \
    KERAS_BACKEND=tensorflow \
    TF_CPP_MIN_LOG_LEVEL=3 \
    CUDA_VISIBLE_DEVICES="" \
    TF_ENABLE_ONEDNN_OPTS=0 \
    OMP_NUM_THREADS=4 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 7860

# ── Health-check ──────────────────────────────────────────────────────────────
# Wait up to 3 minutes for models to load before marking the container healthy.
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT}/health', timeout=5)"

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
