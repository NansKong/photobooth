'use client';

import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, Check } from 'lucide-react';

interface QrModalProps {
  roomId: string;
  onClose: () => void;
}

export const QrModal: React.FC<QrModalProps> = ({ roomId, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = React.useState(false);

  const roomUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (canvasRef.current && roomUrl) {
      QRCode.toCanvas(canvasRef.current, roomUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#080c14',
          light: '#ffffff',
        },
      }).catch((e) => console.error('QR code generation error:', e));
    }
  }, [roomUrl]);

  const handleCopy = () => {
    if (roomUrl) {
      navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#282A2B]/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-sm bg-[#F4EFE6] border-3 border-[#282A2B] rounded-3xl p-6 shadow-retro flex flex-col items-center text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#282A2B]/70 hover:text-[#282A2B] p-1.5 rounded-lg border border-[#282A2B]/20 hover:border-[#282A2B] bg-white/50 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-[#D67C65]/20 border-2 border-[#282A2B] flex items-center justify-center text-[#D67C65] mb-2 shadow-retro-sm">
          <Smartphone className="w-6 h-6" />
        </div>

        <h3 className="font-retro font-bold text-xl text-[#282A2B] tracking-wide">
          JOIN ON MOBILE
        </h3>
        <p className="text-[#282A2B]/70 text-xs font-mono mt-1 mb-4">
          Scan with your camera to enter Studio #{roomId}
        </p>

        <div className="p-3.5 bg-white rounded-2xl border-2 border-[#282A2B] shadow-retro-sm">
          <canvas ref={canvasRef} className="block rounded-lg" />
        </div>

        <button
          onClick={handleCopy}
          className="retro-btn-terracotta mt-5 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-[#282A2B] text-xs font-bold font-mono shadow-retro-sm transition"
        >
          {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
          <span>{copied ? 'COPIED LINK!' : 'COPY STUDIO LINK'}</span>
        </button>
      </div>
    </div>
  );
};
