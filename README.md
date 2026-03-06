<div align="center">

# 🤟 SanketSetu | સંકેત-સેતુ

**Real-time Gujarati Sign Language Recognition System**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://sanket-setu.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-HuggingFace%20Spaces-yellow?style=for-the-badge&logo=huggingface)](https://huggingface.co/spaces/devrajsinh2012/Sanket-Setu)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red?style=for-the-badge)](#license)

</div>

---

## 📖 About

**SanketSetu** (Sanskrit: *Sanket* = gesture/sign, *Setu* = bridge) is a production-grade, real-time **Gujarati Sign Language (GSL)** recognition system. It bridges the communication gap between the hearing-impaired community and the broader public by translating hand gestures corresponding to **34 Gujarati consonants** (ક–જ્ઞ) into text — all in real time, directly in the browser.

The system uses your device camera, processes hand landmarks locally via **MediaPipe**, and sends them over a **WebSocket** connection to a machine-learning backend that classifies the gesture using a **3-pipeline ensemble** of models.

---

## ✨ Features

- **Real-time gesture detection** — sub-100 ms end-to-end latency
- **3-pipeline ensemble inference** — XGBoost → Autoencoder+LightGBM → CNN+SVM, invoked in order of confidence
- **34 Gujarati sign classes** — complete consonant alphabet (ક, ખ, ગ … ક્ષ, જ્ઞ)
- **WebSocket streaming** — live bidirectional communication between browser and backend
- **MediaPipe hand tracking** — 21 landmark coordinates extracted client-side (no raw video sent to server)
- **Onboarding wizard** — animated step-by-step guide for first-time users
- **Calibration screen** — transparent overlay keeps camera feed fully visible while detecting hand readiness
- **Landmark canvas overlay** — live 21-point skeleton drawn over the webcam feed
- **Prediction HUD** — displays recognised sign, confidence bar, latency, and prediction history
- **Low-bandwidth mode** — auto-throttles to 5 fps when latency is high
- **Docker-ready backend** — deployable on Hugging Face Spaces in one push

---

## 🏗️ System Architecture

```
Browser (React + TypeScript)
│
├─ MediaPipe Hands (WASM)    ← extracts 21 hand landmarks (63 floats) locally
├─ WebcamFeed + LandmarkCanvas
├─ Calibration / Onboarding UI
│
└─ WebSocket (wss://)
        │
        ▼
FastAPI Backend (Python)
│
├─ Pipeline A — XGBoost (63 landmarks → 34 classes)        ← primary, fastest
│       └─ if confidence < 0.70 ↓
├─ Pipeline B — Autoencoder (63→16) + LightGBM             ← secondary
│       └─ if confidence < 0.60 ↓
└─ Pipeline C — ResNet50 CNN (128×128 image) + SVM         ← tertiary
        └─ Ensemble weighted average → final prediction
```

---

## 📁 Project Structure

```
SanketSetu/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry-point, WebSocket + REST
│   │   ├── config.py            # Settings (thresholds, model paths, env vars)
│   │   ├── schemas.py           # Pydantic request/response models
│   │   ├── inference/
│   │   │   ├── pipeline_a.py    # XGBoost inference (63 MediaPipe landmarks)
│   │   │   ├── pipeline_b.py    # Autoencoder encoder + LightGBM
│   │   │   ├── pipeline_c.py    # ResNet CNN + SVM (image-based)
│   │   │   └── ensemble.py      # Confidence-weighted ensemble logic
│   │   └── models/
│   │       ├── loader.py        # Singleton model loader
│   │       └── label_map.py     # Index 0–33 → Gujarati character
│   ├── tests/                   # Pytest test suite
│   ├── requirements.txt
│   └── requirements-dev.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # App shell, stage machine (onboarding → calibration → running)
│   │   ├── components/
│   │   │   ├── WebcamFeed.tsx       # Webcam stream + canvas overlay
│   │   │   ├── LandmarkCanvas.tsx   # Draws 21-point hand skeleton
│   │   │   ├── PredictionHUD.tsx    # Live sign, confidence bar, latency, history
│   │   │   ├── OnboardingGuide.tsx  # Animated intro wizard
│   │   │   └── Calibration.tsx      # Transparent hand-detection calibration card
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts      # WS connection, send/receive
│   │   │   ├── useMediaPipe.ts      # MediaPipe Hands JS integration
│   │   │   └── useWebcam.ts         # Camera permissions + stream
│   │   └── lib/
│   │       └── landmarkUtils.ts     # Landmark normalisation helpers
│   ├── .env.production          # VITE_WS_URL for Vercel build
│   ├── vite.config.ts
│   └── package.json
│
├── CNN_Autoencoder_LightGBM/    # Autoencoder + LightGBM model weights
├── CNN_PreTrained/              # ResNet CNN + SVM model weights
├── Mediapipe_XGBoost/           # XGBoost model weights
├── Dockerfile                   # Multi-stage Docker build for HF Spaces
└── start.ps1                    # One-command local dev launcher (Windows)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Framer Motion |
| **Hand Tracking** | MediaPipe Hands (browser WASM) |
| **Real-time Comm.** | WebSocket (native browser API) |
| **Backend** | FastAPI, Python 3.10+ |
| **ML — Pipeline A** | XGBoost (scikit-learn API) |
| **ML — Pipeline B** | Keras/TensorFlow Autoencoder + LightGBM |
| **ML — Pipeline C** | PyTorch ResNet50 CNN + scikit-learn SVM |
| **Deployment** | Hugging Face Spaces (Docker SDK) + Vercel |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### 1. Clone the repository

```bash
git clone https://github.com/devrajsinh2012/Sanket-Setu.git
cd Sanket-Setu
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
# Starts FastAPI server on http://localhost:8000
python -m app.main
```

### 3. Frontend Setup

```bash
cd frontend
npm install
# Starts Vite dev server on http://localhost:5173
npm run dev
```

### 4. One-Command Start (Windows)

```powershell
# From the repo root — starts both backend and frontend
.\start.ps1
```

---

## 🧪 Testing

```bash
cd backend
pytest tests/ -v
```

---

## 🐳 Docker (Local)

```bash
# Build the image
docker build -t sanketsetu .

# Run on port 7860 (matches HF Spaces)
docker run -p 7860:7860 sanketsetu
```

---

## ☁️ Deployment

### Backend — Hugging Face Spaces

The backend runs as a [Hugging Face Space](https://huggingface.co/spaces/devrajsinh2012/Sanket-Setu) using the **Docker SDK**.

**Push to the Space:**

```bash
# From repo root
git push space main
```

HF Spaces automatically builds the Docker image and serves the container on port 7860.

**Space Secrets** (HF Space → Settings → Repository secrets):

| Secret | Example value |
|--------|---------------|
| `CORS_ORIGINS` | `https://sanket-setu.vercel.app,http://localhost:5173` |
| `PIPELINE_MODE` | `ensemble` |
| `CONFIDENCE_THRESHOLD` | `0.70` |

**Live URLs:**

| Endpoint | URL |
|---|---|
| Health check | `https://devrajsinh2012-sanket-setu.hf.space/health` |
| WebSocket | `wss://devrajsinh2012-sanket-setu.hf.space/ws/landmarks` |

### Frontend — Vercel

Connect the GitHub repository in the [Vercel dashboard](https://vercel.com) and add the **Environment Variable**:

| Variable | Value |
|---|---|
| `VITE_WS_URL` | `wss://devrajsinh2012-sanket-setu.hf.space` |

Vercel auto-deploys on every push to `main`.

---

## 🔧 Environment Variables

| Variable | Scope | Default | Description |
|---|---|---|---|
| `VITE_WS_URL` | Frontend (build-time) | — | WebSocket URL of the backend |
| `CORS_ORIGINS` | Backend (runtime) | `*` | Comma-separated allowed origins |
| `PIPELINE_MODE` | Backend (runtime) | `ensemble` | `ensemble` / `A` / `B` / `C` |
| `CONFIDENCE_THRESHOLD` | Backend (runtime) | `0.70` | Primary confidence cutoff |
| `SECONDARY_THRESHOLD` | Backend (runtime) | `0.60` | Secondary confidence cutoff |
| `WEIGHTS_DIR` | Backend (runtime) | repo root | Override path to model weight files |

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change. Please make sure to update tests as appropriate.

---

## 👥 Team & Acknowledgements

This project was developed by:

| Name | Contribution |
|---|---|
| **Devrajsinh Gohil** | Full-stack development, ML integration, deployment |
| **Jay Nasit** | Machine learning models, dataset preparation, testing |

**Guided by:** Dr. Om Prakash Suthar

> We express our sincere gratitude to **Dr. Om Prakash Suthar** for his invaluable guidance, encouragement, and technical insights throughout the development of SanketSetu. His mentorship was instrumental in shaping both the research direction and the system architecture of this project.

---

## 📄 License

© 2026 Devrajsinh Gohil & Jay Nasit. All Rights Reserved.
