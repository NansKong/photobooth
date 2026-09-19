'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useCallback } from 'react';
import { PhotoLayoutConfig, PHOTO_LAYOUTS, Room } from '@photobooth/shared';
import { renderPhotoboothComposition } from '@/lib/canvas-renderer';

/** Handle exposed to parent for direct access to the off-DOM video element map (BUG-2 fix) */
export interface PhotoboothCanvasHandle {
  getVideoElements: () => Map<string, HTMLVideoElement>;
}

interface PhotoboothCanvasProps {
  room: Room;
  selfParticipantId: string;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  onUpdatePosition: (updates: { x: number; y: number; scale?: number; mirror?: boolean }) => void;
  isCapturing?: boolean;
}

export const PhotoboothCanvas = forwardRef<PhotoboothCanvasHandle, PhotoboothCanvasProps>(function PhotoboothCanvas({
  room,
  selfParticipantId,
  localStream,
  remoteStreams,
  onUpdatePosition,
  isCapturing = false,
}, ref) {
  // Expose the off-DOM video element map so the capture handler can read it
  // without relying on document.querySelectorAll (which can't find detached elements)
  useImperativeHandle(ref, () => ({
    getVideoElements: () => videoElementsRef.current,
  }));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Hidden video elements map
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Mouse/Touch drag state for interactive posing
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; initialPosX: number; initialPosY: number }>({
    x: 0,
    y: 0,
    initialPosX: 0,
    initialPosY: 0,
  });

  const layoutConfig: PhotoLayoutConfig =
    PHOTO_LAYOUTS[room.layoutId] || PHOTO_LAYOUTS['duo-classic'];

  // Helper to maintain hidden video elements synchronized with streams
  const syncVideoElement = useCallback((participantId: string, stream: MediaStream | null) => {
    let video = videoElementsRef.current.get(participantId);

    if (!stream) {
      if (video) {
        video.srcObject = null;
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
        videoElementsRef.current.delete(participantId);
      }
      return;
    }

    if (!video) {
      video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true; // prevent feedback and satisfy autoplay policy
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.style.position = 'fixed';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '320px';
      video.style.height = '240px';
      video.style.opacity = '0.001';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-9999';
      if (typeof document !== 'undefined') {
        document.body.appendChild(video);
      }
      videoElementsRef.current.set(participantId, video);
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video?.play().catch(() => {});
      };
      video.oncanplay = () => {
        video?.play().catch(() => {});
      };
      video.play().catch(() => {});
    } else if (video.paused) {
      video.play().catch(() => {});
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      videoElementsRef.current.forEach((video) => {
        video.srcObject = null;
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
      });
      videoElementsRef.current.clear();
    };
  }, []);

  // Update local video element
  useEffect(() => {
    if (selfParticipantId) {
      syncVideoElement(selfParticipantId, localStream);
    }
  }, [selfParticipantId, localStream, syncVideoElement]);

  // Update remote video elements
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([pId, stream]) => {
      syncVideoElement(pId, stream);
    });

    // Clean up videos of removed participants
    const activeIds = new Set([selfParticipantId, ...Object.keys(remoteStreams)]);
    videoElementsRef.current.forEach((_, id) => {
      if (!activeIds.has(id)) {
        syncVideoElement(id, null);
      }
    });
  }, [remoteStreams, selfParticipantId, syncVideoElement]);

  // 60FPS Continuous Render Loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          renderPhotoboothComposition(
            ctx,
            canvas.width,
            canvas.height,
            room,
            videoElementsRef.current,
            selfParticipantId,
            {
              showGuidelines: !isCapturing,
              isFinalCapture: false,
            }
          );
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [room, selfParticipantId, isCapturing]);

  // Handle Drag Posing
  const handlePointerDown = (e: React.PointerEvent) => {
    const self = room.participants.find((p) => p.id === selfParticipantId);
    if (!self) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPosX: self.position?.x || 0,
      initialPosY: self.position?.y || 0,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const self = room.participants.find((p) => p.id === selfParticipantId);
    if (!self) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    // Convert pixel delta to percentage offset based on container
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const percentX = (deltaX / (rect.width * 0.5)) * 100;
    const percentY = (deltaY / (rect.height * 0.5)) * 100;

    const newX = Math.max(-100, Math.min(100, dragStartRef.current.initialPosX + percentX));
    const newY = Math.max(-100, Math.min(100, dragStartRef.current.initialPosY + percentY));

    onUpdatePosition({
      x: Math.round(newX),
      y: Math.round(newY),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center select-none overflow-hidden"
    >
      <div
        className="relative max-w-full max-h-full rounded-2xl overflow-hidden p-1.5 sm:p-2.5 bg-[#FFFFFF] border-2 border-[#282A2B] shadow-retro transition-all duration-300 cursor-grab active:cursor-grabbing"
        style={{
          aspectRatio: `${layoutConfig.aspectRatio}`,
          width: 'min(100%, calc(62dvh * ' + layoutConfig.aspectRatio + '))',
          maxHeight: 'calc(100% - 8px)',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          width={layoutConfig.canvasWidth}
          height={layoutConfig.canvasHeight}
          className="w-full h-full block object-contain rounded-xl"
        />

        {/* Subtle interactive hint */}
        <div className="absolute top-2 sm:top-4 left-2 sm:left-4 pointer-events-none opacity-80 hover:opacity-100 transition-opacity">
          <span className="text-[9px] sm:text-[10px] font-retro tracking-wide bg-[#F4EFE6] text-[#282A2B] px-2 sm:px-3 py-0.5 sm:py-1 rounded-md border border-[#282A2B] shadow-sm">
            Drag to adjust pose
          </span>
        </div>
      </div>
    </div>
  );
});
