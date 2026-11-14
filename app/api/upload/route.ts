/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Server-Side IPFS Upload Route (Task 5)
 * Uploads evidence files (images/PDFs, max 10MB) to Pinata IPFS using PINATA_JWT.
 * SECURITY INVARIANT: PINATA_JWT NEVER LEAKS TO THE CLIENT.
 */

import { NextRequest, NextResponse } from 'next/server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

export async function POST(req: NextRequest) {
  try {
    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt || pinataJwt.includes('your_pinata_jwt')) {
      return NextResponse.json(
        { error: 'Server configuration error: PINATA_JWT is not configured.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form-data.' }, { status: 400 });
    }

    // 1. Validate MIME type (Images and PDF only)
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type '${file.type}'. Only images (PNG, JPEG, WEBP, GIF) and PDF files are allowed.` },
        { status: 400 }
      );
    }

    // 2. Validate file size (Max 10 MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).` },
        { status: 400 }
      );
    }

    // 3. Prepare payload for Pinata Cloud pinFileToIPFS endpoint
    const pinataFormData = new FormData();
    pinataFormData.append('file', file, file.name);

    const pinataMetadata = JSON.stringify({
      name: `meditrust_evidence_${Date.now()}_${file.name}`,
      keyvalues: {
        app: 'meditrust',
        uploadedAt: new Date().toISOString(),
      },
    });
    pinataFormData.append('pinataMetadata', pinataMetadata);

    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: pinataFormData,
    });

    if (!pinataResponse.ok) {
      const errText = await pinataResponse.text();
      return NextResponse.json(
        { error: `Pinata IPFS upload failed: ${errText}` },
        { status: pinataResponse.status }
      );
    }

    const pinataData = await pinataResponse.json();

    return NextResponse.json({
      success: true,
      cid: pinataData.IpfsHash,
      pinSize: pinataData.PinSize,
      timestamp: pinataData.Timestamp,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Server upload error: ${err.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
