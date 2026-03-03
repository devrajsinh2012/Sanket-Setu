# SanketSetu — Execution TODO & Implementation Tracker

## Model Analysis (Reviewed 2026-03-02)

All 5 model files inspected. Three distinct inference pipelines exist:

| Pipeline | Files | Input | Process | Output |
|---|---|---|---|---|
| **A — Primary (Fastest)** | `Mediapipe_XGBoost/model.pkl` | 63 MediaPipe coords (21 landmarks × x,y,z) | XGBClassifier (50 trees) | 34-class probability |
| **B — Autoencoder + LGBM** | `CNN_Autoencoder_LightGBM/autoencoder_model.pkl` + `lgbm_model.pkl` | 63 MediaPipe coords | Encoder (63→32→**16** bottleneck) + LGBMClassifier | 34-class probability |
| **C — Vision CNN + SVM** | `CNN_PreTrained/cnn_model.pkl` + `svm_model.pkl` | 128×128×3 RGB image | ResNet50-based CNN (179 layers) → 256 features + SVC(C=10) | 34-class probability w/ probability=True |

### Key Architecture Facts
- **34 classes** (Gujarati Sign Language alphabet + digits, labels 0–33)
- **Pipeline A** input: 63 floats — directly from MediaPipe `hand_landmarks` (x, y, z per landmark, flattened)
- **Pipeline B** input: same 63 floats → takes only the encoder half (first 3 Dense layers, output of `dense_1` layer = 16 features) 
- **Pipeline C** input: 128×128 BGR/RGB cropped hand image, normalized to [0,1]
- All `.pth` files are identical copies of the `.pkl` files (same objects, different extension)
- Model quality strategy: A is primary (sub-ms); if confidence < threshold, query B or C for ensemble

---

## Project Folder Structure to Create

```
SanketSetu/
├── backend/                    ← FastAPI server
│   ├── app/
│   │   ├── main.py             ← FastAPI entry, WebSocket + REST
│   │   ├── models/
│   │   │   ├── loader.py       ← Singleton model loader
│   │   │   └── label_map.py    ← 0–33 → Gujarati sign name mapping
│   │   ├── inference/
│   │   │   ├── pipeline_a.py   ← XGBoost inference (63 landmarks)
│   │   │   ├── pipeline_b.py   ← Autoencoder encoder + LightGBM
│   │   │   ├── pipeline_c.py   ← ResNet CNN + SVM (image-based)
│   │   │   └── ensemble.py     ← Confidence-weighted ensemble logic
│   │   ├── schemas.py          ← Pydantic request/response models
│   │   └── config.py           ← Settings (confidence threshold, etc.)
│   ├── weights/                ← Symlink or copy of model pkl files
│   ├── requirements.txt
│   ├── Dockerfile
│   └── fly.toml
│
├── frontend/                   ← Vite + React + TS
│   ├── src/
│   │   ├── components/
│   │   │   ├── WebcamFeed.tsx       ← Webcam + canvas landmark overlay
│   │   │   ├── LandmarkCanvas.tsx   ← Draws 21 hand points + connections
│   │   │   ├── PredictionHUD.tsx    ← Live sign, confidence bar, history
│   │   │   ├── OnboardingGuide.tsx  ← Animated intro wizard
│   │   │   └── Calibration.tsx      ← Lighting/distance check UI
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts      ← WS connection, send/receive
│   │   │   ├── useMediaPipe.ts      ← MediaPipe Hands JS integration
│   │   │   └── useWebcam.ts         ← Camera permissions + stream
│   │   ├── lib/
│   │   │   └── landmarkUtils.ts     ← Landmark normalization (mirror XGBoost preprocessing)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── package.json
│
├── CNN_Autoencoder_LightGBM/   ← (existing)
├── CNN_PreTrained/             ← (existing)
├── Mediapipe_XGBoost/          ← (existing)
└── .github/
    └── workflows/
        ├── deploy-backend.yml
        └── deploy-frontend.yml
```

---

## Phase 1 — Backend Core (FastAPI + Model Integration)

### 1.1 Project Bootstrap
- [x] Create `backend/` folder and `app/` package structure
- [x] Create `backend/requirements.txt` with: `fastapi`, `uvicorn[standard]`, `websockets`, `xgboost`, `lightgbm`, `scikit-learn`, `keras==3.13.2`, `tensorflow-cpu`, `numpy`, `opencv-python-headless`, `pillow`, `python-dotenv`
- [x] Create `backend/app/config.py` — confidence threshold (default 0.7), WebSocket max connections, pipeline mode (A/B/C/ensemble)
- [x] Create `backend/app/models/label_map.py` — map class indices 0–33 to Gujarati sign names

### 1.2 Model Loader (Singleton)
- [x] Create `backend/app/models/loader.py`
  - Load `model.pkl` (XGBoost) at startup
  - Load `autoencoder_model.pkl` (extract encoder layers only: input → dense → dense_1) and `lgbm_model.pkl`
  - Load `cnn_model.pkl` (full ResNet50 feature extractor, strip any classification head) and `svm_model.pkl`
  - Expose `ModelStore` singleton accessed via `get_model_store()` dependency
  - Log load times for each model

### 1.3 Pipeline A — XGBoost (Primary, Landmarks)
- [x] Create `backend/app/inference/pipeline_a.py`
  - Input: `List[float]` of length 63 (x,y,z per landmark, already normalized by MediaPipe)
  - Output: `{"sign": str, "confidence": float, "probabilities": List[float]}`
  - Use `model.predict_proba(np.array(landmarks).reshape(1,-1))[0]`
  - Return `classes_[argmax]` and `max(probabilities)` as confidence

### 1.4 Pipeline B — Autoencoder Encoder + LightGBM
- [x] Create `backend/app/inference/pipeline_b.py`
  - Build encoder-only submodel: `encoder = keras.Model(inputs=model.input, outputs=model.layers[2].output)` (output of `dense_1`, the 16-D bottleneck)
  - Input: 63 MediaPipe coords
  - Encode: `features = encoder.predict(np.array(landmarks).reshape(1,-1))[0]`  → shape (16,)
  - Classify: `lgbm.predict_proba(features.reshape(1,-1))[0]`

### 1.5 Pipeline C — CNN + SVM (Image-based)
- [x] Create `backend/app/inference/pipeline_c.py`
  - Input: base64-encoded JPEG or raw bytes of the cropped hand region (128×128 px)
  - Decode → numpy array (128,128,3) uint8 → normalize to float32 [0,1]
  - `features = cnn_model.predict(img[np.newaxis])[0]`  → shape (256,)
  - `proba = svm.predict_proba(features.reshape(1,-1))[0]`
  - Note: CNN inference is slower (~50–200ms on CPU); only call when Pipeline A confidence < threshold

### 1.6 Ensemble Logic
- [x] Create `backend/app/inference/ensemble.py`
  - Call Pipeline A first
  - If `confidence < config.THRESHOLD` (default 0.7), call Pipeline B
  - If still below threshold and image data available, call Pipeline C
  - Final result: weighted average of probabilities from each pipeline that was called
  - Return the top predicted class and ensemble confidence score

### 1.7 WebSocket Handler
- [x] Create `backend/app/main.py` with FastAPI app
- [x] Implement `GET /health` — returns `{"status": "ok", "models_loaded": true}`
- [x] Implement `WS /ws/landmarks` — primary endpoint
  - Client sends JSON: `{"landmarks": [63 floats], "session_id": "..."}`
  - Server responds: `{"sign": "...", "confidence": 0.95, "pipeline": "A", "label_index": 12}`
  - Handle disconnect gracefully
- [x] Implement `WS /ws/image` — optional image-based endpoint for Pipeline C
  - Client sends JSON: `{"image_b64": "...", "session_id": "..."}`
- [x] Implement `POST /api/predict` — REST fallback for non-WS clients
  - Body: `{"landmarks": [63 floats]}`
  - Returns same response schema as WS

### 1.8 Schemas & Validation
- [x] Create `backend/app/schemas.py`
  - `LandmarkMessage(BaseModel)`: `landmarks: List[float]` (must be length 63), `session_id: str`
  - `ImageMessage(BaseModel)`: `image_b64: str`, `session_id: str`
  - `PredictionResponse(BaseModel)`: `sign: str`, `confidence: float`, `pipeline: str`, `label_index: int`, `probabilities: Optional[List[float]]`

### 1.9 CORS & Middleware
- [x] Configure CORS for Vercel frontend domain + localhost:5173
- [x] Add request logging middleware (log session_id, pipeline used, latency ms)
- [x] Add global exception handler returning proper JSON errors

---

## Phase 2 — Frontend (React + Vite + Tailwind + Framer Motion)

### 2.1 Project Bootstrap
- [x] Run `npm create vite@latest frontend -- --template react-ts` inside `SanketSetu/`
- [x] Install deps: `tailwindcss`, `framer-motion`, `lucide-react`, `@mediapipe/tasks-vision`
- [x] Configure Tailwind with custom palette (dark neon-cyan glassmorphism theme)
- [x] Set up `vite.config.ts` proxy: `/api` → backend URL, `/ws` → backend WS URL

### 2.2 Webcam Hook (`useWebcam.ts`)
- [x] Request `getUserMedia({ video: { width: 1280, height: 720 } })`
- [x] Expose `videoRef`, `isReady`, `error`, `switchCamera()` (for mobile front/back toggle)
- [x] Handle permission denied state with instructional UI

### 2.3 MediaPipe Hook (`useMediaPipe.ts`)
- [x] Initialize `HandLandmarker` from `@mediapipe/tasks-vision` (WASM backend)
- [x] Process video frames at target 30fps using `requestAnimationFrame`
- [x] Extract `landmarks[0]` (first hand) → flatten to 63 floats `[x0,y0,z0, x1,y1,z1, ...]`
- [x] Normalize: subtract wrist (landmark 0) position to make translation-invariant — **must match training preprocessing**
- [x] Expose `landmarks: number[] | null`, `handedness: string`, `isDetecting: boolean`

### 2.4 WebSocket Hook (`useWebSocket.ts`)
- [x] Connect to `wss://backend-url/ws/landmarks` on mount
- [x] Auto-reconnect with exponential backoff on disconnect
- [x] `sendLandmarks(landmarks: number[])` — throttled to max 15 sends/sec
- [x] Expose `lastPrediction: PredictionResponse | null`, `isConnected: boolean`, `latency: number`

### 2.5 Landmark Canvas (`LandmarkCanvas.tsx`)
- [x] Overlay `<canvas>` on top of `<video>` with `position: absolute`
- [x] Draw 21 hand landmark dots (cyan glow: `shadowBlur`, `shadowColor`)
- [x] Draw 21 bone connections following MediaPipe hand topology (finger segments)
- [x] On successful prediction: animate landmarks to pulse/glow with Framer Motion spring
- [x] Use `requestAnimationFrame` for smooth 60fps rendering

### 2.6 Prediction HUD (`PredictionHUD.tsx`)
- [x] Glassmorphism card: `backdrop-blur`, `bg-white/10`, `border-white/20`
- [x] Large Gujarati sign name (mapped from label index)
- [x] Confidence bar: animated width transition via Framer Motion `animate={{ width: confidence% }}`
- [x] Color coding: green (>85%), yellow (60–85%), red (<60%)
- [x] Rolling history list: last 10 recognized signs (Framer Motion `AnimatePresence` for enter/exit)
- [x] Pipeline badge: shows which pipeline (A/B/C) produced the result
- [x] Latency display: shows WS round-trip time in ms

### 2.7 Onboarding Guide (`OnboardingGuide.tsx`)
- [x] 3-step animated wizard using Framer Motion page transitions
  1. "Position your hand 30–60cm from camera"
  2. "Ensure good lighting, avoid dark backgrounds"
  3. "Show signs clearly — palm facing camera"
- [x] Skip button + "Don't show again" (localStorage)

### 2.8 Calibration Screen (`Calibration.tsx`)
- [x] Brief 2-second "Ready?" screen after onboarding
- [x] Check: hand detected by MediaPipe → show green checkmark animation
- [x] Auto-transitions to main translation view when hand is stable for 1 second

### 2.9 Main App Layout (`App.tsx`)
- [x] Full-screen dark background with subtle animated gradient
- [x] Three-panel layout (desktop): webcam | HUD | history
- [x] Mobile: stacked layout with webcam top, HUD bottom
- [x] Header: "SanketSetu | સંકેત-સેતુ" with glowing text effect
- [x] Settings gear icon → modal for pipeline selection (A / B / C / Ensemble), confidence threshold slider

---

## Phase 3 — Dockerization & Deployment

### 3.1 Backend Dockerfile
- [x] Create `Dockerfile` (repo root, build context includes models)
- [x] Add `.dockerignore` (excludes `.venv`, `node_modules`, `*.pth`, tests)
- [ ] Test locally: `docker build -t sanketsetu-backend . && docker run -p 8000:8000 sanketsetu-backend`

### 3.2 Fly.io Configuration
- [x] Create `fly.toml` (repo root, region=maa, port 8000, shared-cpu-2x)
- [x] Note: Keras/TF will increase Docker image size — use `tensorflow-cpu` to keep slim
- [ ] Set secrets via `flyctl secrets set` for any API keys
- [ ] Run: `flyctl deploy --dockerfile Dockerfile`

### 3.3 Vercel Frontend Deployment
- [x] Create `frontend/vercel.json` with SPA rewrite + WASM Content-Type header
- [x] Add `VITE_WS_URL` and `VITE_API_URL` to Vercel environment variables (via CI vars)
- [ ] Ensure `@mediapipe/tasks-vision` WASM files are served correctly (add to `public/`)

### 3.4 GitHub Actions CI/CD
- [x] Create `.github/workflows/deploy-backend.yml`
  - Triggers on push to `main` when `backend/**` changes
  - Steps: checkout → setup Python → run tests → `flyctl deploy`
- [x] Create `.github/workflows/deploy-frontend.yml`
  - Triggers on push to `main` when `frontend/**` changes
  - Steps: checkout → `npm ci` → tsc → `npm run build` → Vercel CLI deploy

---

## Phase 4 — Testing & Hardening

### 4.1 Backend Tests
- [x] `tests/test_pipeline_a.py` — 8 unit tests, XGBoost inference (4s)
- [x] `tests/test_pipeline_b.py` — 6 unit tests, encoder + LightGBM (49s)
- [x] `tests/test_pipeline_c.py` — 7 unit tests, CNN + SVM with real 128×128 images (14s)
- [x] `tests/test_websocket.py` — 7 integration tests, health + REST + WS round-trip

### 4.2 Frontend Error Handling
- [ ] No-camera fallback UI (file upload for image mode)
- [x] WS reconnecting banner (red banner when `!isConnected && stage === 'running'`)
- [x] Low-bandwidth mode: reduce send rate to 5fps if latency > 500ms + yellow "LB" badge in HUD
- [x] MediaPipe WASM load failure fallback message (shown in header via `mpError`)

### 4.3 Label Map (Critical)
- [ ] Create `backend/app/models/label_map.py` mapping classes 0–33 to actual Gujarati signs
  - You need to confirm the exact mapping used during training (check your original dataset/notebook)
  - Placeholder: `LABEL_MAP = { 0: "ક", 1: "ખ", ... , 33: "?" }`
  - This file must exactly mirror what was used in training

---

## Execution Order (Start Here)

```
Week 1: Phase 1.1 → 1.3 → 1.7 (get WS working with Pipeline A alone, test in browser)
Week 2: Phase 1.4 → 1.5 → 1.6 (add other pipelines + ensemble)
Week 3: Phase 2.1 → 2.2 → 2.3 → 2.4 (React skeleton + WS connected)
Week 4: Phase 2.5 → 2.6 → 2.7 → 2.8 → 2.9 (full UI)
Week 5: Phase 3 + 4 (deploy + tests)
```

---

## Critical Decision Points

| Decision | Default | Notes |
|---|---|---|
| Primary pipeline | **A (XGBoost)** | Sub-ms inference, uses MediaPipe landmarks already extracted client-side |
| Confidence threshold for fallback | **0.70** | Tune after testing - if XGBoost < 70%, call Pipeline B |
| Enable Pipeline C (CNN) | **Optional / off by default** | Adds ~150ms latency and requires image upload, not just landmarks |
| MediaPipe model variant | **lite** | Use `hand_landmarker_lite.task` for mobile performance |
| WebSocket frame rate | **15fps** | Sufficient for sign recognition, avoids server overload |
| Gujarati label map | **CONFIRM WITH DATASET** | Classes 0–33 must match training data exactly |
