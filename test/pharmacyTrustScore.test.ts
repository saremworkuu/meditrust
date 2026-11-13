/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Pharmacy Trust Score Unit Tests
 * Implements: FR-TS-01 to FR-TS-07, NFR-26, Section 4.3 and 4.4
 *
 * Verifies:
 * 1. Base score starts deterministically at 50.
 * 2. Each signal's effect (recall on-time, active months, expiry hygiene, clone caught).
 * 3. Caps enforced (clones capped at +10, active months capped at +10).
 * 4. Anonymous reports = 0 change (Fairness rule 4.4 invariant).
 * 5. Dismissed reports = 0 change (Fairness invariant).
 * 6. Confirmed counterfeit report = -25 per incident.
 * 7. Recall overdue = -30 and lowers badge.
 * 8. Recomputation is fully idempotent.
 * 9. Attaching IPFS response note preserves on negative event.
 * 10. Ranked list with belowThreshold filtering.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  trustScoreService,
} from '../src/services/trustScoreService.ts';
import {
  TRUST_SCORE_CONFIG,
  calculateBadge,
} from '../src/config/trustScoreConfig.ts';

describe('Pharmacy Trust Score (FR-TS-01 to FR-TS-07, Section 4.3 & 4.4)', () => {
  const testPharmacy = '0x111122223333444455556666777788889999aaaa';

  it('1. New pharmacy starts with deterministic base score of 50 and Silver badge (FR-TS-01)', () => {
    trustScoreService.registerPharmacy({
      pharmacy: testPharmacy,
      name: 'Test Unity Pharmacy',
      licenseNo: 'EFDA-TEST-001',
      region: 'Addis Ababa',
    });

    const profile = trustScoreService.getPharmacyProfile(testPharmacy);
    assert.strictEqual(profile.score, 50, 'Base score must start at 50');
    assert.strictEqual(profile.badge, 'Bronze', '50 is < 60, starts at Bronze');
    assert.strictEqual(profile.breakdown.baseScore, 50);
    assert.strictEqual(profile.breakdown.recallAcknowledgedDelta, 0);
    assert.strictEqual(profile.breakdown.recallOverdueDelta, 0);
    assert.strictEqual(profile.breakdown.cloneAttemptDelta, 0);
    assert.strictEqual(profile.breakdown.confirmedReportDelta, 0);
  });

  it('2. Recall acknowledged on-time adds +20 points (FR-RR-06 / FR-TS-01)', () => {
    trustScoreService.addEvent({
      pharmacy: testPharmacy,
      eventType: 'recall_acknowledged',
      descriptionEn: 'Quarantined recalled batch #1 on time',
      descriptionAm: 'የእገዳ ጥሪውን በሰዓቱ አረጋገጠ',
      evidenceCid: 'ipfs://bafybeiquarantineevidence01',
    });

    const profile = trustScoreService.getPharmacyProfile(testPharmacy);
    // 50 + 20 = 70 => Silver
    assert.strictEqual(profile.score, 70);
    assert.strictEqual(profile.badge, 'Silver');
    assert.strictEqual(profile.breakdown.recallAcknowledgedDelta, 20);
  });

  it('3. Expiry hygiene adds +10 points (FR-TS-01)', () => {
    trustScoreService.addEvent({
      pharmacy: testPharmacy,
      eventType: 'expiry_hygiene',
      descriptionEn: 'Passed annual audit with zero expired stock on shelf',
      descriptionAm: 'ያለፈበት መድኃኒት አልተገኘበትም',
    });

    const profile = trustScoreService.getPharmacyProfile(testPharmacy);
    // 50 + 20 + 10 = 80 => Gold!
    assert.strictEqual(profile.score, 80);
    assert.strictEqual(profile.badge, 'Gold');
    assert.strictEqual(profile.breakdown.expiryHygieneDelta, 10);
  });

  it('4. Blocked clone attempts add points up to config cap of +10 (FR-TS-01)', () => {
    // Add 8 incidents of clone attempt caught (+2 each = 16 raw points)
    for (let i = 0; i < 8; i++) {
      trustScoreService.addEvent({
        pharmacy: testPharmacy,
        eventType: 'clone_attempt_blocked',
        descriptionEn: `Intercepted duplicate sale attempt #${i + 1}`,
        descriptionAm: `የተባዛ ኮድ ሙከራ ተከለከለ #${i + 1}`,
      });
    }

    const profile = trustScoreService.getPharmacyProfile(testPharmacy);
    // Capped at +10 (even though raw is 16)
    assert.strictEqual(profile.breakdown.cloneAttemptDelta, 10, 'Clone points must cap at 10');
    // 50 + 20 + 10 + 10 = 90
    assert.strictEqual(profile.score, 90);
    assert.strictEqual(profile.badge, 'Gold');
  });

  it('5. Clean active operational months add +1/month up to config cap of +10', () => {
    trustScoreService.addEvent({
      pharmacy: testPharmacy,
      eventType: 'active_month_clean',
      descriptionEn: '15 incident-free operational months',
      descriptionAm: '15 ወራት ያለ ምንም ችግር',
      customDelta: 15,
    });

    const profile = trustScoreService.getPharmacyProfile(testPharmacy);
    // Raw was 15, capped at +10
    assert.strictEqual(profile.breakdown.monthsActiveDelta, 10, 'Months active must cap at 10');
    // 50 + 20 + 10 + 10 + 10 = 100 (max score)
    assert.strictEqual(profile.score, 100);
    assert.strictEqual(profile.badge, 'Gold');
  });

  it('6. Fairness Invariant (Section 4.4): Anonymous reports NEVER change the score', () => {
    const scoreBefore = trustScoreService.getPharmacyProfile(testPharmacy).score;

    trustScoreService.addEvent({
      pharmacy: testPharmacy,
      eventType: 'anonymous_report',
      descriptionEn: 'Anonymous tip claiming suspect paracetamol',
      descriptionAm: 'ስም-አልባ ጥቆማ',
    });

    const scoreAfter = trustScoreService.getPharmacyProfile(testPharmacy).score;
    assert.strictEqual(scoreAfter, scoreBefore, 'Anonymous report must NEVER alter pharmacy score');
  });

  it('7. Fairness Invariant (Section 4.4): Dismissed reports change nothing (0 pts)', () => {
    const scoreBefore = trustScoreService.getPharmacyProfile(testPharmacy).score;

    trustScoreService.addEvent({
      pharmacy: testPharmacy,
      eventType: 'dismissed_report',
      descriptionEn: 'EFDA inspector audited claim and dismissed as unsubstantiated',
      descriptionAm: 'ምርመራ ተደርጎ ውድቅ የተደረገ',
    });

    const scoreAfter = trustScoreService.getPharmacyProfile(testPharmacy).score;
    assert.strictEqual(scoreAfter, scoreBefore, 'Dismissed report must not alter pharmacy score');
  });

  it('8. Confirmed counterfeit report deducts -25 per incident (FR-TS-01)', () => {
    trustScoreService.addEvent({
      pharmacy: testPharmacy,
      eventType: 'confirmed_counterfeit_report',
      descriptionEn: 'EFDA lab confirmed fake packaging batch at this pharmacy',
      descriptionAm: 'የተረጋገጠ አጠራጣሪ መድኃኒት ተገኘበት',
      refTx: '0xEFDA-ACTION-2026-CONFIRM-99',
    });

    const profile = trustScoreService.getPharmacyProfile(testPharmacy);
    // Score dropped by 25 from 100 -> 75 => Silver
    assert.strictEqual(profile.breakdown.confirmedReportDelta, -25);
    assert.strictEqual(profile.score, 75);
    assert.strictEqual(profile.badge, 'Silver');
  });

  it('9. Overdue recall deducts -30 and drops badge to Bronze (FR-RR-09 / FR-TS-01)', () => {
    trustScoreService.addEvent({
      pharmacy: testPharmacy,
      eventType: 'recall_overdue',
      descriptionEn: 'Failed to quarantine recalled batch within 48 hours',
      descriptionAm: 'የእገዳ ጥሪን በ48 ሰዓት ሳያረጋግጥ ቀርቷል',
      refTx: '0xOVERDUE-ON-CHAIN-TX-4491',
    });

    const profile = trustScoreService.getPharmacyProfile(testPharmacy);
    // 75 - 30 = 45 => Bronze (< 60)
    assert.strictEqual(profile.breakdown.recallOverdueDelta, -30);
    assert.strictEqual(profile.score, 45);
    assert.strictEqual(profile.badge, 'Bronze');
  });

  it('10. Custody sales gap deducts -20 points (FR-TS-01)', () => {
    trustScoreService.addEvent({
      pharmacy: testPharmacy,
      eventType: 'custody_sales_gap',
      descriptionEn: 'Discrepancy in recorded pack custody vs dispensing volume',
      descriptionAm: 'በተመዘገበውና በተሸጠው መድኃኒት መሀል ልዩነት ተገኘ',
      refTx: '0xCUSTODY-AUDIT-DISCREPANCY-01',
    });

    const profile = trustScoreService.getPharmacyProfile(testPharmacy);
    // 45 - 20 = 25
    assert.strictEqual(profile.breakdown.custodyGapDelta, -20);
    assert.strictEqual(profile.score, 25);
    assert.strictEqual(profile.badge, 'Bronze');
  });

  it('11. Score recomputation is completely idempotent (NFR-26)', () => {
    const profile1 = trustScoreService.recomputePharmacyScore(testPharmacy);
    const profile2 = trustScoreService.recomputePharmacyScore(testPharmacy);
    const profile3 = trustScoreService.getPharmacyProfile(testPharmacy);

    assert.strictEqual(profile1.score, profile2.score);
    assert.strictEqual(profile2.score, profile3.score);
    assert.deepStrictEqual(profile1.breakdown, profile2.breakdown);
    assert.strictEqual(profile1.badge, profile2.badge);
    assert.strictEqual(profile1.disclaimer, 'Based on recorded activity in MediTrust');
  });

  it('12. Pharmacy attaches IPFS response note to negative event (Section 4.4)', () => {
    const profile = trustScoreService.getPharmacyProfile(testPharmacy);
    const negativeEv = profile.events.find((e) => e.isNegative);
    assert.ok(negativeEv, 'Should have a negative event');

    const updated = trustScoreService.attachResponseNote(
      testPharmacy,
      negativeEv.id,
      'ipfs://bafybeiharmacynoteexplanation999proof'
    );

    assert.strictEqual(updated.responseNoteIpfs, 'ipfs://bafybeiharmacynoteexplanation999proof');

    const freshProfile = trustScoreService.getPharmacyProfile(testPharmacy);
    const found = freshProfile.events.find((e) => e.id === negativeEv.id);
    assert.strictEqual(found?.responseNoteIpfs, 'ipfs://bafybeiharmacynoteexplanation999proof');
  });

  it('13. Regulator ranked list filters by belowThreshold correctly (FR-TS-06)', () => {
    const below60 = trustScoreService.getRankedPharmacies({ belowThreshold: 60 });
    assert.ok(below60.length >= 1, 'Should find at least 1 pharmacy below 60 (our test pharmacy at 25)');
    for (const p of below60) {
      assert.ok(p.score < 60, `Pharmacy ${p.name} score ${p.score} must be < 60`);
    }

    const below30 = trustScoreService.getRankedPharmacies({ belowThreshold: 30 });
    assert.ok(below30.some((p) => p.pharmacy.toLowerCase() === testPharmacy.toLowerCase()));
  });

  it('14. Badge calculator conforms to thresholds (FR-TS-02)', () => {
    assert.strictEqual(calculateBadge(100), 'Gold');
    assert.strictEqual(calculateBadge(80), 'Gold');
    assert.strictEqual(calculateBadge(79), 'Silver');
    assert.strictEqual(calculateBadge(60), 'Silver');
    assert.strictEqual(calculateBadge(59), 'Bronze');
    assert.strictEqual(calculateBadge(0), 'Bronze');
  });
});
