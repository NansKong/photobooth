import {
  EnvironmentType,
  generateRoomId,
  Participant,
  PhotoLayoutId,
  Room,
  CaptureSession,
} from '@photobooth/shared';
import { IRoomStore } from './room-store.js';
import { config } from '../config.js';
import crypto from 'crypto';

export class RoomManager {
  private store: IRoomStore;
  private socketToRoomMap: Map<string, { roomId: string; participantId: string }> = new Map();

  constructor(store: IRoomStore) {
    this.store = store;
  }

  mapSocket(socketId: string, roomId: string, participantId: string) {
    this.socketToRoomMap.set(socketId, { roomId, participantId });
  }

  unmapSocket(socketId: string) {
    const entry = this.socketToRoomMap.get(socketId);
    this.socketToRoomMap.delete(socketId);
    return entry;
  }

  getSocketMapping(socketId: string) {
    return this.socketToRoomMap.get(socketId);
  }

  async createRoom(hostName: string = 'Host'): Promise<{ room: Room; hostParticipant: Participant }> {
    let roomId = generateRoomId(6);
    let attempts = 0;
    while ((await this.store.getRoom(roomId)) && attempts < 5) {
      roomId = generateRoomId(6);
      attempts++;
    }

    const hostId = crypto.randomUUID();
    const hostParticipant: Participant = {
      id: hostId,
      socketId: '',
      name: hostName.trim() || 'Host',
      isHost: true,
      isReady: false,
      cameraActive: true,
      micActive: true,
      position: { x: 0, y: 0, scale: 1.0, mirror: true },
      joinedAt: Date.now(),
    };

    const room: Room = {
      id: roomId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      hostId: hostId,
      participants: [hostParticipant],
      environmentId: 'real-default',
      environmentType: 'real',
      layoutId: 'duo-classic',
      captureSession: null,
    };

    await this.store.saveRoom(room);
    return { room, hostParticipant };
  }

  async getRoom(roomId: string): Promise<Room | null> {
    return this.store.getRoom(roomId.toUpperCase().trim());
  }

  async joinRoom(
    roomId: string,
    participantId: string,
    name: string,
    socketId: string
  ): Promise<{ room: Room; participant: Participant } | null> {
    const normalizedId = roomId.toUpperCase().trim();
    let room = await this.store.getRoom(normalizedId);
    if (!room) {
      // Auto-create room if it doesn't exist on server yet (e.g. joined via direct link or server restarted)
      const initialHostId = crypto.randomUUID();
      room = {
        id: normalizedId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        hostId: initialHostId,
        participants: [],
        environmentId: 'virtual-studio',
        environmentType: 'virtual',
        layoutId: 'duo-classic',
        captureSession: null,
      };
      await this.store.saveRoom(room);
    }

    room.lastActivity = Date.now();

    // Check if participant already exists in room (reconnection)
    const existingIndex = room.participants.findIndex(
      (p) => p.id === participantId || p.socketId === socketId
    );

    let participant: Participant;

    if (existingIndex >= 0) {
      participant = {
        ...room.participants[existingIndex],
        socketId,
        name: name.trim() || room.participants[existingIndex].name,
      };
      room.participants[existingIndex] = participant;
    } else {
      const isFirst = room.participants.length === 0;
      participant = {
        id: participantId || crypto.randomUUID(),
        socketId,
        name: name.trim() || `Participant ${room.participants.length + 1}`,
        isHost: isFirst,
        isReady: false,
        cameraActive: true,
        micActive: true,
        position: { x: 0, y: 0, scale: 1.0, mirror: true },
        joinedAt: Date.now(),
      };
      if (isFirst) {
        room.hostId = participant.id;
      }
      room.participants.push(participant);
    }

    this.mapSocket(socketId, normalizedId, participant.id);
    await this.store.saveRoom(room);
    return { room, participant };
  }

  async leaveRoom(
    roomId: string,
    participantIdOrSocketId: string
  ): Promise<{ room: Room | null; leftParticipant: Participant | null; newHostId?: string }> {
    const normalizedId = roomId.toUpperCase().trim();
    const room = await this.store.getRoom(normalizedId);
    if (!room) return { room: null, leftParticipant: null };

    const index = room.participants.findIndex(
      (p) => p.id === participantIdOrSocketId || p.socketId === participantIdOrSocketId
    );

    if (index === -1) {
      return { room, leftParticipant: null };
    }

    const [leftParticipant] = room.participants.splice(index, 1);
    room.lastActivity = Date.now();

    let newHostId: string | undefined;

    // If host left, assign new host if participants remain
    if (room.hostId === leftParticipant.id) {
      if (room.participants.length > 0) {
        room.participants[0].isHost = true;
        room.hostId = room.participants[0].id;
        newHostId = room.hostId;
      }
    }

    // Cancel ongoing capture session if any
    if (room.captureSession) {
      room.captureSession = null;
    }

    // BUG-13 fix: delete the room immediately when it becomes empty
    // instead of saving an empty shell that persists until the next GC cycle
    if (room.participants.length === 0) {
      await this.store.deleteRoom(normalizedId);
      return { room, leftParticipant, newHostId };
    }

    await this.store.saveRoom(room);
    return { room, leftParticipant, newHostId };
  }

  async updateParticipant(
    roomId: string,
    participantId: string,
    updates: Partial<Participant>
  ): Promise<{ room: Room; updatedParticipant: Participant } | null> {
    const normalizedId = roomId.toUpperCase().trim();
    const room = await this.store.getRoom(normalizedId);
    if (!room) return null;

    const participant = room.participants.find((p) => p.id === participantId);
    if (!participant) return null;

    if (updates.name !== undefined) participant.name = updates.name.trim();
    if (updates.isReady !== undefined) participant.isReady = updates.isReady;
    if (updates.cameraActive !== undefined) participant.cameraActive = updates.cameraActive;
    if (updates.micActive !== undefined) participant.micActive = updates.micActive;
    if (updates.position !== undefined) {
      participant.position = {
        ...participant.position,
        ...updates.position,
      };
    }

    room.lastActivity = Date.now();
    await this.store.saveRoom(room);
    return { room, updatedParticipant: participant };
  }

  async setEnvironment(
    roomId: string,
    environmentId: string,
    environmentType: EnvironmentType
  ): Promise<Room | null> {
    const normalizedId = roomId.toUpperCase().trim();
    const room = await this.store.getRoom(normalizedId);
    if (!room) return null;

    room.environmentId = environmentId;
    room.environmentType = environmentType;
    room.lastActivity = Date.now();

    await this.store.saveRoom(room);
    return room;
  }

  async setLayout(roomId: string, layoutId: PhotoLayoutId): Promise<Room | null> {
    const normalizedId = roomId.toUpperCase().trim();
    const room = await this.store.getRoom(normalizedId);
    if (!room) return null;

    room.layoutId = layoutId;
    room.lastActivity = Date.now();

    await this.store.saveRoom(room);
    return room;
  }

  async setCaptureSession(roomId: string, session: CaptureSession | null): Promise<Room | null> {
    const normalizedId = roomId.toUpperCase().trim();
    const room = await this.store.getRoom(normalizedId);
    if (!room) return null;

    room.captureSession = session;
    room.lastActivity = Date.now();

    await this.store.saveRoom(room);
    return room;
  }

  async cleanupExpiredRooms(): Promise<number> {
    const allRooms = await this.store.getAllRooms();
    const now = Date.now();
    let cleanedCount = 0;

    for (const room of allRooms) {
      const isEmpty = room.participants.length === 0;
      const emptyExpired = isEmpty && now - room.lastActivity > config.emptyRoomTtlMs;
      const lifetimeExpired = now - room.createdAt > config.maxRoomTtlMs;

      if (emptyExpired || lifetimeExpired) {
        await this.store.deleteRoom(room.id);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}
