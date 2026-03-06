---
title: SanketSetu Backend
emoji: 🤟
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
short_description: Real-time Gujarati Sign Language recognition API
---

# SanketSetu

A real-time sign language recognition system using machine learning and computer vision.

## Project Structure

```
Γö£ΓöÇΓöÇ backend/              # FastAPI backend server
Γöé   Γö£ΓöÇΓöÇ app/             # Main application code
Γöé   Γöé   Γö£ΓöÇΓöÇ inference/   # ML inference pipelines
Γöé   Γöé   ΓööΓöÇΓöÇ models/      # Model loading and management
Γöé   ΓööΓöÇΓöÇ tests/           # Backend tests
Γö£ΓöÇΓöÇ frontend/            # React + TypeScript frontend
Γöé   ΓööΓöÇΓöÇ src/
Γöé       Γö£ΓöÇΓöÇ components/  # React components
Γöé       Γö£ΓöÇΓöÇ hooks/       # Custom React hooks
Γöé       ΓööΓöÇΓöÇ lib/         # Utility libraries
Γö£ΓöÇΓöÇ CNN_Autoencoder_LightGBM/  # CNN Autoencoder + LightGBM model
Γö£ΓöÇΓöÇ CNN_PreTrained/              # CNN + SVM model
ΓööΓöÇΓöÇ Mediapipe_XGBoost/          # MediaPipe + XGBoost model
```

## Features

- Real-time sign language gesture recognition
- Multiple ML model ensemble approach
- WebSocket-based real-time communication
- MediaPipe hand landmark tracking
- Interactive webcam feed with visual feedback
- Prediction confidence display

## Tech Stack

### Backend
- FastAPI
- Python 3.x
- PyTorch
- LightGBM
- XGBoost
- MediaPipe

### Frontend
- React
- TypeScript
- Vite
- TailwindCSS

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python -m app.main
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Development

Run the development servers:

```bash
# Start both frontend and backend
.\start.ps1
```

## Deployment

### Backend ΓÇö Hugging Face Spaces (Docker SDK)

The backend is deployed as a [Hugging Face Space](https://huggingface.co/spaces) using the Docker SDK.

**Steps to create a new Space and push:**

1. **Create the Space** on [huggingface.co/new-space](https://huggingface.co/new-space)
   - SDK: **Docker**
   - Visibility: Public (or Private)
   - Note your `username` and `space-name`

2. **Clone the Space repo and push your code:**
   ```bash
   # Add HF Space as a remote (from repo root)
   git remote add space https://huggingface.co/spaces/devrajsinh2012/Sanket-Setu

   git push space main
   ```
   HF Spaces will automatically build the Docker image and start the container.

3. **Set Space Secrets** (via HF Space ΓåÆ Settings ΓåÆ Repository secrets):
   | Secret | Example value |
   |--------|---------------|
   | `CORS_ORIGINS` | `https://sanketsetu.vercel.app,http://localhost:5173` |
   | `PIPELINE_MODE` | `ensemble` |
   | `CONFIDENCE_THRESHOLD` | `0.70` |

4. **Update the frontend** ΓÇö set the `VITE_WS_URL` Vercel environment variable:
   ```
   wss://devrajsinh2012-sanket-setu.hf.space
   ```
   In Vercel dashboard: **Settings ΓåÆ Environment Variables ΓåÆ VITE_WS_URL**

**Space URL format:**
- HTTPS API: `https://devrajsinh2012-sanket-setu.hf.space`
- WebSocket:  `wss://devrajsinh2012-sanket-setu.hf.space/ws/landmarks`
- Health:     `https://devrajsinh2012-sanket-setu.hf.space/health`

### Frontend ΓÇö Vercel

```bash
cd frontend
# deploy via Vercel CLI or connect the GitHub repo in Vercel dashboard
```

Set the `VITE_WS_URL` environment variable in Vercel to the HF Space WebSocket URL above.

## Docker (local)

Build and run using Docker locally:

```bash
docker build -t sanketsetu .
docker run -p 7860:7860 sanketsetu
```

## Testing

Run backend tests:

```bash
cd backend
pytest
```

## License

All rights reserved.

## Author

Devrajsinh Gohil (devrajsinh2012)
