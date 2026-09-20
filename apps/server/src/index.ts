import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config.js';
import { createRoomStore } from './rooms/room-store.js';
import { RoomManager } from './rooms/room-manager.js';
import { CaptureScheduler } from './sync/capture-scheduler.js';
import { setupSocketHandlers } from './signaling/socket-handlers.js';

async function bootstrap() {
  const app = express();
  const server = http.createServer(app);

  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());

  // Room store & managers
  const roomStore = createRoomStore(config.redisUrl);
  const roomManager = new RoomManager(roomStore);
  const captureScheduler = new CaptureScheduler(roomManager);

  // Setup Socket.IO
  const io = new Server(server, {
    cors: {
      origin: config.corsOrigin === '*' ? true : config.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  setupSocketHandlers(io, roomManager, captureScheduler);

  // Health check & status endpoints
  app.get('/', (req, res) => {
    res.json({
      status: 'ok',
      service: 'virtual-photobooth-server',
      message: 'Virtual Photobooth Real-Time WebSocket & API Server is running.',
      timestamp: Date.now(),
    });
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'virtual-photobooth-server',
      timestamp: Date.now(),
    });
  });

  app.get('/api/rooms/:id', async (req, res) => {
    const room = await roomManager.getRoom(req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json({
      id: room.id,
      participantCount: room.participants.length,
      environmentId: room.environmentId,
      layoutId: room.layoutId,
      createdAt: room.createdAt,
    });
  });

  // Dynamic ICE / STUN / TURN server resolution endpoint
  let serverMeteredCache: { servers: any[]; expiry: number } | null = null;
  app.get('/api/ice-servers', async (req, res) => {
    try {
      if (config.meteredApiKey && config.meteredDomain) {
        if (serverMeteredCache && serverMeteredCache.expiry > Date.now()) {
          return res.json({ iceServers: serverMeteredCache.servers });
        }
        const domain = config.meteredDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const response = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(config.meteredApiKey)}`);
        if (response.ok) {
          const servers = await response.json();
          if (Array.isArray(servers) && servers.length > 0) {
            serverMeteredCache = { servers, expiry: Date.now() + 1800 * 1000 };
            return res.json({ iceServers: servers });
          }
        }
      }

      if (config.turnUrl) {
        return res.json({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            {
              urls: config.turnUrl.split(',').map((u) => u.trim()),
              username: config.turnUsername || undefined,
              credential: config.turnCredential || undefined,
            },
          ],
        });
      }

      return res.json({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      });
    } catch (err: any) {
      console.error('[ICE] Error resolving ice servers:', err);
      return res.json({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      });
    }
  });

  // Periodic room cleanup
  const cleanupInterval = setInterval(async () => {
    try {
      const cleaned = await roomManager.cleanupExpiredRooms();
      if (cleaned > 0) {
        console.log(`[Cleaner] Cleaned up ${cleaned} expired rooms`);
      }
    } catch (err) {
      console.error('[Cleaner] Cleanup error:', err);
    }
  }, config.cleanupIntervalMs);

  server.listen(config.port, () => {
    console.log(`🚀 Virtual Photobooth Server running on http://localhost:${config.port}`);
    console.log(`📡 WebSocket signaling active on port ${config.port}`);
  });

  const shutdown = () => {
    console.log('Shutting down gracefully...');
    clearInterval(cleanupInterval);
    io.close(() => {
      server.close(() => {
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
