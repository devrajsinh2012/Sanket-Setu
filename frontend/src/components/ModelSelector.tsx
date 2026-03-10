import { motion } from 'framer-motion'
import { Brain, Gauge, Layers, Aperture } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ModelMode } from '../types'

interface Props {
  selectedMode: ModelMode
  availableModes: Set<ModelMode>
  onSelectMode: (mode: ModelMode) => void
  onContinue: () => void
}

type ModeMeta = {
  key: ModelMode
  title: string
  subtitle: string
  details: string
  icon: ComponentType<{ size?: number }>
}

const MODE_OPTIONS: ModeMeta[] = [
  {
    key: 'ensemble',
    title: 'Ensemble (Recommended)',
    subtitle: 'Balanced accuracy and reliability',
    details: 'Starts with A, falls back to B and C when confidence is low.',
    icon: Layers,
  },
  {
    key: 'A',
    title: 'Pipeline A',
    subtitle: 'Fastest response',
    details: 'XGBoost using hand landmarks only.',
    icon: Gauge,
  },
  {
    key: 'B',
    title: 'Pipeline B',
    subtitle: 'Stronger landmark reasoning',
    details: 'Autoencoder embeddings with LightGBM.',
    icon: Brain,
  },
  {
    key: 'C',
    title: 'Pipeline C',
    subtitle: 'Image-based fallback model',
    details: 'CNN features with SVM using webcam snapshots.',
    icon: Aperture,
  },
]

export function ModelSelector({
  selectedMode,
  availableModes,
  onSelectMode,
  onContinue,
}: Props) {
  const canContinue = selectedMode === 'ensemble' || availableModes.has(selectedMode)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl rounded-2xl p-4 sm:p-6"
        style={{
          background: 'rgba(5,8,22,0.92)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
        }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold glow-text text-center">Choose Recognition Model</h2>
        <p className="text-slate-400 text-center mt-2 text-sm sm:text-base">
          Select how predictions should be generated for this session.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon
            const selected = selectedMode === option.key
            const available = option.key === 'ensemble' || availableModes.has(option.key)

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onSelectMode(option.key)}
                className="text-left rounded-xl p-4 transition-all"
                style={{
                  background: selected ? 'rgba(0,245,212,0.12)' : 'rgba(255,255,255,0.04)',
                  border: selected
                    ? '1px solid rgba(0,245,212,0.55)'
                    : '1px solid rgba(255,255,255,0.10)',
                  opacity: available ? 1 : 0.5,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon size={16} />
                    <span className="font-semibold text-slate-100">{option.title}</span>
                  </div>
                  {!available && <span className="text-xs text-rose-300">Unavailable</span>}
                </div>
                <p className="text-sm text-slate-300 mt-2">{option.subtitle}</p>
                <p className="text-xs text-slate-500 mt-1">{option.details}</p>
              </button>
            )
          })}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Tip: Ensemble is best for most users. Use A for low-latency demos.
          </p>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="px-5 py-2.5 rounded-lg font-semibold disabled:cursor-not-allowed"
            style={{
              background: canContinue ? 'rgba(0,245,212,0.22)' : 'rgba(148,163,184,0.2)',
              color: canContinue ? '#99f6e4' : '#94a3b8',
              border: canContinue
                ? '1px solid rgba(0,245,212,0.45)'
                : '1px solid rgba(148,163,184,0.25)',
            }}
          >
            Continue
          </button>
        </div>
      </motion.div>
    </div>
  )
}
