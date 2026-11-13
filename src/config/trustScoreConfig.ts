/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Pharmacy Trust Score Configuration
 * Implements: FR-TS-01, FR-TS-02, FR-TS-03, Section 4.3
 *
 * Configurable weights and caps (Section 4.3: "The exact weights are tunable configuration, not hard-coded.")
 */

export interface TrustScoreConfig {
  baseScore: number;
  minScore: number;
  maxScore: number;
  badgeThresholds: {
    gold: number;   // >= 80
    silver: number; // 60 to 79
    bronze: number; // < 60
  };
  weights: {
    recallAcknowledgedOnTime: number; // +20
    recallOverdue: number;            // -30
    cloneAttemptCaught: number;       // +2 per incident
    cloneAttemptCap: number;          // capped at +10
    custodySalesGap: number;          // -20
    confirmedCounterfeitReport: number; // -25 per incident
    dismissedReport: number;          // 0 (no change)
    anonymousReport: number;          // 0 (no change, fairness rule 4.4)
    monthActiveNoIncident: number;    // +1 per month
    monthActiveCap: number;           // capped at +10
    expiryHygiene: number;            // +10
  };
  formulaDocumentationEn: string;
  formulaDocumentationAm: string;
}

export const TRUST_SCORE_CONFIG: TrustScoreConfig = {
  baseScore: 50,
  minScore: 0,
  maxScore: 100,
  badgeThresholds: {
    gold: 80,
    silver: 60,
    bronze: 0,
  },
  weights: {
    recallAcknowledgedOnTime: 20,
    recallOverdue: -30,
    cloneAttemptCaught: 2,
    cloneAttemptCap: 10,
    custodySalesGap: -20,
    confirmedCounterfeitReport: -25,
    dismissedReport: 0,
    anonymousReport: 0,
    monthActiveNoIncident: 1,
    monthActiveCap: 10,
    expiryHygiene: 10,
  },
  formulaDocumentationEn:
    'Trust Score (0–100) = Base(50) + min(10, MonthsActive * 1) + RecallOnTime(+20) + ExpiryHygiene(+10) + min(10, ClonesBlocked * 2) - RecallOverdue(30) - (ConfirmedReports * 25) - CustodyGaps(20). Anonymous reports never alter scores.',
  formulaDocumentationAm:
    'የታማኝነት ነጥብ (0–100) = መነሻ (50) + ንቁ ወራት (እስከ +10) + በእገዳ ጊዜ እርምጃ መውሰድ (+20) + የማብቂያ ቀን ጥበቃ (+10) + የተባዙ ኮዶችን መከላከል (እስከ +10) - ያለፈ እገዳ (-30) - የተረጋገጠ አጠራጣሪ መድኃኒት (-25)። ስም-አልባ ጥቆማዎች ነጥብ አይቀንሱም።',
};

export type BadgeLevel = 'Gold' | 'Silver' | 'Bronze';

export function calculateBadge(score: number): BadgeLevel {
  if (score >= TRUST_SCORE_CONFIG.badgeThresholds.gold) return 'Gold';
  if (score >= TRUST_SCORE_CONFIG.badgeThresholds.silver) return 'Silver';
  return 'Bronze';
}
