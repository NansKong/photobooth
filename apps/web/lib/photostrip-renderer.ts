import {
  PhotoFilterId,
  PhotostripLayoutId,
  PhotostripThemeId,
} from '@photobooth/shared';

export interface PhotostripUserSticker {
  id: string;
  url?: string;
  icon?: string;
  label?: string;
  x: number; // 0..100 (%)
  y: number; // 0..100 (%)
  scale: number;
  rotation: number; // degrees
}

export interface PhotostripMovableCard {
  id: string;
  frameIndex: number;
  x: number; // 0..100 (%)
  y: number; // 0..100 (%)
  width?: number;
  height?: number;
  rotation: number; // degrees
  scale: number;
}

export interface PhotostripOptions {
  theme: PhotostripThemeId;
  layout: PhotostripLayoutId;
  filter: PhotoFilterId;
  title?: string;
  subtitle?: string;
  dateStr?: string;
  primaryColor?: string;
  customFrameImage?: HTMLImageElement | null;
  stickers?: PhotostripUserSticker[];
  movableCards?: PhotostripMovableCard[];
}

const stickerImgCache = new Map<string, HTMLImageElement>();
export function preloadSticker(url: string): Promise<HTMLImageElement | null> {
  if (stickerImgCache.has(url)) return Promise.resolve(stickerImgCache.get(url)!);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      stickerImgCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function drawUserStickersOnCanvas(
  ctx: CanvasRenderingContext2D,
  stickers: PhotostripUserSticker[],
  canvasW: number,
  canvasH: number
) {
  if (!stickers || stickers.length === 0) return;

  for (const st of stickers) {
    const cx = (st.x / 100) * canvasW;
    const cy = (st.y / 100) * canvasH;
    const scale = st.scale || 1.0;
    const rot = ((st.rotation || 0) * Math.PI) / 180;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);

    if (st.url) {
      const img = await preloadSticker(st.url);
      if (img && img.naturalWidth > 0) {
        const baseSize = 140;
        const aspect = img.naturalWidth / img.naturalHeight;
        let w = baseSize;
        let h = baseSize / aspect;
        if (aspect < 1) {
          h = baseSize;
          w = baseSize * aspect;
        }
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
    } else if (st.icon) {
      ctx.font = '64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.icon, 0, 0);
    }

    ctx.restore();
  }
}

/**
 * Apply filters (Noir B&W, Warm Sepia, 90s Film Grain) to image on canvas
 */
export function applyPhotoFilter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  filter: PhotoFilterId
) {
  if (filter === 'none') return;

  const imgData = ctx.getImageData(x, y, w, h);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    if (filter === 'noir') {
      // High-contrast punchy black & white (Noir)
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;
      // S-curve contrast
      gray = gray < 128 ? (gray * gray) / 128 : 255 - ((255 - gray) * (255 - gray)) / 128;
      d[i] = gray;
      d[i + 1] = gray;
      d[i + 2] = gray;
    } else if (filter === 'sepia') {
      // Warm vintage 70s sepia
      const tr = 0.393 * r + 0.769 * g + 0.189 * b;
      const tg = 0.349 * r + 0.686 * g + 0.168 * b;
      const tb = 0.272 * r + 0.534 * g + 0.131 * b;
      d[i] = Math.min(255, tr * 1.05);
      d[i + 1] = Math.min(255, tg * 0.95);
      d[i + 2] = Math.min(255, tb * 0.82);
    } else if (filter === 'film90s') {
      // 90s disposable camera warm tones with subtle noise
      const noise = (Math.random() - 0.5) * 14;
      d[i] = Math.min(255, Math.max(0, r * 1.08 + 8 + noise));
      d[i + 1] = Math.min(255, Math.max(0, g * 0.98 + 4 + noise));
      d[i + 2] = Math.min(255, Math.max(0, b * 0.88 + 12 + noise));
    }
  }

  ctx.putImageData(imgData, x, y);
}

/**
 * Draws rounded rectangle path
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draws ticket notches / perforations on the vertical sides of a strip
 */
function drawTicketNotches(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  notchRadius: number = 18,
  notchCount: number = 14
) {
  ctx.save();
  ctx.fillStyle = '#450a0a'; // outer background cutout color
  const step = h / (notchCount + 1);

  for (let i = 1; i <= notchCount; i++) {
    const notchY = y + i * step;
    // Left notch
    ctx.beginPath();
    ctx.arc(x, notchY, notchRadius, -Math.PI / 2, Math.PI / 2, false);
    ctx.fill();

    // Right notch
    ctx.beginPath();
    ctx.arc(x + w, notchY, notchRadius, Math.PI / 2, (3 * Math.PI) / 2, false);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draws cute stickers on canvas (Cherries, bows, teddy bear, stars, band-aids)
 */
function drawDecorativeStickers(
  ctx: CanvasRenderingContext2D,
  theme: PhotostripThemeId,
  canvasW: number,
  canvasH: number,
  stripX: number,
  stripY: number,
  stripW: number,
  stripH: number
) {
  ctx.save();

  if (theme === 'cute-scrapbook') {
    // Top: Polaroid Camera Graphic
    ctx.save();
    const camW = stripW * 0.72;
    const camH = 110;
    const camX = stripX + (stripW - camW) / 2;
    const camY = stripY - 30;

    // Camera body
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, camX, camY, camW, camH, 18);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Camera black lower band
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(camX, camY + 80, camW, 30);

    // Lens outer circle
    ctx.beginPath();
    ctx.arc(camX + camW / 2, camY + 48, 32, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();

    // Lens inner glare
    ctx.beginPath();
    ctx.arc(camX + camW / 2 - 6, camY + 42, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();

    // Shutter button (red)
    ctx.beginPath();
    ctx.arc(camX + 32, camY + 70, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    // Flash window
    ctx.fillStyle = '#38bdf8';
    roundRect(ctx, camX + 24, camY + 20, 24, 28, 4);
    ctx.fill();

    // "OneStep2" label
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('OneStep 2', camX + camW - 65, camY + 68);

    // Red Satin Ribbon Bow on Camera
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.ellipse(camX + 16, camY + 14, 18, 10, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(camX + 44, camY + 14, 18, 10, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(camX + 30, camY + 14, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#7f1d1d';
    ctx.fill();
    ctx.restore();

    // Sticker: Cherries on left margin
    const drawCherries = (cx: number, cy: number) => {
      ctx.save();
      // Cherry 1
      ctx.beginPath();
      ctx.arc(cx - 10, cy + 8, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#b91c1c';
      ctx.fill();
      // Cherry 2
      ctx.beginPath();
      ctx.arc(cx + 8, cy + 12, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#991b1b';
      ctx.fill();
      // Stems
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.quadraticCurveTo(cx - 4, cy - 18, cx + 4, cy - 24);
      ctx.moveTo(cx + 8, cy + 2);
      ctx.quadraticCurveTo(cx + 6, cy - 14, cx + 4, cy - 24);
      ctx.stroke();
      ctx.restore();
    };

    drawCherries(stripX + 18, stripY + 140);

    // Sticker: Stacked Coffee Cups illustration on right margin
    const drawCoffeeCups = (cx: number, cy: number) => {
      ctx.save();
      const cupColors = ['#78350f', '#b45309', '#fef3c7'];
      cupColors.forEach((col, idx) => {
        const yOff = cy + idx * 16;
        ctx.fillStyle = col;
        roundRect(ctx, cx - 18, yOff, 36, 18, 5);
        ctx.fill();
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      ctx.restore();
    };

    drawCoffeeCups(stripX + stripW - 24, stripY + stripH * 0.58);

    // Bottom Sticker: Birthday Teddy Bear
    ctx.save();
    const bearX = stripX + 36;
    const bearY = stripY + stripH - 52;
    // Body & head
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.arc(bearX, bearY, 22, 0, Math.PI * 2); // head
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bearX - 18, bearY - 18, 9, 0, Math.PI * 2); // ear L
    ctx.arc(bearX + 18, bearY - 18, 9, 0, Math.PI * 2); // ear R
    ctx.fill();
    // Party hat
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.moveTo(bearX, bearY - 40);
    ctx.lineTo(bearX - 10, bearY - 18);
    ctx.lineTo(bearX + 10, bearY - 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Bottom Sticker: Cinema ticket "good things are coming"
    ctx.save();
    const tX = stripX + stripW - 140;
    const tY = stripY + stripH - 64;
    ctx.fillStyle = '#fffbeb';
    roundRect(ctx, tX, tY, 110, 42, 6);
    ctx.fill();
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('GOOD THINGS', tX + 14, tY + 18);
    ctx.font = '8px sans-serif';
    ctx.fillText('ARE COMING ★', tX + 14, tY + 30);
    ctx.restore();
  } else if (theme === 'y2k-zine') {
    // Top right: Realistic Vinyl Record Sticker
    ctx.save();
    const vx = stripX + stripW - 35;
    const vy = stripY + 28;
    ctx.beginPath();
    ctx.arc(vx, vy, 42, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    // Grooves
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let r = 18; r < 38; r += 5) {
      ctx.beginPath();
      ctx.arc(vx, vy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Center label
    ctx.beginPath();
    ctx.arc(vx, vy, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(vx, vy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.restore();

    // Bottom Left: Chrome Metallic Candy Wrapper Sticker
    ctx.save();
    const candyX = stripX + 28;
    const candyY = stripY + stripH - 55;
    const grad = ctx.createLinearGradient(candyX - 25, candyY - 15, candyX + 25, candyY + 15);
    grad.addColorStop(0, '#94a3b8');
    grad.addColorStop(0.3, '#f8fafc');
    grad.addColorStop(0.5, '#64748b');
    grad.addColorStop(0.7, '#cbd5e1');
    grad.addColorStop(1, '#475569');
    ctx.fillStyle = grad;
    // Twisted ends
    ctx.beginPath();
    ctx.moveTo(candyX - 30, candyY - 16);
    ctx.lineTo(candyX - 12, candyY);
    ctx.lineTo(candyX - 30, candyY + 16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(candyX + 30, candyY - 16);
    ctx.lineTo(candyX + 12, candyY);
    ctx.lineTo(candyX + 30, candyY + 16);
    ctx.closePath();
    ctx.fill();
    // Center wrapped candy
    ctx.beginPath();
    ctx.ellipse(candyX, candyY, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Main Photostrip Canvas Compositor
 */
export async function renderCustomPhotostrip(
  capturedFrames: (ImageBitmap | HTMLCanvasElement)[],
  options: PhotostripOptions
): Promise<Blob | null> {
  const {
    theme = 'vintage-ticket',
    layout = 'strip-1x4',
    filter = 'none',
    title = 'Theather Show',
    subtitle = 'SAVE THE BEST MOMENT ★ SAVE THE BEST MOMENT',
    dateStr = 'Sunday, 29 March • 20.00',
    primaryColor = '#500724',
    customFrameImage = null,
    stickers = [],
    movableCards = [],
  } = options;

  // Determine strip dimensions
  let canvasW = 820;
  let canvasH = 2100;
  const frameCount = Math.max(1, Math.min(6, capturedFrames.length));

  const isTwin = layout === 'strip-twin';
  const is3Shot = layout === 'strip-1x3';
  const is2x2 = layout === 'grid-2x2';
  const isFreeform = layout === 'scrapbook-freeform';

  if (isFreeform) {
    canvasW = 1400;
    canvasH = 1400;
  } else if (isTwin) {
    canvasW = 1480;
    canvasH = 2100;
  } else if (is2x2) {
    canvasW = 1200;
    canvasH = 1450;
  } else if (is3Shot) {
    canvasW = 820;
    canvasH = 1750;
  } else if (!is2x2 && !isTwin) {
    canvasH = 450 + frameCount * 410;
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  // 1. Draw Master Outer Background (Tabletop / Background Mat)
  if (theme === 'vintage-ticket') {
    ctx.fillStyle = '#4a0404'; // Deep wine theatrical curtain backdrop
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (theme === 'boothy-call') {
    // Polka dot wallpaper background
    ctx.fillStyle = '#fdf4dc'; // Cream
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#991b1b'; // Red polka dots
    const dotSpacing = 80;
    for (let py = 0; py < canvasH; py += dotSpacing) {
      for (let px = 0; px < canvasW; px += dotSpacing) {
        ctx.beginPath();
        ctx.arc(px + (py % 160 === 0 ? 0 : 40), py, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (theme === 'cute-scrapbook') {
    ctx.fillStyle = '#7f1d1d'; // Rich velvet burgundy
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (theme === 'y2k-zine') {
    // Grayscale textured newsprint zine background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, 40, canvasW - 80, canvasH - 80);
  } else if (theme === 'retro-patterns') {
    // Tartan plaid background
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 14;
    for (let x = 0; x < canvasW; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
      ctx.stroke();
    }
    for (let y = 0; y < canvasH; y += 90) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  if (isFreeform) {
    // Draw Freeform Scrapbook Tabletop
    ctx.fillStyle = '#f8f4eb';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Subtle checkered / linen grid pattern
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    for (let p = 0; p < canvasW; p += 35) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, canvasH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(canvasW, p);
      ctx.stroke();
    }

    // Top Header
    ctx.save();
    ctx.fillStyle = '#282a2b';
    ctx.font = 'italic 700 48px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(title || 'Our Scrapbook Memories', canvasW / 2, 85);
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText(dateStr || new Date().toDateString(), canvasW / 2, 120);
    ctx.restore();

    // Default positions for movable cards if not customized
    const defaultPositions = [
      { x: 28, y: 36, rotation: -7, scale: 1 },
      { x: 72, y: 34, rotation: 6, scale: 1 },
      { x: 30, y: 74, rotation: 5, scale: 1 },
      { x: 74, y: 72, rotation: -5, scale: 1 },
      { x: 50, y: 53, rotation: 1, scale: 1.05 },
      { x: 82, y: 53, rotation: -3, scale: 0.95 },
    ];

    const cards =
      movableCards && movableCards.length > 0
        ? movableCards
        : capturedFrames.map((_, i) => {
            const p = defaultPositions[i % defaultPositions.length];
            return {
              id: `card-${i}`,
              frameIndex: i,
              x: p.x,
              y: p.y,
              rotation: p.rotation,
              scale: p.scale,
            };
          });

    const cardBaseW = 440;
    const cardBaseH = 490;

    for (const card of cards) {
      const cx = (card.x / 100) * canvasW;
      const cy = (card.y / 100) * canvasH;
      const cardW = cardBaseW * (card.scale || 1);
      const cardH = cardBaseH * (card.scale || 1);
      const rot = ((card.rotation || 0) * Math.PI) / 180;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);

      // Card shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 12;

      // Polaroid Card Body
      ctx.fillStyle = '#fffdfa';
      roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 12);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Photo inside Polaroid
      const photoPad = 24 * (card.scale || 1);
      const photoW = cardW - photoPad * 2;
      const photoH = cardH - photoPad * 2 - 60 * (card.scale || 1);
      const photoX = -cardW / 2 + photoPad;
      const photoY = -cardH / 2 + photoPad;

      ctx.save();
      roundRect(ctx, photoX, photoY, photoW, photoH, 6);
      ctx.clip();

      const frame = capturedFrames[card.frameIndex % capturedFrames.length];
      if (frame) {
        const scale = Math.max(photoW / frame.width, photoH / frame.height);
        const dw = frame.width * scale;
        const dh = frame.height * scale;
        ctx.drawImage(frame, photoX + (photoW - dw) / 2, photoY + (photoH - dh) / 2, dw, dh);
        applyPhotoFilter(ctx, photoX, photoY, photoW, photoH, filter);
      }
      ctx.restore();

      // Cute Pink Washi Tape on top edge
      ctx.save();
      ctx.fillStyle = 'rgba(236, 72, 153, 0.75)';
      roundRect(
        ctx,
        -50 * (card.scale || 1),
        -cardH / 2 - 10 * (card.scale || 1),
        100 * (card.scale || 1),
        22 * (card.scale || 1),
        4
      );
      ctx.fill();
      ctx.restore();

      ctx.restore();
    }
  } else {
    // Calculate strip columns (1 column for single strip / 2 columns for twin strip)
    const columns = isTwin || is2x2 ? 2 : 1;
    const stripMarginX = isTwin || is2x2 ? 45 : 45;
    const stripMarginY = 50;
    const stripGap = 50;
    const singleStripW = isTwin || is2x2
      ? (canvasW - 2 * stripMarginX - stripGap) / 2
      : canvasW - 2 * stripMarginX;
    const singleStripH = canvasH - 2 * stripMarginY;

    // Number of photo slots per column
    const slotCount = is2x2 ? Math.min(2, frameCount) : is3Shot ? Math.min(3, frameCount) : frameCount;

    for (let col = 0; col < columns; col++) {
      const stripX = stripMarginX + col * (singleStripW + stripGap);
      const stripY = stripMarginY;
      const stripW = singleStripW;
      const stripH = singleStripH;

    // Draw Strip Card Background
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;

    let stripBgColor = '#fffdf7'; // Authentic off-white ticket card
    if (theme === 'boothy-call' && col === 1) {
      stripBgColor = '#831843'; // Deep wine right strip
    } else if (theme === 'y2k-zine') {
      stripBgColor = '#f8fafc';
    } else if (theme === 'classic-film') {
      stripBgColor = '#09090b';
    }

    roundRect(ctx, stripX, stripY, stripW, stripH, 18);
    ctx.fillStyle = stripBgColor;
    ctx.fill();
    ctx.restore();

    // Strip Border
    ctx.save();
    ctx.strokeStyle = theme === 'vintage-ticket' ? '#5c0b0b' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 3;
    roundRect(ctx, stripX, stripY, stripW, stripH, 18);
    ctx.stroke();
    ctx.restore();

    // Draw Ticket Notches if theater ticket theme
    if (theme === 'vintage-ticket') {
      drawTicketNotches(ctx, stripX, stripY, stripW, stripH, 16, 12);
    }

    // Top Header
    const headerH = is3Shot ? 160 : 210;
    const footerH = is3Shot ? 150 : 180;
    const photosTop = stripY + headerH;
    const photosHeight = stripH - headerH - footerH;

    // Draw Theme Header Details
    ctx.save();
    if (theme === 'vintage-ticket') {
      // 3 Stars on top
      ctx.fillStyle = '#5c0b0b';
      ctx.textAlign = 'center';
      ctx.font = '18px serif';
      ctx.fillText('★  ★  ★', stripX + stripW / 2, stripY + 38);

      // "Theather Show" in ornate script
      ctx.font = 'italic 700 38px Georgia, serif';
      ctx.fillText(title || 'Theather Show', stripX + stripW / 2, stripY + 82);

      // Ticket Info Box (Row B2 | Show 02 | Date Time)
      const boxY = stripY + 104;
      const boxW = stripW - 48;
      const boxX = stripX + 24;
      const boxH = 68;

      ctx.strokeStyle = '#5c0b0b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      // Divider 1
      ctx.beginPath();
      ctx.moveTo(boxX + boxW * 0.22, boxY);
      ctx.lineTo(boxX + boxW * 0.22, boxY + boxH);
      ctx.stroke();
      // Divider 2
      ctx.beginPath();
      ctx.moveTo(boxX + boxW * 0.44, boxY);
      ctx.lineTo(boxX + boxW * 0.44, boxY + boxH);
      ctx.stroke();

      // Labels & Values
      ctx.font = '500 13px sans-serif';
      ctx.fillStyle = '#7f1d1d';
      ctx.fillText('Row', boxX + boxW * 0.11, boxY + 22);
      ctx.fillText('Show', boxX + boxW * 0.33, boxY + 22);
      ctx.fillText('Sunday, 29 March', boxX + boxW * 0.72, boxY + 22);

      ctx.font = 'bold 22px Georgia, serif';
      ctx.fillText('B2', boxX + boxW * 0.11, boxY + 54);
      ctx.fillText('02', boxX + boxW * 0.33, boxY + 54);
      ctx.fillText('20.00', boxX + boxW * 0.72, boxY + 54);
    } else if (theme === 'y2k-zine') {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('HIT RECORDS  •  BEING FUNNY IN A FOREIGN LANGUAGE', stripX + 30, stripY + 36);

      ctx.font = 'bold 900 44px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ABOUT YOU', stripX + stripW / 2, stripY + 95);

      ctx.font = 'italic 500 13px Georgia, serif';
      ctx.fillText('"DO YOU THINK I HAVE FORGOTTEN?"', stripX + stripW / 2, stripY + 130);
    } else if (theme === 'snapobox-baroque') {
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 700 28px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '6px';
      ctx.fillText('SNAPOBOX', stripX + stripW / 2, stripY + 65);
    } else if (theme === 'boothy-call') {
      // Heart Telephone Badge
      ctx.save();
      const badgeX = stripX + stripW - 65;
      const badgeY = stripY + 45;
      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.arc(badgeX - 10, badgeY - 10, 16, 0, Math.PI * 2);
      ctx.arc(badgeX + 10, badgeY - 10, 16, 0, Math.PI * 2);
      ctx.lineTo(badgeX, badgeY + 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic bold 10px cursive';
      ctx.textAlign = 'center';
      ctx.fillText('Boothy', badgeX, badgeY - 4);
      ctx.fillText('Call', badgeX, badgeY + 8);
      ctx.restore();
    }
    ctx.restore();

    // Draw Photo Slots
    const slotGap = 20;
    const slotW = stripW - 56;
    const slotH = (photosHeight - (slotCount - 1) * slotGap) / slotCount;
    const slotX = stripX + 28;

    for (let s = 0; s < slotCount; s++) {
      const slotY = photosTop + s * (slotH + slotGap);

      // Select frame from captured sequence
      const frameIndex = isTwin ? s % frameCount : is2x2 ? col * 2 + s : s;
      const photoFrame = capturedFrames[frameIndex];

      ctx.save();

      // Circular slot mode for Boothy Call right column
      const isCircularSlot = theme === 'boothy-call' && col === 1;

      if (isCircularSlot) {
        ctx.beginPath();
        const rad = Math.min(slotW, slotH) / 2;
        ctx.arc(slotX + slotW / 2, slotY + slotH / 2, rad, 0, Math.PI * 2);
        ctx.clip();
      } else {
        // Rounded rectangle slot
        roundRect(ctx, slotX, slotY, slotW, slotH, 8);
        ctx.clip();
      }

      // Draw photo cover
      if (photoFrame) {
        const pw = photoFrame.width;
        const ph = photoFrame.height;
        const scale = Math.max(slotW / pw, slotH / ph);
        const dw = pw * scale;
        const dh = ph * scale;
        const dx = slotX + (slotW - dw) / 2;
        const dy = slotY + (slotH - dh) / 2;

        ctx.drawImage(photoFrame, dx, dy, dw, dh);

        // Apply photo filter (Noir, Sepia, etc.)
        applyPhotoFilter(ctx, slotX, slotY, slotW, slotH, filter);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(slotX, slotY, slotW, slotH);
      }

      ctx.restore(); // end photo clip

      // Ornate Slot Borders (SNAPOBOX Baroque, Leopard, Gold frames)
      ctx.save();
      if (theme === 'snapobox-baroque') {
        // Alternate ornate frames
        ctx.lineWidth = 14;
        if (s === 0) {
          ctx.strokeStyle = '#3b82f6'; // Blue striped
        } else if (s === 1) {
          ctx.strokeStyle = '#eab308'; // Baroque gold
        } else if (s === 2) {
          ctx.strokeStyle = '#ef4444'; // Red wavy
        } else {
          ctx.strokeStyle = '#78350f'; // Chocolate twist
        }
        roundRect(ctx, slotX, slotY, slotW, slotH, 16);
        ctx.stroke();
      } else if (theme === 'classic-film') {
        // Film border with sprockets on sides
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 3;
        roundRect(ctx, slotX, slotY, slotW, slotH, 4);
        ctx.stroke();
      } else {
        // Clean crisp inner photo matting
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        roundRect(ctx, slotX, slotY, slotW, slotH, 8);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Theme Footer
    const footerY = photosTop + photosHeight + 20;
    ctx.save();
    if (theme === 'vintage-ticket') {
      // "SAVE THE BEST MOMENT ★ SAVE THE BEST MOMENT"
      ctx.fillStyle = '#5c0b0b';
      ctx.strokeStyle = '#5c0b0b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(stripX + 24, footerY + 8);
      ctx.lineTo(stripX + stripW - 24, footerY + 8);
      ctx.stroke();

      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(subtitle || 'SAVE THE BEST MOMENT ★ SAVE THE BEST MOMENT', stripX + stripW / 2, footerY + 28);

      ctx.beginPath();
      ctx.moveTo(stripX + 24, footerY + 38);
      ctx.lineTo(stripX + stripW - 24, footerY + 38);
      ctx.stroke();

      // "kafastudio." or "ADMIT MORE" in bold elegant serif
      ctx.font = 'italic bold 42px Georgia, serif';
      ctx.fillText('kafastudio.', stripX + stripW / 2, footerY + 95);
    } else if (theme === 'snapobox-baroque') {
      ctx.fillStyle = '#57534e';
      ctx.font = 'italic 26px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('Framing the Feeling', stripX + stripW / 2, footerY + 50);
    } else if (theme === 'y2k-zine') {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`VOL. 1 • NO. 1 • ${dateStr}`, stripX + stripW / 2, footerY + 45);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dateStr || new Date().toDateString(), stripX + stripW / 2, footerY + 40);
    }
    ctx.restore();

    // Draw thematic sticker overlays on top
    drawDecorativeStickers(ctx, theme, canvasW, canvasH, stripX, stripY, stripW, stripH);
  }
}

  // Draw user custom draggable stickers (bows, cats, sparkles, flowers, charms, etc.)
  await drawUserStickersOnCanvas(ctx, stickers, canvasW, canvasH);

  // If user provided a custom PNG frame image overlay, blend it over the canvas
  if (customFrameImage) {
    ctx.drawImage(customFrameImage, 0, 0, canvasW, canvasH);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.98);
  });
}
