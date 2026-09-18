/**
 * Triggers a browser file download for a Blob image.
 */
export function downloadImageBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copies a PNG Blob directly to the system clipboard.
 */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write) {
      return false;
    }
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.warn('Failed to copy to clipboard:', err);
    return false;
  }
}

/**
 * Invokes native Web Share API with image file if supported.
 */
export async function shareImageBlob(blob: Blob, title: string = 'Our Virtual Photobooth Photo'): Promise<boolean> {
  try {
    if (!navigator.share) return false;

    const file = new File([blob], 'photobooth.png', { type: 'image/png' });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return false;
    }

    await navigator.share({
      title,
      text: 'Look at our photo from the Virtual Photobooth! 📸',
      files: [file],
    });
    return true;
  } catch (e) {
    return false;
  }
}
