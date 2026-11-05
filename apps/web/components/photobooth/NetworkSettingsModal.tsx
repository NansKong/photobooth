'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';
import {
  CustomTurnConfig,
  getSavedTurnConfig,
  saveTurnConfig,
  clearTurnConfig,
  resolveIceServers,
  testIceConnectivity,
  IceDiagnosticResult,
} from '@/lib/ice-servers';

interface NetworkSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
  socketBaseUrl?: string | null;
}

export const NetworkSettingsModal: React.FC<NetworkSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
  socketBaseUrl,
}) => {
  const [mode, setMode] = useState<'default' | 'custom'>('default');
  const [turnUrls, setTurnUrls] = useState('');
  const [turnUsername, setTurnUsername] = useState('');
  const [turnCredential, setTurnCredential] = useState('');

  const [isTesting, setIsTesting] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<IceDiagnosticResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load saved configuration on mount
  useEffect(() => {
    if (!isOpen) return;
    const saved = getSavedTurnConfig();
    if (saved) {
      setMode(saved.mode === 'custom' ? 'custom' : 'default');
      setTurnUrls(saved.turnUrls || '');
      setTurnUsername(saved.turnUsername || '');
      setTurnCredential(saved.turnCredential || '');
    } else {
      setMode('default');
    }
    setDiagnosticResult(null);
    setStatusMessage(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const config: CustomTurnConfig = {
      mode,
      turnUrls: turnUrls.trim(),
      turnUsername: turnUsername.trim(),
      turnCredential: turnCredential.trim(),
    };

    saveTurnConfig(config);
    setStatusMessage('Settings saved successfully!');
    if (onConfigChanged) onConfigChanged();
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleReset = () => {
    clearTurnConfig();
    setMode('default');
    setTurnUrls('');
    setTurnUsername('');
    setTurnCredential('');
    setDiagnosticResult(null);
    setStatusMessage('Hosted Metered TURN restored.');
    if (onConfigChanged) onConfigChanged();
  };

  const handleRunDiagnostic = async () => {
    setIsTesting(true);
    setDiagnosticResult(null);
    setStatusMessage(null);

    try {
      const customUrls = turnUrls.split('\n').map((url) => url.trim()).filter(Boolean);
      const servers = mode === 'custom' && customUrls.length > 0
        ? [{ urls: customUrls, username: turnUsername.trim(), credential: turnCredential.trim() }]
        : await resolveIceServers(socketBaseUrl);
      const result = await testIceConnectivity(servers);
      setDiagnosticResult(result);
    } catch (err: any) {
      console.error('Diagnostic error:', err);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none overflow-y-auto">
      <div className="w-full max-w-lg retro-card p-5 sm:p-6 text-left relative my-auto max-h-[92dvh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#F4EFE6] border border-[#282A2B] text-[#282A2B] hover:bg-white active:scale-95 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#6BA3A9] border-2 border-[#282A2B] shadow-retro-sm flex items-center justify-center text-white">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-retro text-xl sm:text-2xl text-[#282A2B]">NETWORK & TURN RELAY</h3>
            <p className="text-[#282A2B]/70 text-xs font-mono">
              Fix laptop-to-laptop connections across different Wi-Fi networks
            </p>
          </div>
        </div>

        {/* Diagnostic Explanation Banner */}
        <div className="mb-4 p-3 rounded-xl bg-[#F4EFE6] border border-[#282A2B]/20 text-xs font-mono text-[#282A2B]/90 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[#D67C65]">
            <Zap className="w-3.5 h-3.5" />
            <span>Why is TURN Relay Required?</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Home Wi-Fi and office routers use <strong>Symmetric NAT</strong>. When connecting two laptops in different locations, direct peer-to-peer STUN fails. A <strong>TURN relay</strong> bounces encrypted media so the video feed connects instantly.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mb-4">
          <label className="block text-xs font-retro text-[#282A2B] uppercase tracking-wider mb-1.5">
            Relay Provider Mode
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#EBE4D5] border border-[#282A2B]/30 text-xs font-retro">
            <button
              type="button"
              onClick={() => setMode('default')}
              className={`py-1.5 px-2 rounded-lg text-center transition ${
                mode === 'default'
                  ? 'bg-white text-[#282A2B] shadow-sm font-bold border border-[#282A2B]'
                  : 'text-[#282A2B]/70 hover:text-[#282A2B]'
              }`}
            >
              Hosted TURN
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`py-1.5 px-2 rounded-lg text-center transition ${
                mode === 'custom'
                  ? 'bg-white text-[#282A2B] shadow-sm font-bold border border-[#282A2B]'
                  : 'text-[#282A2B]/70 hover:text-[#282A2B]'
              }`}
            >
              Custom TURN
            </button>
          </div>
        </div>

        {/* Mode C: Custom TURN Configuration */}
        {mode === 'custom' && (
          <div className="mb-4 p-3.5 rounded-xl bg-white border border-[#282A2B]/20 space-y-2.5 animate-fadeIn">
            <div>
              <label className="block text-[11px] font-mono text-[#282A2B]/80 mb-0.5">
                TURN URLs (one per line)
              </label>
              <textarea
                value={turnUrls}
                onChange={(e) => setTurnUrls(e.target.value)}
                placeholder="turn:relay.example.com:443?transport=tcp&#10;turn:relay.example.com:3478"
                rows={2}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[#282A2B]/30 bg-[#F4EFE6] focus:outline-none focus:border-[#D67C65]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-mono text-[#282A2B]/80 mb-0.5">
                  Username
                </label>
                <input
                  type="text"
                  value={turnUsername}
                  onChange={(e) => setTurnUsername(e.target.value)}
                  placeholder="username"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[#282A2B]/30 bg-[#F4EFE6] focus:outline-none focus:border-[#D67C65]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#282A2B]/80 mb-0.5">
                  Password / Credential
                </label>
                <input
                  type="password"
                  value={turnCredential}
                  onChange={(e) => setTurnCredential(e.target.value)}
                  placeholder="password"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[#282A2B]/30 bg-[#F4EFE6] focus:outline-none focus:border-[#D67C65]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Mode A: Default Info */}
        {mode === 'default' && (
          <div className="mb-4 p-3 rounded-xl bg-white border border-[#282A2B]/20 text-xs font-mono text-[#282A2B]/80">
            <p className="flex items-center gap-1.5 font-bold text-[#282A2B] mb-1">
              <Server className="w-3.5 h-3.5 text-[#6BA3A9]" />
              Hosted Metered TURN
            </p>
            <p className="text-[11px]">
              TURN relay is configured for everyone. No API key is needed here. The booth uses direct STUN when possible and Metered TURN when a relay is required. If you have your own relay, choose <strong>Custom TURN</strong>.
            </p>
          </div>
        )}

        {/* Live Connectivity Test Section */}
        <div className="mb-4 p-3 rounded-xl bg-[#F4EFE6] border border-[#282A2B]/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-retro text-[#282A2B]">ICE & RELAY TEST</span>
            <button
              type="button"
              onClick={handleRunDiagnostic}
              disabled={isTesting}
              className="px-3 py-1 rounded-lg retro-btn-terracotta text-[11px] font-bold flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Testing ICE...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3 h-3" />
                  <span>Run WebRTC Test</span>
                </>
              )}
            </button>
          </div>

          {/* Test Results */}
          {diagnosticResult && (
            <div className="space-y-1.5 pt-2 border-t border-[#282A2B]/20 text-xs font-mono animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[#282A2B]/70">STUN Hole-Punching:</span>
                <span
                  className={`font-bold flex items-center gap-1 ${
                    diagnosticResult.hasStun ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {diagnosticResult.hasStun ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Blocked</span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#282A2B]/70">TURN Relay (Cross-NAT):</span>
                <span
                  className={`font-bold flex items-center gap-1 ${
                    diagnosticResult.hasRelay ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {diagnosticResult.hasRelay ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Active ({diagnosticResult.relayProtocols.join(', ').toUpperCase()})</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>No Relay (STUN Only)</span>
                    </>
                  )}
                </span>
              </div>

              <div className="text-[10px] text-[#282A2B]/60 pt-1">
                Candidate types: {diagnosticResult.candidateTypes.join(', ') || 'none'} • {diagnosticResult.durationMs}ms
              </div>

              {diagnosticResult.errors.length > 0 && (
                <div className="text-[10px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                  {diagnosticResult.errors[0]}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className="mb-3 text-xs font-mono text-center text-emerald-800 bg-emerald-50 py-1.5 rounded-lg border border-emerald-300">
            {statusMessage}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#282A2B]/20">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl text-xs font-mono text-[#282A2B]/70 hover:text-[#282A2B] hover:underline"
          >
            Reset to Default
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl retro-btn-cream text-xs font-bold text-[#282A2B]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl retro-btn-terracotta text-xs font-bold shadow-retro-sm active:scale-95"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
