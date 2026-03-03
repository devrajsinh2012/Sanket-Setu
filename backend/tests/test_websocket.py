"""
tests/test_websocket.py — WebSocket integration tests using FastAPI TestClient.

These tests use httpx + anyio to exercise the full WebSocket round-trip without
a running server.  Models are loaded via the lifespan context, so model fixtures
are NOT used here — the app loads models itself.

Skip the entire module when the model files are absent (CI).
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

# Skip module if any model file is missing
from app import config as _cfg

_REQUIRED = [
    _cfg.PIPELINE_A_MODEL,
    _cfg.PIPELINE_B_AE,
    _cfg.PIPELINE_B_LGBM,
    _cfg.PIPELINE_C_CNN,
    _cfg.PIPELINE_C_SVM,
]

for _p in _REQUIRED:
    if not Path(_p).exists():
        pytest.skip(f"Model file not found: {_p}", allow_module_level=True)

# heavy imports only after the skip guard
from fastapi.testclient import TestClient    # noqa: E402
from app.main import app                     # noqa: E402

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

ZEROS_63 = [0.0] * 63


class TestHealthEndpoint:
    def test_health_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["models_loaded"] is True
        assert set(body["pipelines_available"]) >= {"A", "B", "C"}


class TestRestPredict:
    def test_predict_zeros(self, client):
        r = client.post(
            "/api/predict",
            json={"landmarks": ZEROS_63, "session_id": "test"},
        )
        assert r.status_code == 200
        body = r.json()
        assert "sign"        in body
        assert "confidence"  in body
        assert "pipeline"    in body
        assert "label_index" in body
        assert 0.0 <= body["confidence"] <= 1.0
        assert 0   <= body["label_index"] <= 33

    def test_predict_wrong_length(self, client):
        r = client.post(
            "/api/predict",
            json={"landmarks": [0.0] * 62, "session_id": "bad"},
        )
        assert r.status_code == 422   # FastAPI validation error

    def test_predict_random(self, client):
        landmarks = [float(i % 11) / 10.0 for i in range(63)]
        r = client.post(
            "/api/predict",
            json={"landmarks": landmarks, "session_id": "rand"},
        )
        assert r.status_code == 200


class TestWebSocketLandmarks:
    def test_ws_single_message(self, client):
        with client.websocket_connect("/ws/landmarks") as ws:
            ws.send_json({"landmarks": ZEROS_63, "session_id": "ws-test"})
            data = ws.receive_json()
            assert "sign"       in data
            assert "confidence" in data
            assert "pipeline"   in data
            assert 0.0 <= data["confidence"] <= 1.0

    def test_ws_multiple_messages(self, client):
        with client.websocket_connect("/ws/landmarks") as ws:
            for _ in range(3):
                ws.send_json({"landmarks": ZEROS_63, "session_id": "ws-multi"})
                data = ws.receive_json()
                assert "sign" in data

    def test_ws_invalid_message_returns_error(self, client):
        """Sending malformed JSON should return an error frame, not crash."""
        with client.websocket_connect("/ws/landmarks") as ws:
            ws.send_text("not-json")
            data = ws.receive_json()
            assert "error" in data or data.get("status") == "error"
