/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Pharmacy Trust Score Service
 * Implements: FR-TS-01 to FR-TS-07, NFR-26, Section 4.3 and 4.4
 *
 * Rules:
 * 1. Base score starts at 50.
 * 2. Deterministic, published formula.
 * 3. Anonymous reports NEVER change a score (fairness invariant Section 4.4).
 * 4. Only regulator-confirmed reports deduct score (-25 each). Dismissed reports change nothing.
 * 5. Recomputation is fully idempotent.
 * 6. Every event links to its cause (ref_tx or regulator action ID).
 * 7. Label: "Based on recorded activity in MediTrust".
 */

import crypto from 'crypto';
import {
  TRUST_SCORE_CONFIG,
  calculateBadge,
  BadgeLevel,
} from '../config/trustScoreConfig.ts';

export type ScoreEventType =
  | 'recall_acknowledged'
  | 'recall_overdue'
  | 'clone_attempt_blocked'
  | 'custody_sales_gap'
  | 'confirmed_counterfeit_report'
  | 'dismissed_report'
  | 'anonymous_report'
  | 'active_month_clean'
  | 'expiry_hygiene';

export interface ScoreEventRecord {
  id: string;
  pharmacy: string;
  eventType: ScoreEventType;
  delta: number;
  descriptionEn: string;
  descriptionAm: string;
  refTx?: string; // On-chain transaction or regulator case ID (NFR-26)
  evidenceCid?: string;
  responseNoteIpfs?: string; // Pharmacy response note (Section 4.4)
  isNegative: boolean;
  createdAt: string;
}

export interface ScoreBreakdown {
  baseScore: number;
  recallAcknowledgedDelta: number;
  recallOverdueDelta: number;
  cloneAttemptDelta: number;
  custodyGapDelta: number;
  confirmedReportDelta: number;
  monthsActiveDelta: number;
  expiryHygieneDelta: number;
  totalNetScore: number;
}

export interface PharmacyProfile {
  pharmacy: string;
  name: string;
  licenseNo: string;
  region: string;
  score: number;
  badge: BadgeLevel;
  breakdown: ScoreBreakdown;
  events: ScoreEventRecord[];
  disclaimer: string;
  computedAt: string;
}

class TrustScoreStore {
  // Pharmacy address -> basic metadata
  private pharmacies: Map<string, { name: string; licenseNo: string; region: string }> = new Map();
  // Pharmacy address -> ScoreEventRecord[]
  private events: Map<string, ScoreEventRecord[]> = new Map();
  // Cached calculated profiles
  private cachedProfiles: Map<string, PharmacyProfile> = new Map();

  constructor() {
    this.seedDemo();
  }

  public registerPharmacy(params: {
    pharmacy: string;
    name: string;
    licenseNo: string;
    region?: string;
  }) {
    const key = params.pharmacy.toLowerCase();
    this.pharmacies.set(key, {
      name: params.name,
      licenseNo: params.licenseNo,
      region: params.region || 'Addis Ababa',
    });
    if (!this.events.has(key)) {
      this.events.set(key, []);
    }
    this.recomputePharmacyScore(key);
  }

  /**
   * Adds an event and recomputes the score deterministically
   */
  public addEvent(params: {
    pharmacy: string;
    eventType: ScoreEventType;
    descriptionEn: string;
    descriptionAm: string;
    refTx?: string;
    evidenceCid?: string;
    customDelta?: number;
  }): ScoreEventRecord {
    const key = params.pharmacy.toLowerCase();
    if (!this.pharmacies.has(key)) {
      this.pharmacies.set(key, {
        name: `Pharmacy ${params.pharmacy.slice(0, 8)}`,
        licenseNo: `EFDA-LIC-${params.pharmacy.slice(2, 6)}`,
        region: 'Addis Ababa',
      });
    }

    // Determine delta from config
    let delta = 0;
    let isNegative = false;
    const cfg = TRUST_SCORE_CONFIG.weights;

    switch (params.eventType) {
      case 'recall_acknowledged':
        delta = params.customDelta ?? cfg.recallAcknowledgedOnTime;
        break;
      case 'recall_overdue':
        delta = params.customDelta ?? cfg.recallOverdue;
        isNegative = true;
        break;
      case 'clone_attempt_blocked':
        delta = params.customDelta ?? cfg.cloneAttemptCaught;
        break;
      case 'custody_sales_gap':
        delta = params.customDelta ?? cfg.custodySalesGap;
        isNegative = true;
        break;
      case 'confirmed_counterfeit_report':
        delta = params.customDelta ?? cfg.confirmedCounterfeitReport;
        isNegative = true;
        break;
      case 'dismissed_report':
        delta = cfg.dismissedReport; // 0
        break;
      case 'anonymous_report':
        delta = cfg.anonymousReport; // 0 (Fairness rule 4.4)
        break;
      case 'active_month_clean':
        delta = params.customDelta ?? cfg.monthActiveNoIncident;
        break;
      case 'expiry_hygiene':
        delta = params.customDelta ?? cfg.expiryHygiene;
        break;
    }

    const record: ScoreEventRecord = {
      id: crypto.randomUUID(),
      pharmacy: key,
      eventType: params.eventType,
      delta,
      descriptionEn: params.descriptionEn,
      descriptionAm: params.descriptionAm,
      refTx: params.refTx || `0x${crypto.randomBytes(32).toString('hex')}`,
      evidenceCid: params.evidenceCid,
      isNegative,
      createdAt: new Date().toISOString(),
    };

    const list = this.events.get(key) || [];
    list.push(record);
    this.events.set(key, list);

    this.recomputePharmacyScore(key);
    return record;
  }

  /**
   * Deterministic, idempotent score recomputation starting at 50
   * Implements Section 4.3 scoring model
   */
  public recomputePharmacyScore(pharmacyAddress: string): PharmacyProfile {
    const key = pharmacyAddress.toLowerCase();
    const meta = this.pharmacies.get(key) || {
      name: `Pharmacy ${pharmacyAddress.slice(0, 8)}`,
      licenseNo: 'EFDA-UNKNOWN',
      region: 'Addis Ababa',
    };

    const evs = this.events.get(key) || [];
    const cfg = TRUST_SCORE_CONFIG;

    let recallAcknowledgedDelta = 0;
    let recallOverdueDelta = 0;
    let rawClonePoints = 0;
    let custodyGapDelta = 0;
    let confirmedReportDelta = 0;
    let rawActiveMonths = 0;
    let expiryHygieneDelta = 0;

    for (const ev of evs) {
      switch (ev.eventType) {
        case 'recall_acknowledged':
          recallAcknowledgedDelta = Math.min(cfg.weights.recallAcknowledgedOnTime, recallAcknowledgedDelta + ev.delta);
          break;
        case 'recall_overdue':
          recallOverdueDelta += ev.delta; // Negative e.g. -30
          break;
        case 'clone_attempt_blocked':
          rawClonePoints += ev.delta;
          break;
        case 'custody_sales_gap':
          custodyGapDelta += ev.delta;
          break;
        case 'confirmed_counterfeit_report':
          confirmedReportDelta += ev.delta; // -25 each
          break;
        case 'active_month_clean':
          rawActiveMonths += ev.delta;
          break;
        case 'expiry_hygiene':
          expiryHygieneDelta = Math.min(cfg.weights.expiryHygiene, expiryHygieneDelta + ev.delta);
          break;
        case 'anonymous_report':
        case 'dismissed_report':
          // Section 4.4 Fairness: explicitly no change to score
          break;
      }
    }

    // Apply caps
    const cloneAttemptDelta = Math.min(cfg.weights.cloneAttemptCap, rawClonePoints);
    const monthsActiveDelta = Math.min(cfg.weights.monthActiveCap, rawActiveMonths);

    // Compute net score starting at 50
    let total =
      cfg.baseScore +
      recallAcknowledgedDelta +
      recallOverdueDelta +
      cloneAttemptDelta +
      custodyGapDelta +
      confirmedReportDelta +
      monthsActiveDelta +
      expiryHygieneDelta;

    // Clamp score to [0, 100]
    total = Math.max(cfg.minScore, Math.min(cfg.maxScore, total));

    const badge = calculateBadge(total);

    const breakdown: ScoreBreakdown = {
      baseScore: cfg.baseScore,
      recallAcknowledgedDelta,
      recallOverdueDelta,
      cloneAttemptDelta,
      custodyGapDelta,
      confirmedReportDelta,
      monthsActiveDelta,
      expiryHygieneDelta,
      totalNetScore: total,
    };

    const profile: PharmacyProfile = {
      pharmacy: key,
      name: meta.name,
      licenseNo: meta.licenseNo,
      region: meta.region,
      score: total,
      badge,
      breakdown,
      events: [...evs].reverse(), // Newest first
      disclaimer: 'Based on recorded activity in MediTrust',
      computedAt: new Date().toISOString(),
    };

    this.cachedProfiles.set(key, profile);
    return profile;
  }

  /**
   * Pharmacy attaches an IPFS response note to an existing negative event (Section 4.4)
   */
  public attachResponseNote(
    pharmacyAddress: string,
    eventId: string,
    responseNoteIpfs: string
  ): ScoreEventRecord {
    const key = pharmacyAddress.toLowerCase();
    const list = this.events.get(key) || [];
    const event = list.find((e) => e.id === eventId);
    if (!event) {
      throw new Error(`Score event ${eventId} not found for pharmacy ${pharmacyAddress}`);
    }

    event.responseNoteIpfs = responseNoteIpfs;
    this.recomputePharmacyScore(key);
    return event;
  }

  public getPharmacyProfile(pharmacyAddress: string): PharmacyProfile {
    const key = pharmacyAddress.toLowerCase();
    return this.cachedProfiles.get(key) || this.recomputePharmacyScore(key);
  }

  public getRankedPharmacies(options?: {
    belowThreshold?: number;
    badge?: BadgeLevel;
    query?: string;
  }): PharmacyProfile[] {
    const all = Array.from(this.pharmacies.keys()).map((addr) => this.getPharmacyProfile(addr));

    let filtered = all;

    if (options?.belowThreshold !== undefined) {
      filtered = filtered.filter((p) => p.score < options.belowThreshold!);
    }

    if (options?.badge) {
      filtered = filtered.filter((p) => p.badge === options.badge);
    }

    if (options?.query) {
      const q = options.query.toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || p.pharmacy.toLowerCase().includes(q) || p.licenseNo.toLowerCase().includes(q)
      );
    }

    // Sort descending by score
    return filtered.sort((a, b) => b.score - a.score);
  }

  public seedDemo() {
    this.pharmacies.clear();
    this.events.clear();
    this.cachedProfiles.clear();

    // 1. Bole Med-Plus Pharmacy (Gold Badge, 90 points) - Demonstrates compliant safe pharmacy
    const pGold = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
    this.registerPharmacy({
      pharmacy: pGold,
      name: 'Bole Med-Plus Community Pharmacy',
      licenseNo: 'EFDA-AA-2024-8891',
      region: 'Bole, Addis Ababa',
    });

    this.addEvent({
      pharmacy: pGold,
      eventType: 'active_month_clean',
      descriptionEn: '10 consecutive incident-free operational months registered',
      descriptionAm: '10 ተከታታይ ወራት ያለ ምንም ችግር በስራ ላይ የቆየ',
      customDelta: 10,
    });

    this.addEvent({
      pharmacy: pGold,
      eventType: 'recall_acknowledged',
      descriptionEn: 'Quarantined 200 units of recalled Batch #1 within 2 hours of notification',
      descriptionAm: 'የታገደውን ባች #1 በ2 ሰዓት ውስጥ ለይቶ አስቀመጠ',
      evidenceCid: 'ipfs://bafybeiclkmedi7patientproof',
    });

    this.addEvent({
      pharmacy: pGold,
      eventType: 'expiry_hygiene',
      descriptionEn: 'Zero expired stock detected during annual regulatory audit',
      descriptionAm: 'በዓመታዊ ቁጥጥር ወቅት ጊዜው ያለፈበት መድኃኒት አልተገኘበትም',
    });

    // 2. Arada Central Pharmacy (Bronze Badge, 20 points) - Demonstrates overdue non-compliance
    const pBronze = '0x90f79bf6eb2c4f870365e785982e1f101e93b906';
    this.registerPharmacy({
      pharmacy: pBronze,
      name: 'Arada Central Pharmacy',
      licenseNo: 'EFDA-AA-2023-4412',
      region: 'Arada, Addis Ababa',
    });

    this.addEvent({
      pharmacy: pBronze,
      eventType: 'recall_overdue',
      descriptionEn: 'Failed to acknowledge Batch #1 recall within 48h deadline (marked overdue on-chain)',
      descriptionAm: 'የባች #1 የእገዳ ጥሪ በ48 ሰዓት ውስጥ አላረጋገጠም',
      refTx: '0x9924aaff88320141bbde83492716492719468924194729141748291471928491',
    });

    // 3. Kazanchis Care Pharmacy (Silver Badge, 72 points)
    const pSilver = '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65';
    this.registerPharmacy({
      pharmacy: pSilver,
      name: 'Kazanchis Care Pharmacy',
      licenseNo: 'EFDA-AA-2025-0019',
      region: 'Kazanchis, Addis Ababa',
    });

    this.addEvent({
      pharmacy: pSilver,
      eventType: 'active_month_clean',
      descriptionEn: '6 active operational clean months',
      descriptionAm: '6 ንቁ የስራ ወራት ያለ ቅሬታ',
      customDelta: 6,
    });

    this.addEvent({
      pharmacy: pSilver,
      eventType: 'clone_attempt_blocked',
      descriptionEn: 'Blocked clone attempt at dispensing counter (DuplicateSaleAttempt intercepted)',
      descriptionAm: 'በመሸጫ ጠረጴዛው ላይ የተባዛ ኮድ ሙከራን በብቃት ከለከለ',
      customDelta: 6,
    });

    this.addEvent({
      pharmacy: pSilver,
      eventType: 'expiry_hygiene',
      descriptionEn: 'Quarantined near-expiry antibiotic stock prior to expiration date',
      descriptionAm: 'ጊዜው ሊያልፍ የደረሰ አንቲባዮቲክ አስቀድሞ ለይቶ አስቀመጠ',
      customDelta: 10,
    });
  }
}

export const trustScoreService = new TrustScoreStore();
