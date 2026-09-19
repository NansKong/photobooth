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
  Scaling,
  Maximize2,
  Minimize2,
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
  // Full-screen/expanded view toggle for preview
  const [isExpandedPreview, setIsExpandedPreview] = useState(false);
  const [inspectorZoom, setInspectorZoom] = useState(1.0);

  // Escape key listener to exit full screen inspection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpandedPreview) {
        setIsExpandedPreview(false);
        setInspectorZoom(1.0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpandedPreview]);

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
  const [isExporting, setIsExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // ref to the actual rendered image element for accurate drag coordinate mapping
  const previewImgRef = useRef<HTMLImageElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // ─── Zero-lag drag system ────────────────────────────────────────────────
  // Maps sticker id → its DOM <div> so we can mutate style directly without setState
  const stickerElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const cardElsRef    = useRef<Map<string, HTMLDivElement>>(new Map());

  // Live position/scale during drag — updated every frame, committed to state on pointerup
  const liveStateRef = useRef<Map<string, { x: number; y: number; scale: number; rotation: number }>>(new Map());

  // Pinch-to-zoom tracking state for stickers
  const pinchRef = useRef<{
    id: string;
    dist: number;
    origScale: number;
  } | null>(null);
  // ─────────────────────────────────────────────────────────────────────────

  // ─── Studio Photostrip View Mode ─────────────────────────────────────────
  // 'fit' scales the photostrip to fit 100% inside the preview without any clipping
  // 'scroll' zooms in to allow close-up scrolling through each pose for precision editing
  const [stripViewMode, setStripViewMode] = useState<'fit' | 'scroll'>('fit');
  const [scrollZoom, setScrollZoom] = useState<number>(1.6);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const getLayoutDimensions = (l: PhotostripLayoutId) => {
    switch (l) {
      case 'strip-twin': return { width: 1480, height: 2100 };
      case 'strip-1x3': return { width: 820, height: 1750 };
      case 'grid-2x2': return { width: 1200, height: 1450 };
      case 'scrapbook-freeform': return { width: 1400, height: 1400 };
      case 'strip-1x4':
      default: return { width: 820, height: 2100 };
    }
  };

  const [stripNaturalSize, setStripNaturalSize] = useState<{ width: number; height: number }>(() =>
    getLayoutDimensions(capturedFrames.length === 3 ? 'strip-1x3' : 'strip-1x4')
  );

  useEffect(() => {
    setStripNaturalSize(getLayoutDimensions(layout));
  }, [layout]);

  // ResizeObserver to track preview container size dynamically
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };

    measure();

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(el);

    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activeTab, stripViewMode]);
  // ─────────────────────────────────────────────────────────────────────────

  // Trigger celebration confetti on initial open
  useEffect(() => {
    confetti({
      particleCount: 85,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#38bdf8'],
    });
  }, []);

  // Render base Photostrip (frames, theme, layout, filter, title, subtitle, date, custom frame, scrapbook cards)
  // Stickers are rendered in the live overlay layer on top, so sticker edits NEVER re-render this heavy canvas!
  const renderBaseStrip = useCallback(async () => {
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
        stickers: [], // Leave stickers for the interactive DOM overlay during preview
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
      console.error('Failed to render base photostrip:', err);
    } finally {
      setIsRenderingStrip(false);
    }
  }, [capturedFrames, theme, layout, filter, title, subtitle, dateStr, customFrameImg, movableCards]);

  useEffect(() => {
    renderBaseStrip();
  }, [renderBaseStrip]);

  // Generate final composite strip with all user stickers baked in for download/copy/share
  const generateExportBlob = useCallback(async (): Promise<Blob | null> => {
    if (capturedFrames.length === 0) return null;
    setIsRenderingStrip(true);
    try {
      return await renderCustomPhotostrip(capturedFrames, {
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
    } catch (err) {
      console.error('Failed to generate export photostrip:', err);
      return null;
    } finally {
      setIsRenderingStrip(false);
    }
  }, [capturedFrames, theme, layout, filter, title, subtitle, dateStr, customFrameImg, stickers, movableCards]);

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
    let targetY = 50;
    if (stripViewMode === 'scroll' && previewContainerRef.current) {
      const container = previewContainerRef.current;
      const scrollCenter = container.scrollTop + container.clientHeight / 2;
      const totalH = container.scrollHeight || 1;
      targetY = Math.max(10, Math.min(90, Math.round((scrollCenter / totalH) * 100)));
    }

    const newSticker: PhotostripUserSticker = {
      id: `stk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      url: stickerItem.url,
      label: stickerItem.label,
      x: 50 + (Math.random() * 12 - 6),
      y: targetY + (Math.random() * 6 - 3),
      scale: 1.0,
      rotation: Math.round(Math.random() * 20 - 10),
    };
    setStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
  };

  const handleAddEmojiSticker = (emoji: string) => {
    let targetY = 50;
    if (stripViewMode === 'scroll' && previewContainerRef.current) {
      const container = previewContainerRef.current;
      const scrollCenter = container.scrollTop + container.clientHeight / 2;
      const totalH = container.scrollHeight || 1;
      targetY = Math.max(10, Math.min(90, Math.round((scrollCenter / totalH) * 100)));
    }

    const newSticker: PhotostripUserSticker = {
      id: `stk-emoji-${Date.now()}`,
      icon: emoji,
      label: 'Emoji Charm',
      x: 50 + (Math.random() * 10 - 5),
      y: targetY + (Math.random() * 6 - 3),
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

  // ─── Zero-Lag Interaction Handlers ──────────────────────────────────────────
  // Dragging a sticker across the photostrip
  const handleStartDragSticker = useCallback((
    id: string,
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedStickerId(id);
    setSelectedCardId(null);

    const st = stickers.find((s) => s.id === id);
    if (!st) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = st.x;
    const originY = st.y;
    const originScale = st.scale;
    const originRot = st.rotation;

    liveStateRef.current.set(id, {
      x: originX,
      y: originY,
      scale: originScale,
      rotation: originRot,
    });

    const onPointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const bounds = previewImgRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width === 0 || bounds.height === 0) return;

      const deltaPercentX = ((ev.clientX - startX) / bounds.width) * 100;
      const deltaPercentY = ((ev.clientY - startY) / bounds.height) * 100;
      const newX = Math.max(2, Math.min(98, originX + deltaPercentX));
      const newY = Math.max(2, Math.min(98, originY + deltaPercentY));

      const live = liveStateRef.current.get(id);
      if (live) {
        live.x = newX;
        live.y = newY;
      }

      const el = stickerElsRef.current.get(id);
      if (el) {
        el.style.left = `${newX}%`;
        el.style.top = `${newY}%`;
        el.style.transform = `translate(-50%, -50%) rotate(${originRot}deg) scale(${originScale})`;
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      const live = liveStateRef.current.get(id);
      if (live) {
        setStickers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, x: live.x, y: live.y } : s))
        );
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }, [stickers]);

  // Dragging the corner handle to smoothly resize a sticker
  const handleStartResize = useCallback((
    id: string,
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const el = stickerElsRef.current.get(id);
    if (!el) return;

    const elRect = el.getBoundingClientRect();
    const centerX = elRect.left + elRect.width / 2;
    const centerY = elRect.top + elRect.height / 2;
    const initialDist = Math.hypot(e.clientX - centerX, e.clientY - centerY) || 1;

    const st = stickers.find((s) => s.id === id);
    const originScale = st?.scale ?? 1;
    const originRot = st?.rotation ?? 0;

    let finalScale = originScale;

    const onResizeMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const currentDist = Math.hypot(ev.clientX - centerX, ev.clientY - centerY);
      const ratio = currentDist / initialDist;
      const newScale = Math.max(0.3, Math.min(3.5, Number((originScale * ratio).toFixed(2))));
      finalScale = newScale;

      const live = liveStateRef.current.get(id);
      if (live) live.scale = newScale;

      if (el) {
        el.style.transform = `translate(-50%, -50%) rotate(${originRot}deg) scale(${newScale})`;
      }
    };

    const onResizeUp = () => {
      window.removeEventListener('pointermove', onResizeMove);
      window.removeEventListener('pointerup', onResizeUp);
      window.removeEventListener('pointercancel', onResizeUp);

      setStickers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, scale: finalScale } : s))
      );
    };

    window.addEventListener('pointermove', onResizeMove, { passive: false });
    window.addEventListener('pointerup', onResizeUp);
    window.addEventListener('pointercancel', onResizeUp);
  }, [stickers]);

  // Dragging the top handle to smoothly rotate a sticker
  const handleStartRotate = useCallback((
    id: string,
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const el = stickerElsRef.current.get(id);
    if (!el) return;

    const elRect = el.getBoundingClientRect();
    const centerX = elRect.left + elRect.width / 2;
    const centerY = elRect.top + elRect.height / 2;
    const initialAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

    const st = stickers.find((s) => s.id === id);
    const originRot = st?.rotation ?? 0;
    const originScale = st?.scale ?? 1;

    let finalRot = originRot;

    const onRotateMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const currentAngle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * (180 / Math.PI);
      const deltaAngle = currentAngle - initialAngle;
      const newRot = Math.round((originRot + deltaAngle) % 360);
      finalRot = newRot;

      const live = liveStateRef.current.get(id);
      if (live) live.rotation = newRot;

      if (el) {
        el.style.transform = `translate(-50%, -50%) rotate(${newRot}deg) scale(${originScale})`;
      }
    };

    const onRotateUp = () => {
      window.removeEventListener('pointermove', onRotateMove);
      window.removeEventListener('pointerup', onRotateUp);
      window.removeEventListener('pointercancel', onRotateUp);

      setStickers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, rotation: finalRot } : s))
      );
    };

    window.addEventListener('pointermove', onRotateMove, { passive: false });
    window.addEventListener('pointerup', onRotateUp);
    window.addEventListener('pointercancel', onRotateUp);
  }, [stickers]);

  // Dragging a photo card in Freeform Scrapbook mode
  const handleStartDragCard = useCallback((
    id: string,
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedCardId(id);
    setSelectedStickerId(null);

    const card = movableCards.find((c) => c.id === id);
    if (!card) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = card.x;
    const originY = card.y;
    const originRot = card.rotation;

    liveStateRef.current.set(id, {
      x: originX,
      y: originY,
      scale: card.scale,
      rotation: originRot,
    });

    const onCardMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const bounds = previewImgRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width === 0 || bounds.height === 0) return;

      const deltaPercentX = ((ev.clientX - startX) / bounds.width) * 100;
      const deltaPercentY = ((ev.clientY - startY) / bounds.height) * 100;
      const newX = Math.max(5, Math.min(95, originX + deltaPercentX));
      const newY = Math.max(5, Math.min(95, originY + deltaPercentY));

      const live = liveStateRef.current.get(id);
      if (live) {
        live.x = newX;
        live.y = newY;
      }

      const el = cardElsRef.current.get(id);
      if (el) {
        el.style.left = `${newX}%`;
        el.style.top = `${newY}%`;
        el.style.transform = `translate(-50%, -50%) rotate(${originRot}deg)`;
      }
    };

    const onCardUp = () => {
      window.removeEventListener('pointermove', onCardMove);
      window.removeEventListener('pointerup', onCardUp);
      window.removeEventListener('pointercancel', onCardUp);

      const live = liveStateRef.current.get(id);
      if (live) {
        setMovableCards((prev) =>
          prev.map((c) => (c.id === id ? { ...c, x: live.x, y: live.y } : c))
        );
      }
    };

    window.addEventListener('pointermove', onCardMove, { passive: false });
    window.addEventListener('pointerup', onCardUp);
    window.addEventListener('pointercancel', onCardUp);
  }, [movableCards]);

  // Pinch-to-zoom (mobile touchscreens)
  const handleTouchStart = useCallback((id: string, e: React.TouchEvent, currentScale: number) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      pinchRef.current = { id, dist, origScale: currentScale };
      const st = stickers.find((s) => s.id === id);
      if (st && !liveStateRef.current.has(id)) {
        liveStateRef.current.set(id, { x: st.x, y: st.y, scale: st.scale, rotation: st.rotation });
      }
    }
  }, [stickers]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = Math.max(0.3, Math.min(3.5, Number((pinchRef.current.origScale * (dist / pinchRef.current.dist)).toFixed(2))));
      const sId = pinchRef.current.id;
      const live = liveStateRef.current.get(sId);
      if (live) live.scale = scale;
      const el = stickerElsRef.current.get(sId);
      if (el && live) {
        el.style.transform = `translate(-50%, -50%) rotate(${live.rotation}deg) scale(${scale})`;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!pinchRef.current) return;
    const { id } = pinchRef.current;
    pinchRef.current = null;
    const live = liveStateRef.current.get(id);
    if (live) {
      setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, scale: live.scale } : s)));
    }
  }, []);

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

  const handleDownload = async () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    if (activeTab === 'strip') {
      setIsExporting(true);
      try {
        const blob = await generateExportBlob();
        if (blob) {
          downloadImageBlob(blob, `photobooth-${roomId}-${theme}-${timestamp}.png`);
        }
      } finally {
        setIsExporting(false);
      }
    } else if (activeTab === 'gif' && gifBlob) {
      downloadImageBlob(gifBlob, `photobooth-${roomId}-animation-${timestamp}.gif`);
    } else if (activeTab === 'video' && videoBlob) {
      const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
      downloadImageBlob(videoBlob, `photobooth-${roomId}-video-${timestamp}.${ext}`);
    }
  };

  const handleCopy = async () => {
    if (activeTab === 'strip') {
      setIsExporting(true);
      try {
        const blob = await generateExportBlob();
        if (blob) {
          const success = await copyImageToClipboard(blob);
          if (success) {
            setHasCopied(true);
            setTimeout(() => setHasCopied(false), 2000);
          }
        }
      } finally {
        setIsExporting(false);
      }
    } else if (gifBlob) {
      const success = await copyImageToClipboard(gifBlob);
      if (success) {
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
      }
    }
  };

  const handleShare = async () => {
    if (activeTab === 'strip') {
      setIsExporting(true);
      try {
        const blob = await generateExportBlob();
        if (blob) {
          await shareImageBlob(blob, `Virtual Photobooth — Room ${roomId}`);
        }
      } finally {
        setIsExporting(false);
      }
    } else if (gifBlob) {
      await shareImageBlob(gifBlob, `Virtual Photobooth — Room ${roomId}`);
    }
  };

  // Dynamic pixel sizing for photostrip preview
  const stripAspect = stripNaturalSize.width / (stripNaturalSize.height || 1);

  const padX = 24;
  const padY = 24;
  const availW = Math.max(100, (containerSize.width || 480) - padX);
  const availH = Math.max(100, (containerSize.height || 420) - padY);

  let renderW = 0;
  let renderH = 0;

  if (stripViewMode === 'fit') {
    const scale = Math.min(availW / stripNaturalSize.width, availH / stripNaturalSize.height);
    renderW = Math.max(80, Math.round(stripNaturalSize.width * scale));
    renderH = Math.max(120, Math.round(stripNaturalSize.height * scale));
  } else {
    // Scroll mode: zoomed in for comfortable pose-by-pose editing
    const targetW = Math.max(280, Math.min(Math.round(availW * scrollZoom), 620));
    renderW = targetW;
    renderH = Math.round(targetW / stripAspect);
  }

  // Base sticker display size proportional to strip rendered width (140 / 820 ~= 17%)
  const stickerBaseSize = Math.max(32, Math.min(96, Math.round(renderW * 0.19)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4 bg-[#282A2B]/85 backdrop-blur-sm animate-fadeIn overflow-y-auto select-none">
      <div className="relative w-full max-w-6xl bg-[#F4EFE6] border-2 sm:border-3 border-[#282A2B] rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-retro flex flex-col my-auto max-h-[98dvh] text-[#282A2B]">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-2 sm:pb-3 border-b-2 border-[#282A2B]/15 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#D67C65] border-2 border-[#282A2B] flex items-center justify-center text-white shadow-retro-sm shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="font-retro font-bold text-base sm:text-xl text-[#282A2B] flex items-center gap-1.5 sm:gap-2">
                PHOTOBOOTH STUDIO 📸
                <span className="text-[10px] sm:text-xs font-normal text-[#282A2B]/70 font-mono">
                  {capturedFrames.length} poses
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-[#282A2B]/70 font-mono hidden sm:block">
                Add cute stickers (cats, bows, charms), drag photos, or export looping GIFs & videos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Retake Dropdown Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRetakeDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-mono font-bold text-[#282A2B] bg-white hover:bg-[#F4EFE6] border-2 border-[#282A2B] rounded-xl shadow-retro-sm transition active:translate-y-0.5"
                title="Retake a specific photo or all photos"
              >
                <RotateCcw className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[#D67C65]" />
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
        <div className="flex items-center gap-1.5 sm:gap-2 py-2 sm:py-3 border-b-2 border-[#282A2B]/15 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('strip')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-retro font-bold uppercase tracking-wider border-2 transition shrink-0 ${
              activeTab === 'strip'
                ? 'bg-[#D67C65] text-white border-[#282A2B] shadow-retro-sm'
                : 'bg-white/80 text-[#282A2B] border-[#282A2B]/40 hover:border-[#282A2B] hover:bg-white'
            }`}
          >
            <ImageIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            <span className="hidden sm:inline">Photostrip & Scrapbook</span>
            <span className="sm:hidden">Photostrip</span>
          </button>

          <button
            onClick={() => setActiveTab('gif')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-retro font-bold uppercase tracking-wider border-2 transition shrink-0 ${
              activeTab === 'gif'
                ? 'bg-[#D67C65] text-white border-[#282A2B] shadow-retro-sm'
                : 'bg-white/80 text-[#282A2B] border-[#282A2B]/40 hover:border-[#282A2B] hover:bg-white'
            }`}
          >
            <Film className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#6BA3A9]" />
            <span className="hidden sm:inline">Looping GIF</span>
            <span className="sm:hidden">GIF</span>
          </button>

          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-retro font-bold uppercase tracking-wider border-2 transition shrink-0 ${
              activeTab === 'video'
                ? 'bg-[#D67C65] text-white border-[#282A2B] shadow-retro-sm'
                : 'bg-white/80 text-[#282A2B] border-[#282A2B]/40 hover:border-[#282A2B] hover:bg-white'
            }`}
          >
            <Video className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#DDA853]" />
            <span className="hidden sm:inline">Photobooth Video</span>
            <span className="sm:hidden">Video</span>
          </button>
        </div>

        {/* Individual Poses Retake Strip Bar (hidden on mobile to free up space for the full photostrip) */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/75 border-2 border-[#282A2B]/20 rounded-2xl shrink-0 overflow-x-auto my-1 shadow-inner">
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
        <div className="flex flex-col lg:flex-row gap-2 sm:gap-4 min-h-0 flex-1 overflow-hidden my-1 sm:my-2">
          {/* Left: Interactive Preview & Canvas */}
          <div
            className="flex-1 min-w-0 flex flex-col bg-[#282A2B] rounded-2xl border-2 border-[#282A2B] h-[48dvh] sm:h-[54dvh] lg:h-[62vh] min-h-0 overflow-hidden relative shadow-inner select-none transition-all duration-300"
            onClick={() => {
              setSelectedStickerId(null);
              setSelectedCardId(null);
            }}
          >
            {/* Top Studio Canvas Controls Header */}
            <div className="px-3 py-2 sm:px-4 sm:py-2 flex items-center justify-between border-b border-white/10 bg-black/30 shrink-0 z-30">
              {/* Left: Inspect Full Screen Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpandedPreview(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4EFE6]/95 hover:bg-white text-[#282A2B] border-2 border-[#282A2B] text-[11px] sm:text-xs font-mono font-bold shadow-retro-sm transition active:scale-95 shrink-0"
                title="Inspect photo in high-resolution full screen"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[#6BA3A9]" />
                <span className="hidden sm:inline">Inspect Full Screen</span>
                <span className="sm:hidden">Inspect</span>
              </button>

              {/* Right: Studio Strip Canvas Controls */}
              {activeTab === 'strip' ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {isRenderingStrip && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#F4EFE6] border border-[#282A2B] text-[10px] text-[#282A2B] font-mono shadow-xs animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D67C65] animate-ping" />
                      <span className="hidden sm:inline">Rendering</span>
                    </div>
                  )}

                  {/* View Mode Switcher: Fit Strip vs Scroll Mode */}
                  <div className="flex items-center bg-[#18191A] border border-white/15 p-0.5 rounded-xl shadow-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStripViewMode('fit');
                      }}
                      className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold transition ${
                        stripViewMode === 'fit'
                          ? 'bg-[#D67C65] text-white shadow-xs'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                      title="Fit entire photostrip in view (all poses visible at once)"
                    >
                      <Minimize2 className="w-3 h-3" />
                      <span>Fit Strip</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStripViewMode('scroll');
                      }}
                      className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold transition ${
                        stripViewMode === 'scroll'
                          ? 'bg-[#D67C65] text-white shadow-xs'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                      title="Zoom in and scroll poses to decorate up-close"
                    >
                      <ZoomIn className="w-3 h-3 text-[#DDA853]" />
                      <span>Scroll Mode</span>
                    </button>
                  </div>

                  {/* Zoom controls when in Scroll Mode */}
                  {stripViewMode === 'scroll' && (
                    <div className="hidden md:flex items-center bg-[#18191A] border border-white/15 rounded-xl p-0.5 text-white/80 text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScrollZoom((z) => Math.max(1.1, Number((z - 0.25).toFixed(2))));
                        }}
                        className="p-1 hover:text-white hover:bg-white/10 rounded-lg transition"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3 h-3" />
                      </button>
                      <span className="px-1.5 font-bold">{Math.round((scrollZoom / 1.6) * 100)}%</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScrollZoom((z) => Math.min(2.8, Number((z + 0.25).toFixed(2))));
                        }}
                        className="p-1 hover:text-white hover:bg-white/10 rounded-lg transition"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[10px] font-mono text-white/50 hidden sm:block">
                  {activeTab === 'gif' ? 'Looping Animation' : 'Boomerang Video'}
                </div>
              )}
            </div>

            {/* Photostrip Canvas Viewport */}
            {activeTab === 'strip' && (
              <div
                ref={previewContainerRef}
                className={`relative flex-1 w-full min-h-0 min-w-0 select-none ${
                  stripViewMode === 'scroll'
                    ? 'overflow-y-auto overflow-x-hidden flex justify-center py-4 px-2 sm:px-6 scrollbar-thin scrollbar-thumb-[#D67C65] scrollbar-track-black/30'
                    : 'overflow-hidden flex items-center justify-center p-2 sm:p-3'
                }`}
                style={{
                  touchAction: stripViewMode === 'scroll' ? 'pan-y' : 'none',
                }}
              >
                {stripUrl ? (
                  <div
                    className="relative select-none shrink-0 transition-[width,height] duration-150 ease-out"
                    style={{
                      width: `${renderW}px`,
                      height: `${renderH}px`,
                      maxWidth: stripViewMode === 'fit' ? '100%' : undefined,
                      maxHeight: stripViewMode === 'fit' ? '100%' : undefined,
                    }}
                  >
                    <img
                      ref={previewImgRef}
                      src={stripUrl}
                      alt="Photobooth Print"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                          setStripNaturalSize({
                            width: img.naturalWidth,
                            height: img.naturalHeight,
                          });
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                      className="rounded-xl shadow-polaroid pointer-events-none select-none"
                      draggable={false}
                    />

                    {/* Interactive Overlay Layer for Draggable Stickers & Movable Photo Cards */}
                    <div className="absolute inset-0 pointer-events-auto overflow-visible">
                      {/* Movable Photo Cards (when in Scrapbook Freeform mode) */}
                      {layout === 'scrapbook-freeform' &&
                        movableCards.map((card) => {
                          const isSelected = selectedCardId === card.id;
                          return (
                            <div
                              key={card.id}
                              ref={(node) => {
                                if (node) cardElsRef.current.set(card.id, node);
                                else cardElsRef.current.delete(card.id);
                              }}
                              onPointerDown={(e) => handleStartDragCard(card.id, e)}
                              style={{
                                left: `${card.x}%`,
                                top: `${card.y}%`,
                                transform: `translate(-50%, -50%) rotate(${card.rotation}deg)`,
                                touchAction: 'none',
                              }}
                              className={`absolute cursor-grab active:cursor-grabbing p-1 rounded-lg transition-transform select-none ${
                                isSelected ? 'ring-2 ring-[#D67C65] bg-white/30 backdrop-blur-xs z-30' : 'hover:ring-1 hover:ring-white/50 z-20'
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
                                  className="absolute -top-6 -right-2 flex items-center gap-1 bg-[#F4EFE6] border border-[#282A2B] rounded-full px-2 py-0.5 text-[9px] font-mono font-bold text-[#D67C65] shadow-sm z-40 pointer-events-auto hover:bg-white transition"
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
                        const controlsLeft = st.x > 75 ? 'right-0' : 'left-0';
                        const controlsTop = st.y < 22 ? 'top-full mt-2' : '-top-11';
                        return (
                          <div
                            key={st.id}
                            ref={(node) => {
                              if (node) stickerElsRef.current.set(st.id, node);
                              else stickerElsRef.current.delete(st.id);
                            }}
                            onPointerDown={(e) => handleStartDragSticker(st.id, e)}
                            onTouchStart={(e) => handleTouchStart(st.id, e, st.scale)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onWheel={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const delta = e.deltaY < 0 ? 0.15 : -0.15;
                              const newScale = Math.max(0.3, Math.min(3.5, Number((st.scale + delta).toFixed(2))));
                              handleUpdateSticker(st.id, { scale: newScale });
                            }}
                            style={{
                              left: `${st.x}%`,
                              top: `${st.y}%`,
                              transform: `translate(-50%, -50%) rotate(${st.rotation}deg) scale(${st.scale})`,
                              touchAction: 'none',
                            }}
                            className={`absolute cursor-grab active:cursor-grabbing p-1.5 select-none transition-shadow ${
                              isSelected
                                ? 'ring-2 ring-[#D67C65] ring-offset-1 rounded-2xl bg-white/25 backdrop-blur-xs shadow-xl z-30'
                                : 'hover:ring-1 hover:ring-white/60 hover:bg-white/10 rounded-2xl z-20'
                            }`}
                          >
                            {/* Sticker Visual scaled to match rendered strip */}
                            {st.url ? (
                              <img
                                src={st.url}
                                alt={st.label || 'Sticker'}
                                style={{
                                  width: `${stickerBaseSize}px`,
                                  height: `${stickerBaseSize}px`,
                                }}
                                className="object-contain pointer-events-none drop-shadow-md select-none"
                                draggable={false}
                              />
                            ) : (
                              <span
                                className="pointer-events-none drop-shadow-md select-none leading-none block"
                                style={{
                                  fontSize: `${Math.round(stickerBaseSize * 0.75)}px`,
                                }}
                              >
                                {st.icon}
                              </span>
                            )}

                            {/* Floating Controls & Drag Handles when Sticker is Selected */}
                            {isSelected && (
                              <>
                                {/* Corner Resize Handle (Bottom-Right) */}
                                <div
                                  onPointerDown={(e) => handleStartResize(st.id, e)}
                                  className="absolute -bottom-3 -right-3 w-7 h-7 rounded-full bg-[#D67C65] text-white border-2 border-[#282A2B] shadow-retro-sm flex items-center justify-center cursor-nwse-resize z-40 touch-none hover:scale-110 active:scale-95 transition-transform"
                                  title="Drag to resize sticker"
                                >
                                  <Scaling className="w-3.5 h-3.5 pointer-events-none" />
                                </div>

                                {/* Top Rotation Handle */}
                                <div
                                  onPointerDown={(e) => handleStartRotate(st.id, e)}
                                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#6BA3A9] text-white border-2 border-[#282A2B] shadow-retro-sm flex items-center justify-center cursor-grab active:cursor-grabbing z-40 touch-none hover:scale-110 active:scale-95 transition-transform"
                                  title="Drag to rotate sticker"
                                >
                                  <RotateCw className="w-3 h-3 pointer-events-none" />
                                </div>

                                {/* Floating Action Pill Toolbar */}
                                <div
                                  className={`absolute ${controlsTop} ${controlsLeft} flex items-center gap-1 bg-[#F4EFE6] border-2 border-[#282A2B] rounded-full px-2 py-1 shadow-retro z-50 whitespace-nowrap`}
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateSticker(st.id, { scale: Math.min(3.5, Number((st.scale + 0.2).toFixed(2))) })}
                                    className="p-1.5 text-[#282A2B] hover:text-[#D67C65] active:scale-90 transition rounded-full hover:bg-white"
                                    title="Enlarge (+)"
                                  >
                                    <ZoomIn className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateSticker(st.id, { scale: Math.max(0.3, Number((st.scale - 0.2).toFixed(2))) })}
                                    className="p-1.5 text-[#282A2B] hover:text-[#D67C65] active:scale-90 transition rounded-full hover:bg-white"
                                    title="Shrink (-)"
                                  >
                                    <ZoomOut className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateSticker(st.id, { rotation: (st.rotation + 15) % 360 })}
                                    className="p-1.5 text-[#282A2B] hover:text-[#D67C65] active:scale-90 transition rounded-full hover:bg-white"
                                    title="Rotate +15°"
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateSticker(st.id, { rotation: (st.rotation - 15 + 360) % 360 })}
                                    className="p-1.5 text-[#282A2B] hover:text-[#D67C65] active:scale-90 transition rounded-full hover:bg-white"
                                    title="Rotate -15°"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                  <div className="w-[1px] h-3.5 bg-[#282A2B]/20 mx-0.5" />
                                  <button
                                    type="button"
                                    onClick={(e) => handleRemoveSticker(st.id, e)}
                                    className="p-1.5 text-red-600 hover:text-red-700 active:scale-90 transition rounded-full hover:bg-red-50"
                                    title="Delete Sticker"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
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
              </div>
            )}

            {/* Looping Animated GIF View */}
            {activeTab === 'gif' && (
              <div className="flex flex-col items-center justify-center flex-1 w-full min-h-0 overflow-hidden p-2 sm:p-4">
                {isGeneratingGif ? (
                  <div className="flex flex-col items-center text-white/90">
                    <div className="w-10 h-10 rounded-full border-3 border-[#D67C65] border-t-transparent animate-spin mb-3" />
                    <p className="text-xs font-bold font-retro tracking-wide">Encoding Looping GIF...</p>
                    <p className="text-[11px] text-white/70 font-mono mt-1">Stitching poses into animated loop</p>
                  </div>
                ) : gifUrl ? (
                  <div className="flex flex-col items-center justify-center max-h-full max-w-full">
                    <img
                      src={gifUrl}
                      alt="Animated Photobooth GIF"
                      style={{
                        maxHeight: '100%',
                        maxWidth: '100%',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                      className="rounded-2xl shadow-polaroid"
                    />
                    <button
                      type="button"
                      onClick={generateGif}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4EFE6] text-[#282A2B] border-2 border-[#282A2B] text-xs font-mono font-bold shadow-retro-sm hover:bg-white transition"
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
              <div className="flex flex-col items-center justify-center flex-1 w-full min-h-0 overflow-hidden p-2 sm:p-4">
                {isGeneratingVideo ? (
                  <div className="flex flex-col items-center text-white/90">
                    <div className="w-10 h-10 rounded-full border-3 border-[#6BA3A9] border-t-transparent animate-spin mb-3" />
                    <p className="text-xs font-bold font-retro tracking-wide">Rendering Boomerang Video...</p>
                    <p className="text-[11px] text-white/70 font-mono mt-1">Generating 30fps clip with flash effects</p>
                  </div>
                ) : videoUrl ? (
                  <div className="flex flex-col items-center justify-center max-h-full max-w-full">
                    <video
                      key={videoUrl}
                      src={videoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      controls
                      style={{
                        maxHeight: '100%',
                        maxWidth: '100%',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                      className="rounded-2xl shadow-polaroid"
                    />
                    <button
                      type="button"
                      onClick={generateVideo}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4EFE6] text-[#282A2B] border-2 border-[#282A2B] text-xs font-mono font-bold shadow-retro-sm hover:bg-white transition"
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
          <div className="w-full lg:w-[380px] lg:shrink-0 flex flex-col gap-2 sm:gap-3 overflow-hidden max-h-[48dvh] sm:max-h-[54dvh] lg:max-h-[62vh] bg-white/70 rounded-2xl border-2 border-[#282A2B] p-2 sm:p-3 shadow-retro-sm">
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
                  <p className="text-[10px] text-[#282A2B]/60 font-mono text-center -mt-1">
                    Tap to add • Drag to move • Pinch to resize
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 max-h-[28dvh] sm:max-h-[38vh] overflow-y-auto p-1">
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 w-full pt-2.5 sm:pt-3 border-t-2 border-[#282A2B]/15 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={onRetake}
              className="retro-btn-cream flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-mono font-bold text-[#282A2B] border-2 border-[#282A2B] shadow-retro-sm transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#D67C65]" />
              <span className="inline">Retake Session</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="retro-btn-cream flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-mono font-bold text-[11px] sm:text-xs text-[#282A2B] border-2 border-[#282A2B] shadow-retro-sm transition active:translate-y-0.5"
                title="Copy Image"
              >
                {hasCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#6BA3A9]" />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#D67C65]" />
                    <span className="hidden sm:inline">Copy Image</span>
                    <span className="sm:hidden">Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="retro-btn-teal flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-mono font-bold text-[11px] sm:text-xs text-white border-2 border-[#282A2B] shadow-retro-sm transition active:translate-y-0.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-retro font-bold text-xs sm:text-sm text-white border-2 border-[#282A2B] shadow-retro-sm tracking-wide transition active:translate-y-0.5 ${
                isExporting ? 'bg-[#D67C65]/70 cursor-wait' : 'retro-btn-terracotta'
              }`}
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Rendering HD Strip...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {activeTab === 'strip'
                      ? 'Download High-Res Strip'
                      : activeTab === 'gif'
                      ? 'Download Looping GIF'
                      : 'Download Video Clip'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Full-Screen Inspector Modal for Thorough Inspection on All Devices */}
      {isExpandedPreview && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#141516]/98 backdrop-blur-md text-[#F4EFE6] select-none p-2 sm:p-4 animate-fadeIn">
          {/* Inspector Header */}
          <div className="flex items-center justify-between px-2 sm:px-4 py-2 border-b border-white/15 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#D67C65] border border-white/20 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Maximize2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-retro font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                  FULL SCREEN INSPECT
                  <span className="text-[10px] sm:text-xs font-mono font-normal text-white/60">
                    ({activeTab === 'strip' ? 'Photostrip' : activeTab === 'gif' ? 'Looping GIF' : 'Video'})
                  </span>
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Zoom Controls for Photostrip Inspection */}
              {activeTab === 'strip' && (
                <div className="hidden sm:flex items-center bg-white/10 rounded-xl p-0.5 border border-white/15 mr-1">
                  <button
                    type="button"
                    onClick={() => setInspectorZoom((z) => Math.max(0.6, Number((z - 0.2).toFixed(1))))}
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 text-[11px] font-mono text-white/90">
                    {Math.round(inspectorZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setInspectorZoom((z) => Math.min(3.0, Number((z + 0.2).toFixed(1))))}
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  {inspectorZoom !== 1.0 && (
                    <button
                      type="button"
                      onClick={() => setInspectorZoom(1.0)}
                      className="px-2 py-0.5 text-[10px] font-mono text-[#D67C65] hover:underline"
                      title="Reset Zoom to 100%"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}

              {/* Format Switcher Pills */}
              <div className="flex items-center bg-white/10 rounded-xl p-0.5 border border-white/15">
                <button
                  type="button"
                  onClick={() => { setActiveTab('strip'); setInspectorZoom(1.0); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold transition ${
                    activeTab === 'strip' ? 'bg-[#D67C65] text-white shadow-sm' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Strip
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('gif'); setInspectorZoom(1.0); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold transition ${
                    activeTab === 'gif' ? 'bg-[#D67C65] text-white shadow-sm' : 'text-white/70 hover:text-white'
                  }`}
                >
                  GIF
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('video'); setInspectorZoom(1.0); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold transition ${
                    activeTab === 'video' ? 'bg-[#D67C65] text-white shadow-sm' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Video
                </button>
              </div>

              {/* Exit Full Screen Button */}
              <button
                type="button"
                onClick={() => { setIsExpandedPreview(false); setInspectorZoom(1.0); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4EFE6] text-[#282A2B] hover:bg-white text-xs font-mono font-bold shadow-retro-sm transition active:scale-95"
                title="Exit Full Screen (Esc)"
              >
                <Minimize2 className="w-3.5 h-3.5 text-[#D67C65]" />
                <span className="hidden sm:inline">Exit Full Screen</span>
                <span className="sm:hidden">Exit</span>
              </button>
            </div>
          </div>

          {/* Center Inspection Viewport */}
          <div className="flex-1 w-full min-h-0 min-w-0 flex items-center justify-center p-2 sm:p-4 overflow-auto relative">
            {activeTab === 'strip' && (
              stripUrl ? (
                <div
                  className="relative flex items-center justify-center select-none transition-transform duration-150"
                  style={{
                    transform: `scale(${inspectorZoom})`,
                    transformOrigin: 'center center',
                    maxHeight: 'calc(100dvh - 140px)',
                    maxWidth: 'calc(100vw - 32px)',
                  }}
                >
                  <img
                    src={stripUrl}
                    alt="Full Photostrip Preview"
                    style={{
                      maxHeight: 'calc(100dvh - 140px)',
                      maxWidth: 'calc(100vw - 32px)',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                    className="rounded-xl shadow-2xl pointer-events-none select-none"
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center text-white/70">
                  <div className="w-8 h-8 rounded-full border-2 border-[#D67C65] border-t-transparent animate-spin mb-2" />
                  <p className="text-xs font-mono">Loading full strip preview...</p>
                </div>
              )
            )}

            {activeTab === 'gif' && (
              gifUrl ? (
                <div className="relative flex items-center justify-center select-none">
                  <img
                    src={gifUrl}
                    alt="Full Looping GIF Preview"
                    style={{
                      maxHeight: 'calc(100dvh - 140px)',
                      maxWidth: 'calc(100vw - 32px)',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                    className="rounded-xl shadow-2xl pointer-events-none select-none"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center text-white/70">
                  <p className="text-xs font-mono">Generate GIF in studio to preview</p>
                </div>
              )
            )}

            {activeTab === 'video' && (
              videoUrl ? (
                <div className="relative flex items-center justify-center select-none">
                  <video
                    key={videoUrl}
                    src={videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls
                    style={{
                      maxHeight: 'calc(100dvh - 140px)',
                      maxWidth: 'calc(100vw - 32px)',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                    className="rounded-xl shadow-2xl"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center text-white/70">
                  <p className="text-xs font-mono">Render video in studio to preview</p>
                </div>
              )
            )}
          </div>

          {/* Bottom Quick-Action Dock */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 py-2 border-t border-white/15 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className="retro-btn-terracotta px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-retro font-bold text-white flex items-center gap-2 shadow-retro-sm active:translate-y-0.5"
            >
              <Download className="w-4 h-4" />
              <span>Download Print</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={isExporting}
              className="px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-retro font-bold bg-[#F4EFE6] text-[#282A2B] border-2 border-[#282A2B] hover:bg-white flex items-center gap-1.5 shadow-retro-sm active:translate-y-0.5"
            >
              {hasCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{hasCopied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              disabled={isExporting}
              className="px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-retro font-bold bg-[#6BA3A9] text-white border-2 border-[#282A2B] hover:bg-[#5b8f95] flex items-center gap-1.5 shadow-retro-sm active:translate-y-0.5"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={() => { setIsExpandedPreview(false); setInspectorZoom(1.0); }}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-mono font-bold text-white/80 hover:text-white border border-white/20 hover:bg-white/10 transition"
            >
              Back to Studio
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
