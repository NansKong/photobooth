import { PhotoLayoutConfig, PhotoLayoutId, ParticipantSlot } from './types.js';

export const PHOTO_LAYOUTS: Record<PhotoLayoutId, PhotoLayoutConfig> = {
  'solo-portrait': {
    id: 'solo-portrait',
    name: 'Solo Spotlight',
    description: 'Full-frame solo portrait framing for individual shots',
    aspectRatio: 16 / 10,
    canvasWidth: 1920,
    canvasHeight: 1200,
    borderPadding: 48,
    slotGap: 0,
    frameStyle: 'polaroid',
  },
  'duo-classic': {
    id: 'duo-classic',
    name: 'Duo Classic',
    description: 'Traditional photobooth side-by-side dual portrait framing',
    aspectRatio: 16 / 10,
    canvasWidth: 1920,
    canvasHeight: 1200,
    borderPadding: 48,
    slotGap: 36,
    frameStyle: 'vintage-film',
  },
  'polaroid-twin': {
    id: 'polaroid-twin',
    name: 'Polaroid Twin',
    description: 'Instant film polaroid frames with authentic card margins',
    aspectRatio: 16 / 11,
    canvasWidth: 1920,
    canvasHeight: 1320,
    borderPadding: 60,
    slotGap: 48,
    frameStyle: 'polaroid',
  },
  'split-stack': {
    id: 'split-stack',
    name: 'Split Stack',
    description: 'Upper and lower cinematic horizontal widescreen frames',
    aspectRatio: 12 / 16,
    canvasWidth: 1200,
    canvasHeight: 1600,
    borderPadding: 44,
    slotGap: 32,
    frameStyle: 'minimal',
  },
  'multi-grid': {
    id: 'multi-grid',
    name: 'Multi Grid',
    description: 'Balanced multi-participant grid suitable for 2 to 6 people',
    aspectRatio: 16 / 10,
    canvasWidth: 1920,
    canvasHeight: 1200,
    borderPadding: 40,
    slotGap: 28,
    frameStyle: 'neon-glow',
  },
};

/**
 * Calculates normalized slot coordinates (0..1) inside the inner canvas content area.
 */
export function calculateParticipantSlots(layoutId: PhotoLayoutId, participantCount: number): ParticipantSlot[] {
  const count = Math.max(1, participantCount);

  // When only 1 person is clicking or solo layout is active, center them in full glory!
  if (count === 1 || layoutId === 'solo-portrait') {
    const slotWidth = 0.74;
    const slotHeight = 0.90;
    return [
      {
        slotIndex: 0,
        x: (1 - slotWidth) / 2,
        y: (1 - slotHeight) / 2,
        width: slotWidth,
        height: slotHeight,
        borderRadius: 16,
      },
    ];
  }

  if (layoutId === 'duo-classic' || layoutId === 'polaroid-twin') {
    if (count <= 2) {
      // 2 equal columns side by side
      const slotWidth = 0.48;
      const slotHeight = 0.88;
      const gap = 0.04;
      const totalWidth = 2 * slotWidth + gap;
      const startX = (1 - totalWidth) / 2;
      const startY = (1 - slotHeight) / 2;

      return [
        {
          slotIndex: 0,
          x: startX,
          y: startY,
          width: slotWidth,
          height: slotHeight,
          borderRadius: 16,
        },
        {
          slotIndex: 1,
          x: startX + slotWidth + gap,
          y: startY,
          width: slotWidth,
          height: slotHeight,
          borderRadius: 16,
        },
      ];
    }
  }

  if (layoutId === 'split-stack') {
    if (count <= 2) {
      // 2 rows stacked vertically
      const slotWidth = 0.90;
      const slotHeight = 0.44;
      const gap = 0.04;
      const totalHeight = 2 * slotHeight + gap;
      const startX = (1 - slotWidth) / 2;
      const startY = (1 - totalHeight) / 2;

      return [
        {
          slotIndex: 0,
          x: startX,
          y: startY,
          width: slotWidth,
          height: slotHeight,
          borderRadius: 16,
        },
        {
          slotIndex: 1,
          x: startX,
          y: startY + slotHeight + gap,
          width: slotWidth,
          height: slotHeight,
          borderRadius: 16,
        },
      ];
    }
  }

  // Fallback or multi-grid: dynamic grid based on count
  let cols = 1;
  let rows = 1;

  if (count === 2) {
    cols = 2;
    rows = 1;
  } else if (count <= 4) {
    cols = 2;
    rows = 2;
  } else if (count <= 6) {
    cols = 3;
    rows = 2;
  } else {
    cols = Math.ceil(Math.sqrt(count));
    rows = Math.ceil(count / cols);
  }

  const gapX = 0.03;
  const gapY = 0.03;
  const paddingX = 0.04;
  const paddingY = 0.06;

  const availableWidth = 1 - 2 * paddingX - (cols - 1) * gapX;
  const availableHeight = 1 - 2 * paddingY - (rows - 1) * gapY;
  const slotW = availableWidth / cols;
  const slotH = availableHeight / rows;

  const slots: ParticipantSlot[] = [];

  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    slots.push({
      slotIndex: i,
      x: paddingX + c * (slotW + gapX),
      y: paddingY + r * (slotH + gapY),
      width: slotW,
      height: slotH,
      borderRadius: 12,
    });
  }

  return slots;
}
