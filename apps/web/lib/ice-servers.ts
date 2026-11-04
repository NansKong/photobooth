export interface CustomTurnConfig {
  mode: 'default' | 'metered' | 'custom';
  meteredDomain?: string; // e.g. "myapp.metered.live"
  meteredApiKey?: string;
  turnUrls?: string; // e.g. "turn:relay.example.com:443?transport=tcp"
  turnUsername?: string;
  turnCredential?: string;
}

export const DEFAULT_METERED_DOMAIN = 'photobooth_retro.metered.live';
export const DEFAULT_METERED_API_KEY = '';

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.relay.metered.ca:80' },
];

const STORAGE_KEY = 'photobooth_custom_turn_config';

// In-memory cache for dynamic Metered credentials
let cachedMeteredServers: { servers: RTCIceServer[]; expiry: number } | null = null;

export function getSavedTurnConfig(): CustomTurnConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveTurnConfig(config: CustomTurnConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    cachedMeteredServers = null; // bust cache
  } catch {}
}

export function clearTurnConfig(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    cachedMeteredServers = null;
  } catch {}
}

/**
 * Fetches dynamic credentials from a Metered Video application.
 */
async function fetchMeteredCredentials(
  domain: string,
  apiKey: string
): Promise<RTCIceServer[] | null> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${cleanDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[ICE] Metered API returned status ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return null;
  } catch (err) {
    console.warn('[ICE] Failed to fetch Metered credentials:', err);
    return null;
  }
}

/**
 * Resolves the optimal list of ICE servers (STUN + TURN Relay) based on:
 * 1. User manual in-app override in localStorage
 * 2. Next.js environment variables
 * 3. Server signaling endpoint (/api/ice-servers)
 * 4. Fallback public STUN servers
 */
export async function resolveIceServers(socketBaseUrl?: string | null): Promise<RTCIceServer[]> {
  // 1. Check user manual configuration in localStorage
  const saved = getSavedTurnConfig();
  if (saved) {
    if (saved.mode === 'metered' && saved.meteredDomain && saved.meteredApiKey) {
      if (cachedMeteredServers && cachedMeteredServers.expiry > Date.now()) {
        return cachedMeteredServers.servers;
      }
      const fetched = await fetchMeteredCredentials(saved.meteredDomain, saved.meteredApiKey);
      if (fetched) {
        cachedMeteredServers = {
          servers: fetched,
          expiry: Date.now() + 1800 * 1000, // cache for 30 minutes
        };
        return fetched;
      }
    } else if (saved.mode === 'custom' && saved.turnUrls) {
      const urls = saved.turnUrls
        .split('\n')
        .map((u) => u.trim())
        .filter((u) => u.length > 0);

      const customServer: RTCIceServer = {
        urls,
        username: saved.turnUsername?.trim() || undefined,
        credential: saved.turnCredential?.trim() || undefined,
      };

      return [...DEFAULT_ICE_SERVERS, customServer];
    }
  }

  // 2. Fetch latest ephemeral TURN credentials from Metered REST API
  const targetDomain = process.env.NEXT_PUBLIC_METERED_DOMAIN || DEFAULT_METERED_DOMAIN;
  const targetApiKey = DEFAULT_METERED_API_KEY; // Never ship a TURN API key in the browser bundle.

  if (targetDomain && targetApiKey) {
    if (cachedMeteredServers && cachedMeteredServers.expiry > Date.now()) {
      return cachedMeteredServers.servers;
    }
    const fetched = await fetchMeteredCredentials(targetDomain, targetApiKey);
    if (fetched && fetched.length > 0) {
      cachedMeteredServers = {
        servers: fetched,
        expiry: Date.now() + 1800 * 1000,
      };
      return fetched;
    }
  }

  // 3. Fetch relay credentials from the signaling server.
  // 4. Try fetching from backend signaling server endpoint if available
  if (socketBaseUrl && !socketBaseUrl.includes('localhost')) {
    try {
      const cleanBase = socketBaseUrl.replace(/\/$/, '');
      const res = await fetch(`${cleanBase}/api/ice-servers`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.iceServers) && json.iceServers.length > 0) {
          // An uncredentialed TURN URL cannot relay media. Keep working STUN
          // entries and ignore the server's placeholder TURN configuration.
          const usable = json.iceServers.filter((server: RTCIceServer) => {
            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
            const usesTurn = urls.some((url) => typeof url === 'string' && /^turns?:/i.test(url));
            return !usesTurn || Boolean(server.username && server.credential);
          });
          if (usable.length > 0) return usable;
        }
      }
    } catch {}
  }

  // 5. Default fallback: Google + Cloudflare STUN
  return DEFAULT_ICE_SERVERS;
}

export interface IceDiagnosticResult {
  hasStun: boolean;
  hasRelay: boolean;
  candidateTypes: string[];
  relayProtocols: string[];
  errors: string[];
  durationMs: number;
}

/**
 * Tests candidate gathering with the provided ICE servers to verify
 * whether STUN and TURN Relay are functioning correctly.
 */
export async function testIceConnectivity(iceServers: RTCIceServer[]): Promise<IceDiagnosticResult> {
  const startTime = Date.now();
  const candidateTypes = new Set<string>();
  const relayProtocols = new Set<string>();
  const errors: string[] = [];

  return new Promise((resolve) => {
    let finished = false;

    let pc: RTCPeerConnection | null = null;
    try {
      pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 4,
      });
    } catch (e: any) {
      return resolve({
        hasStun: false,
        hasRelay: false,
        candidateTypes: [],
        relayProtocols: [],
        errors: [e?.message || 'Failed to initialize RTCPeerConnection'],
        durationMs: Date.now() - startTime,
      });
    }

    const finalize = () => {
      if (finished) return;
      finished = true;
      try {
        pc?.close();
      } catch {}

      resolve({
        hasStun: candidateTypes.has('srflx') || candidateTypes.has('host'),
        hasRelay: candidateTypes.has('relay'),
        candidateTypes: Array.from(candidateTypes),
        relayProtocols: Array.from(relayProtocols),
        errors,
        durationMs: Date.now() - startTime,
      });
    };

    // Timeout safety: gather for at most 4 seconds
    const timeout = setTimeout(finalize, 4000);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const type = event.candidate.type;
        if (type) candidateTypes.add(type);

        if (type === 'relay') {
          const proto = event.candidate.protocol;
          if (proto) relayProtocols.add(proto.toLowerCase());
        }
      } else {
        // Gathering completed
        clearTimeout(timeout);
        setTimeout(finalize, 200);
      }
    };

    pc.onicecandidateerror = (event: any) => {
      const errText = `Code ${event.errorCode}: ${event.errorText || 'ICE Error'} (${event.url || ''})`;
      if (!errors.includes(errText)) {
        errors.push(errText);
      }
    };

    // Create a dummy data channel to trigger ICE gathering
    try {
      pc.createDataChannel('ice_diag_channel');
      pc.createOffer().then((offer) => pc?.setLocalDescription(offer)).catch((err) => {
        errors.push(`Offer error: ${err.message}`);
        finalize();
      });
    } catch (err: any) {
      errors.push(`Offer error: ${err.message}`);
      finalize();
    }
  });
}
