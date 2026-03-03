import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, Sun, Eye, ArrowRight, X } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: Hand,
    title: 'Position Your Hand',
    body: 'Hold your hand 30–60 cm from the camera with the palm facing forward. Make sure all five fingers are clearly visible.',
    color: '#00f5d4',
  },
  {
    icon: Sun,
    title: 'Check Your Lighting',
    body: 'Ensure your hand is well-lit from the front. Avoid strong back-lighting or dark backgrounds for best accuracy.',
    color: '#fee440',
  },
  {
    icon: Eye,
    title: 'Sign Clearly',
    body: 'Form each Gujarati sign deliberately. The system detects one hand at a time. Signs appear instantly in the HUD.',
    color: '#9b5de5',
  },
] as const;

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

/**
 * 3-step animated onboarding wizard shown on first visit.
 */
export function OnboardingGuide({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [dir,  setDir]  = useState(1);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const { icon: Icon, title, body, color } = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ background: 'rgba(5,8,22,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="glass glow-border p-8 max-w-sm w-full mx-4 relative">

        {/* Skip / close */}
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          aria-label="Skip"
        >
          <X size={18} />
        </button>

        {/* Step indicator */}
        <div className="flex gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full flex-1 transition-all duration-300"
              style={{ background: i <= step ? color : 'rgba(255,255,255,0.1)' }}
            />
          ))}
        </div>

        {/* Animated step content */}
        <AnimatePresence custom={dir} mode="wait">
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="flex flex-col items-center text-center gap-4"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: `${color}15`,
                border: `2px solid ${color}40`,
                boxShadow: `0 0 20px ${color}30`,
              }}
            >
              <Icon size={36} style={{ color }} />
            </div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="text-slate-300 text-sm leading-relaxed">{body}</p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 0 ? (
            <button
              onClick={() => go(step - 1)}
              className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5"
            >
              Back
            </button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => go(step + 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: `${color}20`,
                border: `1px solid ${color}50`,
                color,
              }}
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{
                background: 'rgba(0,245,212,0.15)',
                border: '1px solid rgba(0,245,212,0.4)',
                color: '#00f5d4',
                boxShadow: '0 0 12px rgba(0,245,212,0.2)',
              }}
            >
              Start <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
