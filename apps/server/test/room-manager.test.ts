import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRoomStore } from '../src/rooms/room-store.js';
import { RoomManager } from '../src/rooms/room-manager.js';
import { CaptureScheduler } from '../src/sync/capture-scheduler.js';

describe('RoomManager & CaptureScheduler', () => {
  let store: MemoryRoomStore;
  let roomManager: RoomManager;
  let scheduler: CaptureScheduler;

  beforeEach(() => {
    store = new MemoryRoomStore();
    roomManager = new RoomManager(store);
    scheduler = new CaptureScheduler(roomManager);
  });

  it('creates room with host participant and default settings', async () => {
    const { room, hostParticipant } = await roomManager.createRoom('Alice');
    expect(room.id).toHaveLength(6);
    expect(room.participants).toHaveLength(1);
    expect(hostParticipant.name).toBe('Alice');
    expect(hostParticipant.isHost).toBe(true);
    expect(room.environmentId).toBe('real-default');
    expect(room.layoutId).toBe('duo-classic');
  });

  it('allows a second participant to join and updates room', async () => {
    const { room } = await roomManager.createRoom('Alice');
    const joinResult = await roomManager.joinRoom(room.id, 'bob-uuid', 'Bob', 'socket-bob');

    expect(joinResult).not.toBeNull();
    expect(joinResult?.room.participants).toHaveLength(2);
    expect(joinResult?.participant.name).toBe('Bob');
    expect(joinResult?.participant.isHost).toBe(false);
  });

  it('reassigns host when original host leaves', async () => {
    const { room, hostParticipant } = await roomManager.createRoom('Alice');
    const bobJoin = await roomManager.joinRoom(room.id, 'bob-uuid', 'Bob', 'socket-bob');

    const leaveResult = await roomManager.leaveRoom(room.id, hostParticipant.id);
    expect(leaveResult.leftParticipant?.name).toBe('Alice');
    expect(leaveResult.room?.participants).toHaveLength(1);
    expect(leaveResult.newHostId).toBe('bob-uuid');
    expect(leaveResult.room?.participants[0].isHost).toBe(true);
  });

  it('updates participant position and ready status', async () => {
    const { room, hostParticipant } = await roomManager.createRoom('Alice');
    const updated = await roomManager.updateParticipant(room.id, hostParticipant.id, {
      isReady: true,
      position: { x: 15, y: -10, scale: 1.2, mirror: false },
    });

    expect(updated?.updatedParticipant.isReady).toBe(true);
    expect(updated?.updatedParticipant.position.x).toBe(15);
    expect(updated?.updatedParticipant.position.scale).toBe(1.2);
  });

  it('schedules synchronized capture with future timestamp', async () => {
    const { room, hostParticipant } = await roomManager.createRoom('Alice');
    const result = await scheduler.scheduleCapture(room.id, hostParticipant.id, 3000);

    expect(result).not.toBeNull();
    expect(result?.session.durationMs).toBe(3000);
    expect(result?.session.captureTimestamp).toBeGreaterThan(Date.now());
    expect(result?.session.status).toBe('scheduled');

    // Cancel test
    const cancelledRoom = await scheduler.cancelCapture(room.id);
    expect(cancelledRoom?.captureSession).toBeNull();
  });
});
