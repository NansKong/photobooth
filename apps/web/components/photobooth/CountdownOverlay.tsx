'use client';

import React, { useEffect, useState, useRef } from 'react';
import { CaptureSession } from '@photobooth/shared';
import { useAudioEffects } from '@/hooks/useAudioEffects';
import { Camera, Sparkles, X } from 'lucide-react';

interface CountdownOverlayProps {
  session: CaptureSession;
  toLocalTime: (serverTimestamp: number) => number;
  onCaptureTrigger: (shotIndex: number, totalShots: number) => void;
  onCancel?: () => void;
  retakePoseNumber?: number;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  session,
  toLocalTime,
  onCaptureTrigger,
  onCancel,
  retakePoseNumber,
}) => {
  const [displayNumber, setDisplayNumber] = useState<string>('3');
  const [currentPoseIndex, setCurrentPoseIndex] = useState<number>(1);
  const [isIntermission, setIsIntermission] = useState<boolean>(false);
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);
  const { playBeep, playShutterSound } = useAudioEffects();

  const totalShots = session.totalShots || 4;
  const triggeredShotsRef = useRef<Set<number>>(new Set());
  const lastBeepNumberRef = useRef<number | null>(null);
  const onCaptureTriggerRef = useRef(onCaptureTrigger);
  useEffect(() => { onCaptureTriggerRef.current = onCaptureTrigger; }, [onCaptureTrigger]);

  useEffect(() => {
    triggeredShotsRef.current.clear();
    lastBeepNumberRef.current = null;

    // Build timeline of shots
    const shotsList =
      session.shots && session.shots.length > 0
        ? session.shots
        : Array.from({ length: totalShots }).map((_, i) => ({
            shotIndex: i,
            targetTimestamp: session.captureTimestamp + i * ((session.durationMs || 3000) + 2500),
          }));

    let animId: number;

    const tick = () => {
      const now = Date.now();

      // Find current or next pending shot
      let activeShot = shotsList.find((s) => !triggeredShotsRef.current.has(s.shotIndex));

      if (!activeShot) {
        // All shots completed
        return;
      }

      const targetLocalTime = toLocalTime(activeShot.targetTimestamp);
      const diff = targetLocalTime - now;

      setCurrentPoseIndex(activeShot.shotIndex + 1);

      if (diff <= 0) {
        // Trigger current shot
        triggeredShotsRef.current.add(activeShot.shotIndex);
        setDisplayNumber('📸');
        setIsFlashActive(true);
        playShutterSound();
        onCaptureTriggerRef.current(activeShot.shotIndex, totalShots);

        // Flash fade out and brief intermission before next shot
        setTimeout(() => {
          setIsFlashActive(false);
          if (activeShot!.shotIndex + 1 < totalShots) {
            setIsIntermission(true);
            setTimeout(() => {
              setIsIntermission(false);
            }, 1200);
          }
        }, 220);

        animId = requestAnimationFrame(tick);
        return;
      }

      // Calculate countdown seconds remaining (e.g. 3, 2, 1)
      const secondsLeft = Math.max(1, Math.ceil(diff / 1000));
      setDisplayNumber(secondsLeft.toString());

      // Audio beeps at 3, 2, 1
      if (secondsLeft !== lastBeepNumberRef.current) {
        lastBeepNumberRef.current = secondsLeft;
        if (secondsLeft === 1) {
          playBeep(880, 150); // higher pitch on 1
        } else if (secondsLeft <= 3) {
          playBeep(550, 100);
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [session, toLocalTime, totalShots, playBeep, playShutterSound]);

  return (
    <>
      {/* Screen Camera Flash */}
      {isFlashActive && (
        <div className="fixed inset-0 z-50 bg-white pointer-events-none animate-flash" />
      )}

      {/* Synchronized Countdown Center Display with Translucent Opacity */}
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center">
          {/* Pose Header Banner - Translucent */}
          <div className="mb-3 px-5 py-1.5 rounded-full bg-black/40 backdrop-blur-[2px] border border-white/40 shadow-md flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#FFB69B] animate-pulse" />
            <span className="font-retro font-bold text-xs sm:text-sm tracking-widest text-white uppercase drop-shadow-sm">
              {retakePoseNumber ? `· · · RETAKING POSE #${retakePoseNumber} · · ·` : `· · · POSE ${currentPoseIndex} OF ${totalShots} · · ·`}
            </span>
          </div>

          {/* Central Countdown Counter - Translucent Glass Circle with High Contrast Number */}
          <div className="relative flex items-center justify-center w-40 h-40 rounded-full bg-black/25 backdrop-blur-[2px] border-2 border-white/60 shadow-xl transition-transform transform scale-100">
            {isIntermission ? (
              <div className="text-center px-2">
                <span className="text-xl font-retro font-bold text-[#FFD166] uppercase tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  Switch Pose!
                </span>
              </div>
            ) : (
              <span className="font-retro text-8xl sm:text-9xl font-bold text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] select-none">
                {displayNumber}
              </span>
            )}
          </div>

          {/* Bottom Pose Prompt - Translucent */}
          <div className="mt-4 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-[2px] border border-white/30 shadow-md">
            <p className="text-xs font-retro font-bold tracking-widest uppercase text-white/95 flex items-center gap-2 drop-shadow-sm">
              <Camera className="w-3.5 h-3.5 text-[#FFB69B] animate-bounce" />
              {isIntermission ? 'GET READY FOR NEXT SHOT!' : 'STRIKE A POSE!'}
            </p>
          </div>

          {onCancel && (
            <button
              onClick={onCancel}
              className="mt-4 pointer-events-auto flex items-center gap-1.5 px-3.5 py-1 text-xs font-mono font-bold text-white/90 bg-black/40 hover:bg-black/60 rounded-full border border-white/40 shadow-sm transition active:translate-y-0.5 backdrop-blur-[2px]"
            >
              <X className="w-3.5 h-3.5" />
              Cancel Photobooth
            </button>
          )}
        </div>
      </div>
    </>
  );
};
