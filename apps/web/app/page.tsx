'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Sparkles, Users, ArrowRight, ShieldCheck, Zap, Globe, Heart } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { SocketEvents } from '@photobooth/shared';

export default function LandingPage() {
  const router = useRouter();
  const { socket, isConnected } = useSocket();

  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [hostName, setHostName] = useState('');

  const handleCreateRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!socket || isCreating) return;

    setIsCreating(true);

    const chosenName = hostName.trim() || `Guest ${Math.floor(100 + Math.random() * 900)}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem('photobooth_username', chosenName);
    }

    socket.emit(
      SocketEvents.ROOM_CREATE,
      { name: chosenName },
      (res: any) => {
        if (res?.success && res.room) {
          sessionStorage.setItem(`photobooth_pid_${res.room.id}`, res.participant.id);
          router.push(`/room/${res.room.id}`);
        } else {
          setIsCreating(false);
          alert('Failed to create room. Please try again.');
        }
      }
    );
  };

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (!cleanCode) return;
    router.push(`/room/${cleanCode}`);
  };

  return (
    <div className="relative min-h-screen retro-pattern text-[#282A2B] flex flex-col justify-between overflow-hidden select-none">
      {/* Navigation Header */}
      <nav className="w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#F4EFE6] border-2 border-[#282A2B] shadow-retro-sm flex items-center justify-center">
            <Camera className="w-6 h-6 text-[#D67C65]" />
          </div>
          <div>
            <span className="font-retro text-2xl tracking-wide text-[#F4EFE6] drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
              RETRO<span className="text-[#D67C65]">PHOTOBOOTH</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F4EFE6] border-2 border-[#282A2B] shadow-retro-sm text-xs font-retro">
            <span
              className={`w-2.5 h-2.5 rounded-full border border-[#282A2B] ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-[#D67C65]'
              }`}
            />
            <span className="text-[#282A2B]">
              {isConnected ? 'BOOTH READY' : 'CONNECTING...'}
            </span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="w-full max-w-4xl mx-auto px-6 py-8 flex flex-col items-center text-center z-20">
        {/* 3D Layered Retro Title (Matching Reference Image 1) */}
        <h1 className="retro-3d-title text-6xl sm:text-8xl md:text-9xl mb-2 select-none">
          RETRO
        </h1>

        {/* Vintage Ribbon Banner with Dots (Matching Reference Image 1) */}
        <div className="flex items-center justify-center gap-3 mb-8 w-full max-w-xl">
          <span className="text-[#F4EFE6] font-black tracking-widest text-base sm:text-lg opacity-80">
            • • • •
          </span>
          <div className="retro-ribbon px-6 py-1.5 rounded-md border-2 border-[#282A2B] shadow-retro-sm">
            <span className="text-xs sm:text-sm tracking-widest">
              VIRTUAL PHOTOBOOTH STUDIO
            </span>
          </div>
          <span className="text-[#F4EFE6] font-black tracking-widest text-base sm:text-lg opacity-80">
            • • • •
          </span>
        </div>

        {/* Centerpiece: Vintage Camera & Polaroid Preview Card (Matching Reference Image 1) */}
        <div className="w-full max-w-lg retro-card p-4 sm:p-5 mb-8 relative">
          <div className="bg-[#282A2B] rounded-xl overflow-hidden aspect-[16/10] relative flex items-center justify-center border-2 border-[#282A2B] shadow-inner">
            {/* Vintage Kodak Camera Center Illustration */}
            <div className="relative flex flex-col items-center justify-center w-full h-full bg-[#3d271d] p-6 text-center">
              {/* Twin Lens Camera Face */}
              <div className="w-48 h-36 rounded-2xl bg-[#5c3a28] border-4 border-[#282A2B] shadow-2xl flex flex-col items-center justify-between p-3 relative">
                {/* Kodak Brand Plate */}
                <div className="px-3 py-0.5 rounded bg-[#DDA853] text-[#282A2B] font-retro text-[10px] tracking-wider uppercase border border-[#282A2B]">
                  KODAK
                </div>
                {/* Twin Lenses */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#1C1D1E] border-3 border-[#DDA853] shadow-inner flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-cyan-400/40" />
                  </div>
                  <div className="w-12 h-12 rounded-full bg-[#1C1D1E] border-3 border-[#DDA853] shadow-inner flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-cyan-400/40" />
                  </div>
                </div>
                {/* Shutter Label */}
                <span className="text-[10px] text-[#F4EFE6] font-mono tracking-widest opacity-80">
                  DUAL VIEWFINDER
                </span>
              </div>
            </div>

            {/* Polaroid Camera Banner */}
            <div className="absolute bottom-2 px-4 py-1 rounded bg-[#F4EFE6] border border-[#282A2B] text-[11px] font-retro text-[#282A2B] tracking-wider uppercase">
              KODAK CAMERA • DUAL PORTRAIT
            </div>
          </div>

          {/* Retro Quote Caption (Matching Reference Image 1) */}
          <p className="mt-4 font-retro text-xs sm:text-sm text-[#282A2B] uppercase tracking-wider">
            &ldquo;TAKE PHOTOS TOGETHER, EVEN WHEN YOU ARE MILES APART.&rdquo;
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
          <button
            onClick={() => handleCreateRoom()}
            disabled={isCreating}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl retro-btn-terracotta flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 text-sm sm:text-base"
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Setting Up Booth...
              </span>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span>Open Photobooth</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button
            onClick={() => setIsJoinOpen(true)}
            className="w-full sm:w-auto py-3.5 px-6 rounded-2xl retro-btn-cream flex items-center justify-center gap-2 active:scale-95 text-sm sm:text-base"
          >
            <Users className="w-5 h-5 text-[#D67C65]" />
            <span>Join with Code</span>
          </button>
        </div>

        {/* Join Code Vintage Dialog */}
        {isJoinOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-sm retro-card p-6 text-left relative">
              <div className="flex items-center justify-between border-b-2 border-[#282A2B] pb-3 mb-4">
                <h3 className="font-retro text-xl text-[#282A2B]">Join Photobooth</h3>
                <span className="text-xs font-mono text-[#D67C65] font-bold">EST. 2026</span>
              </div>
              <p className="text-xs text-[#282A2B]/80 mb-4 font-medium">
                Enter the 6-character room code shared by your friend:
              </p>

              <form onSubmit={handleJoinWithCode} className="flex flex-col gap-3">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 9VHYB5"
                  maxLength={8}
                  autoFocus
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white border-2 border-[#282A2B] text-[#282A2B] font-mono font-bold tracking-widest text-center text-xl placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder-slate-400 focus:outline-none focus:border-[#D67C65] shadow-inner transition uppercase"
                />

                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsJoinOpen(false)}
                    className="flex-1 py-2.5 rounded-xl retro-btn-cream text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!joinCode.trim()}
                    className="flex-1 py-2.5 rounded-xl retro-btn-terracotta text-xs font-bold disabled:opacity-50"
                  >
                    Enter Booth
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Vintage Feature Highlight Badges */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left w-full max-w-3xl">
          <div className="retro-card p-4">
            <div className="w-8 h-8 rounded-xl bg-[#6BA3A9] border-2 border-[#282A2B] flex items-center justify-center text-white mb-2.5">
              <Globe className="w-4 h-4" />
            </div>
            <h4 className="font-retro text-sm text-[#282A2B]">Live Video Mesh</h4>
            <p className="text-xs text-[#282A2B]/80 mt-1 leading-relaxed">
              Real-time WebRTC mesh so you see each other pose live with zero lag.
            </p>
          </div>

          <div className="retro-card p-4">
            <div className="w-8 h-8 rounded-xl bg-[#D67C65] border-2 border-[#282A2B] flex items-center justify-center text-white mb-2.5">
              <Zap className="w-4 h-4" />
            </div>
            <h4 className="font-retro text-sm text-[#282A2B]">Synced 3-2-1 Shutter</h4>
            <p className="text-xs text-[#282A2B]/80 mt-1 leading-relaxed">
              NTP clock synchronization snaps all 4 poses simultaneously across devices.
            </p>
          </div>

          <div className="retro-card p-4">
            <div className="w-8 h-8 rounded-xl bg-[#DDA853] border-2 border-[#282A2B] flex items-center justify-center text-[#282A2B] mb-2.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="font-retro text-sm text-[#282A2B]">100% Private</h4>
            <p className="text-xs text-[#282A2B]/80 mt-1 leading-relaxed">
              No signups, no cloud storage. Photographs are rendered right in your browser.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-6 border-t-2 border-[#282A2B]/20 flex flex-col sm:flex-row items-center justify-between text-xs font-retro text-[#F4EFE6] gap-2 z-20">
        <p>© {new Date().getFullYear()} VIRTUAL RETRO PHOTOBOOTH • ALL RIGHTS RESERVED.</p>
        <p className="flex items-center gap-1.5 text-[#F4EFE6]">
          CRAFTED FOR SHARED MEMORIES <Heart className="w-3.5 h-3.5 text-[#D67C65] inline fill-[#D67C65]" />
        </p>
      </footer>
    </div>
  );
}

