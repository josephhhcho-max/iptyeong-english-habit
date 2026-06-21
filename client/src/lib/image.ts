// Resize + re-encode a user-picked image so its base64 payload comfortably
// fits Claude's vision limits (raw image must be <5MB). Returns the
// re-encoded blob, its base64 (no data: prefix), and the media type used.

export type PreparedImage = {
  blob: Blob;
  base64: string;
  mediaType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
};

const DEFAULT_MAX_DIM = 1600;
const DEFAULT_QUALITY = 0.85;
// Target raw bytes well under Claude's 5MB-per-image cap.
const TARGET_BYTES = 3 * 1024 * 1024;

async function loadImageBitmap(file: Blob): Promise<ImageBitmap> {
  return await createImageBitmap(file);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas.toBlob returned null'));
      },
      type,
      quality,
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader returned non-string result'));
        return;
      }
      // Strip the "data:<mime>;base64," prefix.
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export async function prepareImageForUpload(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<PreparedImage> {
  const maxDim = opts.maxDim ?? DEFAULT_MAX_DIM;
  let quality = opts.quality ?? DEFAULT_QUALITY;

  const bitmap = await loadImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // Encode as JPEG and tighten quality until under TARGET_BYTES (best-effort).
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  while (blob.size > TARGET_BYTES && quality > 0.5) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }

  const base64 = await blobToBase64(blob);
  return {
    blob,
    base64,
    mediaType: 'image/jpeg',
    width,
    height,
  };
}
