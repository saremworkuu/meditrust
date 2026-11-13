/**
 * @license SPDX-License-Identifier: Apache-2.0
 * AES-256-GCM Encryption Service
 * Implements: FR-RR-03, Section 7.2 (Contact details encrypted at rest)
 */

import crypto from 'crypto';

// 32-byte secret key derived from environment variable
const RAW_KEY = process.env.ENCRYPTION_KEY || 'meditrust_ethiopia_safety_secret_key_32bytes!!';
const KEY = crypto.createHash('sha256').update(RAW_KEY).digest(); // Guarantees exact 32 bytes

export interface EncryptedPayload {
  serialized: string; // iv:authTag:ciphertext (hex)
}

/**
 * Encrypt sensitive contact information using AES-256-GCM
 */
export function encryptContact(plainText: string): string {
  if (!plainText) throw new Error('Cannot encrypt empty contact text');

  // 12-byte random IV for AES-GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Serialized format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt contact information with authenticated decryption
 */
export function decryptContact(serialized: string): string {
  if (!serialized || !serialized.includes(':')) {
    throw new Error('Invalid serialized encrypted payload');
  }

  const parts = serialized.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload format (expected iv:authTag:ciphertext)');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];

  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Mask contact for safe, privacy-preserving UI confirmations (e.g. u***@domain.com or +251 91***34)
 */
export function maskContact(contact: string, channel: 'telegram' | 'sms' | 'email'): string {
  const trimmed = contact.trim();
  if (channel === 'email') {
    const parts = trimmed.split('@');
    if (parts.length === 2) {
      const user = parts[0];
      const domain = parts[1];
      const visible = user.length > 2 ? user.slice(0, 2) : user.slice(0, 1);
      return `${visible}***@${domain}`;
    }
    return '***@***';
  }

  if (channel === 'sms') {
    if (trimmed.length > 5) {
      return `${trimmed.slice(0, 6)}***${trimmed.slice(-2)}`;
    }
    return '+251 ***';
  }

  // Telegram
  if (trimmed.startsWith('@')) {
    return `@${trimmed.slice(1, 3)}***`;
  }
  return `${trimmed.slice(0, 3)}***`;
}
