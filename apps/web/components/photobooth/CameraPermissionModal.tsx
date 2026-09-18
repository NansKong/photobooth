'use client';

import React, { useEffect, useRef } from 'react';
import { Camera, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

interface CameraPermissionModalProps {
  name: string;
  setName: (name: string) => void;
  localStream: MediaStream | null;
  hasPermission: boolean | null;
  error: string | null;
  isLoading?: boolean;
  isConnected: boolean;
  onRequestPermission: () => void;
  onConfirmJoin: () => void;
}

export const CameraPermissionModal: React.FC<CameraPermissionModalProps> = ({
  name,
  setName,
  localStream,
  hasPermission,
  error,
  isLoading = false,
  isConnected,
  onRequestPermission,
  onConfirmJoin,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Synchronize localStream whenever it changes or the video element mounts
  const handleVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && localStream) {
      if (el.srcObject !== localStream) {
        el.srcObject = localStream;
      }
      el.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (videoRef.current && localStream) {
      if (videoRef.current.srcObject !== localStream) {
        videoRef.current.srcObject = localStream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirmJoin();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn select-none">
      <div className="w-full max-w-md retro-card p-6 sm:p-7 text-center relative">
        {/* Header Icon */}
        <div className="w-12 h-12 rounded-2xl bg-[#6BA3A9] border-2 border-[#282A2B] shadow-retro-sm flex items-center justify-center text-white mx-auto mb-3">
          <Camera className="w-6 h-6" />
        </div>

        <h2 className="font-retro text-2xl text-[#282A2B] tracking-wide">
          GET READY TO POSE
        </h2>
        <p className="text-[#282A2B]/80 text-xs sm:text-sm mt-1 max-w-xs mx-auto font-medium">
          Check your camera preview and choose your photobooth name.
        </p>

        {/* Live Camera Preview Box (Polaroid Framed) */}
        <div className="my-5 w-full aspect-video rounded-xl overflow-hidden bg-[#282A2B] border-2 border-[#282A2B] relative shadow-inner flex items-center justify-center">
          {localStream && hasPermission ? (
            <>
              <video
                ref={handleVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#F4EFE6] border border-[#282A2B] text-[10px] font-retro text-[#282A2B] shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                CAMERA READY • KODAK COLOR
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center p-4 text-center">
              {isLoading ? (
                <>
                  <Loader2 className="w-8 h-8 text-[#D67C65] animate-spin mb-2" />
                  <p className="text-xs text-[#F4EFE6] font-retro tracking-wide">Connecting to camera...</p>
                  <p className="text-[11px] text-[#F4EFE6]/60 mt-1 font-mono">Initializing video source</p>
                </>
              ) : error ? (
                <>
                  <AlertCircle className="w-8 h-8 text-[#D67C65] mb-2" />
                  <p className="text-xs text-[#F4EFE6] max-w-xs leading-relaxed font-medium">{error}</p>
                  <button
                    type="button"
                    onClick={onRequestPermission}
                    disabled={isLoading}
                    className="mt-3 px-4 py-1.5 rounded-xl retro-btn-terracotta text-xs font-bold"
                  >
                    <span>Try Again</span>
                  </button>
                </>
              ) : (
                <>
                  <Camera className="w-8 h-8 text-[#F4EFE6]/60 mb-2 animate-pulse" />
                  <p className="text-xs text-[#F4EFE6] font-medium">Requesting camera access...</p>
                  <button
                    type="button"
                    onClick={onRequestPermission}
                    disabled={isLoading}
                    className="mt-3 px-4 py-2 rounded-xl retro-btn-terracotta text-xs font-bold"
                  >
                    Grant Camera Access
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Name Input & Join Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3.5">
          <div className="text-left">
            <label className="block text-xs font-retro text-[#282A2B] uppercase tracking-wider mb-1.5">
              Your Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex, Maya, Jordan"
              maxLength={24}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-[#282A2B] text-[#282A2B] placeholder-[#282A2B]/40 focus:outline-none focus:border-[#D67C65] text-sm font-semibold shadow-inner transition"
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !isConnected}
            className="w-full py-3.5 rounded-xl retro-btn-terracotta flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-sm"
          >
            <span>{isConnected ? 'Enter Photobooth' : 'Connecting to server…'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
