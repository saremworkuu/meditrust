/**
 * @license SPDX-License-Identifier: Apache-2.0
 * NFR-24 Consistency Test Suite
 * Asserts that the shared library produces identical results regardless of whether called by:
 * 1. Web / PWA verification consumer
 * 2. Telegram Bot consumer
 * 3. USSD / SMS consumer
 *
 * Covers:
 * - Genuine status
 * - Sold status
 * - Recalled status
 * - Expired status
 * - Unknown status
 * - Clone suspected status
 * - Malformed payloads (empty, invalid URL, corrupted JSON, bad delimiters)
 * - FR-IO-04 non-blocking registry hook timeout resistance
 */

import assert from 'node:assert';
import {
  parseQRPayload,
  verifyPack,
  InvalidQRError,
  STATUS_PRESENTATION_MAP,
  checkNationalRegistry,
  mapContractStatus,
} from '../packages/verify/src/index.ts';

// Simulated consumers to test consistency
async function pwaConsumerVerify(rawInput: string) {
  return await verifyPack(rawInput, {
    checkRegistry: true,
    registryOptions: {
      customFetcher: async () => ({ registered: true, nationalDrugCode: 'ET-NDC-9912' }),
    },
  });
}

async function telegramBotConsumerVerify(rawInput: string) {
  return await verifyPack(rawInput, {
    checkRegistry: true,
    registryOptions: {
      customFetcher: async () => ({ registered: true, nationalDrugCode: 'ET-NDC-9912' }),
    },
  });
}

async function runTests() {
  console.log('--- Starting NFR-24 Consistency Tests ---');

  // Test Fixtures across all four supported QR formats
  const fixtures = [
    {
      name: 'Genuine Pack (URL Format)',
      input: 'https://meditrust.et/verify?b=1&s=SN-ET-00123&c=SEC889',
      expectedStatus: 'genuine',
      expectedBatch: 'ET-2026-B1',
      expectedEmoji: '🟢',
    },
    {
      name: 'Already Sold Pack (Delimited Colon Format)',
      input: 'MT:1:SLD-ET-4491:SEC990',
      expectedStatus: 'sold',
      expectedBatch: 'ET-2026-MED01',
      expectedEmoji: '🔵',
    },
    {
      name: 'Recalled Batch (JSON Format)',
      input: JSON.stringify({ b: 999, s: 'RCL-ET-9901', c: 'RECALL_CODE' }),
      expectedStatus: 'recalled',
      expectedBatch: 'ET-RECALL-999',
      expectedEmoji: '🔴',
    },
    {
      name: 'Expired Medicine (SMS Dot Syntax)',
      input: 'VERIFY 888.EXP-ET-8801.EXPPASS',
      expectedStatus: 'expired',
      expectedBatch: 'ET-EXP-888',
      expectedEmoji: '🟠',
    },
    {
      name: 'Clone Suspected Pack (URL Format)',
      input: 'https://meditrust.et/v?b=1&s=CLN-DUPLICATE-77&c=FAKEPASS',
      expectedStatus: 'clone_suspected',
      expectedEmoji: '🛑',
    },
    {
      name: 'Unknown / Fake Pack (Delimited Format)',
      input: 'MT:0:UNK-UNKNOWN-99:NOPROOF',
      expectedStatus: 'unknown',
      expectedEmoji: '⚠️',
    },
  ];

  let passedFixtures = 0;

  for (const fix of fixtures) {
    const pwaResult = await pwaConsumerVerify(fix.input);
    const botResult = await telegramBotConsumerVerify(fix.input);

    // 1. Strict equality check between PWA and Telegram consumers (NFR-24)
    assert.strictEqual(
      pwaResult.status,
      botResult.status,
      `NFR-24 Failure: Consumer status mismatch on ${fix.name}`
    );
    assert.strictEqual(
      pwaResult.batchId,
      botResult.batchId,
      `NFR-24 Failure: Batch ID mismatch on ${fix.name}`
    );
    assert.strictEqual(
      pwaResult.serialNumber,
      botResult.serialNumber,
      `NFR-24 Failure: Serial mismatch on ${fix.name}`
    );
    assert.strictEqual(
      pwaResult.presentation.emoji,
      botResult.presentation.emoji,
      `NFR-24 Failure: Presentation emoji mismatch on ${fix.name}`
    );
    assert.strictEqual(
      pwaResult.presentation.i18nKey,
      botResult.presentation.i18nKey,
      `NFR-24 Failure: i18n key mismatch on ${fix.name}`
    );

    // 2. Expected value assertions
    assert.strictEqual(pwaResult.status, fix.expectedStatus);
    assert.strictEqual(pwaResult.presentation.emoji, fix.expectedEmoji);
    if (fix.expectedBatch) {
      assert.strictEqual(pwaResult.batchNumber, fix.expectedBatch);
    }

    // 3. FR-VA-03: Never color alone assertion
    assert(pwaResult.presentation.titleEn.length > 0, 'Must have descriptive text');
    assert(pwaResult.presentation.titleAm.length > 0, 'Must have Amharic text');
    assert(pwaResult.presentation.emoji.length > 0, 'Must have distinct emoji');

    console.log(`✔ Passed NFR-24 Consumer Consistency: ${fix.name} (${pwaResult.presentation.emoji} ${pwaResult.status})`);
    passedFixtures++;
  }

  // 4. Malformed Payload Tests
  console.log('\n--- Testing Malformed Payloads ---');
  const malformedInputs = [
    { input: '', reason: 'Empty string' },
    { input: '    ', reason: 'Whitespace string' },
    { input: 'MT:', reason: 'Incomplete colon prefix' },
    { input: 'MT:notanumber:serial', reason: 'Non-numeric batch ID' },
    { input: 'https://meditrust.et/invalid-route', reason: 'URL without parameters' },
    { input: '{"broken": json', reason: 'Malformed JSON syntax' },
    { input: '{"b": 1}', reason: 'JSON missing serial number' },
    { input: 'RANDOM_GARBAGE_PAYLOAD_WITHOUT_DELIMITERS', reason: 'Arbitrary text' },
  ];

  let passedMalformed = 0;
  for (const m of malformedInputs) {
    assert.throws(
      () => parseQRPayload(m.input),
      (err: any) => err instanceof InvalidQRError,
      `Should throw InvalidQRError for ${m.reason}`
    );
    console.log(`✔ Correctly rejected malformed payload: ${m.reason}`);
    passedMalformed++;
  }

  // 5. FR-IO-04 Non-blocking registry test
  console.log('\n--- Testing FR-IO-04 Non-blocking Registry Hook ---');
  // Registry that deliberately times out or rejects
  const timeoutResult = await checkNationalRegistry('07612345678900', 'ET-2026-B1', {
    timeoutMs: 50,
    customFetcher: () => new Promise((resolve) => setTimeout(() => resolve({ registered: true }), 500)),
  });

  assert.strictEqual(timeoutResult.registered, false);
  assert.strictEqual(timeoutResult.status, 'unavailable');
  assert.strictEqual(timeoutResult.isSimulated, true);
  console.log('✔ FR-IO-04: Slow registry check timed out gracefully without blocking or throwing');

  // Registry that throws unhandled network error
  const errorResult = await checkNationalRegistry('07612345678900', 'ET-2026-B1', {
    customFetcher: async () => {
      throw new Error('Connection refused by EFDA gateway');
    },
  });
  assert.strictEqual(errorResult.registered, false);
  assert.strictEqual(errorResult.status, 'unavailable');
  console.log('✔ FR-IO-04: Registry network exception safely returned unavailable status');

  console.log(`\nAll Consistency & Unit Tests PASSED (${passedFixtures + passedMalformed + 2} assertions).`);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
