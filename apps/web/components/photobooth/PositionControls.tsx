'use client';

import React from 'react';
import { ParticipantPosition } from '@photobooth/shared';
import { Move, ZoomIn, ZoomOut, FlipHorizontal, RotateCcw } from 'lucide-react';

interface PositionControlsProps {
  position: ParticipantPosition;
  onUpdatePosition: (updates: Partial<ParticipantPosition>) => void;
  onClose?: () => void;
}

export const PositionControls: React.FC<PositionControlsProps> = ({
  position,
  onUpdatePosition,
  onClose,
}) => {
  const currentX = position.x || 0;
  const currentY = position.y || 0;
  const currentScale = position.scale || 1.0;
  const currentMirror = position.mirror !== false;

  const handleNudge = (dx: number, dy: number) => {
    onUpdatePosition({
      x: Math.max(-100, Math.min(100, currentX + dx)),
      y: Math.max(-100, Math.min(100, currentY + dy)),
    });
  };

  const handleZoom = (delta: number) => {
    onUpdatePosition({
      scale: Math.max(0.5, Math.min(2.5, +(currentScale + delta).toFixed(2))),
    });
  };

  const handleReset = () => {
    onUpdatePosition({
      x: 0,
      y: 0,
      scale: 1.0,
      mirror: true,
    });
  };

  return (
    <div className="retro-card p-4 rounded-2xl w-full max-w-sm mx-auto shadow-retro border-2 border-[#282A2B] bg-[#F4EFE6] text-[#282A2B] select-none">
      <div className="flex items-center justify-between pb-2.5 border-b-2 border-[#282A2B]/15">
        <h3 className="font-retro font-bold text-sm flex items-center gap-1.5 text-[#282A2B] tracking-wide">
          <Move className="w-4 h-4 text-[#D67C65]" />
          POSE & FRAMING
        </h3>
        <button
          onClick={handleReset}
          className="retro-btn-cream flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-[#282A2B] shadow-retro-sm"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* D-Pad for Nudging */}
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex flex-col items-center">
          <button
            onClick={() => handleNudge(0, -5)}
            className="w-8 h-8 rounded-lg bg-white/80 hover:bg-[#D67C65] hover:text-white border-2 border-[#282A2B] shadow-retro-sm flex items-center justify-center active:translate-y-0.5 active:shadow-none transition text-xs font-bold"
            title="Move Up"
          >
            ▲
          </button>
          <div className="flex gap-2 my-1">
            <button
              onClick={() => handleNudge(-5, 0)}
              className="w-8 h-8 rounded-lg bg-white/80 hover:bg-[#D67C65] hover:text-white border-2 border-[#282A2B] shadow-retro-sm flex items-center justify-center active:translate-y-0.5 active:shadow-none transition text-xs font-bold"
              title="Move Left"
            >
              ◀
            </button>
            <div className="w-8 h-8 flex items-center justify-center text-[10px] text-[#282A2B]/60 font-mono">
              ●
            </div>
            <button
              onClick={() => handleNudge(5, 0)}
              className="w-8 h-8 rounded-lg bg-white/80 hover:bg-[#D67C65] hover:text-white border-2 border-[#282A2B] shadow-retro-sm flex items-center justify-center active:translate-y-0.5 active:shadow-none transition text-xs font-bold"
              title="Move Right"
            >
              ▶
            </button>
          </div>
          <button
            onClick={() => handleNudge(0, 5)}
            className="w-8 h-8 rounded-lg bg-white/80 hover:bg-[#D67C65] hover:text-white border-2 border-[#282A2B] shadow-retro-sm flex items-center justify-center active:translate-y-0.5 active:shadow-none transition text-xs font-bold"
            title="Move Down"
          >
            ▼
          </button>
        </div>

        {/* Zoom & Mirror Controls */}
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="flex items-center justify-between bg-white/80 p-2 rounded-xl border-2 border-[#282A2B] shadow-retro-sm">
            <span className="text-xs text-[#282A2B] font-mono font-bold">Zoom</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleZoom(-0.1)}
                className="w-7 h-7 rounded-lg bg-[#F4EFE6] hover:bg-[#D67C65] hover:text-white border border-[#282A2B] flex items-center justify-center transition active:scale-95"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold w-8 text-center text-[#282A2B]">
                {currentScale.toFixed(1)}x
              </span>
              <button
                onClick={() => handleZoom(0.1)}
                className="w-7 h-7 rounded-lg bg-[#F4EFE6] hover:bg-[#D67C65] hover:text-white border border-[#282A2B] flex items-center justify-center transition active:scale-95"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <button
            onClick={() => onUpdatePosition({ mirror: !currentMirror })}
            className={`flex items-center justify-between p-2 rounded-xl border-2 border-[#282A2B] shadow-retro-sm text-xs font-bold transition ${
              currentMirror
                ? 'bg-[#D67C65] text-white'
                : 'bg-white/80 text-[#282A2B]'
            }`}
          >
            <span className="flex items-center gap-1.5 font-mono">
              <FlipHorizontal className="w-3.5 h-3.5" />
              Mirror Mode
            </span>
            <span className="text-[10px] font-retro uppercase tracking-wider">
              {currentMirror ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
