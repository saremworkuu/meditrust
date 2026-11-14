/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Browser QR Code Scanner & Image Decoder
 * Uses HTML5 Canvas + jsQR to decode QR codes from:
 * 1. Live video frames (Camera viewfinder)
 * 2. Uploaded image files / photos taken by user
 */

import jsQR from 'jsqr';

export interface QRScanResult {
  data: string;
  location?: any;
}

/**
 * Decodes a QR code from an image File or Blob
 */
export async function decodeQRFromFile(file: File | Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        resolve(null);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          ctx.drawImage(img, 0, 0, img.width, img.height);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (code && code.data) {
            resolve(code.data);
          } else {
            resolve(null);
          }
        } catch (err) {
          console.error('QR decode canvas error:', err);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Decodes a QR code from an HTMLVideoElement frame
 */
export function decodeQRFromVideo(video: HTMLVideoElement): string | null {
  if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });

    return code?.data || null;
  } catch {
    return null;
  }
}
