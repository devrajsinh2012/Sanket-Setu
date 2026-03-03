# SanketSetu

A real-time sign language recognition system using machine learning and computer vision.

## Overview

SanketSetu is an intelligent sign language interpretation system that provides real-time recognition and translation of sign language gestures using advanced machine learning models and MediaPipe hand tracking.

## Project Structure

```
├── backend/              # FastAPI backend server
│   ├── app/             # Main application code
│   │   ├── inference/   # ML inference pipelines
│   │   └── models/      # Model loading and management
│   └── tests/           # Backend tests
├── frontend/            # React + TypeScript frontend
│   └── src/
│       ├── components/  # React components
│       ├── hooks/       # Custom React hooks
│       └── lib/         # Utility libraries
├── CNN_Autoencoder_LightGBM/  # CNN Autoencoder + LightGBM model
├── CNN_PreTrained/              # CNN + SVM model
└── Mediapipe_XGBoost/          # MediaPipe + XGBoost model
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

## Docker

Build and run using Docker:

```bash
docker build -t sanketsetu .
docker run -p 8000:8000 sanketsetu
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
