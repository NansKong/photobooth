export interface StickerItem {
  id: string;
  url: string;
  category: 'cats' | 'glam' | 'charms' | 'pretty' | 'flowers';
  label: string;
}

import manifest from '../public/stickers/manifest.json';

// Category metadata with emojis
export const STICKER_CATEGORIES = [
  { id: 'cats', label: '🐱 Cats & Kittens' },
  { id: 'glam', label: '🪩 Y2K & Glam' },
  { id: 'pretty', label: '🎀 Bows & Stars' },
  { id: 'flowers', label: '🌸 Fresh Blooms' },
  { id: 'charms', label: '✨ Vintage Buttons' },
] as const;

export const AVAILABLE_STICKERS: StickerItem[] = (manifest as any[]).map((m) => {
  let cat: StickerItem['category'] = 'pretty';
  if (m.category === 'cats') cat = 'cats';
  else if (m.category === 'glam') cat = 'glam';
  else if (m.category === 'charms') cat = 'charms';
  else if (m.category === 'flowers') cat = 'flowers';
  else cat = 'pretty';

  // Format a friendly label
  const label = m.label || m.id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  return {
    id: m.id,
    url: m.url,
    category: cat,
    label,
  };
});
