'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Download,
  Copy,
  RotateCcw,
  Share2,
  Check,
  Sparkles,
  Film,
  Video,
  Image as ImageIcon,
  Palette,
  Upload,
  Layers,
  Wand2,
  Smile,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Hand,
  Move,
  RefreshCw,
  Heart,
  X,
  ChevronDown,
  Camera,
} from 'lucide-react';
import {
  PhotoFilterId,
  PhotostripLayoutId,
  PhotostripThemeId,
} from '@photobooth/shared';
import {
  renderCustomPhotostrip,
  PhotostripUserSticker,
  PhotostripMovableCard,
} from '@/lib/photostrip-renderer';
import { createPhotoboothGif } from '@/lib/gif-encoder';
import { createPhotoboothVideo } from '@/lib/video-generator';
import { downloadImageBlob, copyImageToClipboard, shareImageBlob } from '@/lib/export-utils';
import { AVAILABLE_STICKERS, STICKER_CATEGORIES } from '@/lib/stickers-data';

interface CapturePreviewModalProps {
  capturedFrames: (ImageBitmap | HTMLCanvasElement)[];
  roomId: string;
  onRetake: () => void;
  onRetakeSingle?: (index: number) => void;
}

export const CapturePreviewModal: React.FC<CapturePreviewModalProps> = ({
  capturedFrames,
  roomId,
  onRetake,
  onRetakeSingle,
}) => {
  // Main Studio View Tabs
  const [activeTab, setActiveTab] = useState<'strip' | 'gif' | 'video'>('strip');

  // Retake dropdown toggle
  const [isRetakeDropdownOpen, setIsRetakeDropdownOpen] = useState(false);

  // Generate lightweight thumbnails for individual pose retakes
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);
  useEffect(() => {
    try {
      const urls = capturedFrames.map((frame) => {
        if (frame instanceof HTMLCanvasElement) {
          return frame.toDataURL('image/jpeg', 0.7);
        }
        if (typeof document !== 'undefined') {
          const c = document.createElement('canvas');
          c.width = frame.width;
          c.height = frame.height;
          const ctx = c.getContext('2d');
          if (ctx) ctx.drawImage(frame, 0, 0);
          return c.toDataURL('image/jpeg', 0.7);
        }
        return '';
      });
      setThumbUrls(urls);
    } catch (err) {
      console.warn('Failed to generate pose thumbnails:', err);
    }
  }, [capturedFrames]);

  // Sidebar Sub-Tabs
  const [customSidebarTab, setCustomSidebarTab] = useState<'theme' | 'stickers' | 'freeform'>('theme');
  const [selectedStickerCategory, setSelectedStickerCategory] = useState<string>('cats');

  // Photostrip Customization State
  const [theme, setTheme] = useState<PhotostripThemeId>('vintage-ticket');
  const [layout, setLayout] = useState<PhotostripLayoutId>(
    capturedFrames.length === 3 ? 'strip-1x3' : 'strip-1x4'
  );
  const [filter, setFilter] = useState<PhotoFilterId>('none');
  const [title, setTitle] = useState('Theather Show');
  const [subtitle, setSubtitle] = useState('SAVE THE BEST MOMENT ★ SAVE THE BEST MOMENT');
  const [dateStr, setDateStr] = useState(`Sunday, 29 March • 20.00`);
  const [customFrameImg, setCustomFrameImg] = useState<HTMLImageElement | null>(null);

  // Draggable User Stickers & Movable Photo Cards
  const [stickers, setStickers] = useState<PhotostripUserSticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  const defaultFreeformCards: PhotostripMovableCard[] = capturedFrames.map((_, i) => {
    const presets = [
      { x: 28, y: 36, rotation: -7, scale: 1 },
      { x: 72, y: 34, rotation: 6, scale: 1 },
      { x: 30, y: 74, rotation: 5, scale: 1 },
      { x: 74, y: 72, rotation: -5, scale: 1 },
      { x: 50, y: 53, rotation: 1, scale: 1.05 },
      { x: 82, y: 53, rotation: -3, scale: 0.95 },
    ];
    const p = presets[i % presets.length];
    return {
      id: `card-${i}`,
      frameIndex: i,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      scale: p.scale,
    };
  });

  const [movableCards, setMovableCards] = useState<PhotostripMovableCard[]>(defaultFreeformCards);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Rendered Output Blobs & URLs
  const [stripBlob, setStripBlob] = useState<Blob | null>(null);
  const [stripUrl, setStripUrl] = useState<string | null>(null);
  const [isRenderingStrip, setIsRenderingStrip] = useState(false);

  const [gifBlob, setGifBlob] = useState<Blob | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [isGeneratingGif, setIsGeneratingGif] = useState(false);

  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  const [hasCopied, setHasCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Pointer dragging state for stickers
  const activeDragRef = useRef<{
    id: string;
    type: 'sticker' | 'card';
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // Trigger celebration confetti on initial open
  useEffect(() => {
    confetti({
      particleCount: 85,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#38bdf8'],
    });
  }, []);

  // Render Photostrip whenever customization settings or stickers/cards change
  const renderStrip = useCallback(async () => {
    if (capturedFrames.length === 0) return;
    setIsRenderingStrip(true);

    try {
      const blob = await renderCustomPhotostrip(capturedFrames, {
        theme,
        layout,
        filter,
        title,
        subtitle,
        dateStr,
        customFrameImage: customFrameImg,
        stickers,
        movableCards,
      });

      if (blob) {
        setStripBlob(blob);
        const url = URL.createObjectURL(blob);
        setStripUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    } catch (err) {
      console.error('Failed to render photostrip:', err);
    } finally {
      setIsRenderingStrip(false);
    }
  }, [capturedFrames, theme, layout, filter, title, subtitle, dateStr, customFrameImg, stickers, movableCards]);

  useEffect(() => {
    renderStrip();
  }, [renderStrip]);

  // Generate GIF
  const generateGif = useCallback(async () => {
    if (capturedFrames.length === 0 || isGeneratingGif) return;
    setIsGeneratingGif(true);

    try {
      const blob = await createPhotoboothGif(capturedFrames, {
        delayMs: 550,
        filter,
        stickers,
      });
      if (blob) {
        setGifBlob(blob);
        const url = URL.createObjectURL(blob);
        setGifUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    } catch (err) {
      console.error('Failed to create photobooth GIF:', err);
    } finally {
      setIsGeneratingGif(false);
    }
  }, [capturedFrames, isGeneratingGif, filter, stickers]);

  // Generate Video
  const generateVideo = useCallback(async () => {
    if (capturedFrames.length === 0 || isGeneratingVideo) return;
    setIsGeneratingVideo(true);

    try {
      const blob = await createPhotoboothVideo(capturedFrames, {
        frameDurationMs: 650,
        fps: 30,
        showFlash: true,
        filter,
        stickers,
      });
      if (blob) {
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setVideoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    } catch (err) {
      console.error('Failed to create photobooth Video:', err);
    } finally {
      setIsGeneratingVideo(false);
    }
  }, [capturedFrames, isGeneratingVideo, filter, stickers]);

  // Trigger GIF generation when switching to GIF tab if not yet generated
  useEffect(() => {
    if (activeTab === 'gif' && !gifBlob && !isGeneratingGif) {
      generateGif();
    }
  }, [activeTab, gifBlob, isGeneratingGif, generateGif]);

  // Trigger Video generation when switching to Video tab if not yet generated
  useEffect(() => {
    if (activeTab === 'video' && !videoBlob && !isGeneratingVideo) {
      generateVideo();
    }
  }, [activeTab, videoBlob, isGeneratingVideo, generateVideo]);

  // Add a sticker onto canvas
  const handleAddSticker = (stickerItem: { url: string; label: string }) => {
    const newSticker: PhotostripUserSticker = {
      id: `stk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      url: stickerItem.url,
      label: stickerItem.label,
      x: 50 + (Math.random() * 12 - 6),
      y: 50 + (Math.random() * 12 - 6),
      scale: 1.0,
      rotation: Math.round(Math.random() * 20 - 10),
    };
    setStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
  };

  const handleAddEmojiSticker = (emoji: string) => {
    const newSticker: PhotostripUserSticker = {
      id: `stk-emoji-${Date.now()}`,
      icon: emoji,
      label: 'Emoji Charm',
      x: 50 + (Math.random() * 10 - 5),
      y: 50 + (Math.random() * 10 - 5),
      scale: 1.0,
      rotation: Math.round(Math.random() * 20 - 10),
    };
    setStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
  };

  const handleRemoveSticker = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setStickers((prev) => prev.filter((s) => s.id !== id));
    if (selectedStickerId === id) setSelectedStickerId(null);
  };

  const handleUpdateSticker = (id: string, updates: Partial<PhotostripUserSticker>) => {
    setStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleClearStickers = () => {
    setStickers([]);
    setSelectedStickerId(null);
  };

  // Drag handlers for stickers and photo cards on preview
  const handlePointerDownSticker = (
    id: string,
    e: React.PointerEvent,
    currentX: number,
    currentY: number
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelectedStickerId(id);
    setSelectedCardId(null);
    activeDragRef.current = {
      id,
      type: 'sticker',
      startX: e.clientX,
      startY: e.clientY,
      originX: currentX,
      originY: currentY,
    };
  };

  const handlePointerDownCard = (
    id: string,
    e: React.PointerEvent,
    currentX: number,
    currentY: number
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelectedCardId(id);
    setSelectedStickerId(null);
    activeDragRef.current = {
      id,
      type: 'card',
      startX: e.clientX,
      startY: e.clientY,
      originX: currentX,
      originY: currentY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDragRef.current || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const deltaPixelX = e.clientX - activeDragRef.current.startX;
    const deltaPixelY = e.clientY - activeDragRef.current.startY;

    const deltaPercentX = (deltaPixelX / rect.width) * 100;
    const deltaPercentY = (deltaPixelY / rect.height) * 100;

    const newX = Math.max(5, Math.min(95, activeDragRef.current.originX + deltaPercentX));
    const newY = Math.max(5, Math.min(95, activeDragRef.current.originY + deltaPercentY));

    if (activeDragRef.current.type === 'sticker') {
      const sId = activeDragRef.current.id;
      setStickers((prev) =>
        prev.map((s) => (s.id === sId ? { ...s, x: newX, y: newY } : s))
      );
    } else if (activeDragRef.current.type === 'card') {
      const cId = activeDragRef.current.id;
      setMovableCards((prev) =>
        prev.map((c) => (c.id === cId ? { ...c, x: newX, y: newY } : c))
      );
    }
  };

  const handlePointerUp = () => {
    activeDragRef.current = null;
  };

  // Custom Frame Image Upload
  const handleCustomFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      setCustomFrameImg(img);
      setTheme('custom-upload');
    };
    img.src = URL.createObjectURL(file);
  };

  const handleDownload = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    if (activeTab === 'strip' && stripBlob) {
      downloadImageBlob(stripBlob, `photobooth-${roomId}-${theme}-${timestamp}.png`);
    } else if (activeTab === 'gif' && gifBlob) {
      downloadImageBlob(gifBlob, `photobooth-${roomId}-animation-${timestamp}.gif`);
    } else if (activeTab === 'video' && videoBlob) {
      const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
      downloadImageBlob(videoBlob, `photobooth-${roomId}-video-${timestamp}.${ext}`);
    }
  };

  const handleCopy = async () => {
    const blobToCopy = activeTab === 'strip' ? stripBlob : gifBlob;
    if (blobToCopy) {
      const success = await copyImageToClipboard(blobToCopy);
      if (success) {
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
      }
    }
  };

  const handleShare = async () => {
    const blobToShare = activeTab === 'strip' ? stripBlob : gifBlob;
    if (blobToShare) {
      await shareImageBlob(blobToShare, `Virtual Photobooth — Room ${roomId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#282A2B]/85 backdrop-blur-sm animate-fadeIn overflow-y-auto select-none">
      <div className="relative w-full max-w-6xl bg-[#F4EFE6] border-3 border-[#282A2B] rounded-3xl p-4 sm:p-6 shadow-retro flex flex-col my-auto max-h-[95vh] text-[#282A2B]">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#282A2B]/15 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D67C65] border-2 border-[#282A2B] flex items-center justify-center text-white shadow-retro-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-retro font-bold text-lg sm:text-xl text-[#282A2B] flex items-center gap-2">
                PHOTOBOOTH STUDIO 📸
                <span className="text-xs font-normal text-[#282A2B]/70 font-mono">
                  {capturedFrames.length} poses
                </span>
              </h2>
              <p className="text-xs text-[#282A2B]/70 font-mono">
                Add cute stickers (cats, bows, charms), drag photos, or export looping GIFs & videos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Retake Dropdown Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRetakeDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-[#282A2B] bg-white hover:bg-[#F4EFE6] border-2 border-[#282A2B] rounded-xl shadow-retro-sm transition active:translate-y-0.5"
                title="Retake a specific photo or all photos"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#D67C65]" />
                <span>Retake</span>
                <ChevronDown className={`w-3 h-3 text-[#282A2B]/60 transition-transform ${isRetakeDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isRetakeDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsRetakeDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#F4EFE6] border-2 border-[#282A2B] rounded-2xl shadow-retro py-1.5 z-50 animate-fadeIn">
                    <div className="px-3 py-1 text-[10px] font-mono font-bold text-[#282A2B]/60 uppercase tracking-wider border-b border-[#282A2B]/10">
                      Retake Single Photo
                    </div>
                    {capturedFrames.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setIsRetakeDropdownOpen(false);
                          onRetakeSingle?.(i);
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs font-mono font-bold text-[#282A2B] hover:bg-[#D67C65] hover:text-white flex items-center justify-between transition"
                      >
                        <span className="flex items-center gap-1.5">
                          <RotateCcw className="w-3 h-3" />
                          Pose #{i + 1}
                        </span>
                        <span className="text-[10px] opacity-75 font-normal">only shot #{i + 1}</span>
                      </button>
                    ))}
                    <div className="border-t border-[#282A2B]/10 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsRetakeDropdownOpen(false);
                        onRetake();
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs font-mono font-bold text-[#D67C65] hover:bg-[#D67C65] hover:text-white flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retake All Photos</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Master Studio Navigation Tabs */}
        <div className="flex items-center gap-2 py-3 border-b-2 border-[#282A2B]/15 shrink-0">
          <button
            onClick={() => setActiveTab('strip')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-retro font-bold uppercase tracking-wider border-2 transition ${
              activeTab === 'strip'
                ? 'bg-[#D67C65] text-white border-[#282A2B] shadow-retro-sm'
                : 'bg-white/80 text-[#282A2B] border-[#282A2B]/40 hover:border-[#282A2B] hover:bg-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Photostrip & Scrapbook</span>
          </button>

          <button
            onClick={() => setActiveTab('gif')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-retro font-bold uppercase tracking-wider border-2 transition ${
              activeTab === 'gif'
                ? 'bg-[#D67C65] text-white border-[#282A2B] shadow-retro-sm'
                : 'bg-white/80 text-[#282A2B] border-[#282A2B]/40 hover:border-[#282A2B] hover:bg-white'
            }`}
          >
            <Film className="w-4 h-4 text-[#6BA3A9]" />
            <span>Looping GIF</span>
          </button>

          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-retro font-bold uppercase tracking-wider border-2 transition ${
              activeTab === 'video'
                ? 'bg-[#D67C65] text-white border-[#282A2B] shadow-retro-sm'
                : 'bg-white/80 text-[#282A2B] border-[#282A2B]/40 hover:border-[#282A2B] hover:bg-white'
            }`}
          >
            <Video className="w-4 h-4 text-[#DDA853]" />
            <span>Photobooth Video</span>
          </button>
        </div>

        {/* Individual Poses Retake Strip Bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/75 border-2 border-[#282A2B]/20 rounded-2xl shrink-0 overflow-x-auto my-1 shadow-inner">
          <span className="text-[11px] font-mono font-bold text-[#282A2B]/75 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-[#D67C65]" />
            Poses:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            {capturedFrames.map((_, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 bg-white rounded-xl border border-[#282A2B]/25 hover:border-[#D67C65] transition shadow-xs shrink-0"
              >
                {thumbUrls[idx] && (
                  <img
                    src={thumbUrls[idx]}
                    alt={`Pose ${idx + 1}`}
                    className="w-8 h-10 object-cover rounded-md border border-[#282A2B]/20 shrink-0 shadow-xs"
                  />
                )}
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono font-bold text-[#282A2B] leading-tight">
                    Pose #{idx + 1}
                  </span>
                  {onRetakeSingle && (
                    <button
                      type="button"
                      onClick={() => onRetakeSingle(idx)}
                      className="flex items-center gap-1 text-[10px] font-mono font-bold text-[#D67C65] hover:text-[#b85b46] transition mt-0.5 underline decoration-dotted"
                      title={`Retake only Pose #${idx + 1} (keeps all other photos)`}
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      Retake
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="ml-auto pl-2 shrink-0 border-l border-[#282A2B]/15">
            <button
              type="button"
              onClick={onRetake}
              className="flex items-center gap-1 text-[10px] font-mono font-bold text-[#282A2B]/60 hover:text-[#D67C65] px-2 py-1 rounded-lg hover:bg-black/5 transition"
              title="Discard all and retake entire series"
            >
              <RefreshCw className="w-3 h-3" />
              Retake All
            </button>
          </div>
        </div>

        {/* Main Content Workspace */}
        <div className="flex flex-col lg:flex-row gap-5 min-h-0 flex-1 overflow-hidden my-2">
          {/* Left: Interactive Preview & Canvas Canvas */}
          <div
            className="flex-1 min-w-0 flex items-center justify-center bg-[#282A2B] rounded-2xl border-2 border-[#282A2B] p-4 min-h-[380px] overflow-hidden relative shadow-inner"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={() => {
              setSelectedStickerId(null);
              setSelectedCardId(null);
            }}
          >
            {activeTab === 'strip' && (
              <div
                ref={previewContainerRef}
                className="relative flex items-center justify-center max-h-[52vh] sm:max-h-[58vh] max-w-full"
              >
                {stripUrl ? (
                  <div className="relative inline-block select-none">
                    <img
                      src={stripUrl}
                      alt="Photobooth Print"
                      className="max-h-[52vh] sm:max-h-[58vh] w-auto object-contain rounded-xl shadow-polaroid pointer-events-none"
                    />

                    {/* Interactive Overlay Layer for Draggable Stickers & Movable Photo Cards */}
                    <div className="absolute inset-0 pointer-events-auto">
                      {/* Movable Photo Cards (when in Scrapbook Freeform mode) */}
                      {layout === 'scrapbook-freeform' &&
                        movableCards.map((card) => {
                          const isSelected = selectedCardId === card.id;
                          return (
                            <div
                              key={card.id}
                              onPointerDown={(e) => handlePointerDownCard(card.id, e, card.x, card.y)}
                              style={{
                                left: `${card.x}%`,
                                top: `${card.y}%`,
                                transform: `translate(-50%, -50%) rotate(${card.rotation}deg)`,
                              }}
                              className={`absolute cursor-grab active:cursor-grabbing p-1 rounded-lg transition-transform ${
                                isSelected ? 'ring-2 ring-[#D67C65] bg-white/30 backdrop-blur-xs' : 'hover:ring-1 hover:ring-white/50'
                              }`}
                            >
                              <div className="flex items-center gap-1 bg-[#282A2B]/80 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow-sm pointer-events-none">
                                <Move className="w-2.5 h-2.5" />
                                <span>Pose #{card.frameIndex + 1}</span>
                              </div>
                              {isSelected && onRetakeSingle && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRetakeSingle(card.frameIndex);
                                  }}
                                  className="absolute -top-6 -right-2 flex items-center gap-1 bg-[#F4EFE6] border border-[#282A2B] rounded-full px-2 py-0.5 text-[9px] font-mono font-bold text-[#D67C65] shadow-sm z-30 pointer-events-auto hover:bg-white transition"
                                  title={`Retake Pose #${card.frameIndex + 1}`}
                                >
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  Retake #{card.frameIndex + 1}
                                </button>
                              )}
                            </div>
                          );
                        })}

                      {/* Draggable User Stickers Overlay */}
                      {stickers.map((st) => {
                        const isSelected = selectedStickerId === st.id;
                        return (
                          <div
                            key={st.id}
                            onPointerDown={(e) => handlePointerDownSticker(st.id, e, st.x, st.y)}
                            style={{
                              left: `${st.x}%`,
                              top: `${st.y}%`,
                              transform: `translate(-50%, -50%) rotate(${st.rotation}deg) scale(${st.scale})`,
                            }}
                            className={`absolute cursor-grab active:cursor-grabbing p-1 select-none transition-shadow ${
                              isSelected
                                ? 'ring-2 ring-[#D67C65] ring-offset-1 rounded-xl bg-white/20 backdrop-blur-xs shadow-lg'
                                : 'hover:ring-1 hover:ring-white/60'
                            }`}
                          >
                            {/* Sticker Visual */}
                            {st.url ? (
                              <img
                                src={st.url}
                                alt={st.label || 'Sticker'}
                                className="w-14 h-14 sm:w-16 sm:h-16 object-contain pointer-events-none drop-shadow-md"
                              />
                            ) : (
                              <span className="text-3xl sm:text-4xl pointer-events-none drop-shadow-md">
                                {st.icon}
                              </span>
                            )}

                            {/* Floating Controls when Sticker is Selected */}
                            {isSelected && (
                              <div
                                className="absolute -top-7 -right-7 flex items-center gap-1 bg-[#F4EFE6] border-2 border-[#282A2B] rounded-full px-1.5 py-0.5 shadow-retro-sm z-30"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSticker(st.id, { scale: Math.min(2.5, st.scale + 0.15) })}
                                  className="p-1 text-[#282A2B] hover:text-[#D67C65]"
                                  title="Enlarge Sticker"
                                >
                                  <ZoomIn className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSticker(st.id, { scale: Math.max(0.5, st.scale - 0.15) })}
                                  className="p-1 text-[#282A2B] hover:text-[#D67C65]"
                                  title="Shrink Sticker"
                                >
                                  <ZoomOut className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSticker(st.id, { rotation: (st.rotation + 15) % 360 })}
                                  className="p-1 text-[#282A2B] hover:text-[#D67C65]"
                                  title="Rotate Sticker"
                                >
                                  <RotateCw className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleRemoveSticker(st.id, e)}
                                  className="p-1 text-red-600 hover:text-red-700"
                                  title="Delete Sticker"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-white/70">
                    <div className="w-8 h-8 rounded-full border-2 border-[#D67C65] border-t-transparent animate-spin mb-2" />
                    <p className="text-xs font-mono">Composing photostrip...</p>
                  </div>
                )}

                {isRenderingStrip && (
                  <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-[#F4EFE6] border border-[#282A2B] text-[10px] text-[#282A2B] font-mono flex items-center gap-1.5 shadow-retro-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D67C65] animate-ping" />
                    Updating Frame
                  </div>
                )}
              </div>
            )}

            {/* Looping Animated GIF View */}
            {activeTab === 'gif' && (
              <div className="flex flex-col items-center justify-center w-full">
                {isGeneratingGif ? (
                  <div className="flex flex-col items-center text-white/90">
                    <div className="w-10 h-10 rounded-full border-3 border-[#D67C65] border-t-transparent animate-spin mb-3" />
                    <p className="text-xs font-bold font-retro tracking-wide">Encoding Looping GIF...</p>
                    <p className="text-[11px] text-white/70 font-mono mt-1">Stitching poses into animated loop</p>
                  </div>
                ) : gifUrl ? (
                  <div className="flex flex-col items-center">
                    <img
                      src={gifUrl}
                      alt="Animated Photobooth GIF"
                      className="max-h-[50vh] sm:max-h-[56vh] w-auto object-contain rounded-2xl shadow-polaroid"
                    />
                    <button
                      type="button"
                      onClick={generateGif}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4EFE6] text-[#282A2B] border-2 border-[#282A2B] text-xs font-mono font-bold shadow-retro-sm hover:bg-white transition"
                    >
                      <RefreshCw className="w-3 h-3 text-[#D67C65]" />
                      Update GIF with New Stickers
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={generateGif}
                    className="retro-btn-terracotta px-5 py-2.5 rounded-xl font-retro text-xs text-white"
                  >
                    Generate Looping GIF
                  </button>
                )}
              </div>
            )}

            {/* Video Player View */}
            {activeTab === 'video' && (
              <div className="flex flex-col items-center justify-center w-full">
                {isGeneratingVideo ? (
                  <div className="flex flex-col items-center text-white/90">
                    <div className="w-10 h-10 rounded-full border-3 border-[#6BA3A9] border-t-transparent animate-spin mb-3" />
                    <p className="text-xs font-bold font-retro tracking-wide">Rendering Boomerang Video...</p>
                    <p className="text-[11px] text-white/70 font-mono mt-1">Generating 30fps clip with flash effects</p>
                  </div>
                ) : videoUrl ? (
                  <div className="flex flex-col items-center">
                    <video
                      key={videoUrl}
                      src={videoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      controls
                      className="max-h-[50vh] sm:max-h-[56vh] w-auto object-contain rounded-2xl shadow-polaroid"
                    />
                    <button
                      type="button"
                      onClick={generateVideo}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4EFE6] text-[#282A2B] border-2 border-[#282A2B] text-xs font-mono font-bold shadow-retro-sm hover:bg-white transition"
                    >
                      <RefreshCw className="w-3 h-3 text-[#6BA3A9]" />
                      Update Video with New Stickers
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={generateVideo}
                    className="retro-btn-terracotta px-5 py-2.5 rounded-xl font-retro text-xs text-white"
                  >
                    Render Photobooth Video
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Customization Drawer */}
          <div className="w-full lg:w-[380px] lg:shrink-0 flex flex-col gap-3 overflow-hidden max-h-[60vh] bg-white/70 rounded-2xl border-2 border-[#282A2B] p-3 shadow-retro-sm">
            {/* Sub-tabs for sidebar */}
            <div className="flex items-center gap-1 p-1 bg-[#EBE4D5] rounded-xl border border-[#282A2B]/20 shrink-0">
              <button
                type="button"
                onClick={() => setCustomSidebarTab('theme')}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                  customSidebarTab === 'theme'
                    ? 'bg-[#F4EFE6] text-[#282A2B] shadow-sm border border-[#282A2B]'
                    : 'text-[#282A2B]/70 hover:text-[#282A2B]'
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-[#D67C65]" />
                <span>Theme</span>
              </button>

              <button
                type="button"
                onClick={() => setCustomSidebarTab('stickers')}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                  customSidebarTab === 'stickers'
                    ? 'bg-[#F4EFE6] text-[#282A2B] shadow-sm border border-[#282A2B]'
                    : 'text-[#282A2B]/70 hover:text-[#282A2B]'
                }`}
              >
                <Smile className="w-3.5 h-3.5 text-[#6BA3A9]" />
                <span>Stickers ({stickers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomSidebarTab('freeform');
                  setLayout('scrapbook-freeform');
                }}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                  customSidebarTab === 'freeform'
                    ? 'bg-[#F4EFE6] text-[#282A2B] shadow-sm border border-[#282A2B]'
                    : 'text-[#282A2B]/70 hover:text-[#282A2B]'
                }`}
              >
                <Hand className="w-3.5 h-3.5 text-[#DDA853]" />
                <span>Scrapbook</span>
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
              {/* TAB 1: THEMES & LAYOUTS */}
              {customSidebarTab === 'theme' && (
                <>
                  {/* Aesthetic Themes */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#282A2B] uppercase tracking-wider font-mono mb-1.5">
                      <Palette className="w-3.5 h-3.5 text-[#D67C65]" />
                      <span>Aesthetic Frame Theme</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'vintage-ticket', label: '🎟️ Cinema Ticket', desc: 'Perforated 1950s' },
                        { id: 'cute-scrapbook', label: '🎀 Cute Coquette', desc: 'Polaroid & Bows' },
                        { id: 'y2k-zine', label: '📰 Y2K Newsprint', desc: 'The 1975 Headline' },
                        { id: 'snapobox-baroque', label: '🖼️ SNAPOBOX', desc: 'Baroque & Mirrors' },
                        { id: 'boothy-call', label: '🔴 Boothy Call', desc: 'Polka Dots & Circles' },
                        { id: 'retro-patterns', label: '🏁 Tartan Plaid', desc: '90s Punk & Leopard' },
                        { id: 'classic-film', label: '🎞️ Analog 35mm', desc: 'Kodak Filmstrip' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTheme(t.id as PhotostripThemeId);
                            if (t.id === 'vintage-ticket') setTitle('Theather Show');
                            else if (t.id === 'y2k-zine') setTitle('ABOUT YOU');
                            else if (t.id === 'snapobox-baroque') setTitle('SNAPOBOX');
                            else if (t.id === 'boothy-call') setTitle('Boothy Call');
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-left border-2 transition shadow-retro-sm ${
                            theme === t.id
                              ? 'bg-[#D67C65] text-white border-[#282A2B]'
                              : 'bg-white/80 border-[#282A2B]/30 text-[#282A2B] hover:border-[#282A2B] hover:bg-white'
                          }`}
                        >
                          <p className="text-xs font-bold font-retro">{t.label}</p>
                          <p className={`text-[10px] font-mono ${theme === t.id ? 'text-white/80' : 'text-[#282A2B]/60'}`}>
                            {t.desc}
                          </p>
                        </button>
                      ))}

                      {/* Custom Upload Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`px-2.5 py-1.5 rounded-xl text-left border-2 transition shadow-retro-sm ${
                          theme === 'custom-upload'
                            ? 'bg-[#D67C65] text-white border-[#282A2B]'
                            : 'bg-white/80 border-[#282A2B]/30 text-[#282A2B] hover:border-[#282A2B] hover:bg-white'
                        }`}
                      >
                        <p className="text-xs font-bold font-retro flex items-center gap-1">
                          <Upload className="w-3 h-3 text-[#D67C65]" />
                          Upload PNG
                        </p>
                        <p className={`text-[10px] font-mono ${theme === 'custom-upload' ? 'text-white/80' : 'text-[#282A2B]/60'}`}>
                          Custom Frame
                        </p>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleCustomFrameUpload}
                      />
                    </div>
                  </div>

                  {/* Layout Options */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#282A2B] uppercase tracking-wider font-mono mb-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#6BA3A9]" />
                      <span>Layout Format</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'strip-1x4', label: '1x4 Strip (4 Poses)' },
                        { id: 'strip-1x3', label: '1x3 Strip (3 Poses)' },
                        { id: 'strip-twin', label: '2x4 Twin Strips' },
                        { id: 'grid-2x2', label: '2x2 Square Grid' },
                        { id: 'scrapbook-freeform', label: '🎀 Freeform Collage' },
                      ].map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setLayout(l.id as PhotostripLayoutId);
                            if (l.id === 'scrapbook-freeform') setCustomSidebarTab('freeform');
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold font-mono border-2 transition text-center shadow-retro-sm ${
                            layout === l.id
                              ? 'bg-[#6BA3A9] text-white border-[#282A2B]'
                              : 'bg-white/80 border-[#282A2B]/30 text-[#282A2B] hover:border-[#282A2B] hover:bg-white'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Photo Filter */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#282A2B] uppercase tracking-wider font-mono mb-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-[#DDA853]" />
                      <span>Photo Filter</span>
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'none', label: 'Natural' },
                        { id: 'noir', label: 'Noir B&W' },
                        { id: 'sepia', label: 'Sepia' },
                        { id: 'film90s', label: '90s Film' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFilter(f.id as PhotoFilterId)}
                          className={`px-2 py-1.5 rounded-xl text-[11px] font-bold font-mono border-2 transition text-center shadow-retro-sm ${
                            filter === f.id
                              ? 'bg-[#DDA853] text-[#282A2B] border-[#282A2B]'
                              : 'bg-white/80 border-[#282A2B]/30 text-[#282A2B] hover:border-[#282A2B] hover:bg-white'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Text Inputs */}
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-[#282A2B] uppercase tracking-wider font-mono mb-1">
                        Title / Headline
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={30}
                        className="w-full px-2.5 py-1 rounded-xl bg-white border-2 border-[#282A2B] text-[#282A2B] text-xs font-mono shadow-retro-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#282A2B] uppercase tracking-wider font-mono mb-1">
                        Subtitle / Date
                      </label>
                      <input
                        type="text"
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        maxLength={40}
                        className="w-full px-2.5 py-1 rounded-xl bg-white border-2 border-[#282A2B] text-[#282A2B] text-xs font-mono shadow-retro-sm focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: STICKERS & CHARMS DRAWER */}
              {customSidebarTab === 'stickers' && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono uppercase text-[#282A2B]">
                      Aesthetic Stickers
                    </span>
                    {stickers.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearStickers}
                        className="text-[10px] font-mono text-red-600 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear All ({stickers.length})
                      </button>
                    )}
                  </div>

                  {/* Sticker Category Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {STICKER_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedStickerCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold whitespace-nowrap border transition ${
                          selectedStickerCategory === cat.id
                            ? 'bg-[#D67C65] text-white border-[#282A2B] shadow-sm'
                            : 'bg-white text-[#282A2B] border-[#282A2B]/30 hover:bg-[#EBE4D5]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Cute Quick Charms Row */}
                  <div className="flex items-center gap-1.5 p-1.5 bg-[#F4EFE6] rounded-xl border border-[#282A2B]/20">
                    <span className="text-[10px] font-mono font-bold text-[#282A2B]/70 ml-1">Quick:</span>
                    {['🎀', '🐱', '✨', '💖', '🌸', '🍒', '🪩', '⭐'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleAddEmojiSticker(emoji)}
                        className="p-1 hover:bg-white rounded-lg text-base transition transform active:scale-90"
                        title={`Add ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Grid of Extracted Cutouts */}
                  <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 max-h-[38vh] overflow-y-auto p-1">
                    {AVAILABLE_STICKERS.filter((s) => s.category === selectedStickerCategory).map((stk) => (
                      <button
                        key={stk.id}
                        type="button"
                        onClick={() => handleAddSticker(stk)}
                        className="group relative aspect-square p-1.5 rounded-xl bg-white border-2 border-[#282A2B]/30 hover:border-[#D67C65] hover:shadow-md transition flex items-center justify-center transform active:scale-95"
                        title={`Click to add ${stk.label}`}
                      >
                        <img
                          src={stk.url}
                          alt={stk.label}
                          className="max-h-full max-w-full object-contain pointer-events-none group-hover:scale-110 transition-transform"
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#282A2B]/60 font-mono text-center">
                    Click any sticker to place it on your photos. Drag it anywhere you like!
                  </p>
                </div>
              )}

              {/* TAB 3: FREEFORM COLLAGE & SCRAPBOOK DRAG */}
              {customSidebarTab === 'freeform' && (
                <div className="flex flex-col gap-3">
                  <div className="bg-[#DDA853]/15 border-2 border-[#DDA853] p-3 rounded-xl text-left">
                    <h4 className="text-xs font-bold font-retro text-[#282A2B] flex items-center gap-1.5 mb-1">
                      <Hand className="w-4 h-4 text-[#DDA853]" />
                      <span>Freeform Photo Arranger</span>
                    </h4>
                    <p className="text-[11px] font-mono text-[#282A2B]/80 leading-relaxed">
                      Photos are no longer glued to rigid slots! Drag each photo card around the tabletop to create your personal overlapping collage.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold font-mono uppercase text-[#282A2B]">
                      Scrapbook Photo Cards ({movableCards.length})
                    </span>
                    {movableCards.map((card) => (
                      <div
                        key={card.id}
                        className={`flex items-center justify-between p-2 rounded-xl border-2 transition ${
                          selectedCardId === card.id
                            ? 'bg-[#DDA853]/20 border-[#282A2B]'
                            : 'bg-white border-[#282A2B]/20 hover:border-[#282A2B]/50'
                        }`}
                      >
                        <span className="text-xs font-mono font-bold text-[#282A2B]">
                          📸 Pose #{card.frameIndex + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setMovableCards((prev) =>
                                prev.map((c) =>
                                  c.id === card.id ? { ...c, rotation: c.rotation - 5 } : c
                                )
                              )
                            }
                            className="p-1 rounded bg-[#EBE4D5] text-[#282A2B] text-xs font-mono"
                            title="Tilt Left"
                          >
                            ⟲
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setMovableCards((prev) =>
                                prev.map((c) =>
                                  c.id === card.id ? { ...c, rotation: c.rotation + 5 } : c
                                )
                              )
                            }
                            className="p-1 rounded bg-[#EBE4D5] text-[#282A2B] text-xs font-mono"
                            title="Tilt Right"
                          >
                            ⟳
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setMovableCards((prev) =>
                                prev.map((c) =>
                                  c.id === card.id ? { ...c, scale: Math.min(1.4, c.scale + 0.1) } : c
                                )
                              )
                            }
                            className="p-1 rounded bg-[#EBE4D5] text-[#282A2B] text-xs font-mono"
                            title="Enlarge"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => setMovableCards(defaultFreeformCards)}
                      className="mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#282A2B]/40 text-xs font-mono font-bold text-[#282A2B] hover:bg-white transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Photo Positions
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Footer Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 w-full pt-3 border-t-2 border-[#282A2B]/15 shrink-0">
          <button
            type="button"
            onClick={onRetake}
            className="retro-btn-cream flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-mono font-bold text-[#282A2B] border-2 border-[#282A2B] shadow-retro-sm transition"
          >
            <RotateCcw className="w-4 h-4 text-[#D67C65]" />
            <span>Retake Session</span>
          </button>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleCopy}
              className="retro-btn-cream flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono font-bold text-xs text-[#282A2B] border-2 border-[#282A2B] shadow-retro-sm transition active:translate-y-0.5"
            >
              {hasCopied ? (
                <>
                  <Check className="w-4 h-4 text-[#6BA3A9]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#D67C65]" />
                  <span>Copy Image</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="retro-btn-teal flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono font-bold text-xs text-white border-2 border-[#282A2B] shadow-retro-sm transition active:translate-y-0.5"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="retro-btn-terracotta flex items-center gap-2 px-6 py-2.5 rounded-xl font-retro font-bold text-xs sm:text-sm text-white border-2 border-[#282A2B] shadow-retro-sm tracking-wide transition active:translate-y-0.5"
            >
              <Download className="w-4 h-4" />
              <span>
                {activeTab === 'strip'
                  ? 'Download High-Res Strip'
                  : activeTab === 'gif'
                  ? 'Download Looping GIF'
                  : 'Download Video Clip'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
