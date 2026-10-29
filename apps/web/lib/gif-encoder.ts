/**
 * Lightweight pure TypeScript GIF89a animated encoder with LZW compression.
 * Zero external dependencies, runs directly in browser.
 */

interface GifFrameOptions {
  delayMs?: number; // duration of frame in ms
  transparent?: number | null; // transparent color index
}

export class GifEncoder {
  private width: number;
  private height: number;
  private stream: number[] = [];

  constructor(width: number, height: number) {
    this.width = Math.round(width);
    this.height = Math.round(height);
    this.writeHeader();
  }

  private writeHeader() {
    // GIF89a signature
    this.writeString('GIF89a');
    // Logical Screen Descriptor
    this.writeShort(this.width);
    this.writeShort(this.height);
    // GCT Flag: 0 (we use Local Color Tables for each frame for highest fidelity)
    this.writeByte(0x70); // 8 bits resolution, no GCT
    this.writeByte(0); // Background color index
    this.writeByte(0); // Pixel aspect ratio

    // Application Extension: NETSCAPE2.0 for infinite animation looping
    this.writeByte(0x21); // Extension Introducer
    this.writeByte(0xff); // Application Extension Label
    this.writeByte(11); // Block Size (11 bytes)
    this.writeString('NETSCAPE2.0');
    this.writeByte(3); // Sub-block length
    this.writeByte(1); // Sub-block ID (loop count)
    this.writeShort(0); // 0 = Loop infinitely
    this.writeByte(0); // Block Terminator
  }

  public addFrame(ctx: CanvasRenderingContext2D, options: GifFrameOptions = {}) {
    const { delayMs = 600, transparent = null } = options;
    const imgData = ctx.getImageData(0, 0, this.width, this.height);
    const pixels = imgData.data;

    // Build 256-color palette using median cut / simple uniform color quantization
    const { palette, indexedPixels } = this.quantizeColors(pixels);

    // Graphic Control Extension
    this.writeByte(0x21); // Extension Introducer
    this.writeByte(0xf9); // Graphic Control Label
    this.writeByte(4); // Block size
    const packed = transparent !== null ? 0x01 : 0x00;
    this.writeByte(packed);
    this.writeShort(Math.round(delayMs / 10)); // Delay time in hundredths of a second (10ms)
    this.writeByte(transparent !== null ? transparent : 0);
    this.writeByte(0); // Block Terminator

    // Image Descriptor
    this.writeByte(0x2c);
    this.writeShort(0); // Left
    this.writeShort(0); // Top
    this.writeShort(this.width);
    this.writeShort(this.height);
    this.writeByte(0x87); // Local Color Table present, 256 colors (2^(7+1))

    // Write Local Color Table (256 * 3 bytes)
    for (let i = 0; i < 256; i++) {
      if (i < palette.length) {
        this.writeByte(palette[i][0]);
        this.writeByte(palette[i][1]);
        this.writeByte(palette[i][2]);
      } else {
        this.writeByte(0);
        this.writeByte(0);
        this.writeByte(0);
      }
    }

    // LZW Encode pixels
    this.encodeLZW(indexedPixels, 8);
  }

  private quantizeColors(rgbaPixels: Uint8ClampedArray): { palette: [number, number, number][]; indexedPixels: number[] } {
    // Fixed RGB 3-3-2 palette keeps encoding linear in pixel count.
    const palette: [number, number, number][] = Array.from({ length: 256 }, (_, i) => [
      Math.round(((i >> 5) & 7) * 255 / 7),
      Math.round(((i >> 2) & 7) * 255 / 7),
      Math.round((i & 3) * 255 / 3),
    ]);
    const indexedPixels: number[] = new Array(this.width * this.height);
    for (let i = 0; i < rgbaPixels.length; i += 4) {
      indexedPixels[i / 4] = (rgbaPixels[i] & 0xe0) | ((rgbaPixels[i + 1] & 0xe0) >> 3) | (rgbaPixels[i + 2] >> 6);
    }
    return { palette, indexedPixels };
  }

  private encodeLZW(indexedPixels: number[], minCodeSize: number) {
    this.writeByte(minCodeSize);

    const clearCode = 1 << minCodeSize; // 256
    const eoiCode = clearCode + 1; // 257
    let codeSize = minCodeSize + 1; // 9
    let nextCode = eoiCode + 1;

    let dict = new Map<string, number>();
    const resetDict = () => {
      dict.clear();
      for (let i = 0; i < clearCode; i++) {
        dict.set(String(i), i);
      }
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    };
    resetDict();

    const bitBuffer: number[] = [];
    let curBits = 0;
    let bitCount = 0;

    const emitBits = (code: number, bits: number) => {
      curBits |= code << bitCount;
      bitCount += bits;
      while (bitCount >= 8) {
        bitBuffer.push(curBits & 0xff);
        curBits >>= 8;
        bitCount -= 8;
      }
    };

    emitBits(clearCode, codeSize);

    let currentPattern = '';
    for (let i = 0; i < indexedPixels.length; i++) {
      const pixel = indexedPixels[i];
      const combined = currentPattern ? `${currentPattern},${pixel}` : `${pixel}`;

      if (dict.has(combined)) {
        currentPattern = combined;
      } else {
        emitBits(dict.get(currentPattern)!, codeSize);
        if (nextCode < 4096) {
          dict.set(combined, nextCode++);
          if (nextCode > (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          emitBits(clearCode, codeSize);
          resetDict();
        }
        currentPattern = `${pixel}`;
      }
    }

    if (currentPattern) {
      emitBits(dict.get(currentPattern)!, codeSize);
    }
    emitBits(eoiCode, codeSize);
    if (bitCount > 0) {
      bitBuffer.push(curBits & 0xff);
    }

    // Write sub-blocks of at most 255 bytes
    let offset = 0;
    while (offset < bitBuffer.length) {
      const chunkSize = Math.min(255, bitBuffer.length - offset);
      this.writeByte(chunkSize);
      for (let i = 0; i < chunkSize; i++) {
        this.writeByte(bitBuffer[offset + i]);
      }
      offset += chunkSize;
    }
    this.writeByte(0); // Sub-block terminator
  }

  public finish(): Blob {
    // Loop Extension (Netscape 2.0)
    // Note: Inserted before trailer
    // Trailer
    this.writeByte(0x3b);
    const buffer = new Uint8Array(this.stream);
    return new Blob([buffer], { type: 'image/gif' });
  }

  private writeByte(b: number) {
    this.stream.push(b & 0xff);
  }

  private writeShort(s: number) {
    this.stream.push(s & 0xff);
    this.stream.push((s >> 8) & 0xff);
  }

  private writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      this.writeByte(str.charCodeAt(i));
    }
  }
}

export interface PhotoboothGifOptions {
  width?: number;
  height?: number;
  delayMs?: number;
  filter?: 'none' | 'noir' | 'sepia' | 'film90s';
  stickers?: any[];
}

/**
 * Creates an animated GIF from an array of ImageBitmap or HTMLCanvasElement
 * Preserves full field of view so participants are never cut off.
 */
export async function createPhotoboothGif(
  frames: (ImageBitmap | HTMLCanvasElement)[],
  options: PhotoboothGifOptions = {}
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('No frames provided for GIF encoding');
  }

  const {
    delayMs = 550,
    filter = 'none',
    stickers = [],
  } = options;

  const first = frames[0];
  const fw = first.width;
  const fh = first.height;

  // Dynamically calculate GIF resolution matching source aspect ratio to avoid clipping people out
  let width = options.width;
  let height = options.height;

  if (!width || !height) {
    const maxDim = 540;
    if (fw >= fh) {
      width = maxDim;
      height = Math.round((fh / fw) * maxDim);
    } else {
      height = maxDim;
      width = Math.round((fw / fh) * maxDim);
    }
  }

  // Ensure dimensions are even integers
  width = Math.round(width / 2) * 2;
  height = Math.round(height / 2) * 2;

  const encoder = new GifEncoder(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Preload any sticker images for drawing
  const loadedStickerImages: { img: HTMLImageElement; sticker: any }[] = [];
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
            loadedStickerImages.push({ img, sticker: st });
          }
        } catch {
          // ignore
        }
      }
    }
  }

  for (const frame of frames) {
    ctx.clearRect(0, 0, width, height);

    // Draw frame containing full scene (fit into canvas cleanly)
    const scale = Math.min(width / frame.width, height / frame.height);
    const sw = frame.width * scale;
    const sh = frame.height * scale;
    const dx = (width - sw) / 2;
    const dy = (height - sh) / 2;

    // Background fill
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(frame, dx, dy, sw, sh);

    // Apply color filter if selected
    if (filter !== 'none') {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        if (filter === 'noir') {
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;
          gray = gray < 128 ? (gray * gray) / 128 : 255 - ((255 - gray) * (255 - gray)) / 128;
          d[i] = gray;
          d[i + 1] = gray;
          d[i + 2] = gray;
        } else if (filter === 'sepia') {
          d[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
          d[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
          d[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        } else if (filter === 'film90s') {
          d[i] = Math.min(255, r * 1.06 + 6);
          d[i + 1] = Math.min(255, g * 0.98 + 3);
          d[i + 2] = Math.min(255, b * 0.88 + 10);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Draw stickers onto each frame
    for (const { img, sticker } of loadedStickerImages) {
      const cx = (sticker.x / 100) * width;
      const cy = (sticker.y / 100) * height;
      const stScale = (sticker.scale || 1.0) * (width / 700);
      const rot = ((sticker.rotation || 0) * Math.PI) / 180;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(stScale, stScale);
      const baseSize = 100;
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

    // Draw emoji stickers if any
    for (const st of stickers) {
      if (st.icon && !st.url) {
        const cx = (st.x / 100) * width;
        const cy = (st.y / 100) * height;
        const stScale = st.scale || 1.0;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(((st.rotation || 0) * Math.PI) / 180);
        ctx.scale(stScale, stScale);
        ctx.font = '36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(st.icon, 0, 0);
        ctx.restore();
      }
    }

    encoder.addFrame(ctx, { delayMs });
  }

  return encoder.finish();
}
