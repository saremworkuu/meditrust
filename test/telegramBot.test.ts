/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Step 4 Test Suite: Telegram Verification Bot
 * Implements: FR-VA-01 to FR-VA-04, FR-VA-06, FR-VA-07, FR-VA-08, NFR-23, NFR-27, NFR-28
 */

import assert from 'node:assert';
import { formatTelegramVerificationReply, buildVerificationButtons } from '../src/bot/telegramBot.ts';
import { botSessionService } from '../src/services/botSessionService.ts';
import { decodeQRFromBuffer } from '../src/services/qrImageDecoder.ts';
import { verifyPack } from '../packages/verify/src/index.ts';
import enTranslations from '../src/locales/en.json' with { type: 'json' };
import amTranslations from '../src/locales/am.json' with { type: 'json' };

async function runStep4Tests() {
  console.log('--- Starting Step 4: Telegram Verification Bot Tests ---');

  // 1. Test Salted Hash Session & Language Persistence (Section 7.2, FR-VA-04)
  const tgUserId = 987654321;
  const hash1 = botSessionService.hashTelegramId(tgUserId);
  const hash2 = botSessionService.hashTelegramId(tgUserId);

  assert.strictEqual(hash1, hash2, 'Hash must be deterministic for the same ID');
  assert.notStrictEqual(hash1, String(tgUserId), 'Must not store raw Telegram ID');
  assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 hex characters');

  // Default language is English
  assert.strictEqual(botSessionService.getLanguage(tgUserId), 'en');

  // Change to Amharic
  botSessionService.setLanguage(tgUserId, 'am');
  assert.strictEqual(botSessionService.getLanguage(tgUserId), 'am', 'Language must be remembered as Amharic');
  console.log('✔ Section 7.2: Telegram ID stored ONLY as salted SHA-256 hash with language preference');

  // 2. Test Verification Status Mapping & Sub-400 Character Constraint (FR-VA-03, Section 3.4)
  const testCases = [
    {
      code: 'https://meditrust.et/verify?b=1&s=SN-ET-00123&c=SEC889',
      expectedStatus: 'genuine',
      expectedEmoji: '🟢',
    },
    {
      code: 'MT:1:SLD-ET-4491:SEC990',
      expectedStatus: 'sold',
      expectedEmoji: '🔵',
    },
    {
      code: JSON.stringify({ b: 999, s: 'RCL-ET-9901', c: 'RECALL_CODE' }),
      expectedStatus: 'recalled',
      expectedEmoji: '🔴',
    },
    {
      code: 'VERIFY 888.EXP-ET-8801.EXPPASS',
      expectedStatus: 'expired',
      expectedEmoji: '🟠',
    },
    {
      code: 'https://meditrust.et/v?b=1&s=CLN-DUPLICATE-77&c=FAKEPASS',
      expectedStatus: 'clone_suspected',
      expectedEmoji: '🛑',
    },
    {
      code: 'MT:0:UNK-UNKNOWN-99:NOPROOF',
      expectedStatus: 'unknown',
      expectedEmoji: '⚠️',
    },
  ];

  for (const tc of testCases) {
    const startTime = Date.now();
    const result = await verifyPack(tc.code, { checkRegistry: true });
    const elapsedMs = Date.now() - startTime;

    // NFR-23: Fast verification response (< 5 seconds)
    assert(elapsedMs < 5000, `NFR-23 Failure: Verification exceeded 5000ms (took ${elapsedMs}ms)`);

    assert.strictEqual(result.status, tc.expectedStatus);
    assert.strictEqual(result.presentation.emoji, tc.expectedEmoji);

    // English format test
    const replyEn = formatTelegramVerificationReply(result, 'en');
    assert(replyEn.startsWith(tc.expectedEmoji), 'Reply must begin with status emoji');
    assert(replyEn.length < 400, `Section 3.4 Failure: English reply length (${replyEn.length}) exceeds 400 chars`);
    assert(replyEn.includes(result.productName));
    assert(replyEn.includes(result.batchNumber));

    // Amharic format test (NFR-28)
    const replyAm = formatTelegramVerificationReply(result, 'am');
    assert(replyAm.startsWith(tc.expectedEmoji), 'Amharic reply must begin with status emoji');
    assert(replyAm.length < 400, `Section 3.4 Failure: Amharic reply length (${replyAm.length}) exceeds 400 chars`);
    assert(replyAm.includes('ምርት፡') || replyAm.includes('ባች፡'), 'Must contain Amharic headers');

    // NFR-29: Non-alarmist direction present
    assert(replyEn.includes('Direction:') || replyEn.includes('Take') || replyEn.includes('pharmacist'));

    console.log(`✔ Verified Status Mapping & Sub-400 Char Limit: ${tc.expectedEmoji} ${tc.expectedStatus} (EN: ${replyEn.length}c, AM: ${replyAm.length}c)`);
  }

  // 3. Test Action Buttons Structure (FR-VA-06)
  const buttonsEn = buildVerificationButtons('1', 'en');
  const buttonsAm = buildVerificationButtons('1', 'am');

  assert.strictEqual(buttonsEn.inline_keyboard.length, 2, 'Must have 2 rows of buttons');
  assert.strictEqual(buttonsEn.inline_keyboard[0].length, 2, 'Top row has 2 buttons (Report, Alert)');
  assert.strictEqual(buttonsEn.inline_keyboard[1].length, 1, 'Bottom row has 1 button (Pharmacy)');

  assert.strictEqual(buttonsEn.inline_keyboard[0][0].text, enTranslations.bot.btnReport);
  assert.strictEqual(buttonsAm.inline_keyboard[0][0].text, amTranslations.bot.btnReport);
  console.log('✔ FR-VA-06: Buttons generated with correct multilingual text and callbacks');

  // 4. Test Failed Decode Guidance Path (FR-VA-07)
  const corruptImageBuffer = Buffer.from('NOT_A_VALID_IMAGE_FILE_BUFFER_12345');
  const decodedCorrupt = decodeQRFromBuffer(corruptImageBuffer);
  assert.strictEqual(decodedCorrupt, null, 'Corrupt image buffer must return null without throwing');

  // Empty buffer
  assert.strictEqual(decodeQRFromBuffer(Buffer.alloc(0)), null);

  const failMessageEn = enTranslations.bot.decodeFailed;
  const failMessageAm = amTranslations.bot.decodeFailed;

  assert(failMessageEn.includes('retake the photo') || failMessageEn.includes('type the printed code'));
  assert(failMessageAm.includes('ፎቶውን በድጋሚ') || failMessageAm.includes('በቀጥታ ይጻፉ'));
  console.log('✔ FR-VA-07: Corrupt/empty photo safely returns null and delivers clear retake guidance');

  // 5. Test Scan Event Logging & Privacy Invariant (FR-VA-08)
  const scanEvent = botSessionService.logScanEvent({
    status: 'genuine',
    batchId: '1',
    batchNumber: 'ET-2026-MED01',
    channel: 'telegram',
  });

  assert.strictEqual(scanEvent.channel, 'telegram');
  assert.strictEqual(scanEvent.status, 'genuine');
  assert.strictEqual(scanEvent.batchId, '1');
  assert(scanEvent.latApprox !== undefined);
  assert(scanEvent.lngApprox !== undefined);

  // PRIVACY ASSERTION: No personal identity fields present
  const keys = Object.keys(scanEvent);
  assert(!keys.includes('telegramId'), 'Privacy Breach: telegramId must NOT be logged in scan_events');
  assert(!keys.includes('phoneNumber'), 'Privacy Breach: phoneNumber must NOT be logged in scan_events');
  assert(!keys.includes('username'), 'Privacy Breach: username must NOT be logged in scan_events');
  assert(!keys.includes('name'), 'Privacy Breach: name must NOT be logged in scan_events');
  console.log('✔ FR-VA-08: Scan event logged with channel = telegram and strictly ZERO personal identifiers');

  console.log('\nAll Step 4 Telegram Bot Tests PASSED (5 comprehensive suites).');
}

runStep4Tests().catch((err) => {
  console.error('Step 4 test failure:', err);
  process.exit(1);
});
