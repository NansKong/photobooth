import {
  calculateParticipantSlots,
  getEnvironmentById,
  PHOTO_LAYOUTS,
  Participant,
  Room,
} from '@photobooth/shared';

export interface RenderCanvasOptions {
  showGuidelines?: boolean;
  isFinalCapture?: boolean;
  highResScale?: number;
}

/**
 * Draws a rounded rectangle path onto the canvas context.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Renders the virtual or real background environment.
 */
function renderEnvironmentBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  room: Room
) {
  const env = getEnvironmentById(room.environmentId);

  if (room.environmentType === 'real' || env.id === 'real-default') {
    // Mode A: Clean dark studio framing
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0a0e1a');
    grad.addColorStop(1, '#05070d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle studio spotlight from above
    const spotGrad = ctx.createRadialGradient(
      width / 2,
      height * 0.2,
      10,
      width / 2,
      height * 0.2,
      width * 0.75
    );
    spotGrad.addColorStop(0, 'rgba(99, 102, 241, 0.12)');
    spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  // Mode B: Shared Virtual Environment
  if (env.id === 'virtual-synthwave') {
    // 80s Synthwave Sunset & Neon Grid
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#120024');
    bgGrad.addColorStop(0.5, '#4a044e');
    bgGrad.addColorStop(0.7, '#be185d');
    bgGrad.addColorStop(1, '#0a0014');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Retro Sun
    const sunY = height * 0.5;
    const sunRadius = Math.min(width, height) * 0.22;
    const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
    sunGrad.addColorStop(0, '#fde047');
    sunGrad.addColorStop(0.5, '#f43f5e');
    sunGrad.addColorStop(1, '#c026d3');

    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Sun horizontal scanlines
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#4a044e';
    for (let y = sunY - sunRadius * 0.2; y < sunY + sunRadius; y += 14) {
      ctx.beginPath();
      ctx.moveTo(width / 2 - sunRadius, y);
      ctx.lineTo(width / 2 + sunRadius, y);
      ctx.stroke();
    }
    ctx.restore();

    // Perspective wireframe grid at bottom
    ctx.save();
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
    ctx.lineWidth = 2;
    const horizonY = height * 0.65;
    // Horizontals
    for (let i = 0; i <= 10; i++) {
      const y = horizonY + Math.pow(i / 10, 2) * (height - horizonY);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    // Vanishing lines
    for (let x = -width * 0.5; x <= width * 1.5; x += width * 0.1) {
      ctx.beginPath();
      ctx.moveTo(width / 2, horizonY);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.restore();
  } else if (env.id === 'virtual-neon') {
    // Darkroom with glowing neon bokeh circles
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    const bokehPoints = [
      { x: width * 0.2, y: height * 0.25, r: width * 0.22, color: 'rgba(217, 70, 239, 0.25)' },
      { x: width * 0.8, y: height * 0.3, r: width * 0.25, color: 'rgba(6, 182, 212, 0.22)' },
      { x: width * 0.5, y: height * 0.75, r: width * 0.28, color: 'rgba(99, 102, 241, 0.2)' },
      { x: width * 0.15, y: height * 0.8, r: width * 0.18, color: 'rgba(244, 63, 94, 0.18)' },
    ];

    bokehPoints.forEach((p) => {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (env.id === 'virtual-birthday') {
    // Festive celebration with floating confetti
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#3b0764');
    bgGrad.addColorStop(0.5, '#701a75');
    bgGrad.addColorStop(1, '#831843');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Confetti pieces
    const confettiColors = ['#f59e0b', '#38bdf8', '#ec4899', '#10b981', '#fbbf24', '#a855f7'];
    for (let i = 0; i < 70; i++) {
      const cx = ((i * 137.5) % width);
      const cy = ((i * 97.3) % height);
      const color = confettiColors[i % confettiColors.length];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((i * 45 * Math.PI) / 180);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.65;
      if (i % 3 === 0) {
        ctx.fillRect(-6, -6, 12, 12);
      } else if (i % 3 === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-8, -3, 16, 6);
      }
      ctx.restore();
    }
  } else if (env.id === 'virtual-sunset') {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#2e1065');
    bgGrad.addColorStop(0.35, '#831843');
    bgGrad.addColorStop(0.7, '#ea580c');
    bgGrad.addColorStop(1, '#fde047');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Studio or Minimal default gradient
    const bgGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      50,
      width / 2,
      height / 2,
      width * 0.8
    );
    bgGrad.addColorStop(0, '#27272a');
    bgGrad.addColorStop(1, '#09090b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Main composition render function.
 */
export function renderPhotoboothComposition(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  room: Room,
  videoElements: Map<string, HTMLVideoElement>,
  selfParticipantId: string | null,
  options: RenderCanvasOptions = {}
) {
  const { showGuidelines = false, isFinalCapture = false } = options;
  const layoutConfig = PHOTO_LAYOUTS[room.layoutId] || PHOTO_LAYOUTS['duo-classic'];

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // 1. Layer 0: Background Environment
  renderEnvironmentBackground(ctx, width, height, room);

  // 2. Layer 1: Participant Video Streams
  const participants = room.participants;
  const slots = calculateParticipantSlots(room.layoutId, participants.length);

  slots.forEach((slot, index) => {
    const participant = participants[index];
    if (!participant) return;

    // Convert normalized slot coordinates (0..1) to canvas pixels
    const slotX = slot.x * width;
    const slotY = slot.y * height;
    const slotW = slot.width * width;
    const slotH = slot.height * height;
    const radius = slot.borderRadius || 16;

    ctx.save();

    // Outer slot frame / shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;

    // Fill background for slot
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, slotX, slotY, slotW, slotH, radius);
    ctx.fill();

    // Reset shadow for clipping video
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Clip to rounded slot
    roundRect(ctx, slotX, slotY, slotW, slotH, radius);
    ctx.clip();

    // Look up video element for this participant
    const videoEl = videoElements.get(participant.id);
    const hasActiveVideo =
      videoEl &&
      videoEl.readyState >= 2 &&
      videoEl.videoWidth > 0 &&
      participant.cameraActive;

    if (hasActiveVideo && videoEl) {
      // Calculate aspect cover coordinates
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      const videoRatio = vw / vh;
      const slotRatio = slotW / slotH;

      let renderW = slotW;
      let renderH = slotH;

      if (videoRatio > slotRatio) {
        renderW = slotH * videoRatio;
      } else {
        renderH = slotW / videoRatio;
      }

      // Center within slot
      const baseX = slotX + (slotW - renderW) / 2;
      const baseY = slotY + (slotH - renderH) / 2;

      // Apply participant custom positioning and scale
      const pos = participant.position || { x: 0, y: 0, scale: 1.0, mirror: true };
      const scale = Math.max(0.5, Math.min(2.5, pos.scale || 1.0));
      const offsetX = ((pos.x || 0) / 100) * slotW;
      const offsetY = ((pos.y || 0) / 100) * slotH;

      ctx.save();
      // Center of slot for scale and mirror transformations
      const centerX = slotX + slotW / 2 + offsetX;
      const centerY = slotY + slotH / 2 + offsetY;

      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);

      if (pos.mirror) {
        ctx.scale(-1, 1);
      }

      // Draw video frame centered at origin
      ctx.drawImage(videoEl, -renderW / 2, -renderH / 2, renderW, renderH);

      ctx.restore();
    } else {
      // Stylized placeholder when video stream is loading or inactive
      const placeGrad = ctx.createLinearGradient(slotX, slotY, slotX + slotW, slotY + slotH);
      placeGrad.addColorStop(0, '#1e1b4b');
      placeGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = placeGrad;
      ctx.fillRect(slotX, slotY, slotW, slotH);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 24px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        participant.name || `Participant ${index + 1}`,
        slotX + slotW / 2,
        slotY + slotH / 2 - 15
      );

      ctx.font = '400 15px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(
        participant.cameraActive ? 'Connecting camera...' : 'Camera Off',
        slotX + slotW / 2,
        slotY + slotH / 2 + 20
      );
    }

    ctx.restore(); // end of slot clip

    // Draw slot borders and subtle highlights
    ctx.save();
    ctx.lineWidth = 3;
    if (layoutConfig.frameStyle === 'neon-glow') {
      ctx.strokeStyle = index % 2 === 0 ? 'rgba(6, 182, 212, 0.7)' : 'rgba(217, 70, 239, 0.7)';
      ctx.shadowColor = index % 2 === 0 ? '#06b6d4' : '#d946ef';
      ctx.shadowBlur = 12;
    } else if (layoutConfig.frameStyle === 'polaroid') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    }
    roundRect(ctx, slotX, slotY, slotW, slotH, radius);
    ctx.stroke();
    ctx.restore();

    // In Live Mode: Participant Name Badge
    if (!isFinalCapture) {
      const isSelf = participant.id === selfParticipantId;
      ctx.save();
      const badgeText = `${participant.name}${isSelf ? ' (You)' : ''}`;
      ctx.font = '500 13px Plus Jakarta Sans, sans-serif';
      const textWidth = ctx.measureText(badgeText).width;
      const badgeW = textWidth + 24;
      const badgeH = 28;
      const badgeX = slotX + 16;
      const badgeY = slotY + slotH - badgeH - 16;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 14);
      ctx.fill();

      ctx.strokeStyle = isSelf ? 'rgba(99, 102, 241, 0.6)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 14);
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX + 12, badgeY + badgeH / 2);
      ctx.restore();
    }
  });

  // 3. Layer 2: Photobooth Frame & Branding
  if (layoutConfig.frameStyle === 'vintage-film') {
    // 35mm film perforations on top and bottom borders
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillRect(0, height - 36, width, 36);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    const holeW = 12;
    const holeH = 16;
    const holeGap = 24;
    for (let x = 16; x < width - 20; x += holeW + holeGap) {
      roundRect(ctx, x, 10, holeW, holeH, 3);
      ctx.fill();
      roundRect(ctx, x, height - 26, holeW, holeH, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  // Header/Footer Photobooth Stamp
  ctx.save();
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  if (layoutConfig.frameStyle === 'polaroid') {
    // Polaroid handwritten marker style
    ctx.font = '600 24px Caveat, cursive, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textAlign = 'center';
    ctx.fillText(`Virtual Photobooth  •  ${dateStr}  •  Room #${room.id}`, width / 2, height - 28);
  } else {
    // Modern sleek stamp
    ctx.font = '700 13px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'left';
    ctx.fillText('VIRTUAL PHOTOBOOTH', 24, height - 16);

    ctx.font = '500 12px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(`ROOM ${room.id}  •  ${dateStr}`, width - 24, height - 16);
  }
  ctx.restore();
}

/**
 * Creates an offscreen canvas at high resolution and exports to a Blob.
 */
export async function generateHighResCaptureBlob(
  room: Room,
  videoElements: Map<string, HTMLVideoElement>,
  selfParticipantId: string | null,
  scale: number = 2
): Promise<Blob | null> {
  const layout = PHOTO_LAYOUTS[room.layoutId] || PHOTO_LAYOUTS['duo-classic'];
  const targetWidth = layout.canvasWidth;
  const targetHeight = layout.canvasHeight;

  const offscreen = document.createElement('canvas');
  offscreen.width = targetWidth;
  offscreen.height = targetHeight;
  const ctx = offscreen.getContext('2d', { alpha: false });

  if (!ctx) return null;

  renderPhotoboothComposition(ctx, targetWidth, targetHeight, room, videoElements, selfParticipantId, {
    isFinalCapture: true,
    showGuidelines: false,
  });

  return new Promise((resolve) => {
    offscreen.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}
