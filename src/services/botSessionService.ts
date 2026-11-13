/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Telegram Bot Session & Privacy-Preserving Scan Logger
 * Implements: FR-VA-08, Section 7.1, Section 7.2
 * Hard rule 1: No personal data on-chain or in public scan logs.
 */

import crypto from 'crypto';

const BOT_SALT = process.env.BOT_SALT || 'meditrust_ethiopia_safety_salt_2026';

export interface BotSession {
  telegramIdHash: string;
  language: 'en' | 'am';
  createdAt: string;
  updatedAt: string;
}

export interface ScanEvent {
  id: string;
  batchId?: string;
  batchNumber?: string;
  serialHash?: string;
  status: string;
  channel: 'web' | 'telegram' | 'mock_sms';
  latApprox?: number;
  lngApprox?: number;
  createdAt: string;
}

class BotSessionStore {
  // Key: Salted SHA-256 Hash -> BotSession
  private sessions: Map<string, BotSession> = new Map();
  // Privacy-preserving scan log
  private scanLogs: ScanEvent[] = [];

  /**
   * Hashes Telegram ID with cryptographic salt
   * Irreversible one-way hash (Section 7.2, Rule 3)
   */
  public hashTelegramId(telegramId: number | string): string {
    return crypto
      .createHmac('sha256', BOT_SALT)
      .update(String(telegramId))
      .digest('hex');
  }

  public getLanguage(telegramId: number | string): 'en' | 'am' {
    const hash = this.hashTelegramId(telegramId);
    const session = this.sessions.get(hash);
    return session ? session.language : 'en';
  }

  public setLanguage(telegramId: number | string, language: 'en' | 'am'): void {
    const hash = this.hashTelegramId(telegramId);
    const existing = this.sessions.get(hash);
    const now = new Date().toISOString();

    if (existing) {
      existing.language = language;
      existing.updatedAt = now;
      this.sessions.set(hash, existing);
    } else {
      this.sessions.set(hash, {
        telegramIdHash: hash,
        language,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Logs verification scan event with channel = 'telegram'
   * CRITICAL PRIVACY INVARIANT (FR-VA-08):
   * Zero user identity, zero Telegram ID, zero phone number recorded.
   */
  public logScanEvent(params: {
    status: string;
    batchId?: string;
    batchNumber?: string;
    serialHash?: string;
    channel?: 'web' | 'telegram' | 'mock_sms';
  }): ScanEvent {
    // Addis Ababa approximate coordinates for demo aggregation
    const latBase = 9.01 + (Math.random() - 0.5) * 0.08;
    const lngBase = 38.76 + (Math.random() - 0.5) * 0.08;

    const event: ScanEvent = {
      id: crypto.randomUUID(),
      batchId: params.batchId,
      batchNumber: params.batchNumber,
      serialHash: params.serialHash,
      status: params.status,
      channel: params.channel || 'telegram',
      latApprox: Math.round(latBase * 1000) / 1000,
      lngApprox: Math.round(lngBase * 1000) / 1000,
      createdAt: new Date().toISOString(),
    };

    this.scanLogs.push(event);
    return event;
  }

  public getScanLogs(): ScanEvent[] {
    return [...this.scanLogs];
  }
}

export const botSessionService = new BotSessionStore();
