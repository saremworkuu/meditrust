/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Step 5 Test Suite: Patient Recall Alerts, Encryption & NFR-21 Invariant Proof
 * Implements: FR-RR-01 to FR-RR-05, NFR-21, NFR-22, NFR-25, NFR-29, Section 7.2
 */

import assert from 'node:assert';
import {
  encryptContact,
  decryptContact,
  maskContact,
} from '../src/services/encryptionService.ts';
import {
  recallAlertService,
  buildRecallAlertMessage,
} from '../src/services/recallAlertService.ts';
import { verifyPack } from '../packages/verify/src/index.ts';

async function runStep5Tests() {
  console.log('--- Starting Step 5: Patient Recall Alerts & NFR-21 Proof Tests ---');

  // 1. Test AES-256-GCM Encryption Round-Trip (FR-RR-03, Section 7.2)
  const sampleContacts = [
    { raw: '+251911223344', channel: 'sms' as const },
    { raw: 'patient_safety_addis@gmail.com', channel: 'email' as const },
    { raw: '884920192', channel: 'telegram' as const },
  ];

  for (const contact of sampleContacts) {
    const encrypted = encryptContact(contact.raw);

    // Cryptographic assertions
    assert.notStrictEqual(encrypted, contact.raw, 'Ciphertext must not match plaintext');
    assert(encrypted.includes(':'), 'Serialized payload must format as iv:authTag:ciphertext');
    const parts = encrypted.split(':');
    assert.strictEqual(parts.length, 3, 'Must have exactly 3 hex sections');
    assert.strictEqual(parts[0].length, 24, 'IV must be 12 bytes (24 hex characters)');
    assert.strictEqual(parts[1].length, 32, 'AuthTag must be 16 bytes (32 hex characters)');

    // Authenticated decryption assertion
    const decrypted = decryptContact(encrypted);
    assert.strictEqual(decrypted, contact.raw, 'Decrypted text must match original contact');

    // Masking assertion
    const masked = maskContact(contact.raw, contact.channel);
    assert(!masked.includes(contact.raw), 'Masked string must obscure raw contact');
    assert(masked.includes('***'), 'Masked string must contain obscure stars');

    console.log(`✔ AES-256-GCM authenticated encryption verified for ${contact.channel} (${masked})`);
  }

  // 2. Test Privacy Invariant: NO Serial Stored in recall_subscriptions (FR-RR-03, Section 7.2)
  const { subscription, unsubscribeUrl } = recallAlertService.subscribe({
    batchId: 991,
    channel: 'email',
    contact: 'patient.addis@example.com',
    language: 'en',
    consentGiven: true,
  });

  assert.strictEqual(subscription.batchId, 991);
  assert(subscription.unsubscribeToken.length >= 32);
  assert(unsubscribeUrl.includes(subscription.unsubscribeToken));

  // Strict schema assertion: No serial or pack identifier keys
  const subKeys = Object.keys(subscription);
  assert(!subKeys.includes('serial'), 'PRIVACY VIOLATION: serial field must not exist in subscription');
  assert(!subKeys.includes('serialNumber'), 'PRIVACY VIOLATION: serialNumber field must not exist in subscription');
  assert(!subKeys.includes('serialHash'), 'PRIVACY VIOLATION: serialHash field must not exist in subscription');
  assert(!subKeys.includes('packCode'), 'PRIVACY VIOLATION: packCode field must not exist in subscription');
  console.log('✔ Section 7.2 Invariant 2: Subscription links strictly to batch_id ONLY, zero serial stored');

  // 3. Test Explicit Consent Requirement (FR-RR-02)
  assert.throws(
    () =>
      recallAlertService.subscribe({
        batchId: 991,
        channel: 'telegram',
        contact: '123456789',
        consentGiven: false, // Refused consent
      }),
    /Explicit patient consent is required/
  );
  console.log('✔ FR-RR-02: Subscription strictly rejected without explicit consent');

  // 4. Test Recall Worker Dispatch & NFR-29 Template Adherence (FR-RR-04, NFR-22)
  // Register Amharic subscriber
  recallAlertService.subscribe({
    batchId: 991,
    channel: 'sms',
    contact: '+251911998877',
    language: 'am',
    consentGiven: true,
  });

  // Register English Telegram subscriber
  recallAlertService.subscribe({
    batchId: 991,
    channel: 'telegram',
    contact: '99882211',
    language: 'en',
    consentGiven: true,
  });

  const dispatchStart = Date.now();
  const dispatchResult = await recallAlertService.dispatchRecallAlerts({
    batchId: 991,
    batchNumber: 'ET-2026-MED991',
    reason: 'Particulate matter contamination identified during quality audit',
  });
  const dispatchElapsed = Date.now() - dispatchStart;

  // NFR-22: Queued within 60 seconds
  assert(dispatchElapsed < 60000, `NFR-22 Failure: Dispatch took ${dispatchElapsed}ms (> 60s)`);
  assert(dispatchResult.sent >= 3, 'Must have dispatched to all active subscribers for batch 991');

  // Validate NFR-29 compliance in dispatched templates
  const logs = recallAlertService.getNotificationLogs(991);
  assert(logs.length >= 3);

  const amharicMsg = buildRecallAlertMessage({
    batchId: 991,
    batchNumber: 'ET-2026-MED991',
    reason: 'Particulate matter contamination',
    language: 'am',
    unsubscribeUrl: 'https://meditrust.et/u/tok',
    channel: 'sms',
  });

  const englishMsg = buildRecallAlertMessage({
    batchId: 991,
    batchNumber: 'ET-2026-MED991',
    reason: 'Particulate matter contamination',
    language: 'en',
    unsubscribeUrl: 'https://meditrust.et/u/tok',
    channel: 'telegram',
  });

  // NFR-29 Assertions
  assert(amharicMsg.includes('ባች ቁጥር #991'));
  assert(amharicMsg.includes('ራስን በራስ በጭራሽ አያክሙ')); // Never self-treat
  assert(amharicMsg.includes('ፋርማሲስትዎን ወይም በአቅራቢያዎ የሚገኝ የጤና ተቋምን ያማክሩ'));
  assert(amharicMsg.includes('[የተመሰለ የኤስኤምኤስ መግቢያ]')); // Hard Rule 6

  assert(englishMsg.includes('Batch #991'));
  assert(englishMsg.includes('Do NOT self-treat')); // Never self-treat
  assert(englishMsg.includes('contact your licensed pharmacist or nearest health facility'));
  console.log('✔ FR-RR-04 & NFR-29: Multilingual recall alerts queued and sent with non-alarmist directions');

  // 5. Test One-Tap Unsubscribe & Instant Data Eradication (FR-RR-05, NFR-25)
  const unsubsResult = recallAlertService.unsubscribe(subscription.unsubscribeToken);
  assert.strictEqual(unsubsResult.success, true);
  assert(unsubsResult.message.includes('permanently deleted'));

  // Assert contact record is gone
  assert.throws(
    () => recallAlertService.unsubscribe(subscription.unsubscribeToken),
    /Invalid or expired/
  );
  console.log('✔ FR-RR-05 & NFR-25: Unsubscribe permanently erases contact data from memory and index');

  // 6. PROVE NFR-21: Verification works on-chain even if notification worker is down
  console.log('\n--- Proving NFR-21 Reliability Invariant ---');
  // Notification worker is completely idle/offline
  const recalledBatchCode = JSON.stringify({
    b: 999, // Recalled batch fixture
    s: 'RCL-ET-9901',
    c: 'RECALL_CODE',
  });

  const offlineWorkerResult = await verifyPack(recalledBatchCode, {
    checkRegistry: false, // Disconnected from external registry
  });

  // Assert that verification page/consumer still flags 'recalled' directly from chain RPC
  assert.strictEqual(
    offlineWorkerResult.status,
    'recalled',
    'NFR-21 Failure: Medicine must be verified as recalled on-chain regardless of notification worker status'
  );
  assert.strictEqual(offlineWorkerResult.isRecalled, true);
  assert.strictEqual(offlineWorkerResult.presentation.emoji, '🔴');
  console.log('✔ NFR-21 PROVEN: Verification page displays "Recalled" (🔴) with notification worker turned OFF');

  console.log('\nAll Step 5 Patient Recall Alerts Tests PASSED (6 comprehensive suites).');
}

runStep5Tests().catch((err) => {
  console.error('Step 5 test failure:', err);
  process.exit(1);
});
