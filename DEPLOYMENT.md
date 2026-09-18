# Vercel & Signaling Server Deployment Guide

This project is built with:
- **Frontend (`apps/web`)**: Next.js 14 App Router, deployed on **Vercel**.
- **Signaling Server (`apps/server`)**: Node.js + Socket.IO + Express, deployed on **Railway**, **Render**, or **Fly.io** (or runs locally in Standalone Mode).

---

## 1. Hosting on Vercel (Frontend)

### Standalone Mode (Zero Configuration)
The frontend automatically detects when running on Vercel without an external signaling server. In **Standalone Mode**:
- You can take live photobooth pictures, apply vintage filters, choose themes, arrange stickers, and export strips, GIFs, and videos.
- No server setup is required.

### Enabling Real-Time Multiplayer across Friends' Devices
Because Vercel Serverless Functions do not support persistent WebSockets, real-time multiplayer across different devices uses a persistent signaling server.

#### Option A: Deploy Signaling Server to Railway (Recommended - 2 Minutes)
1. Go to [Railway.app](https://railway.app) and create a **New Project**.
2. Select **Deploy from GitHub repo** and pick this repository.
3. In the Railway Service settings:
   - **Root Directory**: Leave as `/` (or `apps/server`)
   - **Build Command**: `npm run build:server`
   - **Start Command**: `npm run start`
   - **Networking**: Click **Generate Domain** (e.g. `https://photobooth-production.up.railway.app`).
4. Copy the generated Railway domain.

#### Option B: Deploy Signaling Server to Render (Free - 2 Minutes)
1. Go to [Render.com](https://render.com) and click **New Web Service**.
2. Connect your GitHub repository.
3. Settings:
   - **Build Command**: `npm run build:server`
   - **Start Command**: `npm run start`
4. Copy your Render URL (e.g. `https://photobooth-signaling.onrender.com`).

---

## 2. Connect Your Signaling Server to Vercel

Once your server URL is ready:

### Method 1: In Vercel Environment Variables
1. In your **Vercel Dashboard**, go to **Settings ➔ Environment Variables**.
2. Add a new variable:
   - **Key**: `NEXT_PUBLIC_SOCKET_URL`
   - **Value**: Your signaling server URL (e.g. `https://photobooth-production.up.railway.app`)
3. Trigger a redeploy in Vercel.

### Method 2: Live in the Web App (No Redeploy Required!)
1. Open your Vercel photobooth app.
2. In the camera setup modal, click **Server Setup**.
3. Paste your signaling server URL and click **Connect**.
4. The URL is saved locally in your browser and automatically connects your multiplayer session!
