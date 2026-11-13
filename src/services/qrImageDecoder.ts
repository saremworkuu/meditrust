/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Pure TypeScript / Serverless QR Image Decoder
 * Decodes QR codes from PNG and JPEG image buffers using jsQR, pngjs, and jpeg-js.
 * Operates with zero native C++ binaries, compatible with Vercel, Cloud Run, and AWS Lambda.
 */

import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

export interface DecodedQRResult {
  data: string;
  format: 'png' | 'jpeg' | 'unknown';
  width: number;
  height: number;
}

/**
 * Attempt to decode a QR code from a binary image buffer (PNG or JPEG)
 * Returns decoded text payload or null if no valid QR is detected.
 */
export function decodeQRFromBuffer(buffer: Buffer): DecodedQRResult | null {
  if (!buffer || buffer.length === 0) {
    return null;
  }

  // 1. Check for JPEG Magic Bytes (0xFF 0xD8)
  const isJpeg = buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8;

  if (isJpeg) {
    try {
      const decodedJpeg = jpeg.decode(buffer, { useTArray: true });
      if (decodedJpeg && decodedJpeg.data && decodedJpeg.width > 0 && decodedJpeg.height > 0) {
        const qrCode = jsQR(
          new Uint8ClampedArray(decodedJpeg.data.buffer),
          decodedJpeg.width,
          decodedJpeg.height
        );
        if (qrCode && qrCode.data) {
          return {
            data: qrCode.data,
            format: 'jpeg',
            width: decodedJpeg.width,
            height: decodedJpeg.height,
          };
        }
      }
    } catch (err) {
      // Continue to PNG fallback
    }
  }

  // 2. Check for PNG Magic Bytes (0x89 0x50 0x4E 0x47) or attempt PNG parse
  try {
    const png = PNG.sync.read(buffer);
    if (png && png.data && png.width > 0 && png.height > 0) {
      const qrCode = jsQR(
        new Uint8ClampedArray(png.data.buffer),
        png.width,
        png.height
      );
      if (qrCode && qrCode.data) {
        return {
          data: qrCode.data,
          format: 'png',
          width: png.width,
          height: png.height,
        };
      }
    }
  } catch (err) {
    // Both failed
  }

  return null;
}
