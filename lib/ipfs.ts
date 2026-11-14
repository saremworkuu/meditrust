/**
 * @license SPDX-License-Identifier: Apache-2.0
 * IPFS & Pinata Client Utilities (Task 5)
 * Formats IPFS URLs to public gateway and verifies pinning endpoints.
 */

const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

/**
 * Converts an IPFS CID or ipfs:// URI into a valid HTTPS gateway URL.
 * Implements Task 5: toGatewayUrl() using NEXT_PUBLIC_IPFS_GATEWAY
 */
export function toGatewayUrl(ipfsUriOrCid?: string): string {
  if (!ipfsUriOrCid) return '';

  const trimmed = ipfsUriOrCid.trim();

  // If already full http(s) URL, return directly
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const gateway = (
    process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
    (typeof window !== 'undefined' && (window as any).__ENV__?.NEXT_PUBLIC_IPFS_GATEWAY) ||
    DEFAULT_GATEWAY
  ).replace(/\/?$/, '/');

  // Strip ipfs:// prefix if present
  const cidOrPath = trimmed.replace(/^ipfs:\/\/?/, '');

  return `${gateway}${cidOrPath}`;
}

/**
 * Server-side / Status check helper: test Pinata Authentication.
 * When called in browser, delegates to the server route /api/health/pinata
 * to ensure PINATA_JWT never leaks to the client bundle.
 */
export async function testPinataConnection(jwt?: string): Promise<{ success: boolean; status: number; message: string }> {
  // If in browser, call backend health route
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/health/pinata');
      if (res.ok) {
        return await res.json();
      }
      return {
        success: false,
        status: res.status,
        message: `Pinata check returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 500,
        message: `Failed to contact server Pinata check: ${err.message}`,
      };
    }
  }

  // Server-side direct test
  const token = jwt || process.env.PINATA_JWT;
  if (!token || token.includes('your_pinata_jwt')) {
    return {
      success: false,
      status: 401,
      message: 'PINATA_JWT is missing or placeholder in .env',
    };
  }

  try {
    const res = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      return {
        success: true,
        status: 200,
        message: 'Pinata Cloud IPFS API connected & authenticated',
      };
    }

    return {
      success: false,
      status: res.status,
      message: `Pinata authentication returned status ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 500,
      message: `Network error reaching Pinata: ${err.message}`,
    };
  }
}
