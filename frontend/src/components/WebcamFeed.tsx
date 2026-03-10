import { useRef } from 'react';
import { CameraOff, RotateCcw } from 'lucide-react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { LandmarkCanvas } from './LandmarkCanvas';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  error: string | null;
  rawLandmarks: NormalizedLandmark[] | null;
  recognised: boolean;
  facingMode: 'user' | 'environment';
  onSwitchCamera: () => void;
}

/**
 * Webcam feed panel with the landmark canvas overlay and error states.
 */
export function WebcamFeed({
  videoRef,
  isReady,
  error,
  rawLandmarks,
  recognised,
  facingMode,
  onSwitchCamera,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (error) {
    return (
      <div className="glass flex flex-col items-center justify-center gap-4 p-8 aspect-video w-full max-w-2xl text-center">
        <CameraOff size={48} className="text-rose-400 opacity-70" />
        <p className="text-rose-300 font-semibold">Camera Unavailable</p>
        <p className="text-slate-400 text-sm max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
          style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185' }}
        >
          <RotateCcw size={14} /> Reload page
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden w-full max-w-2xl"
      style={{
        aspectRatio: window.innerWidth < 640 ? '4/3' : '16/9',
        border: '1px solid rgba(0,245,212,0.2)',
        boxShadow: '0 0 30px rgba(0,245,212,0.08)',
        background: '#0a0a1a',
      }}
    >
      {/* Video element — mirrored for front camera */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        playsInline
        muted
      />

      {/* Landmark canvas overlay */}
      {isReady && (
        <LandmarkCanvas
          rawLandmarks={rawLandmarks}
          videoWidth={containerRef.current?.clientWidth ?? 640}
          videoHeight={containerRef.current?.clientHeight ?? 360}
          recognised={recognised}
        />
      )}

      {/* Loading shimmer */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-transparent"
               style={{ borderTopColor: '#00f5d4', animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {/* Camera switch button (mobile) */}
      <button
        onClick={onSwitchCamera}
        className="absolute bottom-3 right-3 glass p-2 rounded-xl text-slate-300 hover:text-white transition-colors"
        title="Switch camera"
      >
        <RotateCcw size={16} />
      </button>

      {/* Hand detected indicator */}
      {isReady && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
             style={{ background: 'rgba(0,0,0,0.5)' }}>
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: rawLandmarks ? '#00f5d4' : '#4b5563',
              boxShadow: rawLandmarks ? '0 0 6px #00f5d4' : 'none',
            }}
          />
          <span className="text-slate-300">{rawLandmarks ? 'Hand detected' : 'No hand'}</span>
        </div>
      )}
    </div>
  );
}
