/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Recall Compliance Cache Service & Chain Event Indexer
 * Implements: FR-RR-08, FR-RR-09, FR-RR-10, Section 7.1
 */

export interface RecallHolderRecord {
  id: string;
  batchId: number;
  batchNumber: string;
  productName: string;
  gtin: string;
  holder: string;
  holderName: string;
  holderRole: 'distributor' | 'pharmacy';
  status: 'Pending' | 'Acknowledged' | 'Overdue';
  qtyHeld: number;
  qtyQuarantined: number;
  evidenceCid?: string;
  severity: 'ClassI' | 'ClassII' | 'ClassIII';
  recallReason: string;
  recalledAt: string; // ISO
  deadlineAt: string; // ISO
  ackedAt?: string;
  overdueAt?: string;
}

export interface RecalledBatchSummary {
  batchId: number;
  batchNumber: string;
  productName: string;
  severity: 'ClassI' | 'ClassII' | 'ClassIII';
  recalledAt: string;
  deadlineAt: string;
  recallReason: string;
  totalHolders: number;
  pendingHolders: number;
  acknowledgedHolders: number;
  overdueHolders: number;
  totalHeld: number;
  totalQuarantined: number;
  compliancePercentage: number;
  holders: RecallHolderRecord[];
}

export interface RecallBanner {
  id: string;
  batchId: number;
  batchNumber: string;
  productName: string;
  severity: string;
  holder: string;
  deadlineAt: string;
  remainingHours: number;
  messageEn: string;
  messageAm: string;
  urgent: boolean;
}

// In-memory persistent cache for demo, testing, and live syncing
class RecallComplianceStore {
  private records: Map<string, RecallHolderRecord> = new Map();

  constructor() {
    this.seedDemo();
  }

  private makeKey(batchId: number, holder: string): string {
    return `${batchId}:${holder.toLowerCase()}`;
  }

  public seedDemo() {
    this.records.clear();
    const now = new Date();
    const recalledAt = new Date(now.getTime() - 2 * 3600 * 1000).toISOString(); // 2 hours ago
    const deadlineAt = new Date(now.getTime() + 46 * 3600 * 1000).toISOString(); // 46 hours remaining (default 48h)

    // Holder 1: Distributor (Central Addis Medical Wholesaler) - 500 held, Pending
    const h1: RecallHolderRecord = {
      id: 'rec-h1-distributor',
      batchId: 1,
      batchNumber: 'ET-2026-MED01',
      productName: 'Amoxicillin 500mg Capsules (EPHARM)',
      gtin: '07612345678900',
      holder: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      holderName: 'Central Addis Medical Wholesaler',
      holderRole: 'distributor',
      status: 'Pending',
      qtyHeld: 500,
      qtyQuarantined: 0,
      severity: 'ClassII',
      recallReason: 'Substandard dissolution profile reported by regional laboratory',
      recalledAt,
      deadlineAt,
    };

    // Holder 2: Pharmacy (Bole Med-Plus Pharmacy) - 200 held, Pending
    const h2: RecallHolderRecord = {
      id: 'rec-h2-pharmacy',
      batchId: 1,
      batchNumber: 'ET-2026-MED01',
      productName: 'Amoxicillin 500mg Capsules (EPHARM)',
      gtin: '07612345678900',
      holder: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      holderName: 'Bole Med-Plus Pharmacy',
      holderRole: 'pharmacy',
      status: 'Pending',
      qtyHeld: 200,
      qtyQuarantined: 0,
      severity: 'ClassII',
      recallReason: 'Substandard dissolution profile reported by regional laboratory',
      recalledAt,
      deadlineAt,
    };

    this.records.set(this.makeKey(h1.batchId, h1.holder), h1);
    this.records.set(this.makeKey(h2.batchId, h2.holder), h2);
  }

  public recallBatch(
    batchId: number,
    severity: 'ClassI' | 'ClassII' | 'ClassIII',
    reason: string
  ): RecalledBatchSummary[] {
    const now = new Date();
    const recalledAt = now.toISOString();
    const deadlineAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();

    // Update existing records for this batch or create new holder record if none
    let found = false;
    for (const record of this.records.values()) {
      if (record.batchId === batchId) {
        record.severity = severity;
        record.recallReason = reason;
        record.recalledAt = recalledAt;
        record.deadlineAt = deadlineAt;
        found = true;
      }
    }

    if (!found) {
      const newRec: RecallHolderRecord = {
        id: `rec-batch-${batchId}`,
        batchId,
        batchNumber: `ET-RECALLED-${batchId}`,
        productName: 'Recalled Essential Medicine (EFDA Seizure)',
        gtin: '07612345678999',
        holder: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        holderName: 'Bole Med-Plus Pharmacy',
        holderRole: 'pharmacy',
        status: 'Pending',
        qtyHeld: 300,
        qtyQuarantined: 0,
        severity,
        recallReason: reason,
        recalledAt,
        deadlineAt,
      };
      this.records.set(this.makeKey(batchId, newRec.holder), newRec);
    }

    return this.getBatchSummaries();
  }

  public getAllRecords(): RecallHolderRecord[] {

    return Array.from(this.records.values());
  }

  public getBatchSummaries(): RecalledBatchSummary[] {
    const batchMap = new Map<number, RecallHolderRecord[]>();
    for (const record of this.records.values()) {
      const list = batchMap.get(record.batchId) || [];
      list.push(record);
      batchMap.set(record.batchId, list);
    }

    const summaries: RecalledBatchSummary[] = [];

    for (const [batchId, holders] of batchMap.entries()) {
      const first = holders[0];
      const totalHolders = holders.length;
      const pendingHolders = holders.filter((h) => h.status === 'Pending').length;
      const acknowledgedHolders = holders.filter((h) => h.status === 'Acknowledged').length;
      const overdueHolders = holders.filter((h) => h.status === 'Overdue').length;

      const totalHeld = holders.reduce((acc, h) => acc + h.qtyHeld, 0);
      const totalQuarantined = holders.reduce((acc, h) => acc + h.qtyQuarantined, 0);
      const compliancePercentage = totalHeld > 0 ? Math.round((totalQuarantined / totalHeld) * 100) : 0;

      summaries.push({
        batchId,
        batchNumber: first.batchNumber,
        productName: first.productName,
        severity: first.severity,
        recalledAt: first.recalledAt,
        deadlineAt: first.deadlineAt,
        recallReason: first.recallReason,
        totalHolders,
        pendingHolders,
        acknowledgedHolders,
        overdueHolders,
        totalHeld,
        totalQuarantined,
        compliancePercentage,
        holders,
      });
    }

    return summaries;
  }

  public acknowledgeRecall(
    batchId: number,
    holder: string,
    qty: number,
    evidenceCid: string
  ): RecallHolderRecord {
    const key = this.makeKey(batchId, holder);
    const existing = this.records.get(key);
    if (!existing) {
      throw new Error(`Holder ${holder} has no recorded stock for batch #${batchId}`);
    }

    if (qty <= 0) {
      throw new Error('Quarantine quantity must be greater than zero');
    }

    if (qty > existing.qtyHeld) {
      throw new Error(`Quarantine quantity (${qty}) exceeds recorded holdings (${existing.qtyHeld})`);
    }

    if (existing.qtyQuarantined > 0 && qty <= existing.qtyQuarantined) {
      throw new Error(`Subsequent acknowledgement must strictly increase quarantined stock`);
    }

    existing.status = 'Acknowledged';
    existing.qtyQuarantined = qty;
    existing.evidenceCid = evidenceCid;
    existing.ackedAt = new Date().toISOString();

    this.records.set(key, existing);
    return existing;
  }

  public markOverdue(batchId: number, holder: string): RecallHolderRecord {
    const key = this.makeKey(batchId, holder);
    const existing = this.records.get(key);
    if (!existing) {
      throw new Error(`No record found for batch #${batchId} and holder ${holder}`);
    }

    if (existing.status === 'Acknowledged') {
      throw new Error(`Holder ${holder} has already acknowledged recall for batch #${batchId}`);
    }

    const now = new Date().getTime();
    const deadline = new Date(existing.deadlineAt).getTime();

    // In demo environment, allow manual overdue trigger or enforce deadline
    existing.status = 'Overdue';
    existing.overdueAt = new Date().toISOString();

    this.records.set(key, existing);
    return existing;
  }

  public setFastForwardDeadline(batchId: number, pastSeconds: number = 3600) {
    const now = new Date();
    const pastDeadline = new Date(now.getTime() - pastSeconds * 1000).toISOString();
    for (const record of this.records.values()) {
      if (record.batchId === batchId) {
        record.deadlineAt = pastDeadline;
      }
    }
  }

  public getBanners(holderAddress?: string): RecallBanner[] {
    const banners: RecallBanner[] = [];
    const now = new Date().getTime();

    for (const record of this.records.values()) {
      // If holder specified, filter by holder, otherwise get all pending
      if (holderAddress && record.holder.toLowerCase() !== holderAddress.toLowerCase()) {
        continue;
      }

      if (record.status === 'Pending' || record.status === 'Overdue') {
        const deadlineTime = new Date(record.deadlineAt).getTime();
        const remainingHours = Math.round((deadlineTime - now) / (3600 * 1000));
        const urgent = remainingHours <= 12 || record.status === 'Overdue';

        banners.push({
          id: `banner-${record.batchId}-${record.holder}`,
          batchId: record.batchId,
          batchNumber: record.batchNumber,
          productName: record.productName,
          severity: record.severity,
          holder: record.holder,
          deadlineAt: record.deadlineAt,
          remainingHours,
          messageEn:
            record.status === 'Overdue'
              ? `OVERDUE NOTICE: Batch #${record.batchId} (${record.batchNumber}) is past the recall deadline. Immediate quarantine and explanation required.`
              : `CRITICAL RECALL ACTION REQUIRED: Batch #${record.batchId} (${record.batchNumber}) has been recalled by EFDA. You hold ${record.qtyHeld} units. Quarantine immediately and submit acknowledgement.`,
          messageAm:
            record.status === 'Overdue'
              ? `ጊዜው ያለፈበት እገዳ ማሳሰቢያ፡ ባች #${record.batchId} የመጨረሻውን የጊዜ ገደብ አልፏል። አስቸኳይ እርምጃ ይውሰዱ።`
              : `አስቸኳይ የእገዳ እርምጃ ያስፈልጋል፡ ባች #${record.batchId} በባለስልጣኑ ታግዷል። በእጅዎ ${record.qtyHeld} ክምችት አለ። ወዲያውኑ ለይተው ያስቀምጡ።`,
          urgent,
        });
      }
    }

    return banners;
  }
}

export const recallComplianceService = new RecallComplianceStore();
