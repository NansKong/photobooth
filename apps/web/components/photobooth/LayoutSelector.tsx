'use client';

import React from 'react';
import { PHOTO_LAYOUTS, PhotoLayoutId } from '@photobooth/shared';
import { LayoutGrid, Check } from 'lucide-react';

interface LayoutSelectorProps {
  currentLayoutId: PhotoLayoutId;
  onChangeLayout: (layoutId: PhotoLayoutId) => void;
  onClose?: () => void;
}

export const LayoutSelector: React.FC<LayoutSelectorProps> = ({
  currentLayoutId,
  onChangeLayout,
  onClose,
}) => {
  const layouts = Object.values(PHOTO_LAYOUTS);

  return (
    <div className="retro-card p-5 rounded-2xl w-full max-w-lg mx-auto shadow-retro border-2 border-[#282A2B] bg-[#F4EFE6] text-[#282A2B]">
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#282A2B]/15">
        <div>
          <h3 className="font-retro font-bold text-lg flex items-center gap-2 text-[#282A2B] tracking-wide">
            <LayoutGrid className="w-5 h-5 text-[#D67C65]" />
            PHOTOBOOTH LAYOUT
          </h3>
          <p className="text-xs text-[#282A2B]/70 font-mono mt-0.5">
            Choose how participants are framed together
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

      <div className="grid grid-cols-2 gap-3 mt-4">
        {layouts.map((layout) => {
          const isSelected = currentLayoutId === layout.id;
          return (
            <button
              key={layout.id}
              onClick={() => onChangeLayout(layout.id)}
              className={`flex flex-col p-3.5 rounded-xl border-2 transition text-left shadow-retro-sm ${
                isSelected
                  ? 'bg-[#D67C65] text-white border-[#282A2B]'
                  : 'bg-white/80 text-[#282A2B] border-[#282A2B]/40 hover:border-[#282A2B] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-sm font-retro font-bold ${isSelected ? 'text-white' : 'text-[#282A2B]'}`}>
                  {layout.name}
                </span>
                {isSelected && (
                  <span className="w-4 h-4 rounded-full bg-white border border-[#282A2B] flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-[#D67C65]" />
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] font-mono mt-1 line-clamp-2 ${
                  isSelected ? 'text-white/85' : 'text-[#282A2B]/70'
                }`}
              >
                {layout.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
