# Real-Time Multiplayer Virtual Photobooth 📸

A production-grade, privacy-first web application that allows two or more people physically located anywhere in the world to open a shared digital photobooth room, see each other live through their cameras, pose together with individual repositioning and zoom, select shared physical or virtual environments, countdown in synchronized lockstep, and capture a joint high-resolution photobooth photograph.

---

## 🌟 Key Features

- **No Accounts Required**: Instantly create temporary rooms with secure, unpredictable 6-character alphanumeric room codes (e.g., `ABX72K`) or shareable invite links.
- **Peer-to-Peer WebRTC Video**: Direct P2P video streaming between participants for ultra-low latency with zero server-side video relay overhead.
- **Shared Live Photobooth Canvas**: Real-time 60FPS HTML5 Canvas composition showing both participants posing together in a unified composition.
- **Interactive Pose & Positioning**:
  - Direct pointer drag-to-pose right on the canvas.
  - Fine-grained nudge controls (Up, Down, Left, Right).
  - Zoom scaling from 0.5x to 2.5x.
  - Selfie mirror mode toggle.
- **Environment / Background Engine**:
  - **Mode A — Real Environment**: Preserves physical room backgrounds inside clean photobooth framing.
  - **Mode B — Shared Virtual Environment**: Real-time synchronized themes including Classic Studio, Retro 80s Synthwave, Neon Nightclub, Birthday Party with confetti, Golden Sunset, and Minimalist Gallery.
- **Extensible Layout System**:
  - Duo Classic (Side-by-side portrait split).
  - Polaroid Twin (Instant film cards with date stamps).
  - Split Stack (Cinematic horizontal widescreen stack).
  - Multi Grid (Dynamic grid scaling for 2 to 6 participants).
- **Millisecond Clock Synchronization (Cristian's Algorithm)**:
  - Continuous round-trip time (RTT) calculation and outlier rejection.
  - Server-scheduled capture timestamps ($T_{\text{capture}} = \text{serverNow} + \Delta_{\text{countdown}}$).
  - Synchronized 3-2-1 countdown animation with synthesized Web Audio beeps and realistic mechanical shutter clicks.
- **High-Resolution Export**:
  - Composited directly in the browser via HTML5 Canvas (`canvas.toBlob()`).
  - 1-Click High-Res PNG Download.
  - Native System Clipboard Copy (`ClipboardItem`).
  - Native Mobile Share Sheet (`navigator.share`).
- **100% Privacy by Design**:
  - Camera video never touches the server.
  - Ephemeral rooms with automatic cleanup after 10 minutes when empty or after 4 hours total lifetime.
  - Optional Redis adapter for production horizontal scaling.

---

## 🏗️ Architecture & Project Structure

This project is organized as an npm workspaces monorepo:

```text
photobooth/
├── package.json                   # Monorepo workspaces & root scripts
├── tsconfig.base.json             # Shared TypeScript configuration
├── packages/
│   └── shared/                    # Shared types, protocols & layout algorithms
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── types.ts           # Participant, Room, Environment, Layout, Capture interfaces
│       │   ├── events.ts          # Centralized Socket.IO event protocol & payloads
│       │   ├── environments.ts    # Preset virtual environments registry
│       │   ├── layouts.ts         # Extensible photobooth layout geometry calculations
│       │   ├── sync-utils.ts      # Cristian's clock sync algorithm & room ID generator
│       │   └── index.ts           # Shared exports
│       └── test/
│           └── sync-utils.test.ts # Unit tests for clock sync, layout slots, and environments
├── apps/
│   ├── server/                    # Node.js + Express + Socket.IO + TypeScript
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   ├── src/
│   │   │   ├── index.ts           # Server bootstrap, CORS & health endpoints
│   │   │   ├── config.ts          # Environment configuration
│   │   │   ├── rooms/
│   │   │   │   ├── room-store.ts  # In-memory store + Redis adapter
│   │   │   │   └── room-manager.ts# Ephemeral room lifecycle, presence & auto-expiration
│   │   │   ├── signaling/
│   │   │   │   └── socket-handlers.ts # WebRTC signaling, presence, and sync handlers
│   │   │   └── sync/
│   │   │       └── capture-scheduler.ts # Precision capture timestamp coordinator
│   │   └── test/
│   │       └── room-manager.test.ts # Unit tests for room lifecycle & scheduling
│   └── web/                       # Next.js 14+ (App Router) + Tailwind CSS + Canvas Engine
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       ├── app/
│       │   ├── layout.tsx         # Root layout with fonts, metadata, and theme
│       │   ├── globals.css        # Glassmorphism utilities, fonts, animations
│       │   ├── page.tsx           # Landing page (Hero, Create Booth, Join Code)
│       │   └── room/[roomId]/
│       │       └── page.tsx       # Photobooth Room master orchestration
│       ├── components/
│       │   └── photobooth/
│       │       ├── PhotoboothCanvas.tsx       # 60FPS Live Canvas composition & drag-posing
│       │       ├── CameraPermissionModal.tsx  # Pre-join camera check & display name
│       │       ├── WaitingRoom.tsx            # Room code, invite link, QR & presence
│       │       ├── CountdownOverlay.tsx       # Synchronized 3-2-1-📸 countdown & flash
│       │       ├── EnvironmentSelector.tsx    # Real vs Virtual environment drawer
│       │       ├── LayoutSelector.tsx         # Extensible layout selector
│       │       ├── PositionControls.tsx       # Fine-tuning pose (nudge, zoom, mirror)
│       │       ├── CameraControls.tsx         # Mic/cam toggles, fullscreen & Take Photo CTA
│       │       ├── CapturePreviewModal.tsx    # High-res review, download, copy, retake
│       │       └── QrModal.tsx                # QR code for mobile joining
│       ├── hooks/
│       │   ├── useSocket.ts       # Socket.IO connection & lifecycle
│       │   ├── useClockSync.ts    # Continuous Cristian's algorithm clock sync
│       │   ├── useMediaDevices.ts # Camera & mic hardware stream acquisition
│       │   ├── useWebRTC.ts       # Peer-to-peer WebRTC mesh connection manager
│       │   └── useAudioEffects.ts # Synthesized Web Audio countdown beeps & shutter click
│       └── lib/
│           ├── canvas-renderer.ts # Multi-layer composition engine & high-res export
│           └── export-utils.ts    # Download Blob, clipboard copy & web share
└── README.md                      # Comprehensive documentation
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- **Node.js**: v18.0.0 or later (tested on v22.x)
- **npm**: v9.0.0 or later (tested on v11.x)

### 1. Install Dependencies
From the repository root:
```bash
npm install
```

### 2. Configure Environment Variables
Copy the example environment files:
```bash
# In apps/server:
cp apps/server/.env.example apps/server/.env

# In apps/web:
cp apps/web/.env.example apps/web/.env.local
```

Default settings:
- **Server**: Runs on `http://localhost:3001`
- **Web App**: Runs on `http://localhost:3000`
- **Signaling URL**: `NEXT_PUBLIC_SOCKET_URL=http://localhost:3001`

### 3. Run Development Servers Concurrently
```bash
npm run dev
```
Or start each service individually in separate terminals:
```bash
# Terminal 1: Signaling & Sync Server
npm run dev:server

# Terminal 2: Next.js Web App
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Automated Tests

Run the test suite across the workspaces:
```bash
npm test
```
- Tests shared clock synchronization, jitter filtering, and layout slot bounds.
- Tests server room creation, participant joining, host reassignment, and capture scheduling.

---

## 📡 Socket.IO Signaling Protocol

All events are strictly typed and centralized in `@photobooth/shared`:

| Event Name | Direction | Description |
| :--- | :--- | :--- |
| `sync:time:req` | Client ➔ Server | Clock synchronization ping with `clientSendTime` |
| `sync:time:res` | Server ➔ Client | Clock synchronization pong with server receive & send timestamps |
| `room:create` | Client ➔ Server | Creates a new ephemeral room with unique 6-character ID |
| `room:join` | Client ➔ Server | Joins an existing room with participant ID and display name |
| `room:state` | Server ➔ Client | Broadcasts initial full room state upon joining |
| `participant:joined` | Server ➔ Client | Notifies room peers of a newly joined participant |
| `participant:left` | Server ➔ Client | Notifies room peers when a participant leaves or disconnects |
| `participant:update` | Client ➔ Server | Updates position, zoom, mirror, camera or mic active status |
| `participant:updated`| Server ➔ Client | Broadcasts participant state updates to room members |
| `environment:change` | Client ➔ Server | Requests environment change (Real vs Virtual preset) |
| `environment:changed`| Server ➔ Client | Broadcasts updated environment to all room members |
| `layout:change` | Client ➔ Server | Requests layout change (Duo Classic, Polaroid, Split Stack, Multi Grid) |
| `layout:changed` | Server ➔ Client | Broadcasts layout change to all room members |
| `capture:start` | Client ➔ Server | Triggers countdown capture session with target duration |
| `capture:scheduled` | Server ➔ Client | Broadcasts absolute server capture timestamp $T_{\text{capture}}$ |
| `capture:cancel` | Client ➔ Server | Cancels an ongoing countdown session |
| `capture:cancelled` | Server ➔ Client | Notifies peers of countdown cancellation |
| `capture:complete` | Client ➔ Server | Acknowledges capture completion |
| `webrtc:signal` | Bidirectional | Peer-to-peer WebRTC signal relay (`offer`, `answer`, `ice-candidate`) |

---

## ⏱️ Clock Synchronization & Synchronized Capture

To guarantee that participants take the photo simultaneously regardless of network latency:

1. **Cristian's Algorithm**:
   $$\text{RTT} = (t_{\text{recv}} - t_{\text{send}}) - (t_{\text{serverSend}} - t_{\text{serverRecv}})$$
   $$\text{Offset} = t_{\text{serverSend}} + \frac{\text{RTT}}{2} - t_{\text{recv}}$$
2. **Outlier Filtering**:
   - The client takes an initial burst of 5 pings to establish a baseline.
   - Any packet with RTT significantly above the minimum is discarded as network jitter.
   - The median offset from the cleanest samples is used to calibrate the local clock.
3. **Target Scheduled Capture**:
   - When any participant clicks **Take Photo**, the server chooses $T_{\text{capture}} = \text{serverTime} + 3500\text{ ms}$.
   - Every client translates $T_{\text{capture}}$ into their exact local timestamp: $t_{\text{local}} = T_{\text{capture}} - \text{Offset}$.
   - A `requestAnimationFrame` loop on each client tracks time remaining and triggers frame capture at $t \ge t_{\text{local}}$.
   - Shutter click audio and screen flash execute at the exact millisecond.

---

## 🗄️ Ephemeral State & Redis Setup

### Local Development (Default)
By default, the server uses a high-speed in-memory store (`MemoryRoomStore`). No Redis installation is required.

### Production Redis Setup
To enable horizontal multi-server scaling and persistent ephemeral state across server restarts:
1. Provide a Redis connection string in `apps/server/.env`:
   ```env
   REDIS_URL=redis://username:password@your-redis-host:6379
   ```
2. The server automatically activates `RedisRoomStore` with a 4-hour key expiration (`EX 14400`) and graceful fallback.

---

## 🌐 Production Deployment

### Frontend (Next.js)
Deploy to **Vercel**, **Cloudflare Pages**, or **AWS Amplify**:
- Root directory: `apps/web`
- Build command: `npm run build`
- Output directory: `.next`
- Environment variables:
  ```env
  NEXT_PUBLIC_SOCKET_URL=https://your-signaling-server.railway.app
  ```

### Signaling Server (Node.js + Socket.IO)
Deploy to **Railway**, **Render**, or **Fly.io**:
- Root directory: `apps/server`
- Build command: `npm run build`
- Start command: `node dist/index.js`
- Environment variables:
  ```env
  PORT=3001
  CORS_ORIGIN=https://your-photobooth-frontend.vercel.app
  REDIS_URL=redis://... (optional)
  ```

---

## 📄 License
MIT License. Free to use, modify, and distribute.
