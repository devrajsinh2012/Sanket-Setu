"""
SanketSetu FastAPI backend — entry point.

Endpoints
---------
GET  /health                    → HealthResponse
WS   /ws/landmarks              → real-time sign recognition (landmark stream)
WS   /ws/image                  → image-based sign recognition (Pipeline C)
POST /api/predict               → REST fallback for landmark inference
POST /api/predict/image         → REST fallback for image inference
"""
from __future__ import annotations

import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

# Load .env if present (before config is imported so env vars are available)
try:
    from dotenv import load_dotenv
    _env_file = Path(__file__).resolve().parent.parent / ".env"
    if _env_file.exists():
        load_dotenv(_env_file)
except ImportError:
    pass  # python-dotenv not installed; rely on shell env

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app import config
from app.models.loader import load_models, get_model_store
from app.schemas import (
    LandmarkMessage,
    ImageMessage,
    EnsembleMessage,
    PredictionResponse,
    HealthResponse,
    ErrorResponse,
)
import app.inference.ensemble as ensemble

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger("sanketsetu")

# Silence noisy TF / Keras output
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("KERAS_BACKEND", "tensorflow")
logging.getLogger("tensorflow").setLevel(logging.ERROR)
logging.getLogger("keras").setLevel(logging.ERROR)


# ---------------------------------------------------------------------------
# Lifespan — load models on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SanketSetu backend …")
    load_models()
    logger.info("Models ready. Server accepting connections.")
    yield
    logger.info("Shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SanketSetu API",
    description="Real-time Gujarati Sign Language recognition backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve React frontend static files (if built into /app/static) ────────────
_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if _STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_STATIC_DIR / "assets")), name="assets")


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(error="Internal server error", detail=str(exc)).model_dump(),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run_ensemble(
    landmarks: list[float],
    image_b64: str | None = None,
    model_mode: str | None = None,
) -> PredictionResponse:
    store = get_model_store()
    effective_mode = _resolve_pipeline_mode(model_mode)
    result = ensemble.run(
        landmarks,
        image_input=image_b64,
        xgb_model=store.xgb_model,
        encoder_model=store.encoder_model,
        lgbm_model=store.lgbm_model,
        cnn_model=store.cnn_model,
        svm_model=store.svm_model,
        pipeline_mode=effective_mode,
        confidence_threshold=config.CONFIDENCE_THRESHOLD,
        secondary_threshold=config.SECONDARY_THRESHOLD,
    )
    return PredictionResponse(
        sign=result.sign,
        confidence=result.confidence,
        pipeline=result.pipeline,
        label_index=result.label_index,
        probabilities=result.probabilities,
        latency_ms=result.latency_ms,
    )


def _available_pipelines() -> list[str]:
    try:
        store = get_model_store()
    except RuntimeError:
        return []
    pipelines = []
    if store.xgb_model is not None:
        pipelines.append("A")
    if store.encoder_model is not None and store.lgbm_model is not None:
        pipelines.append("B")
    if store.cnn_model is not None and store.svm_model is not None:
        pipelines.append("C")
    return pipelines


def _resolve_pipeline_mode(requested_mode: str | None) -> str:
    """
    Resolve a per-request pipeline mode safely.
    Falls back to configured default when requested mode is unavailable.
    """
    default_mode = config.PIPELINE_MODE
    if requested_mode is None:
        return default_mode

    available = set(_available_pipelines())
    if requested_mode == "ensemble":
        return "ensemble"
    if requested_mode in available:
        return requested_mode

    logger.warning(
        "Requested mode '%s' is unavailable. Falling back to '%s'. Available: %s",
        requested_mode,
        default_mode,
        sorted(available),
    )
    return default_mode


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/", include_in_schema=False)
@app.get("/index.html", include_in_schema=False)
async def serve_frontend():
    """Serve the React SPA index for the root and any unknown path."""
    index = _STATIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(str(index), media_type="text/html")
    # Fallback: redirect to API docs if frontend not bundled
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")


@app.get("/health", response_model=HealthResponse)
async def health():
    try:
        store = get_model_store()
        loaded = store.loaded
    except RuntimeError:
        loaded = False
    return HealthResponse(
        status="ok" if loaded else "loading",
        models_loaded=loaded,
        pipelines_available=_available_pipelines(),
    )


@app.post("/api/predict", response_model=PredictionResponse)
async def predict_landmarks(body: LandmarkMessage):
    """REST fallback: send 63 landmark floats, receive prediction."""
    return _run_ensemble(
        body.landmarks,
        image_b64=body.image_b64,
        model_mode=body.model_mode,
    )


@app.post("/api/predict/image", response_model=PredictionResponse)
async def predict_image(body: ImageMessage):
    """REST fallback: send a base-64 hand crop, receive prediction via Pipeline C."""
    store = get_model_store()
    if store.cnn_model is None or store.svm_model is None:
        raise HTTPException(status_code=503, detail="Pipeline C (CNN+SVM) is not available.")
    import app.inference.pipeline_c as _pc
    result = _pc.predict(body.image_b64, store.cnn_model, store.svm_model)
    return PredictionResponse(
        sign=result.sign,
        confidence=result.confidence,
        pipeline=result.pipeline,
        label_index=result.label_index,
        probabilities=result.probabilities,
        latency_ms=result.latency_ms,
    )


# ---------------------------------------------------------------------------
# WebSocket — landmark stream  /ws/landmarks
# ---------------------------------------------------------------------------

@app.websocket("/ws/landmarks")
async def ws_landmarks(ws: WebSocket):
    """
    Primary real-time endpoint.
    Client sends: {"landmarks": [...63 floats...], "session_id": "..."}
    Server replies: PredictionResponse JSON
    """
    await ws.accept()
    session_id = "unknown"
    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
                msg  = LandmarkMessage(**data)
                session_id = msg.session_id

                response = _run_ensemble(
                    msg.landmarks,
                    image_b64=msg.image_b64,
                    model_mode=msg.model_mode,
                )
                await ws.send_text(response.model_dump_json())

            except ValueError as ve:
                await ws.send_text(
                    ErrorResponse(error="Validation error", detail=str(ve)).model_dump_json()
                )
            except Exception as e:
                logger.error("[%s] Inference error: %s", session_id, e, exc_info=True)
                await ws.send_text(
                    ErrorResponse(error="Inference failed", detail=str(e)).model_dump_json()
                )

    except WebSocketDisconnect:
        logger.info("Client disconnected: %s", session_id)


# ---------------------------------------------------------------------------
# WebSocket — image stream  /ws/image  (Pipeline C)
# ---------------------------------------------------------------------------

@app.websocket("/ws/image")
async def ws_image(ws: WebSocket):
    """
    Image-based endpoint for Pipeline C (CNN+SVM).
    Client sends: {"image_b64": "<base64 JPEG>", "session_id": "..."}
    """
    await ws.accept()
    session_id = "unknown"
    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
                msg  = ImageMessage(**data)
                session_id = msg.session_id

                store = get_model_store()
                if store.cnn_model is None or store.svm_model is None:
                    await ws.send_text(
                        ErrorResponse(error="Pipeline C not available").model_dump_json()
                    )
                    continue

                import app.inference.pipeline_c as _pc
                result = _pc.predict(msg.image_b64, store.cnn_model, store.svm_model)
                response = PredictionResponse(
                    sign=result.sign,
                    confidence=result.confidence,
                    pipeline=result.pipeline,
                    label_index=result.label_index,
                    probabilities=result.probabilities,
                    latency_ms=result.latency_ms,
                )
                await ws.send_text(response.model_dump_json())

            except Exception as e:
                logger.error("[%s] Image inference error: %s", session_id, e, exc_info=True)
                await ws.send_text(
                    ErrorResponse(error="Inference failed", detail=str(e)).model_dump_json()
                )

    except WebSocketDisconnect:
        logger.info("Image client disconnected: %s", session_id)


# ---------------------------------------------------------------------------
# SPA catch-all — must be LAST so it doesn't shadow API routes
# ---------------------------------------------------------------------------
@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    """Return index.html for any unknown path so React Router handles routing."""
    index = _STATIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(str(index), media_type="text/html")
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")
