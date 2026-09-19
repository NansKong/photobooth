'use client';

import React from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  SwitchCamera,
  Maximize2,
  Minimize2,
  LogOut,
  Sparkles,
  LayoutGrid,
  Move,
  Share2,
  Lock,
  Unlock,
  User,
} from 'lucide-react';

interface CameraControlsProps {
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isMirror: boolean;
  isFullscreen: boolean;
  isCountdownActive: boolean;
  hasMultipleCameras?: boolean;
  activeDrawer: 'env' | 'layout' | 'pos' | null;
  selectedShots: number;
  onSelectShots: (shots: number) => void;
  isHost?: boolean;
  canClickShutter?: boolean;
  onlyHostCanClick?: boolean;
  participantCount?: number;
  onToggleOnlyHostCanClick?: () => void;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onToggleMirror: () => void;
  onSwitchCamera: () => void;
  onToggleFullscreen: () => void;
  onToggleDrawer: (drawer: 'env' | 'layout' | 'pos') => void;
  onTakePhoto: () => void;
  onLeaveRoom: () => void;
  onOpenShare: () => void;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  isVideoEnabled,
  isAudioEnabled,
  isMirror,
  isFullscreen,
  isCountdownActive,
  hasMultipleCameras,
  activeDrawer,
  selectedShots,
  onSelectShots,
  isHost = true,
  canClickShutter = true,
  onlyHostCanClick = true,
  participantCount = 1,
  onToggleOnlyHostCanClick,
  onToggleVideo,
  onToggleAudio,
  onToggleMirror,
  onSwitchCamera,
  onToggleFullscreen,
  onToggleDrawer,
  onTakePhoto,
  onLeaveRoom,
  onOpenShare,
}) => {
  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2 w-full max-w-2xl mx-auto px-1 sm:px-4 pointer-events-auto select-none">
      {/* Top Controls Bar: Shot Count & Clicker Mode */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
        {/* Shot Count Selection Pill Selector */}
        <div className="bg-[#F4EFE6] px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full flex items-center gap-1 sm:gap-2 border-2 border-[#282A2B] shadow-retro-sm">
          <span className="text-[10px] sm:text-[11px] font-retro font-bold text-[#282A2B] uppercase tracking-wider flex items-center gap-1">
            📸 <span className="hidden xs:inline">Shots:</span>
          </span>
          <div className="flex items-center gap-0.5 sm:gap-1">
            {[1, 2, 3, 4, 6].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onSelectShots(count)}
                disabled={isCountdownActive}
                className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-mono font-bold transition ${
                  selectedShots === count
                    ? 'bg-[#D67C65] text-white shadow-sm'
                    : 'text-[#282A2B]/70 hover:text-[#282A2B] hover:bg-[#EBE4D5]'
                }`}
                title={`Take ${count} picture${count > 1 ? 's' : ''}`}
              >
                <span className="hidden xs:inline">{count} {count === 1 ? 'Shot' : 'Shots'}</span>
                <span className="xs:hidden">{count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Solo Badge or One Person Click Control */}
        {participantCount === 1 ? (
          <div className="bg-[#6BA3A9] text-white px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full flex items-center gap-1 text-[10px] sm:text-[11px] font-retro uppercase tracking-wider border-2 border-[#282A2B] shadow-retro-sm">
            <User className="w-3 h-3 text-[#DDA853]" />
            <span>Solo <span className="hidden xs:inline">Mode (1 Person)</span></span>
          </div>
        ) : (
          isHost && onToggleOnlyHostCanClick && (
            <button
              type="button"
              onClick={onToggleOnlyHostCanClick}
              disabled={isCountdownActive}
              className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-retro uppercase tracking-wider border-2 border-[#282A2B] shadow-retro-sm transition ${
                onlyHostCanClick
                  ? 'bg-[#DDA853] text-[#282A2B]'
                  : 'bg-[#F4EFE6] text-[#282A2B]/70 hover:bg-white'
              }`}
              title="Toggle whether only 1 person (the host) or anyone can click the shutter button"
            >
              {onlyHostCanClick ? (
                <>
                  <Lock className="w-3 h-3 text-[#282A2B]" />
                  <span>Only Host<span className="hidden xs:inline"> Clicks</span></span>
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3 text-[#6BA3A9]" />
                  <span>Anyone<span className="hidden xs:inline"> Can Click</span></span>
                </>
              )}
            </button>
          )
        )}
      </div>

      {/* Primary Floating Retro Action Bar */}
      <div className="bg-[#F4EFE6] px-2 sm:px-4 py-1.5 sm:py-2 rounded-2xl flex items-center justify-between gap-1 sm:gap-3 shadow-retro border-2 border-[#282A2B] w-full max-w-full">
        {/* Left Action Group: Customization Drawers */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          <button
            onClick={() => onToggleDrawer('env')}
            className={`flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-retro transition min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 justify-center ${
              activeDrawer === 'env'
                ? 'bg-[#6BA3A9] text-white border-2 border-[#282A2B] shadow-sm'
                : 'text-[#282A2B] hover:bg-[#EBE4D5]'
            }`}
            title="Choose Environment"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D67C65]" />
            <span className="hidden sm:inline">Theme</span>
          </button>

          <button
            onClick={() => onToggleDrawer('layout')}
            className={`flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-retro transition min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 justify-center ${
              activeDrawer === 'layout'
                ? 'bg-[#6BA3A9] text-white border-2 border-[#282A2B] shadow-sm'
                : 'text-[#282A2B] hover:bg-[#EBE4D5]'
            }`}
            title="Change Layout"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#6BA3A9]" />
            <span className="hidden sm:inline">Layout</span>
          </button>

          <button
            onClick={() => onToggleDrawer('pos')}
            className={`flex items-center gap-1 p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-retro transition min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 justify-center ${
              activeDrawer === 'pos'
                ? 'bg-[#6BA3A9] text-white border-2 border-[#282A2B] shadow-sm'
                : 'text-[#282A2B] hover:bg-[#EBE4D5]'
            }`}
            title="Adjust Position & Pose"
          >
            <Move className="w-3.5 h-3.5 text-[#DDA853]" />
            <span className="hidden sm:inline">Pose</span>
          </button>
        </div>

        {/* Center: The Main Vintage "Take Photo" Shutter Button */}
        <div className="flex items-center justify-center px-1">
          {canClickShutter ? (
            <button
              onClick={onTakePhoto}
              disabled={isCountdownActive}
              className={`group relative flex items-center gap-1 sm:gap-2 px-2.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl font-retro text-[10px] sm:text-sm tracking-wider uppercase transition-all transform active:scale-95 whitespace-nowrap ${
                isCountdownActive
                  ? 'bg-[#A89F91] text-white border-2 border-[#282A2B] cursor-not-allowed opacity-70'
                  : 'retro-btn-terracotta'
              }`}
            >
              <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
              <span>{isCountdownActive ? 'Snapping...' : 'Take Photos'}</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#A89F91]/40 border-2 border-[#282A2B] text-[10px] sm:text-xs font-retro text-[#282A2B]/70 cursor-not-allowed shadow-inner whitespace-nowrap"
              title="Only 1 person (the booth host) can click to take photos"
            >
              <Lock className="w-3 h-3 text-[#D67C65]" />
              <span>Host Controls</span>
            </div>
          )}
        </div>

        {/* Right Action Group: Hardware & Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          <button
            onClick={onToggleVideo}
            className={`p-1.5 sm:p-2 rounded-xl border transition min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center ${
              isVideoEnabled
                ? 'border-transparent text-[#282A2B] hover:bg-[#EBE4D5]'
                : 'bg-[#D67C65]/20 text-[#D67C65] border-[#D67C65]'
            }`}
            title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isVideoEnabled ? <Camera className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> : <CameraOff className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
          </button>

          <button
            onClick={onToggleAudio}
            className={`p-1.5 sm:p-2 rounded-xl border transition min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center ${
              isAudioEnabled
                ? 'border-transparent text-[#282A2B] hover:bg-[#EBE4D5]'
                : 'bg-[#D67C65]/20 text-[#D67C65] border-[#D67C65]'
            }`}
            title={isAudioEnabled ? 'Mute Mic' : 'Unmute Mic'}
          >
            {isAudioEnabled ? <Mic className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> : <MicOff className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
          </button>

          {hasMultipleCameras && (
            <button
              onClick={onSwitchCamera}
              className="p-1.5 sm:p-2 rounded-xl text-[#282A2B] hover:bg-[#EBE4D5] transition min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
              title="Flip Camera (Front/Back)"
            >
              <SwitchCamera className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </button>
          )}

          <button
            onClick={onOpenShare}
            className="p-1.5 sm:p-2 rounded-xl text-[#282A2B] hover:bg-[#EBE4D5] transition hidden md:flex items-center justify-center"
            title="Invite Friends"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleFullscreen}
            className="p-1.5 sm:p-2 rounded-xl text-[#282A2B] hover:bg-[#EBE4D5] transition flex items-center justify-center min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px]"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> : <Maximize2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
          </button>

          <button
            onClick={onLeaveRoom}
            className="p-1.5 sm:p-2 rounded-xl text-[#D67C65] hover:bg-[#D67C65]/15 transition min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
            title="Leave Photobooth"
          >
            <LogOut className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
