/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Step 8 Cuttable Features Unit Tests
 * Implements: FR-VA-05 (voice), FR-VA-10 (SMS spec), FR-IO-01 to FR-IO-05, FR-EW-08, Section 3.3
 *
 * Verifies:
 * 1. Amharic voice clips & NFR-27 transcript parity.
 * 2. PCM WAV audio generation.
 * 3. Non-alarmist directions adhering to NFR-29.
 * 4. National Registry cross-check (FR-IO-01, FR-IO-02, FR-IO-03).
 * 5. National Registry non-blocking resilience when offline (FR-IO-04).
 * 6. SMS format specification and simulated gateway under 160 chars (FR-VA-10).
 * 7. Public Safety Pulse aggregate privacy invariant (FR-EW-08).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { voiceAudioService, generateStatusAudioWav } from '../src/services/voiceAudioService.ts';
import { nationalRegistryAdapter } from '../src/services/nationalRegistryAdapter.ts';
import { smsVerificationService, SMS_SPEC_DOCS } from '../src/services/smsVerificationService.ts';
import { earlyWarningService } from '../src/services/earlyWarningService.ts';
import { verifyPack } from '../packages/verify/src/index.ts';

describe('Step 8 Cuttable Features (FR-VA-05, FR-VA-10, FR-IO-01 to 05, FR-EW-08)', () => {
  // --- Item a: Amharic Voice Replies (FR-VA-05, NFR-27, NFR-29) ---
  it('1. Amharic voice replies carry identical information as text (NFR-27 Parity)', () => {
    const statuses: Array<'genuine' | 'sold' | 'recalled' | 'expired' | 'clone_suspected' | 'unknown'> = [
      'genuine',
      'sold',
      'recalled',
      'expired',
      'clone_suspected',
      'unknown',
    ];

    for (const status of statuses) {
      const amClip = voiceAudioService.getVoiceTranscript({
        status,
        lang: 'am',
        productName: 'Amoxicillin 500mg',
        batchNumber: 'ET-AMOX-001',
      });

      const enClip = voiceAudioService.getVoiceTranscript({
        status,
        lang: 'en',
        productName: 'Amoxicillin 500mg',
        batchNumber: 'ET-AMOX-001',
      });

      // Verify NFR-27 parity: transcript must explicitly include product, batch, and status direction
      assert.ok(amClip.transcript.includes('Amoxicillin 500mg'), 'Amharic transcript must read product name');
      assert.ok(amClip.transcript.includes('ET-AMOX-001'), 'Amharic transcript must read batch number');
      assert.ok(enClip.transcript.includes('Amoxicillin 500mg'), 'English transcript must read product name');
      assert.ok(enClip.transcript.includes('ET-AMOX-001'), 'English transcript must read batch number');

      // Verify NFR-29 non-alarmist rule: mentions contacting health facility or pharmacist on bad statuses
      if (status === 'sold' || status === 'recalled') {
        assert.ok(
          amClip.transcript.includes('ፋርማሲስት') || amClip.transcript.includes('ጤና'),
          `Amharic transcript for ${status} must advise contacting health professional`
        );
        assert.ok(
          enClip.transcript.includes('pharmacist') || enClip.transcript.includes('health'),
          `English transcript for ${status} must advise contacting health professional`
        );
      }
    }
  });

  it('2. Audio synthesis generates valid 16-bit PCM WAV buffer', () => {
    const wav = generateStatusAudioWav(440, 500);
    assert.ok(wav.length > 44, 'WAV buffer must include 44-byte header plus sample data');
    assert.strictEqual(wav.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.strictEqual(wav.subarray(8, 12).toString('ascii'), 'WAVE');
    assert.strictEqual(wav.subarray(12, 16).toString('ascii'), 'fmt ');
    assert.strictEqual(wav.subarray(36, 40).toString('ascii'), 'data');
  });

  // --- Item b: Mock National Registry (FR-IO-01 to FR-IO-05) ---
  it('3. National Registry cross-check returns registered status and NDC (FR-IO-01, FR-IO-02)', async () => {
    nationalRegistryAdapter.setSimulatedOffline(false);
    const res = await nationalRegistryAdapter.checkRegistry({
      gtin: '07612345678900',
      batchNumber: 'ET-AMOX-001',
    });

    assert.strictEqual(res.registered, true);
    assert.strictEqual(res.nationalDrugCode, 'EFDA-ET-REG-2026-002');
    assert.strictEqual(res.isSimulated, true, 'Hard Rule 6: must be labeled simulated');
    assert.ok(res.disclaimer.includes('simulated'));
  });

  it('4. FR-IO-04 Non-Blocking Invariant: verification still works when Registry is offline', async () => {
    // 1. Simulate national registry outage
    nationalRegistryAdapter.setSimulatedOffline(true);

    const regCheck = await nationalRegistryAdapter.checkRegistry({
      gtin: '07612345678900',
      batchNumber: 'ET-AMOX-001',
    });

    assert.strictEqual(regCheck.registered, false);
    assert.strictEqual(regCheck.registryStatus, 'Unavailable');

    // 2. Critical FR-IO-04 requirement: verifyPack MUST STILL SUCCEED smoothly and not throw
    const verifyResult = await verifyPack('https://meditrust.et/verify?b=1&s=SN-ET-00123&c=SEC889', {
      checkRegistry: true,
      registryOptions: {
        customFetcher: async () => {
          throw new Error('Connection refused to National Registry');
        },
      },
    });

    assert.strictEqual(verifyResult.status, 'genuine');
    assert.strictEqual(verifyResult.nationalRegistry?.status, 'unavailable');

    // Reset registry to online
    nationalRegistryAdapter.setSimulatedOffline(false);
  });

  // --- Item c: Documented SMS Specification & Gateway (FR-VA-10) ---
  it('5. SMS Gateway: Valid VERIFY <batch>.<serial>.<code> formats return reply <= 160 chars', async () => {
    assert.strictEqual(SMS_SPEC_DOCS.format, 'VERIFY <batch>.<serial>.<code>');
    assert.strictEqual(SMS_SPEC_DOCS.shortCode, '8899');

    // Test Genuine SMS
    const resGenuine = await smsVerificationService.handleSms(
      'VERIFY 1.SN-ET-00123.SEC889',
      '+251911223344',
      'en'
    );
    assert.strictEqual(resGenuine.status, 'genuine');
    assert.strictEqual(resGenuine.under160Chars, true, 'SMS reply must fit in single 160-char GSM segment');
    assert.strictEqual(resGenuine.isSimulated, true);
    assert.strictEqual(resGenuine.label, '[SIMULATED SMS - EFDA 8899]');
    assert.ok(resGenuine.reply.includes('GENUINE'));

    // Test Sold SMS
    const resSold = await smsVerificationService.handleSms(
      'VERIFY 1.SLD-ET-4491.SEC990',
      '+251911223344',
      'en'
    );
    assert.strictEqual(resSold.status, 'sold');
    assert.strictEqual(resSold.under160Chars, true);
    assert.ok(resSold.reply.includes('ALREADY SOLD'));

    // Test Recalled SMS
    const resRecalled = await smsVerificationService.handleSms(
      'VERIFY 999.RCL-ET-9901.RECALL_CODE',
      '+251911223344',
      'am'
    );
    assert.strictEqual(resRecalled.status, 'recalled');
    assert.strictEqual(resRecalled.under160Chars, true);
    assert.ok(resRecalled.reply.includes('የታገደ'));
  });

  it('6. SMS Gateway: Invalid syntax returns helpful format guidance', async () => {
    const resInvalid = await smsVerificationService.handleSms('HELLO MEDITRUST', '+251911223344', 'en');
    assert.strictEqual(resInvalid.status, 'invalid_syntax');
    assert.ok(resInvalid.reply.includes('VERIFY <batch>.<serial>.<code>'));
  });

  // --- Item d: Public Safety Pulse Page (FR-EW-08) ---
  it('7. Public Safety Pulse returns strictly aggregate counts with zero pack-level data', () => {
    const pulse = earlyWarningService.getPublicSafetyPulse();

    assert.ok(pulse.totalScans >= 0);
    assert.ok(pulse.genuineScans >= 0);
    assert.ok(pulse.interventionsActive >= 0);
    assert.ok(pulse.monitoredZonesCount >= 1);

    const serialized = JSON.stringify(pulse);
    assert.ok(!serialized.includes('serialNumber'), 'Public pulse must not contain serial numbers');
    assert.ok(!serialized.includes('deviceHash'), 'Public pulse must not contain device hashes');
    assert.ok(!serialized.includes('phoneNumber'), 'Public pulse must not contain phone numbers');
  });
});
