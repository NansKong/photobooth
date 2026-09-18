export interface ParticipantPosition {
  x: number; // percentage offset -100 to 100
  y: number; // percentage offset -100 to 100
  scale: number; // 0.5 to 2.0 (default: 1.0)
  mirror: boolean; // default: true for natural selfie view
}

export interface Participant {
  id: string;
  socketId: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  cameraActive: boolean;
  micActive: boolean;
  position: ParticipantPosition;
  joinedAt: number;
}

export type EnvironmentType = 'real' | 'virtual';

export interface EnvironmentPreset {
  id: string;
  name: string;
  type: EnvironmentType;
  description: string;
  themeColor: string;
  accentColor: string;
  previewGradient: string;
  backgroundStyle: {
    type: 'solid' | 'gradient' | 'pattern' | 'mesh';
    primaryColor: string;
    secondaryColor?: string;
    tertiaryColor?: string;
    patternType?: 'grid' | 'dots' | 'stars' | 'confetti' | 'vintage-film';
  };
}

export interface ParticipantSlot {
  slotIndex: number;
  participantId?: string;
  // Normalized 0..1 bounding box within canvas
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

export type PhotoLayoutId = 'solo-portrait' | 'duo-classic' | 'polaroid-twin' | 'split-stack' | 'multi-grid';

export interface PhotoLayoutConfig {
  id: PhotoLayoutId;
  name: string;
  description: string;
  aspectRatio: number; // width / height
  canvasWidth: number;
  canvasHeight: number;
  borderPadding: number;
  slotGap: number;
  frameStyle: 'minimal' | 'vintage-film' | 'polaroid' | 'neon-glow';
}

export type CaptureSessionStatus = 'idle' | 'scheduled' | 'counting' | 'capturing' | 'captured' | 'cancelled';

export interface CaptureShot {
  shotIndex: number; // 0, 1, 2, 3
  targetTimestamp: number; // absolute server timestamp (ms)
}

export interface CaptureSession {
  id: string;
  scheduledBy: string;
  captureTimestamp: number; // absolute server timestamp for first shot (ms)
  durationMs: number; // countdown duration per shot, e.g. 3000ms
  totalShots: number; // e.g. 4 shots
  currentShotIndex: number; // 0..totalShots-1
  shotIntervalMs: number; // pause between shots, e.g. 2500ms
  shots: CaptureShot[];
  status: CaptureSessionStatus;
  readyParticipants: string[];
}

export type PhotostripThemeId =
  | 'vintage-ticket'
  | 'cute-scrapbook'
  | 'y2k-zine'
  | 'snapobox-baroque'
  | 'boothy-call'
  | 'retro-patterns'
  | 'classic-film'
  | 'custom-upload';

export type PhotostripLayoutId =
  | 'strip-1x4'
  | 'strip-1x3'
  | 'strip-twin'
  | 'grid-2x2'
  | 'scrapbook-freeform';

export type PhotoFilterId =
  | 'none'
  | 'noir'
  | 'sepia'
  | 'film90s';

export interface PhotostripSticker {
  id: string;
  type: 'bow' | 'cat' | 'sparkle' | 'charm' | 'pretty';
  svgOrEmoji: string;
  label: string;
  x: number; // percentage (0..100)
  y: number; // percentage (0..100)
  scale: number; // default 1.0
  rotation: number; // degrees -180..180
}

export interface MovablePhotoCard {
  id: string;
  frameIndex: number;
  x: number; // percentage (0..100)
  y: number; // percentage (0..100)
  width: number; // percentage (0..100)
  height: number; // percentage (0..100)
  rotation: number; // degrees -45..45
  scale: number;
}

export interface Room {
  id: string;
  createdAt: number;
  lastActivity: number;
  hostId: string;
  participants: Participant[];
  environmentId: string;
  environmentType: EnvironmentType;
  layoutId: PhotoLayoutId;
  captureSession: CaptureSession | null;
}

export interface WebRTCSignalData {
  senderId: string;
  targetId: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: any;
}

export interface ClockSyncPing {
  clientSendTime: number;
}

export interface ClockSyncPong {
  clientSendTime: number;
  serverReceiveTime: number;
  serverSendTime: number;
}

export interface ClockSyncResult {
  offset: number; // Add this to Date.now() to get estimated server time
  roundTripTime: number;
}
