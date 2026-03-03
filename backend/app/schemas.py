"""
Pydantic request / response schemas for SanketSetu backend.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------

class LandmarkMessage(BaseModel):
    """
    Payload sent by the client over /ws/landmarks or POST /api/predict.
    'landmarks' is a flat list of [x0,y0,z0, x1,y1,z1, ..., x20,y20,z20]
    extracted by MediaPipe Hands on the browser side.
    """
    landmarks: List[float] = Field(..., min_length=63, max_length=63)
    session_id: str = Field(default="default")

    @field_validator("landmarks")
    @classmethod
    def must_be_63_floats(cls, v: List[float]) -> List[float]:
        if len(v) != 63:
            raise ValueError(f"landmarks must contain exactly 63 values, got {len(v)}")
        return v


class ImageMessage(BaseModel):
    """
    Payload sent when Pipeline C (CNN+SVM) is invoked via /ws/image.
    'image_b64' is a base-64 encoded JPEG of the cropped hand region (128×128).
    """
    image_b64: str = Field(..., description="Base-64 encoded JPEG of the hand crop (128×128 px)")
    session_id: str = Field(default="default")


class EnsembleMessage(BaseModel):
    """
    Combined payload: landmarks + optional image for the full ensemble pipeline.
    """
    landmarks: List[float] = Field(..., min_length=63, max_length=63)
    image_b64: Optional[str] = Field(default=None)
    session_id: str = Field(default="default")


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------

class PredictionResponse(BaseModel):
    sign: str = Field(..., description="Gujarati sign character(s)")
    confidence: float = Field(..., ge=0.0, le=1.0)
    pipeline: str = Field(..., description="Which pipeline(s) produced this result: A, B, C, or ensemble")
    label_index: int = Field(..., ge=0, le=33)
    probabilities: Optional[List[float]] = Field(
        default=None,
        description="Full 34-class probability vector (optional, increases payload size)"
    )
    latency_ms: Optional[float] = Field(default=None, description="Server-side inference latency in ms")


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    pipelines_available: List[str]


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
