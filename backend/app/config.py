"""
Application-wide settings for SanketSetu backend.
Override any value by setting the corresponding environment variable.
"""
from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# TensorFlow / Keras startup optimisations
# Set these BEFORE any import that might pull in tensorflow.
# ---------------------------------------------------------------------------
os.environ.setdefault("KERAS_BACKEND",          "tensorflow")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL",   "3")          # silence C++ TF logs
os.environ.setdefault("CUDA_VISIBLE_DEVICES",   "")           # CPU-only: skip GPU scan
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS",  "0")          # disable oneDNN init check
os.environ.setdefault("OMP_NUM_THREADS",        "4")          # cap CPU thread pool

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # repo root
WEIGHTS_DIR = os.getenv("WEIGHTS_DIR", str(BASE_DIR))

# Individual model paths (relative to repo root)
PIPELINE_A_MODEL   = os.path.join(WEIGHTS_DIR, "Mediapipe_XGBoost",       "model.pkl")
PIPELINE_B_AE      = os.path.join(WEIGHTS_DIR, "CNN_Autoencoder_LightGBM", "autoencoder_model.pkl")
PIPELINE_B_LGBM    = os.path.join(WEIGHTS_DIR, "CNN_Autoencoder_LightGBM", "lgbm_model.pkl")
PIPELINE_C_CNN     = os.path.join(WEIGHTS_DIR, "CNN_PreTrained",            "cnn_model.pkl")
PIPELINE_C_SVM     = os.path.join(WEIGHTS_DIR, "CNN_PreTrained",            "svm_model.pkl")

# ---------------------------------------------------------------------------
# Inference thresholds
# ---------------------------------------------------------------------------
# If Pipeline A confidence falls below this, Pipeline B is also called.
CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.70"))

# If ensemble after B still below this, Pipeline C is attempted (if image provided).
SECONDARY_THRESHOLD: float = float(os.getenv("SECONDARY_THRESHOLD", "0.60"))

# ---------------------------------------------------------------------------
# Pipeline mode
# ---------------------------------------------------------------------------
# "A"        → only XGBoost (fastest)
# "B"        → only Autoencoder + LGBM
# "C"        → only CNN + SVM (image required)
# "ensemble" → A first, fallback to B, then C
PIPELINE_MODE: str = os.getenv("PIPELINE_MODE", "ensemble")

# ---------------------------------------------------------------------------
# WebSocket / server
# ---------------------------------------------------------------------------
MAX_WS_CONNECTIONS: int = int(os.getenv("MAX_WS_CONNECTIONS", "100"))
WS_SEND_RATE_LIMIT: int = int(os.getenv("WS_SEND_RATE_LIMIT", "15"))  # max frames/sec per client

# Allowed CORS origins (comma-separated list in env var)
# Default includes Vercel frontend and the Hugging Face Space URL.
# Replace YOUR_HF_USERNAME and YOUR_SPACE_NAME with your actual HF values.
_cors_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,"
    "https://sanketsetu.vercel.app,"
    "https://devrajsinh2012-sanket-setu.hf.space",
)
CORS_ORIGINS: list[str] = [o.strip() for o in _cors_env.split(",") if o.strip()]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
