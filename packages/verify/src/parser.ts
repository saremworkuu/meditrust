/**
 * @license SPDX-License-Identifier: Apache-2.0
 * QR Payload Parser
 * Parses QR codes and text inputs across URL, delimited string, GS1, SMS, and JSON formats.
 */

import { keccak256, toHex } from 'viem';
import { ParsedQRPayload } from './types.ts';

export class InvalidQRError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQRError';
  }
}

/**
 * Assumed QR Payload format from v1.0:
 * 1. Web URL: https://meditrust.et/verify?b=<batchId>&s=<serialNumber>&c=<code>&p=<proof>
 * 2. Delimited Prefix: MT:<batchId>:<serialNumber>:<code>[:<proof>]
 * 3. SMS Spec (FR-VA-10): VERIFY <batchId>.<serialNumber>.<code>
 * 4. JSON Payload: {"b":1,"s":"SN123","c":"CODE"} or {"batchId":1,"serialNumber":"SN123"}
 */
export function parseQRPayload(rawInput: string): ParsedQRPayload {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new InvalidQRError('Empty or invalid QR payload input');
  }

  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    throw new InvalidQRError('Payload cannot be blank');
  }

  // 1. Try JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const data = JSON.parse(trimmed);
      const batchRaw = data.b ?? data.batchId ?? data.batch;
      const serialRaw = data.s ?? data.serialNumber ?? data.serial;
      const secretCode = data.c ?? data.code ?? data.secretCode;
      const proofRaw = data.p ?? data.proof ?? [];

      if (batchRaw === undefined || serialRaw === undefined) {
        throw new InvalidQRError('JSON payload missing required batch or serial fields');
      }

      const batchId = BigInt(batchRaw);
      const serialNumber = String(serialRaw).trim();
      const serialHash = keccak256(toHex(serialNumber));
      const proof = Array.isArray(proofRaw)
        ? proofRaw.map((item) => (String(item).startsWith('0x') ? String(item) : `0x${item}`) as `0x${string}`)
        : [];

      return {
        raw: trimmed,
        batchId,
        serialNumber,
        secretCode: secretCode ? String(secretCode) : undefined,
        serialHash,
        proof,
        format: 'json',
      };
    } catch (err: any) {
      if (err instanceof InvalidQRError) throw err;
      throw new InvalidQRError(`Malformed JSON in QR payload: ${err.message}`);
    }
  }

  // 2. Try URL format
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('meditrust://')) {
    try {
      const url = new URL(trimmed);
      const params = url.searchParams;
      const batchParam = params.get('b') || params.get('batch') || params.get('batchId');
      const serialParam = params.get('s') || params.get('serial') || params.get('serialNumber');
      const codeParam = params.get('c') || params.get('code') || params.get('secret');
      const proofParam = params.get('p') || params.get('proof');

      if (!batchParam || !serialParam) {
        // Fallback: Check pathname like /verify/1/SN123
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && !isNaN(Number(parts[parts.length - 2]))) {
          const batchId = BigInt(parts[parts.length - 2]);
          const serialNumber = parts[parts.length - 1];
          return {
            raw: trimmed,
            batchId,
            serialNumber,
            secretCode: undefined,
            serialHash: keccak256(toHex(serialNumber)),
            proof: [],
            format: 'url',
          };
        }
        throw new InvalidQRError('URL payload missing batch (b) or serial (s) query parameters');
      }

      const batchId = BigInt(batchParam);
      const serialNumber = serialParam.trim();
      const proof = proofParam
        ? proofParam.split(',').map((p) => (p.startsWith('0x') ? p : `0x${p}`) as `0x${string}`)
        : [];

      return {
        raw: trimmed,
        batchId,
        serialNumber,
        secretCode: codeParam || undefined,
        serialHash: keccak256(toHex(serialNumber)),
        proof,
        format: 'url',
      };
    } catch (err: any) {
      if (err instanceof InvalidQRError) throw err;
      throw new InvalidQRError(`Invalid URL in QR payload: ${err.message}`);
    }
  }

  // 3. Try MT: delimited colon format (MT:<batchId>:<serialNumber>:<secretCode>[:<proof>])
  if (trimmed.toUpperCase().startsWith('MT:')) {
    const parts = trimmed.split(':');
    if (parts.length < 3) {
      throw new InvalidQRError('Delimited format must have at least MT:<batchId>:<serialNumber>');
    }

    const batchRaw = parts[1];
    if (isNaN(Number(batchRaw))) {
      throw new InvalidQRError(`Invalid batch ID in colon format: ${batchRaw}`);
    }

    const batchId = BigInt(batchRaw);
    const serialNumber = parts[2].trim();
    if (!serialNumber) {
      throw new InvalidQRError('Serial number cannot be empty in colon format');
    }

    const secretCode = parts[3] ? parts[3].trim() : undefined;
    const proofRaw = parts[4] ? parts[4].split(',') : [];
    const proof = proofRaw.map((p) => (p.startsWith('0x') ? p : `0x${p}`) as `0x${string}`);

    return {
      raw: trimmed,
      batchId,
      serialNumber,
      secretCode,
      serialHash: keccak256(toHex(serialNumber)),
      proof,
      format: 'delimited',
    };
  }

  // 4. Try SMS printable spec format (VERIFY <batch>.<serial>.<code> or <batch>.<serial>.<code>)
  const cleanSms = trimmed.replace(/^VERIFY\s+/i, '').trim();
  const dotParts = cleanSms.split('.');
  if (dotParts.length >= 2 && !isNaN(Number(dotParts[0]))) {
    const batchId = BigInt(dotParts[0]);
    const serialNumber = dotParts[1].trim();
    if (!serialNumber) {
      throw new InvalidQRError('Invalid serial number in SMS dot format');
    }
    const secretCode = dotParts[2] ? dotParts[2].trim() : undefined;

    return {
      raw: trimmed,
      batchId,
      serialNumber,
      secretCode,
      serialHash: keccak256(toHex(serialNumber)),
      proof: [],
      format: 'sms_syntax',
    };
  }

  throw new InvalidQRError(
    `Unsupported QR format. Accepted formats: URL (https://meditrust.et/v?b=...&s=...), Colon (MT:<batch>:<serial>), SMS (<batch>.<serial>), or JSON.`
  );
}
