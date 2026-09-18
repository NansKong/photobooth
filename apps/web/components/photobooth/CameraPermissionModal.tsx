'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, AlertCircle, ArrowRight, Loader2, RefreshCw, Sparkles, SwitchCamera, Info } from 'lucide-react';

interface CameraPermissionModalProps {
  name: string;
  setName: (name: string) => void;
  localStream: MediaStream | null;
  hasPermission: boolean | null;
  error: string | null;
  isLoading?: boolean;
  isConnected: boolean;
  isStandalone?: boolean;
  isVirtualStream?: boolean;
  onRequestPermission: () => void;
  onUseDemoCamera?: () => void;
  onRetryConnection?: () => void;
  onToggleFacing?: () => void;
  facingMode?: 'user' | 'environment';
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
  isStandalone = false,
  isVirtualStream = false,
  onRequestPermission,
  onUseDemoCamera,
  onRetryConnection,
  onToggleFacing,
  facingMode = 'user',
  onConfirmJoin,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const secure = window.isSecureContext ?? true;
      setIsSecure(secure);
    }
  }, []);

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

  const isCameraReady = !!localStream && hasPermission;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn select-none overflow-y-auto">
      <div className="w-full max-w-md retro-card p-5 sm:p-7 text-center relative my-auto">
        {/* Header Icon */}
        <div className="w-12 h-12 rounded-2xl bg-[#6BA3A9] border-2 border-[#282A2B] shadow-retro-sm flex items-center justify-center text-white mx-auto mb-2.5">
          <Camera className="w-6 h-6" />
        </div>

        <h2 className="font-retro text-2xl sm:text-3xl text-[#282A2B] tracking-wide">
          GET READY TO POSE
        </h2>
        <p className="text-[#282A2B]/80 text-xs sm:text-sm mt-1 max-w-xs mx-auto font-medium">
          Check your camera preview, set your nickname, and step into the vintage photobooth.
        </p>

        {/* Live Camera Preview Box (Polaroid Framed) */}
        <div className="my-4 w-full aspect-video rounded-xl overflow-hidden bg-[#282A2B] border-2 border-[#282A2B] relative shadow-inner flex items-center justify-center">
          {isCameraReady ? (
            <>
              <video
                ref={handleVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F4EFE6] border border-[#282A2B] text-[10px] font-retro text-[#282A2B] shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {isVirtualStream ? 'DEMO CAMERA • READY' : 'CAMERA READY • KODAK COLOR'}
              </div>

              {/* Flip camera button for mobile devices */}
              {onToggleFacing && (
                <button
                  type="button"
                  onClick={onToggleFacing}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#F4EFE6] border border-[#282A2B] text-[#282A2B] shadow-retro-sm hover:bg-white active:scale-95 transition"
                  title="Flip camera"
                >
                  <SwitchCamera className="w-4 h-4 text-[#D67C65]" />
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center p-4 text-center w-full">
              {isLoading ? (
                <>
                  <Loader2 className="w-8 h-8 text-[#D67C65] animate-spin mb-2" />
                  <p className="text-xs text-[#F4EFE6] font-retro tracking-wide">Connecting to camera...</p>
                  <p className="text-[11px] text-[#F4EFE6]/60 mt-1 font-mono">Initializing video source</p>
                </>
              ) : error ? (
                <div className="flex flex-col items-center max-w-xs">
                  <AlertCircle className="w-7 h-7 text-[#D67C65] mb-2" />
                  <p className="text-[11px] sm:text-xs text-[#F4EFE6] leading-relaxed font-medium">
                    {error}
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={onRequestPermission}
                      disabled={isLoading}
                      className="px-3.5 py-1.5 rounded-xl retro-btn-terracotta text-xs font-bold"
                    >
                      <span>Try Again</span>
                    </button>

                    {onUseDemoCamera && (
                      <button
                        type="button"
                        onClick={onUseDemoCamera}
                        className="px-3.5 py-1.5 rounded-xl retro-btn-cream text-xs font-bold text-[#282A2B]"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#DDA853] inline mr-1" />
                        <span>Use Demo Camera</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center max-w-xs">
                  <Camera className="w-8 h-8 text-[#DDA853] mb-2 animate-bounce" />
                  <p className="text-xs text-[#F4EFE6] font-retro tracking-wider">CAMERA ACCESS REQUIRED</p>
                  <p className="text-[11px] text-[#F4EFE6]/70 mt-0.5">
                    Tap below to allow camera & microphone access in your browser.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-2 mt-3 w-full justify-center">
                    <button
                      type="button"
                      onClick={onRequestPermission}
                      disabled={isLoading}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl retro-btn-terracotta text-xs font-bold shadow-retro-sm active:scale-95"
                    >
                      <span>Grant Camera Access</span>
                    </button>

                    {onUseDemoCamera && (
                      <button
                        type="button"
                        onClick={onUseDemoCamera}
                        className="w-full sm:w-auto px-3.5 py-2 rounded-xl retro-btn-cream text-xs font-bold text-[#282A2B] shadow-retro-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#DDA853] inline mr-1" />
                        <span>Use Demo Camera</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Insecure Context Warning for Mobile LAN */}
        {!isSecure && (
          <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-left flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-900 leading-tight">
              <span className="font-bold">Mobile HTTP Warning:</span> Mobile browsers restrict physical cameras over HTTP. Tap <strong className="underline cursor-pointer" onClick={onUseDemoCamera}>Use Demo Camera</strong> above to test all photobooth features right now!
            </div>
          </div>
        )}

        {/* Browser Permission Help Toggle */}
        <div className="mb-3 text-left">
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="text-[11px] font-mono text-[#282A2B]/70 hover:text-[#D67C65] underline flex items-center gap-1 mx-auto"
          >
            <Info className="w-3 h-3" />
            <span>{showHelp ? 'Hide permission guide' : 'Camera permission blocked? Tap for help'}</span>
          </button>

          {showHelp && (
            <div className="mt-2 p-3 rounded-xl bg-white border border-[#282A2B]/20 text-[11px] text-[#282A2B]/80 font-mono space-y-1.5 animate-fadeIn">
              <p className="font-bold text-[#282A2B]">How to allow camera:</p>
              <p>• <strong>iPhone / iPad (Safari):</strong> Tap the <strong>aA</strong> icon in the search bar ➔ Website Settings ➔ Camera ➔ Set to <strong>Allow</strong>.</p>
              <p>• <strong>Android (Chrome):</strong> Tap the <strong>Lock / Settings</strong> icon next to the URL ➔ Permissions ➔ Camera ➔ <strong>Allow</strong>.</p>
              <p>• <strong>Desktop:</strong> Click the camera icon on the right/left of the address bar and click <strong>Always Allow</strong>.</p>
            </div>
          )}
        </div>

        {/* Server Connection Status Banner */}
        <div className="mb-4 flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#F4EFE6] border border-[#282A2B]/20 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-[#DDA853] animate-ping'
              }`}
            />
            <span className="text-[#282A2B] text-[11px] font-bold">
              {isConnected
                ? 'Server Connected'
                : 'Connecting to Server...'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isConnected && onRetryConnection && (
              <button
                type="button"
                onClick={onRetryConnection}
                className="text-[11px] font-bold text-[#D67C65] hover:underline flex items-center gap-0.5"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}

            {isConnected && (
              <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                Ready
              </span>
            )}
          </div>
        </div>

        {/* Name Input & Join Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <div className="text-left">
            <label className="block text-xs font-retro text-[#282A2B] uppercase tracking-wider mb-1">
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

          <div className="flex flex-col gap-2 mt-1">
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full py-3 sm:py-3.5 rounded-xl retro-btn-terracotta flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-xs sm:text-sm font-retro uppercase tracking-wider"
            >
              <span>{isStandalone || isConnected ? 'Enter Photobooth' : 'Enter in Solo Mode'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
