'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseMediaDevicesOptions {
  autoStart?: boolean;
  initialVideo?: boolean;
  initialAudio?: boolean;
  facingMode?: 'user' | 'environment';
}

export function useMediaDevices(options: UseMediaDevicesOptions = {}) {
  const {
    autoStart = true,
    initialVideo = true,
    initialAudio = true,
    facingMode: initialFacingMode = 'user',
  } = options;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialVideo);
  const [isAudioEnabled, setIsAudioEnabled] = useState(initialAudio);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(initialFacingMode);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [isMirror, setIsMirror] = useState<boolean>(true);

  const streamRef = useRef<MediaStream | null>(null);
  // Refs to current enable states so startStream can read them without being in its dep array (BUG-3)
  const isVideoEnabledRef = useRef(initialVideo);
  const isAudioEnabledRef = useRef(initialAudio);
  useEffect(() => { isVideoEnabledRef.current = isVideoEnabled; }, [isVideoEnabled]);
  useEffect(() => { isAudioEnabledRef.current = isAudioEnabled; }, [isAudioEnabled]);

  // Generation counter to discard stale/cancelled getUserMedia promises (prevents React StrictMode race condition)
  const generationRef = useRef(0);
  // Guard to serialize hardware requests
  const isStartingRef = useRef(false);

  // Stop current active stream tracks
  const stopCurrentStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[useMediaDevices] Error stopping track:', e);
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Enumerate available video inputs
  const enumerateDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(videoInputs);
    } catch (e) {
      console.warn('[useMediaDevices] Failed to enumerate media devices:', e);
    }
  }, []);

  const startStream = useCallback(async () => {
    // Increment generation to invalidate any previous in-flight requests
    const currentGeneration = ++generationRef.current;

    // If another request is currently in-flight, wait briefly for it to settle
    if (isStartingRef.current) {
      await new Promise((r) => setTimeout(r, 150));
      if (currentGeneration !== generationRef.current) return;
    }

    isStartingRef.current = true;
    setIsLoading(true);
    setError(null);

    // Stop existing tracks cleanly to release Windows camera hardware lock
    stopCurrentStream();

    // Check mediaDevices support
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera API is not supported in this browser. Please use Chrome, Edge, or Firefox.');
      setHasPermission(false);
      setIsLoading(false);
      isStartingRef.current = false;
      return;
    }

    // Progressive fallback tiers from ideal HD down to plain unconstrained video
    const constraintProfiles: MediaStreamConstraints[] = [
      // 1. 1080p + Audio
      {
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: { ideal: facingMode } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      },
      // 2. 720p + Audio
      {
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: facingMode } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      },
      // 3. 480p + Audio
      {
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: { ideal: facingMode } },
        audio: true,
      },
      // 4. Default video with facingMode + basic audio
      {
        video: { facingMode: { ideal: facingMode } },
        audio: true,
      },
      // 5. Basic video + basic audio (no facingMode constraint)
      {
        video: true,
        audio: true,
      },
      // 6. Video only with facingMode (if audio device is locked/missing/blocked)
      {
        video: { facingMode: { ideal: facingMode } },
        audio: false,
      },
      // 7. Universal plain video only (fallback for any webcam on Windows/Mac)
      {
        video: true,
        audio: false,
      },
    ];

    let mediaStream: MediaStream | null = null;
    let lastErr: any = null;

    for (const constraints of constraintProfiles) {
      if (currentGeneration !== generationRef.current) {
        isStartingRef.current = false;
        setIsLoading(false);
        return;
      }

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (mediaStream) break;
      } catch (err: any) {
        lastErr = err;
        // If permission is denied by user or OS policy, don't keep hammering hardware
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          break;
        }
      }
    }

    // If superseded while waiting for getUserMedia, stop newly acquired tracks immediately
    if (currentGeneration !== generationRef.current) {
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
      }
      isStartingRef.current = false;
      setIsLoading(false);
      return;
    }

    isStartingRef.current = false;
    setIsLoading(false);

    if (!mediaStream) {
      let msg = 'Unable to access your camera.';
      if (lastErr?.name === 'NotAllowedError' || lastErr?.name === 'PermissionDeniedError') {
        msg = 'Camera or microphone permission was denied. Please allow camera access in your browser settings (click the camera icon in your address bar).';
      } else if (lastErr?.name === 'NotFoundError' || lastErr?.name === 'DevicesNotFoundError') {
        msg = 'No camera found on your device. Please ensure a webcam is connected.';
      } else if (lastErr?.name === 'NotReadableError' || lastErr?.name === 'TrackStartError') {
        msg = 'Camera is currently in use by another app or browser tab (e.g. Discord, WhatsApp, Zoom, or another window). Please close any other app using the camera and click Try Again.';
      } else if (lastErr?.name === 'OverconstrainedError') {
        msg = 'Camera does not support requested settings. Click Try Again to use default settings.';
      } else {
        msg = `Unable to access your camera (${lastErr?.name || 'Error'}: ${lastErr?.message || 'Check camera connection'}). Please click Try Again.`;
      }

      console.warn('[useMediaDevices] Camera acquisition failed:', lastErr);
      setError(msg);
      setHasPermission(false);
      return;
    }

    // If mediaStream only has video, try to opportunistically add audio track without failing video
    if (mediaStream.getAudioTracks().length === 0) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (currentGeneration === generationRef.current) {
          audioStream.getAudioTracks().forEach((track) => {
            mediaStream!.addTrack(track);
          });
        } else {
          audioStream.getTracks().forEach((t) => t.stop());
        }
      } catch (audioErr) {
        console.warn('[useMediaDevices] Audio not available, running in video-only mode:', audioErr);
      }
    }

    // Final check before committing to state
    if (currentGeneration !== generationRef.current) {
      mediaStream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = mediaStream;
    setStream(mediaStream);
    setHasPermission(true);

    // Apply track enablement via refs to avoid stale closures (BUG-3)
    mediaStream.getVideoTracks().forEach((t) => (t.enabled = isVideoEnabledRef.current));
    mediaStream.getAudioTracks().forEach((t) => (t.enabled = isAudioEnabledRef.current));

    await enumerateDevices();
  }, [facingMode, enumerateDevices, stopCurrentStream]);

  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const nextState = !isVideoEnabled;
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextState;
      });
      setIsVideoEnabled(nextState);
    }
  }, [isVideoEnabled]);

  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const nextState = !isAudioEnabled;
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextState;
      });
      setIsAudioEnabled(nextState);
    }
  }, [isAudioEnabled]);

  const toggleCameraFacing = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    setIsMirror((prev) => !prev);
  }, []);

  const toggleMirror = useCallback(() => {
    setIsMirror((prev) => !prev);
  }, []);

  useEffect(() => {
    if (autoStart) {
      startStream();
    }

    return () => {
      // Invalidate any in-flight request so it stops tracks immediately upon resolving
      generationRef.current++;
      stopCurrentStream();
    };
  }, [autoStart, startStream, stopCurrentStream]);

  return {
    stream,
    error,
    isLoading,
    hasPermission,
    isVideoEnabled,
    isAudioEnabled,
    facingMode,
    isMirror,
    availableCameras,
    startStream,
    toggleVideo,
    toggleAudio,
    toggleCameraFacing,
    toggleMirror,
  };
}
