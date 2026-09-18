import { CaptureSession, Room } from '@photobooth/shared';
import { RoomManager } from '../rooms/room-manager.js';
import crypto from 'crypto';

export class CaptureScheduler {
  private roomManager: RoomManager;
  private captureTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager;
  }

  async scheduleCapture(
    roomId: string,
    scheduledByParticipantId: string,
    durationMs: number = 3000,
    totalShots: number = 4,
    shotIntervalMs: number = 2500
  ): Promise<{ session: CaptureSession; room: Room } | null> {
    const room = await this.roomManager.getRoom(roomId);
    if (!room || room.participants.length === 0) {
      return null;
    }

    // Clear any existing timer for this room
    this.clearCaptureTimer(roomId);

    const now = Date.now();
    const shots = [];
    let curTime = now + durationMs;
    for (let i = 0; i < totalShots; i++) {
      shots.push({
        shotIndex: i,
        targetTimestamp: curTime,
      });
      curTime += shotIntervalMs + durationMs;
    }

    const session: CaptureSession = {
      id: crypto.randomUUID(),
      scheduledBy: scheduledByParticipantId,
      captureTimestamp: shots[0]?.targetTimestamp || (now + durationMs),
      durationMs,
      totalShots,
      currentShotIndex: 0,
      shotIntervalMs,
      shots,
      status: 'scheduled',
      readyParticipants: room.participants.map((p) => p.id),
    };

    const updatedRoom = await this.roomManager.setCaptureSession(roomId, session);
    if (!updatedRoom) return null;

    // Total session duration includes all shots + pauses
    const totalSessionDuration = (durationMs + shotIntervalMs) * totalShots + 3000;

    // Set a server-side timer to auto-transition state to 'captured' after all shots complete
    const timer = setTimeout(async () => {
      const currentRoom = await this.roomManager.getRoom(roomId);
      if (currentRoom?.captureSession?.id === session.id) {
        const updatedSession = { ...currentRoom.captureSession, status: 'captured' as const };
        await this.roomManager.setCaptureSession(roomId, updatedSession);
      }
      this.captureTimeouts.delete(roomId);
    }, totalSessionDuration);

    this.captureTimeouts.set(roomId, timer);

    return { session, room: updatedRoom };
  }

  async cancelCapture(roomId: string): Promise<Room | null> {
    this.clearCaptureTimer(roomId);
    const room = await this.roomManager.getRoom(roomId);
    if (!room || !room.captureSession) return null;

    return this.roomManager.setCaptureSession(roomId, null);
  }

  clearCaptureTimer(roomId: string) {
    const existing = this.captureTimeouts.get(roomId);
    if (existing) {
      clearTimeout(existing);
      this.captureTimeouts.delete(roomId);
    }
  }
}
