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

type AppStage = 'onboarding' | 'calibration' | 'running'

function App() {
  // ── Stage management ─────────────────────────────────────────
  const showOnboarding = !localStorage.getItem('sanketsetu-onboarded')
  const [stage, setStage] = useState<AppStage>(showOnboarding ? 'onboarding' : 'calibration')

  const handleOnboardingDone = () => {
    localStorage.setItem('sanketsetu-onboarded', '1')
    setStage('calibration')
  }

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

  // Send landmarks on every new frame
  useEffect(() => {
    if (stage === 'running' && landmarks) {
      sendLandmarks(landmarks)
    }
  }, [landmarks, stage, sendLandmarks])

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
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Hand size={22} style={{ color: '#00f5d4' }} />
          <h1 className="text-xl font-bold tracking-wide" style={{ color: '#e2e8f0' }}>
            Sanket<span className="glow-text">Setu</span>
            <span className="ml-2 text-base font-normal text-slate-500">| સંકેત-સેતુ</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 text-slate-500 text-xs">
          {mpLoading && <span>Loading AI…</span>}
          {mpError   && <span className="text-rose-400">{mpError}</span>}
          <Settings size={18} className="cursor-pointer hover:text-slate-300 transition-colors" />
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col lg:flex-row items-start justify-center gap-6 px-4 pb-8 lg:px-8">

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
          />
        </motion.div>

      </main>
    </div>
  )
}

export default App
