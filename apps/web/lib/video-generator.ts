import type { PhotoFilterId } from '@photobooth/shared';
import { applyPhotoFilter } from './photostrip-renderer';
/**
 * Video Generator for Photobooth Shots.
 * Uses browser-native HTMLCanvasElement.captureStream + MediaRecorder
 * to generate a smooth slideshow video clip with flash effects, filters, and user stickers.
 */

export interface VideoGeneratorOptions {
  frameDurationMs?: number; // duration per photo frame (e.g. 700ms)
  width?: number;
  height?: number;
  fps?: number;
  showFlash?: boolean;
  filter?: PhotoFilterId;
  stickers?: any[];
}

export async function createPhotoboothVideo(
  frames: (ImageBitmap | HTMLCanvasElement)[],
  options: VideoGeneratorOptions = {}
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('No frames provided for video generation');
  }

  const {
    frameDurationMs = 700,
    fps = 30,
    showFlash = true,
    filter = 'none',
    stickers = [],
  } = options;

  const first = frames[0];
  const fw = first.width;
  const fh = first.height;

  // Dynamically compute width & height to match input aspect ratio and avoid clipping
  let width = options.width;
  let height = options.height;

  if (!width || !height) {
    const maxDim = 720;
    if (fw >= fh) {
      width = maxDim;
      height = Math.round((fh / fw) * maxDim);
    } else {
      height = maxDim;
      width = Math.round((fw / fh) * maxDim);
    }
  }

  // Ensure dimensions are even integers for video encoders
  width = Math.round(width / 2) * 2;
  height = Math.round(height / 2) * 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })!;

  // Determine supported mime type
  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];

  let chosenMime = 'video/webm';
  for (const mime of mimeTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      chosenMime = mime;
      break;
    }
  }

  // Preload sticker images
  const loadedStickers: { img: HTMLImageElement; sticker: any }[] = [];
  if (stickers && stickers.length > 0) {
    for (const st of stickers) {
      if (st.url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
            img.src = st.url;
          });
          if (img.complete && img.naturalWidth > 0) {
            loadedStickers.push({ img, sticker: st });
          }
        } catch {
          // ignore
        }
      }
    }
  }

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: chosenMime,
    videoBitsPerSecond: 2_500_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const drawFrame = (frame: ImageBitmap | HTMLCanvasElement, flashOpacity: number = 0) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Fit whole photo inside canvas without cropping participants
    const scale = Math.min(width / frame.width, height / frame.height);
    const sw = frame.width * scale;
    const sh = frame.height * scale;
    const dx = (width - sw) / 2;
    const dy = (height - sh) / 2;

    ctx.drawImage(frame, dx, dy, sw, sh);

    // Filter
    if (filter !== 'none') applyPhotoFilter(ctx, 0, 0, width, height, filter);

    // Flash overlay
    if (flashOpacity > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, flashOpacity)})`;
      ctx.fillRect(0, 0, width, height);
    }

    // Draw stickers onto video
    for (const { img, sticker } of loadedStickers) {
      const cx = (sticker.x / 100) * width;
      const cy = (sticker.y / 100) * height;
      const stScale = (sticker.scale || 1.0) * (width / 720);
      const rot = ((sticker.rotation || 0) * Math.PI) / 180;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(stScale, stScale);
      const baseSize = 120;
      const aspect = img.width / img.height;
      let iw = baseSize;
      let ih = baseSize / aspect;
      if (aspect < 1) {
        ih = baseSize;
        iw = baseSize * aspect;
      }
      ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
      ctx.restore();
    }

    for (const st of stickers) {
      if (st.icon && !st.url) {
        const cx = (st.x / 100) * width;
        const cy = (st.y / 100) * height;
        const stScale = st.scale || 1.0;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(((st.rotation || 0) * Math.PI) / 180);
        ctx.scale(stScale, stScale);
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(st.icon, 0, 0);
        ctx.restore();
      }
    }
  };

  return new Promise(async (resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: chosenMime });
      resolve(blob);
    };

    recorder.onerror = (e) => reject(e);

    recorder.start();

    // Render loop through frames (2 full cycles so it plays like a boomerang loop)
    const cycles = 2;
    const totalFrames = frames.length;
    const framesPerPose = Math.max(10, Math.round((frameDurationMs / 1000) * fps));

    drawFrame(frames[0], 0);

    for (let c = 0; c < cycles; c++) {
      for (let i = 0; i < totalFrames; i++) {
        const currentFrame = frames[i];

        for (let f = 0; f < framesPerPose; f++) {
          let flash = 0;
          if (showFlash && f === 0) {
            flash = 0.85; // initial flash
          } else if (showFlash && f === 1) {
            flash = 0.4;
          } else if (showFlash && f === 2) {
            flash = 0.1;
          }

          drawFrame(currentFrame, flash);
          await new Promise((r) => setTimeout(r, 1000 / fps));
        }
      }
    }

    // Trailing hold and flush
    await new Promise((r) => setTimeout(r, 200));
    try {
      if (recorder.state === 'recording') {
        recorder.requestData();
        recorder.stop();
      }
    } catch {
      // already stopped
    }
  });
}
