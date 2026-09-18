import { EnvironmentPreset } from './types.js';

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    id: 'real-default',
    name: 'Real Environment',
    type: 'real',
    description: 'Keep your actual physical room backgrounds in a clean photobooth frame',
    themeColor: '#0f172a',
    accentColor: '#38bdf8',
    previewGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    backgroundStyle: {
      type: 'solid',
      primaryColor: '#0f172a',
      secondaryColor: '#1e293b',
    },
  },
  {
    id: 'virtual-studio',
    name: 'Classic Studio',
    type: 'virtual',
    description: 'Warm velvet studio with soft portrait keylighting and vignette',
    themeColor: '#1c1917',
    accentColor: '#fbbf24',
    previewGradient: 'radial-gradient(circle at 50% 40%, #44403c 0%, #1c1917 100%)',
    backgroundStyle: {
      type: 'gradient',
      primaryColor: '#44403c',
      secondaryColor: '#1c1917',
    },
  },
  {
    id: 'virtual-synthwave',
    name: 'Retro 80s Synthwave',
    type: 'virtual',
    description: 'Vibrant wireframe perspective grid, retro sun and neon magenta horizon',
    themeColor: '#180026',
    accentColor: '#f43f5e',
    previewGradient: 'linear-gradient(180deg, #180026 0%, #581c87 50%, #f43f5e 100%)',
    backgroundStyle: {
      type: 'mesh',
      primaryColor: '#180026',
      secondaryColor: '#581c87',
      tertiaryColor: '#f43f5e',
      patternType: 'grid',
    },
  },
  {
    id: 'virtual-neon',
    name: 'Neon Nightclub',
    type: 'virtual',
    description: 'Electric violet and cyan bokeh lights with dark velvet vibes',
    themeColor: '#09090b',
    accentColor: '#06b6d4',
    previewGradient: 'radial-gradient(circle at 20% 30%, #701a75 0%, #09090b 70%)',
    backgroundStyle: {
      type: 'mesh',
      primaryColor: '#09090b',
      secondaryColor: '#701a75',
      tertiaryColor: '#06b6d4',
      patternType: 'dots',
    },
  },
  {
    id: 'virtual-birthday',
    name: 'Party & Celebration',
    type: 'virtual',
    description: 'Floating golden confetti, celebration sparkles and party vibes',
    themeColor: '#2e1065',
    accentColor: '#f59e0b',
    previewGradient: 'linear-gradient(135deg, #3b0764 0%, #831843 60%, #f59e0b 100%)',
    backgroundStyle: {
      type: 'pattern',
      primaryColor: '#3b0764',
      secondaryColor: '#831843',
      tertiaryColor: '#f59e0b',
      patternType: 'confetti',
    },
  },
  {
    id: 'virtual-minimal',
    name: 'Minimalist Gallery',
    type: 'virtual',
    description: 'Clean architectural museum aesthetic with high contrast styling',
    themeColor: '#111827',
    accentColor: '#e2e8f0',
    previewGradient: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
    backgroundStyle: {
      type: 'solid',
      primaryColor: '#111827',
      secondaryColor: '#1f2937',
    },
  },
  {
    id: 'virtual-sunset',
    name: 'Golden Sunset',
    type: 'virtual',
    description: 'Tropical golden hour gradient with warm amber, coral and dusk violet',
    themeColor: '#31102f',
    accentColor: '#fb923c',
    previewGradient: 'linear-gradient(180deg, #31102f 0%, #831843 40%, #ea580c 80%, #fde047 100%)',
    backgroundStyle: {
      type: 'gradient',
      primaryColor: '#31102f',
      secondaryColor: '#ea580c',
      tertiaryColor: '#fde047',
    },
  },
];

export function getEnvironmentById(id: string): EnvironmentPreset {
  return (
    ENVIRONMENT_PRESETS.find((preset) => preset.id === id) ||
    ENVIRONMENT_PRESETS[0] // fallback to real-default
  );
}
