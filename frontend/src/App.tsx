import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Hand } from 'lucide-react'

import { useWebcam }    from './hooks/useWebcam'
import { useMediaPipe } from './hooks/useMediaPipe'
import { useWebSocket } from './hooks/useWebSocket'

import { WebcamFeed }      from './components/WebcamFeed'
import { PredictionHUD }   from './components/PredictionHUD'
import { OnboardingGuide } from './components/OnboardingGuide'
import { Calibration }     from './components/Calibration'
import { ModelSelector }   from './components/ModelSelector'
import type { ModelMode } from './types'

type AppStage = 'onboarding' | 'model-select' | 'calibration' | 'running'

function App() {
  // ── Stage management ─────────────────────────────────────────
  const showOnboarding = !localStorage.getItem('sanketsetu-onboarded')
  const [stage, setStage] = useState<AppStage>(showOnboarding ? 'onboarding' : 'model-select')
  const savedModel = localStorage.getItem('sanketsetu-model-mode') as ModelMode | null
  const [selectedModel, setSelectedModel] = useState<ModelMode>(savedModel ?? 'ensemble')
  const [availableModes, setAvailableModes] = useState<Set<ModelMode>>(new Set(['ensemble']))

  const handleOnboardingDone = () => {
    localStorage.setItem('sanketsetu-onboarded', '1')
    setStage('model-select')
  }

  const handleModelContinue = () => {
    localStorage.setItem('sanketsetu-model-mode', selectedModel)
    setStage('calibration')
  }

  useEffect(() => {
    let active = true
    const healthUrl = `${resolveBackendHttpBase()}/health`

    const loadAvailability = async () => {
      try {
        const res = await fetch(healthUrl)
        if (!res.ok) return
        const data = (await res.json()) as { pipelines_available?: string[] }
        if (!active) return

        const next = new Set<ModelMode>(['ensemble'])
        for (const mode of data.pipelines_available ?? []) {
          if (mode === 'A' || mode === 'B' || mode === 'C') {
            next.add(mode)
          }
        }
        setAvailableModes(next)
      } catch {
        // Keep local defaults when backend health is unavailable.
      }
    }

    loadAvailability()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (selectedModel !== 'ensemble' && !availableModes.has(selectedModel)) {
      setSelectedModel('ensemble')
    }
  }, [availableModes, selectedModel])

  // ── Webcam ───────────────────────────────────────────────────
  const { videoRef, isReady, error, facingMode, switchCamera } = useWebcam()

  // ── MediaPipe ────────────────────────────────────────────────
  const { landmarks, rawLandmarks, isLoading: mpLoading, error: mpError, startDetection, stopDetection } =
    useMediaPipe()

  useEffect(() => {
    if (isReady && videoRef.current && stage === 'running') {
      startDetection(videoRef.current)
    } else if (stage !== 'running') {
      stopDetection()
    }
  }, [isReady, stage, startDetection, stopDetection, videoRef])

  // Start detecting during calibration too (to detect hand)
  useEffect(() => {
    if (isReady && videoRef.current && stage === 'calibration') {
      startDetection(videoRef.current)
    }
  }, [isReady, stage, startDetection, videoRef])

  // ── WebSocket ────────────────────────────────────────────────
  const { lastPrediction, isConnected, latency, lowBandwidth, sendLandmarks } = useWebSocket()
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Send landmarks on every new frame
  useEffect(() => {
    if (stage === 'running' && landmarks) {
      let imageB64: string | undefined
      if (selectedModel === 'C' && videoRef.current) {
        imageB64 = captureVideoFrame(videoRef.current, imageCanvasRef)
      }
      sendLandmarks(landmarks, {
        modelMode: selectedModel,
        imageB64,
      })
    }
  }, [landmarks, selectedModel, sendLandmarks, stage, videoRef])

  // Was the last prediction recently (within 1.5s)?
  const lastPredTs = useRef(0)
  const [recognised, setRecognised] = useState(false)
  useEffect(() => {
    if (lastPrediction) {
      lastPredTs.current = Date.now()
      setRecognised(true)
      setTimeout(() => setRecognised(false), 800)
    }
  }, [lastPrediction])

  return (
    <div className="bg-animated min-h-screen flex flex-col">
      {/* ── Onboarding overlay ─────────────────────────────────── */}
      <AnimatePresence>
        {stage === 'onboarding' && (
          <OnboardingGuide onComplete={handleOnboardingDone} />
        )}
      </AnimatePresence>

      {/* ── Model selector overlay ─────────────────────────────── */}
      <AnimatePresence>
        {stage === 'model-select' && (
          <ModelSelector
            selectedMode={selectedModel}
            availableModes={availableModes}
            onSelectMode={setSelectedModel}
            onContinue={handleModelContinue}
          />
        )}
      </AnimatePresence>

      {/* ── Calibration overlay ────────────────────────────────── */}
      <AnimatePresence>
        {stage === 'calibration' && (
          <Calibration
            handDetected={!!rawLandmarks}
            onReady={() => setStage('running')}
          />
        )}
      </AnimatePresence>

      {/* ── Reconnecting banner ───────────────────────────────── */}
      <AnimatePresence>
        {!isConnected && stage === 'running' && (
          <motion.div
            key="reconnect-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 z-50 text-center py-2 text-sm font-medium"
            style={{ background: 'rgba(251,113,133,0.9)', color: '#fff' }}
          >
            Reconnecting to server…
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Low-bandwidth banner ─────────────────────────────────── */}
      <AnimatePresence>
        {lowBandwidth && isConnected && (
          <motion.div
            key="lowbw-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 z-50 text-center py-2 text-sm font-medium"
            style={{ background: 'rgba(234,179,8,0.9)', color: '#000' }}
          >
            High latency detected — reduced to 5 fps to conserve bandwidth
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Hand size={20} style={{ color: '#00f5d4' }} />
          <h1 className="text-base sm:text-xl font-bold tracking-wide" style={{ color: '#e2e8f0' }}>
            Sanket<span className="glow-text">Setu</span>
            <span className="hidden sm:inline ml-2 text-sm font-normal text-slate-500">| સંકેત-સેતુ</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-xs">
          {mpLoading && <span className="hidden sm:inline">Loading AI…</span>}
          {mpLoading && <span className="sm:hidden">AI…</span>}
          {mpError   && <span className="text-rose-400 text-xs max-w-[120px] truncate">{mpError}</span>}
          <Settings size={16} className="cursor-pointer hover:text-slate-300 transition-colors" />
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col lg:flex-row items-stretch lg:items-start justify-center gap-3 sm:gap-6 px-2 sm:px-4 pb-4 sm:pb-8 lg:px-8">

        {/* Webcam panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full lg:flex-1 flex justify-center"
        >
          <WebcamFeed
            videoRef={videoRef}
            isReady={isReady}
            error={error}
            rawLandmarks={rawLandmarks}
            recognised={recognised}
            facingMode={facingMode}
            onSwitchCamera={switchCamera}
          />
        </motion.div>

        {/* HUD panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full lg:w-auto flex justify-center lg:justify-start pt-0 lg:pt-2"
        >
          <PredictionHUD
            prediction={lastPrediction}
            isConnected={isConnected}
            latency={latency}
            lowBandwidth={lowBandwidth}
            selectedModel={selectedModel}
          />
        </motion.div>

      </main>
    </div>
  )
}

function captureVideoFrame(
  video: HTMLVideoElement,
  canvasRef: { current: HTMLCanvasElement | null },
): string | undefined {
  if (!video.videoWidth || !video.videoHeight) return undefined

  if (!canvasRef.current) {
    canvasRef.current = document.createElement('canvas')
  }
  const canvas = canvasRef.current
  canvas.width = 128
  canvas.height = 128

  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined

  // Center-crop to square before resizing to model input size.
  const side = Math.min(video.videoWidth, video.videoHeight)
  const sx = (video.videoWidth - side) / 2
  const sy = (video.videoHeight - side) / 2
  ctx.drawImage(video, sx, sy, side, side, 0, 0, 128, 128)

  return canvas.toDataURL('image/jpeg', 0.85).replace(/^data:image\/jpeg;base64,/, '')
}

function resolveBackendHttpBase(): string {
  const envWs = import.meta.env.VITE_WS_URL as string | undefined
  if (envWs) {
    return envWs
      .replace(/^wss:\/\//i, 'https://')
      .replace(/^ws:\/\//i, 'http://')
  }
  if (import.meta.env.DEV) return 'http://localhost:8000'
  return window.location.origin
}

export default App
