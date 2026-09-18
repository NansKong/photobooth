'use client';

import React, { useState } from 'react';
import { Participant, Room } from '@photobooth/shared';
import { Copy, Check, Users, Sparkles, QrCode, ArrowRight, Video } from 'lucide-react';

interface WaitingRoomProps {
  room: Room;
  selfParticipantId: string;
  onEnterPhotobooth: () => void;
  onOpenQrModal: () => void;
  localStream: MediaStream | null;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  room,
  selfParticipantId,
  onEnterPhotobooth,
  onOpenQrModal,
  localStream,
}) => {
  const [copied, setCopied] = useState(false);

  const inviteUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyLink = async () => {
    if (inviteUrl) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard permission denied or unavailable — silently ignore
      }
    }
  };

  const selfParticipant = room.participants.find((p) => p.id === selfParticipantId);
  const otherParticipants = room.participants.filter((p) => p.id !== selfParticipantId);

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] p-4 sm:p-6 w-full max-w-2xl mx-auto animate-fadeIn select-none">
      <div className="w-full retro-card p-6 sm:p-8 text-center relative">
        {/* Photobooth Tag & Room Badge */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-retro uppercase tracking-wider bg-[#6BA3A9] text-white border-2 border-[#282A2B] shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#DDA853]" />
            Vintage Photobooth Lounge
          </span>
        </div>

        <h1 className="font-retro text-3xl sm:text-4xl text-[#282A2B] tracking-wide mt-1">
          WAITING LOUNGE
        </h1>
        <p className="text-[#282A2B]/80 text-sm mt-1 max-w-md mx-auto font-medium">
          Share your room code with friends to step into the photobooth together!
        </p>

        {/* Room Code & Copy Card (Styled as Vintage Ticket) */}
        <div className="mt-6 w-full bg-white border-2 border-[#282A2B] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-[#DDA853] border-2 border-[#282A2B] flex items-center justify-center text-[#282A2B] font-retro text-lg shadow-sm">
              #
            </div>
            <div>
              <span className="text-[10px] text-[#282A2B]/70 uppercase tracking-wider font-bold">
                Photobooth Room Code
              </span>
              <p className="font-mono font-black text-2xl tracking-widest text-[#D67C65]">
                {room.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyLink}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-retro uppercase tracking-wider retro-btn-terracotta active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Link Copied!' : 'Copy Invite Link'}</span>
            </button>

            <button
              onClick={onOpenQrModal}
              className="p-2.5 rounded-xl retro-btn-cream text-[#282A2B]"
              title="Show QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Participant Presence List */}
        <div className="w-full mt-6 text-left">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-xs font-retro uppercase tracking-wider text-[#282A2B] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#D67C65]" />
              In the Booth ({room.participants.length})
            </span>
            <span className="text-xs font-mono font-bold text-[#D67C65]">
              {room.participants.length === 1 ? 'Waiting for friends...' : 'Ready to pose!'}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {/* Self Participant */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-[#282A2B] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#D67C65] border border-[#282A2B] flex items-center justify-center font-retro text-xs text-white">
                  {selfParticipant?.name?.charAt(0).toUpperCase() || 'Y'}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#282A2B]">
                    {selfParticipant?.name || 'You'} <span className="text-xs text-[#D67C65]">(You)</span>
                  </p>
                  <p className="text-[11px] text-[#282A2B]/60 font-mono">
                    {selfParticipant?.isHost ? 'Booth Host' : 'Participant'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-retro">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse border border-emerald-700" />
                  Camera Ready
                </span>
              </div>
            </div>

            {/* Other Participants */}
            {otherParticipants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-[#282A2B] shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#6BA3A9] border border-[#282A2B] flex items-center justify-center font-retro text-xs text-white">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#282A2B]">{p.name}</p>
                    <p className="text-[11px] text-[#282A2B]/60 font-mono">
                      {p.isHost ? 'Booth Host' : 'Participant'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-retro">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                </div>
              </div>
            ))}

            {otherParticipants.length === 0 && (
              <div className="p-4 rounded-xl border-2 border-dashed border-[#282A2B]/40 text-center text-xs text-[#282A2B]/70 font-medium flex items-center justify-center gap-2 bg-[#F4EFE6]">
                <span className="w-2 h-2 rounded-full bg-[#D67C65] animate-ping" />
                Waiting for someone to join with room code #{room.id}...
              </div>
            )}
          </div>
        </div>

        {/* Enter Photobooth Action */}
        <div className="mt-8 w-full">
          <button
            onClick={onEnterPhotobooth}
            className="w-full py-3.5 px-6 rounded-2xl font-retro text-sm sm:text-base retro-btn-terracotta flex items-center justify-center gap-2 active:scale-95 uppercase tracking-wider"
          >
            <span>{otherParticipants.length === 0 ? 'Enter Photobooth (Solo Mode)' : 'Enter Photobooth Canvas'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          {otherParticipants.length === 0 && (
            <p className="text-[11px] font-mono text-[#282A2B]/60 mt-2 text-center">
              You can click pictures by yourself right now, or invite a friend anytime with the room code!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
