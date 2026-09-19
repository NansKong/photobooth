'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Dynamically resolves the signaling server URL:
 * 1. User manual override saved in localStorage: 'photobooth_custom_socket_url'
 * 2. Environment variable: NEXT_PUBLIC_SOCKET_URL (if provided and points to external URL, e.g. Railway / Render)
 * 3. Localhost dev: http://localhost:3001
 * 4. Private LAN IP (e.g. 192.168.x.x, 10.x.x.x): http://${hostname}:3001
 * 5. Production on Vercel (*.vercel.app or public HTTPS domain):
 *    If no external signaling server is configured, returns null to run in standalone/solo photobooth mode
 *    without throwing Mixed Content errors or querying invalid ports.
 */
export function resolveSocketUrl(): string | null {
  if (typeof window === 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
    return envUrl && !envUrl.includes('localhost') ? envUrl : 'http://localhost:3001';
  }

  // 1. Check custom user override in localStorage
  try {
    const custom = localStorage.getItem('photobooth_custom_socket_url');
    if (custom && custom.trim()) {
      return custom.trim();
    }
  } catch {}

  const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  const { protocol, hostname } = window.location;

  // 2. If an external URL is set via environment variable (e.g. on Railway, Render, Fly)
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // 3. Local development on localhost or 127.0.0.1
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isLocalhost) {
    return envUrl || 'http://localhost:3001';
  }

  // 4. Private LAN IP testing (e.g. 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  const isPrivateLan =
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname);

  if (isPrivateLan) {
    let port = '3001';
    if (envUrl) {
      try {
        const u = new URL(envUrl);
        if (u.port) port = u.port;
      } catch {}
    }
    const wsProtocol = protocol === 'https:' ? 'https:' : 'http:';
    return `${wsProtocol}//${hostname}:${port}`;
  }

  // 5. On Vercel (*.vercel.app) or custom production HTTPS domain:
  // If envUrl is provided and valid (must NOT be localhost when on public HTTPS domain)
  if (envUrl && envUrl.trim().length > 0 && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.trim();
  }

  // No external signaling server configured on Vercel; return null to operate in Standalone Mode
  return null;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  const connectToUrl = useCallback((targetUrl: string | null) => {
    // Cleanup previous socket if one exists
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }

    setResolvedUrl(targetUrl);

    if (!targetUrl) {
      // Vercel Standalone Mode: No external signaling server configured
      console.log('[useSocket] Vercel Standalone Mode: Running local photobooth session.');
      setIsStandalone(true);
      setIsConnected(true);
      setConnectionError(null);
      return;
    }

    setIsStandalone(false);
    setIsConnected(false);
    setConnectionError(null);
    console.log('[useSocket] Connecting to signaling server:', targetUrl);

    try {
      const s = io(targetUrl, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 8,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 4000,
        timeout: 8000,
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
        console.warn('[useSocket] Connection error:', err.message);
        setConnectionError(err.message);
        setIsConnected(false);
      });

      socketRef.current = s;
      setSocket(s);
    } catch (err: any) {
      console.error('[useSocket] Initialization error:', err);
      setConnectionError(err.message || 'Failed to initialize socket');
    }
  }, []);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[useSocket] Manually triggering reconnect...');
      socketRef.current.connect();
    } else {
      const target = resolveSocketUrl();
      connectToUrl(target);
    }
  }, [connectToUrl]);

  const setCustomSocketUrl = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (trimmed) {
        try {
          localStorage.setItem('photobooth_custom_socket_url', trimmed);
        } catch {}
        connectToUrl(trimmed);
      }
    },
    [connectToUrl]
  );

  const clearCustomSocketUrl = useCallback(() => {
    try {
      localStorage.removeItem('photobooth_custom_socket_url');
    } catch {}
    const defaultUrl = resolveSocketUrl();
    connectToUrl(defaultUrl);
  }, [connectToUrl]);

  useEffect(() => {
    const initialUrl = resolveSocketUrl();
    connectToUrl(initialUrl);

    return () => {
      // Do not disconnect on fast re-renders; socket persists across app lifecycle
    };
  }, [connectToUrl]);

  return {
    socket,
    isConnected,
    isStandalone,
    connectionError,
    reconnect,
    resolvedUrl,
    setCustomSocketUrl,
    clearCustomSocketUrl,
  };
}
