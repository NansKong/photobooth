'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  // Expose socket as state so consumers re-render once the socket is created
  // (socketRef.current is always null on the very first render — BUG-1 fix)
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!socketRef.current) {
      console.log('[useSocket] Connecting to signaling server:', SOCKET_URL);
      const s = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      s.on('connect', () => {
        console.log('[useSocket] Connected with socket ID:', s.id);
        setIsConnected(true);
        setConnectionError(null);
      });

      s.on('disconnect', (reason) => {
        console.warn('[useSocket] Disconnected:', reason);
        setIsConnected(false);
      });

      s.on('connect_error', (err) => {
        console.error('[useSocket] Connection error:', err.message);
        setConnectionError(err.message);
      });

      socketRef.current = s;
      // Trigger a render so callers receive the socket instance immediately
      setSocket(s);
    }

    return () => {
      // Do not disconnect on fast re-renders; the socket persists for the session
    };
  }, []);

  return {
    socket,
    isConnected,
    connectionError,
  };
}
