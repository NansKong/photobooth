import {
  CaptureSession,
  ClockSyncPong,
  EnvironmentType,
  Participant,
  PhotoLayoutId,
  Room,
  WebRTCSignalData,
} from './types.js';

export const SocketEvents = {
  // Client -> Server
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  PARTICIPANT_UPDATE: 'participant:update',
  ENVIRONMENT_CHANGE: 'environment:change',
  LAYOUT_CHANGE: 'layout:change',
  CAPTURE_START: 'capture:start',
  CAPTURE_CANCEL: 'capture:cancel',
  CAPTURE_COMPLETE: 'capture:complete',
  SYNC_TIME_REQ: 'sync:time:req',
  WEBRTC_SIGNAL: 'webrtc:signal',
  CHAT_SEND: 'chat:send',

  // Server -> Client
  ROOM_STATE: 'room:state',
  PARTICIPANT_JOINED: 'participant:joined',
  PARTICIPANT_LEFT: 'participant:left',
  PARTICIPANT_UPDATED: 'participant:updated',
  ENVIRONMENT_CHANGED: 'environment:changed',
  LAYOUT_CHANGED: 'layout:changed',
  CAPTURE_SCHEDULED: 'capture:scheduled',
  CAPTURE_CANCELLED: 'capture:cancelled',
  CAPTURE_FINISHED: 'capture:finished',
  SYNC_TIME_RES: 'sync:time:res',
  ROOM_ERROR: 'room:error',
  CHAT_MESSAGE: 'chat:message',
  CHAT_HISTORY: 'chat:history',
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

// Payload Definitions for strict type safety
export interface ChatSendPayload {
  roomId: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  participantId: string;
  name: string;
  text: string;
  sentAt: number;
}

export interface RoomCreatePayload {
  name: string;
}

export interface RoomJoinPayload {
  roomId: string;
  participantId: string;
  name: string;
}

export interface RoomLeavePayload {
  roomId: string;
}

export interface ParticipantUpdatePayload {
  roomId: string;
  updates: Partial<Pick<Participant, 'isReady' | 'cameraActive' | 'micActive' | 'position' | 'name'>>;
}

export interface EnvironmentChangePayload {
  roomId: string;
  environmentId: string;
  environmentType: EnvironmentType;
}

export interface LayoutChangePayload {
  roomId: string;
  layoutId: PhotoLayoutId;
}

export interface CaptureStartPayload {
  roomId: string;
  durationMs?: number;
  totalShots?: number;
  shotIntervalMs?: number;
}

export interface CaptureCancelPayload {
  roomId: string;
}

export interface RoomStatePayload {
  room: Room;
  selfParticipantId: string;
}

export interface ParticipantJoinedPayload {
  participant: Participant;
}

export interface ParticipantLeftPayload {
  participantId: string;
  newHostId?: string;
}

export interface ParticipantUpdatedPayload {
  participantId: string;
  updates: Partial<Participant>;
}

export interface EnvironmentChangedPayload {
  environmentId: string;
  environmentType: EnvironmentType;
}

export interface LayoutChangedPayload {
  layoutId: PhotoLayoutId;
}

export interface RoomErrorPayload {
  code: string;
  message: string;
}
