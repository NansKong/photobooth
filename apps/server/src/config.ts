import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  redisUrl: process.env.REDIS_URL || '',
  // Room cleanup settings
  emptyRoomTtlMs: 10 * 60 * 1000, // 10 minutes for empty rooms
  maxRoomTtlMs: 4 * 60 * 60 * 1000, // 4 hours maximum room lifetime
  cleanupIntervalMs: 60 * 1000, // run cleanup check every 60 seconds
  // Capture countdown default
  defaultCountdownMs: 3500,
  // Metered or custom TURN configuration
  meteredApiKey: process.env.METERED_API_KEY || '',
  meteredDomain: process.env.METERED_DOMAIN || 'photobooth_retro.metered.live',
  turnUrl: process.env.TURN_URL || 'turn:global.relay.metered.ca:80,turn:global.relay.metered.ca:443,turns:global.relay.metered.ca:443?transport=tcp',
  turnUsername: process.env.TURN_USERNAME || '',
  turnCredential: process.env.TURN_CREDENTIAL || '',
};
