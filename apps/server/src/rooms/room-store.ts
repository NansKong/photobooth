import { Room } from '@photobooth/shared';
import { Redis } from 'ioredis';

export interface IRoomStore {
  getRoom(roomId: string): Promise<Room | null>;
  saveRoom(room: Room): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  getAllRooms(): Promise<Room[]>;
}

export class MemoryRoomStore implements IRoomStore {
  private rooms: Map<string, Room> = new Map();

  async getRoom(roomId: string): Promise<Room | null> {
    const room = this.rooms.get(roomId);
    // BUG-8 fix: return a deep clone so callers can't mutate the shared store reference
    return room ? structuredClone(room) : null;
  }

  async saveRoom(room: Room): Promise<void> {
    this.rooms.set(room.id, { ...room });
  }

  async deleteRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
  }

  async getAllRooms(): Promise<Room[]> {
    return Array.from(this.rooms.values());
  }
}

export class RedisRoomStore implements IRoomStore {
  private redis: Redis;
  private prefix = 'photobooth:room:';

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 100, 2000);
      },
    });

    this.redis.on('error', (err: Error) => {
      console.error('[RedisRoomStore] Redis connection error:', err.message);
    });
  }

  async getRoom(roomId: string): Promise<Room | null> {
    try {
      const data = await this.redis.get(`${this.prefix}${roomId}`);
      if (!data) return null;
      return JSON.parse(data) as Room;
    } catch (err) {
      console.error('[RedisRoomStore] Error getting room:', err);
      return null;
    }
  }

  async saveRoom(room: Room): Promise<void> {
    try {
      const serialized = JSON.stringify(room);
      // Set key with 4 hours TTL
      await this.redis.set(`${this.prefix}${room.id}`, serialized, 'EX', 4 * 3600);
    } catch (err) {
      console.error('[RedisRoomStore] Error saving room:', err);
    }
  }

  async deleteRoom(roomId: string): Promise<void> {
    try {
      await this.redis.del(`${this.prefix}${roomId}`);
    } catch (err) {
      console.error('[RedisRoomStore] Error deleting room:', err);
    }
  }

  async getAllRooms(): Promise<Room[]> {
    try {
      const keys = await this.redis.keys(`${this.prefix}*`);
      if (keys.length === 0) return [];
      const data = await this.redis.mget(keys);
      return data
        .filter((d: string | null): d is string => d !== null)
        .map((d: string) => JSON.parse(d) as Room);
    } catch (err) {
      console.error('[RedisRoomStore] Error fetching all rooms:', err);
      return [];
    }
  }
}

export function createRoomStore(redisUrl?: string): IRoomStore {
  if (redisUrl && redisUrl.trim() !== '') {
    try {
      console.log('[RoomStore] Initializing Redis room store with:', redisUrl);
      return new RedisRoomStore(redisUrl);
    } catch (e) {
      console.warn('[RoomStore] Failed to initialize Redis, falling back to in-memory store:', e);
    }
  }
  console.log('[RoomStore] Using fast ephemeral In-Memory room store');
  return new MemoryRoomStore();
}
