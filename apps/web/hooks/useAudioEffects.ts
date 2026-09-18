'use client';

import { useCallback, useRef } from 'react';

export function useAudioEffects() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtxRef.current = new AudioCtxClass();
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  // Play short countdown beep (frequency in Hz)
  const playBeep = useCallback(
    (freq: number = 600, durationMs: number = 100) => {
      try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000);
      } catch (e) {
        // Audio playback might be restricted if user hasn't interacted
      }
    },
    [getAudioContext]
  );

  // Play photobooth camera shutter sound (synthesized mechanical click)
  const playShutterSound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // 1. Initial mechanical mirror flip click (short noise burst)
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 3;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      whiteNoise.start(now);
      // BUG-10 fix: explicitly stop so AudioGraph nodes can be GC'd
      whiteNoise.stop(now + 0.05);

      // 2. Secondary shutter click 60ms later
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(320, now + 0.06);
      clickOsc.frequency.exponentialRampToValueAtTime(80, now + 0.14);

      clickGain.gain.setValueAtTime(0.35, now + 0.06);
      clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);

      clickOsc.start(now + 0.06);
      clickOsc.stop(now + 0.15);
    } catch (e) {
      console.warn('Audio shutter error:', e);
    }
  }, [getAudioContext]);

  return {
    playBeep,
    playShutterSound,
  };
}
