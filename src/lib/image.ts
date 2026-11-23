// src/lib/image.ts
// Profile photos: check the file, shrink it so its longest side is at most 1024 px,
// and re-encode it as JPEG. Re-encoding also drops hidden camera data (such as GPS
// position) from the picture. The shrinking maths is pure and tested; the canvas
// part needs a real browser.

export const MAX_EDGE = 1024;
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const JPEG_QUALITY = 0.9;

/** Size that fits inside max x max, keeping the proportions; never enlarges. */
export function fitWithin(width: number, height: number, max = MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Message for a file that cannot be used, or null when it is fine. */
export function checkImageFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Please choose a JPEG, PNG, WebP or GIF picture.';
  if (file.size > MAX_INPUT_BYTES) return 'That file is too large (over 20 MB). Please choose a smaller picture.';
  if (file.size === 0) return 'That file is empty.';
  return null;
}

export interface ResizedImage { blob: Blob; width: number; height: number }

/** Decode, shrink to MAX_EDGE on the longest side if bigger, and return a JPEG. */
export async function resizeImage(file: Blob, max = MAX_EDGE): Promise<ResizedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();                       // browsers turn the picture upright using its camera data
    const size = fitWithin(img.naturalWidth, img.naturalHeight, max);
    if (!size.width || !size.height) throw new Error('empty image');

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.fillStyle = '#ffffff';                // JPEG has no transparency: put pictures with holes on white
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, size.width, size.height);

    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('could not encode');
    return { blob, width: size.width, height: size.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
