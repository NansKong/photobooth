'use client';

import React from 'react';
import { ENVIRONMENT_PRESETS, EnvironmentType } from '@photobooth/shared';
import { Sparkles, Video, Check } from 'lucide-react';

interface EnvironmentSelectorProps {
  currentEnvironmentId: string;
  currentType: EnvironmentType;
  onChangeEnvironment: (envId: string, type: EnvironmentType) => void;
  onClose?: () => void;
}

export const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  currentEnvironmentId,
  currentType,
  onChangeEnvironment,
  onClose,
}) => {
  const virtualPresets = ENVIRONMENT_PRESETS.filter((p) => p.type === 'virtual');

  return (
    <div className="retro-card p-5 rounded-2xl w-full max-w-xl mx-auto shadow-retro border-2 border-[#282A2B] bg-[#F4EFE6] text-[#282A2B]">
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#282A2B]/15">
        <div>
          <h3 className="font-retro font-bold text-lg flex items-center gap-2 text-[#282A2B] tracking-wide">
            <Sparkles className="w-5 h-5 text-[#D67C65]" />
            PHOTOBOOTH ENVIRONMENT
          </h3>
          <p className="text-xs text-[#282A2B]/70 font-mono mt-0.5">
            Synchronized live backdrop for all participants
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="retro-btn-cream text-xs font-bold font-mono px-3 py-1 rounded-lg border-2 border-[#282A2B] shadow-retro-sm"
          >
            Done
          </button>
        )}
      </div>

      {/* Mode A vs Mode B Selection */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          onClick={() => onChangeEnvironment('real-default', 'real')}
          className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-[#282A2B] transition text-center ${
            currentType === 'real'
              ? 'bg-[#D67C65] text-white shadow-retro-sm font-bold'
              : 'bg-white/80 text-[#282A2B] hover:bg-white shadow-retro-sm'
          }`}
        >
          <Video className={`w-5 h-5 mb-1.5 ${currentType === 'real' ? 'text-white' : 'text-[#6BA3A9]'}`} />
          <span className="text-sm font-retro font-bold uppercase tracking-wider">Real Backdrop</span>
          <span className={`text-[11px] mt-0.5 ${currentType === 'real' ? 'text-white/80' : 'text-[#282A2B]/70'}`}>
            Physical room background
          </span>
        </button>

        <button
          onClick={() => {
            if (currentType !== 'virtual') {
              onChangeEnvironment('virtual-studio', 'virtual');
            }
          }}
          className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-[#282A2B] transition text-center ${
            currentType === 'virtual'
              ? 'bg-[#D67C65] text-white shadow-retro-sm font-bold'
              : 'bg-white/80 text-[#282A2B] hover:bg-white shadow-retro-sm'
          }`}
        >
          <Sparkles className={`w-5 h-5 mb-1.5 ${currentType === 'virtual' ? 'text-white' : 'text-[#DDA853]'}`} />
          <span className="text-sm font-retro font-bold uppercase tracking-wider">Virtual Backdrop</span>
          <span className={`text-[11px] mt-0.5 ${currentType === 'virtual' ? 'text-white/80' : 'text-[#282A2B]/70'}`}>
            Shared vintage photobooth
          </span>
        </button>
      </div>

      {/* Virtual Environment Palette */}
      {currentType === 'virtual' && (
        <div className="mt-5">
          <p className="text-xs font-bold text-[#282A2B] uppercase tracking-wider font-mono mb-2.5">
            Select Studio Backdrop
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {virtualPresets.map((preset) => {
              const isSelected = currentEnvironmentId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => onChangeEnvironment(preset.id, 'virtual')}
                  className={`group relative flex flex-col rounded-xl overflow-hidden border-2 text-left transition p-2.5 shadow-retro-sm ${
                    isSelected
                      ? 'border-[#282A2B] ring-2 ring-[#D67C65]'
                      : 'border-[#282A2B]/30 hover:border-[#282A2B]'
                  }`}
                  style={{
                    background: preset.previewGradient,
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-retro">
                      {preset.name}
                    </span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-[#D67C65] border border-[#282A2B] flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-white/95 mt-1 line-clamp-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-mono">
                    {preset.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
