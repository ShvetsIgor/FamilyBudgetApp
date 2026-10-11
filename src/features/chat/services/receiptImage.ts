/**
 * Receipt photos leave the phone at 3–12 MB. The model reads a receipt fine at
 * 1600 px on the long side, and a JPEG at that size is a few hundred KB — fast
 * on mobile data and far under the route's limit. Nothing is stored: the
 * compressed image goes to the parse request and is then dropped.
 */
export const MAX_RECEIPT_SIDE = 1600;
/** Base64 characters, comfortably under the server's 1.5 MB image limit */
const TARGET_DATA_URL_LENGTH = 1_200_000;

/** Scales the longer side down to `max`, never up. */
export function receiptTargetSize(width: number, height: number, max = MAX_RECEIPT_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function compressReceiptPhoto(file: Blob): Promise<string> {
  // imageOrientation applies the EXIF rotation phones write instead of rotating pixels
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    let { width, height } = receiptTargetSize(bitmap.width, bitmap.height);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is not available');
      // JPEG has no alpha: a transparent PNG must not turn black
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.78 - attempt * 0.1);
      if (dataUrl.length <= TARGET_DATA_URL_LENGTH) return dataUrl;
      ({ width, height } = receiptTargetSize(width, height, Math.round(Math.max(width, height) * 0.8)));
    }
    throw new Error('Photo is too large after compression');
  } finally {
    bitmap.close();
  }
}
