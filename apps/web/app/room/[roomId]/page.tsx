'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CaptureSession,
  EnvironmentType,
  Participant,
  ParticipantPosition,
  PHOTO_LAYOUTS,
  PhotoLayoutId,
  Room,
  SocketEvents,
} from '@photobooth/shared';
import { useSocket } from '@/hooks/useSocket';
import { useClockSync } from '@/hooks/useClockSync';
import { useMediaDevices } from '@/hooks/useMediaDevices';
import { useWebRTC } from '@/hooks/useWebRTC';
import { renderPhotoboothComposition } from '@/lib/canvas-renderer';

import { PhotoboothCanvas, PhotoboothCanvasHandle } from '@/components/photobooth/PhotoboothCanvas';
import { CameraControls } from '@/components/photobooth/CameraControls';
import { EnvironmentSelector } from '@/components/photobooth/EnvironmentSelector';
import { LayoutSelector } from '@/components/photobooth/LayoutSelector';
import { PositionControls } from '@/components/photobooth/PositionControls';
import { CountdownOverlay } from '@/components/photobooth/CountdownOverlay';
import { CapturePreviewModal } from '@/components/photobooth/CapturePreviewModal';
import { WaitingRoom } from '@/components/photobooth/WaitingRoom';
import { CameraPermissionModal } from '@/components/photobooth/CameraPermissionModal';
import { QrModal } from '@/components/photobooth/QrModal';
import { NetworkSettingsModal } from '@/components/photobooth/NetworkSettingsModal';
import { Globe } from 'lucide-react';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.roomId as string)?.toUpperCase() || '';

  // App & Room State
  const [userName, setUserName] = useState<string>('');
  const [hasEnteredRoom, setHasEnteredRoom] = useState<boolean>(false);
  const [inWaitingRoom, setInWaitingRoom] = useState<boolean>(true);
  const [selfParticipantId, setSelfParticipantId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [captureSession, setCaptureSession] = useState<CaptureSession | null>(null);
  const [capturedFrames, setCapturedFrames] = useState<HTMLCanvasElement[]>([]);
  const [selectedShots, setSelectedShots] = useState<number>(4);
  const [onlyHostCanClick, setOnlyHostCanClick] = useState<boolean>(false);
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [retakeTargetIndex, setRetakeTargetIndex] = useState<number | null>(null);
  const retakeTargetIndexRef = useRef<number | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<'env' | 'layout' | 'pos' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isQrOpen, setIsQrOpen] = useState<boolean>(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState<boolean>(false);

  // Networking Hooks
  const {
    socket,
    isConnected,
    isStandalone,
    connectionError,
    reconnect,
  } = useSocket();
  const { isSynchronized, toLocalTime } = useClockSync(socket, isConnected);
  const {
    stream: localStream,
    error: mediaError,
    isLoading: isMediaLoading,
    hasPermission,
    isVideoEnabled,
    isAudioEnabled,
    isMirror,
    isVirtualStream,
    availableCameras,
    startStream,
    startVirtualStream,
    toggleVideo,
    toggleAudio,
    toggleCameraFacing,
    facingMode,
    toggleMirror,
  } = useMediaDevices({ autoStart: true });

  const participants = room?.participants || [];
  const { remoteStreams } = useWebRTC(socket, selfParticipantId, participants, localStream);

  // Ref to PhotoboothCanvas so we can read its off-DOM video elements at capture time (BUG-2)
  const canvasRef = useRef<PhotoboothCanvasHandle | null>(null);

  // Read saved name from local storage if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('photobooth_username');
      if (saved) setUserName(saved);
      else setUserName(`Guest ${Math.floor(100 + Math.random() * 900)}`);
    }
  }, []);

  // Join Room Socket Event Flow
  const handleConfirmJoin = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('photobooth_username', userName);
    }

    // Offline / Solo Mode fallback when socket is disconnected or connecting or in Vercel Standalone mode
    if (isStandalone || !socket || !isConnected) {
      const fallbackRoom: Room = {
        id: roomId,
        hostId: 'local-self',
        participants: [
          {
            id: 'local-self',
            socketId: 'local-self',
            name: userName || 'Photobooth User',
            isHost: true,
            isReady: true,
            cameraActive: true,
            micActive: true,
            position: { x: 0, y: 0, scale: 1.0, mirror: true },
            joinedAt: Date.now(),
          },
        ],
        environmentId: 'virtual-studio',
        environmentType: 'virtual',
        layoutId: 'duo-classic',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        captureSession: null,
      };
      setRoom(fallbackRoom);
      setSelfParticipantId('local-self');
      setHasEnteredRoom(true);
      return;
    }

    const storedParticipantId =
      typeof window !== 'undefined'
        ? sessionStorage.getItem(`photobooth_pid_${roomId}`) || ''
        : '';

    socket.emit(
      SocketEvents.ROOM_JOIN,
      {
        roomId,
        participantId: storedParticipantId,
        name: userName,
      },
      (res: any) => {
        if (res?.success) {
          setRoom(res.room);
          setSelfParticipantId(res.participant.id);
          sessionStorage.setItem(`photobooth_pid_${roomId}`, res.participant.id);
          setHasEnteredRoom(true);
        } else {
          // If server returned error or room not found, join as local solo host instead of failing
          const fallbackRoom: Room = {
            id: roomId,
            hostId: 'local-self',
            participants: [
              {
                id: 'local-self',
                socketId: 'local-self',
                name: userName || 'Photobooth User',
                isHost: true,
                isReady: true,
                cameraActive: true,
                micActive: true,
                position: { x: 0, y: 0, scale: 1.0, mirror: true },
                joinedAt: Date.now(),
              },
            ],
            environmentId: 'virtual-studio',
            environmentType: 'virtual',
            layoutId: 'duo-classic',
            createdAt: Date.now(),
            lastActivity: Date.now(),
            captureSession: null,
          };
          setRoom(fallbackRoom);
          setSelfParticipantId('local-self');
          setHasEnteredRoom(true);
        }
      }
    );
  }, [socket, isConnected, isStandalone, roomId, userName]);

  // Subscribe to Room Events
  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (data: { room: Room; selfParticipantId: string }) => {
      setRoom(data.room);
      setSelfParticipantId(data.selfParticipantId);
      if (data.room.captureSession) {
        setCaptureSession(data.room.captureSession);
      }
    };

    const handleParticipantJoined = (data: { participant: Participant }) => {
      setRoom((prev) => {
        if (!prev) return null;
        const exists = prev.participants.some((p) => p.id === data.participant.id);
        if (exists) return prev;
        return {
          ...prev,
          participants: [...prev.participants, data.participant],
        };
      });
    };

    const handleParticipantLeft = (data: { participantId: string; newHostId?: string }) => {
      setRoom((prev) => {
        if (!prev) return null;
        const updated = prev.participants.filter((p) => p.id !== data.participantId);
        return {
          ...prev,
          hostId: data.newHostId || prev.hostId,
          participants: updated,
        };
      });
    };

    const handleParticipantUpdated = (data: {
      participantId: string;
      updates: Partial<Participant>;
    }) => {
      setRoom((prev) => {
        if (!prev) return null;
        const updated = prev.participants.map((p) =>
          p.id === data.participantId ? { ...p, ...data.updates } : p
        );
        return { ...prev, participants: updated };
      });
    };

    const handleEnvironmentChanged = (data: {
      environmentId: string;
      environmentType: EnvironmentType;
    }) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          environmentId: data.environmentId,
          environmentType: data.environmentType,
        };
      });
    };

    const handleLayoutChanged = (data: { layoutId: PhotoLayoutId }) => {
      setRoom((prev) => {
        if (!prev) return null;
        return { ...prev, layoutId: data.layoutId };
      });
    };

    const handleCaptureScheduled = (session: CaptureSession) => {
      setCaptureSession(session);
      setActiveDrawer(null); // close open menus for photo
    };

    const handleCaptureCancelled = () => {
      setCaptureSession(null);
    };

    const handleCaptureFinished = () => {
      setCaptureSession(null);
    };

    const handleSocketConnect = () => {
      if (roomId) {
        const storedParticipantId =
          typeof window !== 'undefined'
            ? sessionStorage.getItem(`photobooth_pid_${roomId}`) || selfParticipantId || ''
            : selfParticipantId || '';

        socket.emit(
          SocketEvents.ROOM_JOIN,
          {
            roomId,
            participantId: storedParticipantId,
            name: userName,
          },
          (res: any) => {
            if (res?.success) {
              setRoom(res.room);
              setSelfParticipantId(res.participant.id);
            }
          }
        );
      }
    };

    socket.on('connect', handleSocketConnect);
    socket.on(SocketEvents.ROOM_STATE, handleRoomState);
    socket.on(SocketEvents.PARTICIPANT_JOINED, handleParticipantJoined);
    socket.on(SocketEvents.PARTICIPANT_LEFT, handleParticipantLeft);
    socket.on(SocketEvents.PARTICIPANT_UPDATED, handleParticipantUpdated);
    socket.on(SocketEvents.ENVIRONMENT_CHANGED, handleEnvironmentChanged);
    socket.on(SocketEvents.LAYOUT_CHANGED, handleLayoutChanged);
    socket.on(SocketEvents.CAPTURE_SCHEDULED, handleCaptureScheduled);
    socket.on(SocketEvents.CAPTURE_CANCELLED, handleCaptureCancelled);
    socket.on(SocketEvents.CAPTURE_FINISHED, handleCaptureFinished);

    return () => {
      socket.off('connect', handleSocketConnect);
      socket.off(SocketEvents.ROOM_STATE, handleRoomState);
      socket.off(SocketEvents.PARTICIPANT_JOINED, handleParticipantJoined);
      socket.off(SocketEvents.PARTICIPANT_LEFT, handleParticipantLeft);
      socket.off(SocketEvents.PARTICIPANT_UPDATED, handleParticipantUpdated);
      socket.off(SocketEvents.ENVIRONMENT_CHANGED, handleEnvironmentChanged);
      socket.off(SocketEvents.LAYOUT_CHANGED, handleLayoutChanged);
      socket.off(SocketEvents.CAPTURE_SCHEDULED, handleCaptureScheduled);
      socket.off(SocketEvents.CAPTURE_CANCELLED, handleCaptureCancelled);
      socket.off(SocketEvents.CAPTURE_FINISHED, handleCaptureFinished);
    };
  }, [socket, roomId, userName, selfParticipantId]);

  // Position updates handler
  const handleUpdatePosition = useCallback(
    (updates: Partial<ParticipantPosition>) => {
      if (!socket || !roomId || !selfParticipantId || !room) return;

      const self = room.participants.find((p) => p.id === selfParticipantId);
      const newPos = {
        ...(self?.position || { x: 0, y: 0, scale: 1.0, mirror: true }),
        ...updates,
      };

      // Optimistic local update
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === selfParticipantId ? { ...p, position: newPos } : p
          ),
        };
      });

      socket.emit(SocketEvents.PARTICIPANT_UPDATE, {
        roomId,
        updates: { position: newPos },
      });
    },
    [socket, roomId, selfParticipantId, room]
  );

  // Environment change
  const handleChangeEnvironment = (envId: string, type: EnvironmentType) => {
    setRoom((prev) =>
      prev ? { ...prev, environmentId: envId, environmentType: type } : null
    );
    if (socket && isConnected && roomId) {
      socket.emit(SocketEvents.ENVIRONMENT_CHANGE, {
        roomId,
        environmentId: envId,
        environmentType: type,
      });
    }
  };

  // Layout change
  const handleChangeLayout = (layoutId: PhotoLayoutId) => {
    setRoom((prev) => (prev ? { ...prev, layoutId } : null));
    if (socket && isConnected && roomId) {
      socket.emit(SocketEvents.LAYOUT_CHANGE, {
        roomId,
        layoutId,
      });
    }
  };

  // Trigger Take Photo (Multi-shot session)
  const handleTakePhoto = () => {
    retakeTargetIndexRef.current = null;
    setRetakeTargetIndex(null);
    setCapturedFrames([]);
    setIsStudioOpen(false);

    const isLocalMode =
      isStandalone ||
      !socket ||
      !isConnected ||
      selfParticipantId === 'local-self' ||
      room?.hostId === 'local-self';

    const triggerLocalCapture = () => {
      const now = Date.now();
      const shots = Array.from({ length: selectedShots }, (_, i) => ({
        shotIndex: i,
        targetTimestamp: now + 3000 + i * (3000 + 2500),
      }));

      setCaptureSession({
        id: `local-${now}`,
        scheduledBy: selfParticipantId || 'local-self',
        captureTimestamp: now + 3000,
        durationMs: 3000,
        totalShots: selectedShots,
        currentShotIndex: 0,
        shotIntervalMs: 2500,
        shots,
        status: 'counting',
        readyParticipants: [selfParticipantId || 'local-self'],
      });
    };

    if (!isLocalMode && socket && isConnected && roomId) {
      let acknowledged = false;
      const watchdog = setTimeout(() => {
        if (!acknowledged) {
          console.warn('[handleTakePhoto] Server capture timed out; falling back to local capture session');
          triggerLocalCapture();
        }
      }, 800);

      socket.emit(
        SocketEvents.CAPTURE_START,
        {
          roomId,
          durationMs: 3000,
          totalShots: selectedShots,
          shotIntervalMs: 2500,
        },
        (res: any) => {
          if (res?.success) {
            acknowledged = true;
            clearTimeout(watchdog);
          }
        }
      );
    } else {
      triggerLocalCapture();
    }
  };

  // Trigger Retake of a Single Specific Photo/Pose (e.g. retake pose 2 without wiping other images)
  const handleRetakeSingle = (poseIndex: number) => {
    retakeTargetIndexRef.current = poseIndex;
    setRetakeTargetIndex(poseIndex);
    setIsStudioOpen(false);

    const isLocalMode =
      isStandalone ||
      !socket ||
      !isConnected ||
      selfParticipantId === 'local-self' ||
      room?.hostId === 'local-self';

    const triggerLocalSingle = () => {
      const now = Date.now();
      const shots = [{ shotIndex: 0, targetTimestamp: now + 3000 }];

      setCaptureSession({
        id: `local-${now}`,
        scheduledBy: selfParticipantId || 'local-self',
        captureTimestamp: now + 3000,
        durationMs: 3000,
        totalShots: 1,
        currentShotIndex: 0,
        shotIntervalMs: 2000,
        shots,
        status: 'counting',
        readyParticipants: [selfParticipantId || 'local-self'],
      });
    };

    if (!isLocalMode && socket && isConnected && roomId) {
      let acknowledged = false;
      const watchdog = setTimeout(() => {
        if (!acknowledged) {
          triggerLocalSingle();
        }
      }, 800);

      socket.emit(
        SocketEvents.CAPTURE_START,
        {
          roomId,
          durationMs: 3000,
          totalShots: 1,
          shotIntervalMs: 2000,
        },
        (res: any) => {
          if (res?.success) {
            acknowledged = true;
            clearTimeout(watchdog);
          }
        }
      );
    } else {
      triggerLocalSingle();
    }
  };

  // Cancel Countdown
  const handleCancelCountdown = () => {
    if (socket && isConnected && roomId) {
      socket.emit(SocketEvents.CAPTURE_CANCEL, { roomId });
    }
    setCaptureSession(null);
    if (retakeTargetIndexRef.current !== null) {
      retakeTargetIndexRef.current = null;
      setRetakeTargetIndex(null);
      setIsStudioOpen(true);
    } else {
      setCapturedFrames([]);
    }
  };

  // Millisecond Synchronized Capture Trigger for each shot in the series
  const handleCaptureTrigger = useCallback(
    async (shotIndex: number, totalShots: number) => {
      if (!room) return;

      // Read video elements directly from the canvas ref (off-DOM elements)
      const videoElements =
        canvasRef.current?.getVideoElements() ?? new Map<string, HTMLVideoElement>();
      const layout = PHOTO_LAYOUTS[room.layoutId] || PHOTO_LAYOUTS['duo-classic'];

      const offscreen = document.createElement('canvas');
      offscreen.width = layout.canvasWidth;
      offscreen.height = layout.canvasHeight;
      const ctx = offscreen.getContext('2d', { alpha: false });

      if (ctx) {
        renderPhotoboothComposition(
          ctx,
          layout.canvasWidth,
          layout.canvasHeight,
          room,
          videoElements,
          selfParticipantId,
          {
            isFinalCapture: true,
            showGuidelines: false,
          }
        );

        if (retakeTargetIndexRef.current !== null) {
          const targetIdx = retakeTargetIndexRef.current;
          retakeTargetIndexRef.current = null;
          setRetakeTargetIndex(null);
          setCapturedFrames((prev) => {
            const next = [...prev];
            if (targetIdx >= 0 && targetIdx < next.length) {
              next[targetIdx] = offscreen;
            } else {
              next.push(offscreen);
            }
            return next;
          });
          setIsStudioOpen(true);
        } else {
          setCapturedFrames((prev) => {
            const next = [...prev, offscreen];
            // If this was the final shot in the multi-shot session, open studio
            if (shotIndex + 1 >= totalShots) {
              setIsStudioOpen(true);
            }
            return next;
          });
        }
      }

      const isLocalSession =
        !isConnected ||
        !socket ||
        selfParticipantId === 'local-self' ||
        captureSession?.id?.startsWith('local-');

      if (isLocalSession) {
        if (shotIndex + 1 >= totalShots) {
          setCaptureSession(null);
          setIsStudioOpen(true);
        } else {
          setCaptureSession((prev) =>
            prev
              ? {
                  ...prev,
                  currentShotIndex: prev.currentShotIndex + 1,
                  captureTimestamp: Date.now() + prev.shotIntervalMs,
                }
              : null
          );
        }
      } else if (socket && captureSession && shotIndex + 1 >= totalShots) {
        socket.emit(SocketEvents.CAPTURE_COMPLETE, {
          roomId,
          sessionId: captureSession.id,
        });
        // Safety timeout: ensure studio opens even if server dropped CAPTURE_FINISHED event
        setTimeout(() => {
          setCaptureSession(null);
          setIsStudioOpen(true);
        }, 600);
      }
    },
    [room, selfParticipantId, socket, isConnected, captureSession, roomId]
  );

  // Retake all photos
  const handleRetake = () => {
    retakeTargetIndexRef.current = null;
    setRetakeTargetIndex(null);
    setCapturedFrames([]);
    setIsStudioOpen(false);
    if (socket && roomId) {
      socket.emit(SocketEvents.CAPTURE_CANCEL, { roomId });
    }
  };

  // Cross-browser and iOS-safe Fullscreen toggle
  const handleToggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    const doc: any = document;
    const docEl: any = document.documentElement;

    const isFs = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    if (!isFs) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => setIsFullscreen(true));
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      } else {
        // Fallback for iOS Safari & browsers without Fullscreen API: toggle app-level fullscreen
        setIsFullscreen((prev) => !prev);
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => setIsFullscreen(false));
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      } else {
        setIsFullscreen(false);
      }
    }
  }, []);

  // Sync fullscreen state with native browser events (Esc key, swipe gestures, etc.)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFsChange = () => {
      const doc: any = document;
      const isFs = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, []);

  // Leave room
  const handleLeaveRoom = () => {
    if (socket && roomId) {
      socket.emit(SocketEvents.ROOM_LEAVE, { roomId });
    }
    router.push('/');
  };

  // Step 1: Pre-join Camera Permission & Name Onboarding
  if (!hasEnteredRoom) {
    return (
      <CameraPermissionModal
        name={userName}
        setName={setUserName}
        localStream={localStream}
        hasPermission={hasPermission}
        error={mediaError}
        isLoading={isMediaLoading}
        isConnected={isConnected}
        isStandalone={isStandalone}
        isVirtualStream={isVirtualStream}
        onRequestPermission={startStream}
        onUseDemoCamera={() => startVirtualStream(userName)}
        onRetryConnection={reconnect}
        onToggleFacing={toggleCameraFacing}
        facingMode={facingMode}
        onConfirmJoin={handleConfirmJoin}
      />
    );
  }

  // If room failed to load
  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <p className="text-slate-300 font-display font-medium">Entering Photobooth Room #{roomId}...</p>
      </div>
    );
  }

  // Step 2: Waiting Room (shown before entering live composition)
  if (inWaitingRoom) {
    return (
      <>
        <WaitingRoom
          room={room}
          selfParticipantId={selfParticipantId || ''}
          onEnterPhotobooth={() => setInWaitingRoom(false)}
          onOpenQrModal={() => setIsQrOpen(true)}
          onOpenNetworkModal={() => setIsNetworkModalOpen(true)}
          localStream={localStream}
        />
        {isQrOpen && <QrModal roomId={roomId} onClose={() => setIsQrOpen(false)} />}
        <NetworkSettingsModal
          isOpen={isNetworkModalOpen}
          onClose={() => setIsNetworkModalOpen(false)}
        />
      </>
    );
  }

  const selfParticipant = room.participants.find((p) => p.id === selfParticipantId);

  // Step 3: The Main Shared Photobooth View
  return (
    <main className={`relative flex flex-col items-center justify-between w-full h-[100dvh] max-h-[100dvh] overflow-hidden retro-pattern ${
      isFullscreen ? 'py-1 px-1 sm:px-2' : 'py-1.5 sm:py-3 px-1 sm:px-2'
    } select-none`}>
      {/* Top Bar: Retro Status & Room Details */}
      <header className={`w-full max-w-5xl px-2 sm:px-4 flex items-center justify-between z-30 pointer-events-auto shrink-0 transition-opacity ${
        isFullscreen ? 'opacity-85 hover:opacity-100' : ''
      }`}>
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            onClick={() => setInWaitingRoom(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[#F4EFE6] border-2 border-[#282A2B] text-[11px] sm:text-xs font-retro text-[#282A2B] shadow-retro-sm hover:bg-[#EBE4D5] transition"
            title="Return to waiting lounge"
          >
            <span>Room #{room.id}</span>
          </button>

          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-retro text-[#282A2B] bg-[#F4EFE6] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border-2 border-[#282A2B] shadow-retro-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse border border-[#282A2B]" />
            <span>{room.participants.length} <span className="hidden sm:inline">posing</span></span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isSynchronized && (
            <span className="hidden md:inline-flex items-center text-[11px] text-[#282A2B] font-mono px-3 py-1 rounded-xl bg-[#F4EFE6] border-2 border-[#282A2B] shadow-retro-sm">
              Synced Shutter
            </span>
          )}
          <button
            onClick={() => setIsNetworkModalOpen(true)}
            className="p-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs font-retro rounded-xl bg-[#F4EFE6] border-2 border-[#282A2B] text-[#282A2B] shadow-retro-sm hover:bg-[#EBE4D5] transition shrink-0 flex items-center gap-1"
            title="Configure TURN Relay & Cross-Network Settings"
          >
            <Globe className="w-3.5 h-3.5 text-[#6BA3A9]" />
            <span className="hidden md:inline">Relay Setup</span>
          </button>
          <button
            onClick={() => setIsQrOpen(true)}
            className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-retro rounded-xl retro-btn-terracotta transition shrink-0"
          >
            + Invite <span className="hidden sm:inline">Friends</span>
          </button>
        </div>
      </header>

      {/* Center Hero: The Shared Photobooth Canvas */}
      <div className={`relative flex-1 w-full max-w-6xl px-1 sm:px-4 flex items-center justify-center min-h-0 z-10 overflow-hidden ${
        isFullscreen ? 'my-0.5' : 'my-1'
      }`}>
        <PhotoboothCanvas
          ref={canvasRef}
          room={room}
          selfParticipantId={selfParticipantId || ''}
          localStream={localStream}
          remoteStreams={remoteStreams}
          onUpdatePosition={handleUpdatePosition}
          isCapturing={!!captureSession}
        />
      </div>

      {/* Floating Drawers (Theme, Layout, Pose) */}
      {activeDrawer === 'env' && (
        <div className="absolute top-14 sm:top-16 z-40 w-full max-w-xl px-2 sm:px-4 max-h-[75dvh] overflow-y-auto animate-fadeIn">
          <EnvironmentSelector
            currentEnvironmentId={room.environmentId}
            currentType={room.environmentType}
            onChangeEnvironment={handleChangeEnvironment}
            onClose={() => setActiveDrawer(null)}
          />
        </div>
      )}

      {activeDrawer === 'layout' && (
        <div className="absolute top-14 sm:top-16 z-40 w-full max-w-lg px-2 sm:px-4 max-h-[75dvh] overflow-y-auto animate-fadeIn">
          <LayoutSelector
            currentLayoutId={room.layoutId}
            onChangeLayout={handleChangeLayout}
            onClose={() => setActiveDrawer(null)}
          />
        </div>
      )}

      {activeDrawer === 'pos' && selfParticipant && (
        <div className="absolute bottom-28 sm:bottom-24 z-40 w-full max-w-sm px-2 sm:px-4 max-h-[65dvh] overflow-y-auto animate-fadeIn">
          <PositionControls
            position={selfParticipant.position}
            onUpdatePosition={handleUpdatePosition}
            onClose={() => setActiveDrawer(null)}
          />
        </div>
      )}

      {/* Bottom Floating Camera Controls */}
      <footer className="w-full pb-1 sm:pb-2 px-1 sm:px-2 z-30 shrink-0">
        <CameraControls
          isVideoEnabled={isVideoEnabled}
          isAudioEnabled={isAudioEnabled}
          isMirror={isMirror}
          isFullscreen={isFullscreen}
          isCountdownActive={!!captureSession}
          hasMultipleCameras={availableCameras.length > 1}
          activeDrawer={activeDrawer}
          selectedShots={selectedShots}
          onSelectShots={setSelectedShots}
          isHost={room?.hostId === selfParticipantId}
          canClickShutter={!onlyHostCanClick || room?.hostId === selfParticipantId || (room?.participants.length ?? 1) <= 1}
          onlyHostCanClick={onlyHostCanClick}
          participantCount={room?.participants.length ?? 1}
          onToggleOnlyHostCanClick={() => setOnlyHostCanClick((prev) => !prev)}
          onToggleVideo={toggleVideo}
          onToggleAudio={toggleAudio}
          onToggleMirror={toggleMirror}
          onSwitchCamera={toggleCameraFacing}
          onToggleFullscreen={handleToggleFullscreen}
          onToggleDrawer={(drawer) =>
            setActiveDrawer((curr) => (curr === drawer ? null : drawer))
          }
          onTakePhoto={handleTakePhoto}
          onLeaveRoom={handleLeaveRoom}
          onOpenShare={() => setIsQrOpen(true)}
        />
      </footer>

      {/* Countdown Overlay (Synchronized 3-2-1-📸) */}
      {captureSession && (
        <CountdownOverlay
          session={captureSession}
          toLocalTime={toLocalTime}
          onCaptureTrigger={handleCaptureTrigger}
          onCancel={handleCancelCountdown}
          retakePoseNumber={retakeTargetIndex !== null ? retakeTargetIndex + 1 : undefined}
        />
      )}

      {/* Photobooth Customization Studio Modal */}
      {isStudioOpen && capturedFrames.length > 0 && (
        <CapturePreviewModal
          capturedFrames={capturedFrames}
          roomId={room.id}
          onRetake={handleRetake}
          onRetakeSingle={handleRetakeSingle}
        />
      )}

      {/* Mobile QR Code Modal */}
      {isQrOpen && <QrModal roomId={room.id} onClose={() => setIsQrOpen(false)} />}

      {/* Network & TURN Relay Modal */}
      <NetworkSettingsModal
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
      />
    </main>
  );
}
