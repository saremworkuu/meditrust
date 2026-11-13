/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Counterfeit Early-Warning Map & Anomaly Detection Service
 * Implements: FR-EW-01, FR-EW-02, FR-EW-04, FR-EW-05, FR-EW-06, Section 5.2 Privacy
 *
 * Rules:
 * - Device hashes are salted and non-reversible HMAC-SHA256 (Section 5.2).
 * - Locations are rounded to ~1 km cells (Section 5.2).
 * - Never show individual scans on any public page (FR-EW-08).
 * - R4: >10 Unknown results on one batch in 24h.
 * - R5: 3+ Unknown from different devices within 5 km in 24h.
 * - R6: Serial marked Sold at one pharmacy but scanned Genuine-unsold elsewhere.
 */

import crypto from 'crypto';
import { recallComplianceService } from './recallComplianceService.ts';

const DEVICE_SALT = process.env.DEVICE_SALT || 'meditrust_ethiopia_device_salt_2026';

export interface GeoScanEvent {
  id: string;
  batchId?: number;
  batchNumber?: string;
  serialNumber?: string;
  channel: 'web' | 'telegram' | 'mock_sms';
  status: 'genuine' | 'sold' | 'recalled' | 'expired' | 'unknown' | 'clone_suspected';
  lat: number;
  lng: number;
  cellId: string;
  areaName: string;
  deviceHash: string; // Non-reversible salted HMAC
  pharmacyId?: string;
  pharmacyName?: string;
  createdAt: string;
}

export interface GeoCellSummary {
  cellId: string;
  latCenter: number;
  lngCenter: number;
  areaName: string;
  unknownCount: number;
  genuineCount: number;
  cloneCount: number;
  soldCount: number;
  totalCount: number;
  windowStart: string;
  windowEnd: string;
}

export type AnomalyRule = 'R4' | 'R5' | 'R6';

export interface AnomalyAlert {
  id: string;
  rule: AnomalyRule;
  title: string;
  descriptionEn: string;
  descriptionAm: string;
  batchId?: number;
  batchNumber?: string;
  serialNumber?: string;
  area: string;
  lat: number;
  lng: number;
  count: number;
  distinctDevices?: number;
  severity: 'Medium' | 'High' | 'Critical';
  status: 'active' | 'investigating' | 'resolved';
  investigationId?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface InvestigationRecord {
  id: string;
  alertId: string;
  rule: AnomalyRule;
  batchId?: number;
  batchNumber?: string;
  area: string;
  status: 'open' | 'investigating' | 'confirmed_counterfeit' | 'recalled' | 'closed';
  notes: string;
  assignedInspector: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSafetyPulse {
  disclaimer: string;
  period: string;
  totalScans: number;
  genuineScans: number;
  interventionsActive: number;
  monitoredZonesCount: number;
  updatedAt: string;
}

// Known Addis Ababa areas for realistic geocoding
const ADDIS_ZONES = [
  { name: 'Bole, Addis Ababa', lat: 9.002, lng: 38.785 },
  { name: 'Arada, Addis Ababa', lat: 9.035, lng: 38.752 },
  { name: 'Merkato, Addis Ababa', lat: 9.028, lng: 38.736 },
  { name: 'Kirkos, Addis Ababa', lat: 9.012, lng: 38.761 },
  { name: 'Kazanchis, Addis Ababa', lat: 9.018, lng: 38.772 },
  { name: 'Piassa, Addis Ababa', lat: 9.032, lng: 38.748 },
  { name: 'Lideta, Addis Ababa', lat: 9.015, lng: 38.738 },
  { name: 'Akaki-Kality, Addis Ababa', lat: 8.945, lng: 38.774 },
];

export function findClosestArea(lat: number, lng: number): string {
  let closest = ADDIS_ZONES[0].name;
  let minDistance = Infinity;
  for (const zone of ADDIS_ZONES) {
    const d = calculateHaversineDistanceKm(lat, lng, zone.lat, zone.lng);
    if (d < minDistance) {
      minDistance = d;
      closest = zone.name;
    }
  }
  return closest;
}

/**
 * Rounds coordinate to approx 1 km grid cells (~0.01 deg lat/lng) (Section 5.2)
 */
export function roundTo1KmCell(lat: number, lng: number): {
  cellId: string;
  latCenter: number;
  lngCenter: number;
  areaName: string;
} {
  const latCenter = Math.round(lat * 100) / 100;
  const lngCenter = Math.round(lng * 100) / 100;
  const cellId = `cell_${latCenter.toFixed(2)}_${lngCenter.toFixed(2)}`;
  const areaName = findClosestArea(latCenter, lngCenter);
  return { cellId, latCenter, lngCenter, areaName };
}

/**
 * Salted non-reversible device hash (Section 5.2)
 */
export function hashDeviceId(rawDeviceId: string): string {
  return crypto.createHmac('sha256', DEVICE_SALT).update(rawDeviceId).digest('hex');
}

/**
 * Haversine formula to calculate geographic distance in km
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class EarlyWarningService {
  private scans: GeoScanEvent[] = [];
  private alerts: Map<string, AnomalyAlert> = new Map();
  private investigations: Map<string, InvestigationRecord> = new Map();

  // Registry of serial sales for R6 detection
  // serial -> { pharmacyId, pharmacyName, soldAt, lat, lng }
  private salesRegistry: Map<
    string,
    { pharmacyId: string; pharmacyName: string; soldAt: string; lat: number; lng: number }
  > = new Map();

  constructor() {
    this.seedDemoData();
  }

  /**
   * Log a scan with privacy-preserving geo rounding & salted device hashing (Section 5.2)
   */
  public logScan(params: {
    batchId?: number;
    batchNumber?: string;
    serialNumber?: string;
    channel: 'web' | 'telegram' | 'mock_sms';
    status: 'genuine' | 'sold' | 'recalled' | 'expired' | 'unknown' | 'clone_suspected';
    lat: number;
    lng: number;
    rawDeviceId: string;
    pharmacyId?: string;
    pharmacyName?: string;
    customTime?: string;
  }): GeoScanEvent {
    const { cellId, latCenter, lngCenter, areaName } = roundTo1KmCell(params.lat, params.lng);
    const deviceHash = hashDeviceId(params.rawDeviceId);

    const event: GeoScanEvent = {
      id: crypto.randomUUID(),
      batchId: params.batchId,
      batchNumber: params.batchNumber,
      serialNumber: params.serialNumber,
      channel: params.channel,
      status: params.status,
      lat: latCenter,
      lng: lngCenter,
      cellId,
      areaName,
      deviceHash,
      pharmacyId: params.pharmacyId,
      pharmacyName: params.pharmacyName,
      createdAt: params.customTime || new Date().toISOString(),
    };

    this.scans.push(event);

    // Track sales for Rule R6 detection
    if (params.status === 'sold' && params.serialNumber && params.pharmacyId) {
      this.salesRegistry.set(params.serialNumber, {
        pharmacyId: params.pharmacyId,
        pharmacyName: params.pharmacyName || 'Registered Pharmacy',
        soldAt: event.createdAt,
        lat: latCenter,
        lng: lngCenter,
      });
    }

    // Run real-time anomaly detection rules
    this.evaluateRules(event);

    return event;
  }

  /**
   * Evaluates Anomaly Rules R4, R5, and R6 (FR-EW-04, FR-EW-05, FR-EW-06)
   */
  public evaluateRules(triggerEvent?: GeoScanEvent) {
    const now = new Date().getTime();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Filter scans from last 24 hours
    const recentScans = this.scans.filter(
      (s) => new Date(s.createdAt).getTime() >= oneDayAgo
    );

    // --- RULE R4: >10 Unknown results on one batch in 24h (FR-EW-04) ---
    const unknownBatchCounts: Map<string, { count: number; batchId?: number; area: string; lat: number; lng: number }> = new Map();
    for (const s of recentScans) {
      if (s.status === 'unknown' && s.batchNumber) {
        const cur = unknownBatchCounts.get(s.batchNumber) || {
          count: 0,
          batchId: s.batchId,
          area: s.areaName,
          lat: s.lat,
          lng: s.lng,
        };
        cur.count += 1;
        unknownBatchCounts.set(s.batchNumber, cur);
      }
    }

    for (const [batchNum, data] of unknownBatchCounts.entries()) {
      if (data.count > 10) {
        const alertId = `ALERT-R4-${batchNum}`;
        if (!this.alerts.has(alertId)) {
          this.alerts.set(alertId, {
            id: alertId,
            rule: 'R4',
            title: `Batch Anomaly Spike: ${batchNum} (>10 Unknown Scans)`,
            descriptionEn: `More than 10 Unknown verification scans (${data.count} detected) reported on batch ${batchNum} in ${data.area} within 24 hours.`,
            descriptionAm: `በ24 ሰዓት ውስጥ በባች ${batchNum} ላይ ከ10 በላይ (${data.count}) ያልታወቁ ፍተሻዎች በ${data.area} ተመዝግበዋል።`,
            batchId: data.batchId,
            batchNumber: batchNum,
            area: data.area,
            lat: data.lat,
            lng: data.lng,
            count: data.count,
            severity: 'High',
            status: 'active',
            createdAt: new Date().toISOString(),
          });
        } else {
          // Update count
          const existing = this.alerts.get(alertId)!;
          existing.count = data.count;
        }
      }
    }

    // --- RULE R5: 3+ Unknown from different devices within 5 km in 24h (FR-EW-05) ---
    const recentUnknowns = recentScans.filter((s) => s.status === 'unknown');

    for (let i = 0; i < recentUnknowns.length; i++) {
      const focal = recentUnknowns[i];
      const clusterDevices = new Set<string>();
      clusterDevices.add(focal.deviceHash);

      for (let j = 0; j < recentUnknowns.length; j++) {
        if (i === j) continue;
        const target = recentUnknowns[j];
        const dist = calculateHaversineDistanceKm(focal.lat, focal.lng, target.lat, target.lng);
        if (dist <= 5.0) {
          clusterDevices.add(target.deviceHash);
        }
      }

      if (clusterDevices.size >= 3) {
        const cellKey = `ALERT-R5-${focal.cellId}`;
        if (!this.alerts.has(cellKey)) {
          this.alerts.set(cellKey, {
            id: cellKey,
            rule: 'R5',
            title: `Geographic Counterfeit Cluster: ${focal.areaName} (${clusterDevices.size} Devices)`,
            descriptionEn: `Detected ${clusterDevices.size} distinct patient devices reporting Unknown fake medicine codes within a 5 km radius in ${focal.areaName}.`,
            descriptionAm: `በ${focal.areaName} ዙሪያ በ5 ኪ.ሜ ውስጥ ${clusterDevices.size} የተለያዩ ስልኮች ያልታወቁ አጠራጣሪ ኮዶችን መዝግበዋል።`,
            area: focal.areaName,
            lat: focal.lat,
            lng: focal.lng,
            count: clusterDevices.size,
            distinctDevices: clusterDevices.size,
            severity: 'Critical',
            status: 'active',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // --- RULE R6: Serial sold at one pharmacy but scanned elsewhere (FR-EW-06) ---
    if (triggerEvent && triggerEvent.serialNumber) {
      const priorSale = this.salesRegistry.get(triggerEvent.serialNumber);
      if (
        priorSale &&
        (triggerEvent.status === 'genuine' || triggerEvent.status === 'clone_suspected') &&
        triggerEvent.pharmacyId &&
        triggerEvent.pharmacyId.toLowerCase() !== priorSale.pharmacyId.toLowerCase()
      ) {
        const alertId = `ALERT-R6-${triggerEvent.serialNumber}`;
        if (!this.alerts.has(alertId)) {
          this.alerts.set(alertId, {
            id: alertId,
            rule: 'R6',
            title: `Duplicate / Sold-Elsewhere Anomaly (Serial ${triggerEvent.serialNumber})`,
            descriptionEn: `Unit serial ${triggerEvent.serialNumber} previously registered as Sold by ${priorSale.pharmacyName}, but subsequently verified at ${triggerEvent.pharmacyName || triggerEvent.areaName}. Suspected cloned pack.`,
            descriptionAm: `መድኃኒት መለያ ${triggerEvent.serialNumber} አስቀድሞ በ${priorSale.pharmacyName} ተሽጦ የተመዘገበ ቢሆንም በድጋሚ በ${triggerEvent.pharmacyName || triggerEvent.areaName} ተገኝቷል። የተባዛ ኮድ ተጠርጥሯል።`,
            batchId: triggerEvent.batchId,
            batchNumber: triggerEvent.batchNumber,
            serialNumber: triggerEvent.serialNumber,
            area: triggerEvent.areaName,
            lat: triggerEvent.lat,
            lng: triggerEvent.lng,
            count: 2,
            severity: 'Critical',
            status: 'active',
            details: {
              firstSoldPharmacy: priorSale.pharmacyName,
              firstSoldAt: priorSale.soldAt,
              secondScannedPharmacy: triggerEvent.pharmacyName,
              secondScannedAt: triggerEvent.createdAt,
            },
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  /**
   * Aggregates scans to ~1 km geo-cells (FR-EW-01)
   */
  public getGeoCells(): GeoCellSummary[] {
    const cellMap: Map<string, GeoCellSummary> = new Map();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const scan of this.scans) {
      let cell = cellMap.get(scan.cellId);
      if (!cell) {
        cell = {
          cellId: scan.cellId,
          latCenter: scan.lat,
          lngCenter: scan.lng,
          areaName: scan.areaName,
          unknownCount: 0,
          genuineCount: 0,
          cloneCount: 0,
          soldCount: 0,
          totalCount: 0,
          windowStart: oneDayAgo.toISOString(),
          windowEnd: now.toISOString(),
        };
        cellMap.set(scan.cellId, cell);
      }

      cell.totalCount += 1;
      if (scan.status === 'unknown') cell.unknownCount += 1;
      else if (scan.status === 'genuine') cell.genuineCount += 1;
      else if (scan.status === 'clone_suspected') cell.cloneCount += 1;
      else if (scan.status === 'sold') cell.soldCount += 1;
    }

    return Array.from(cellMap.values());
  }

  /**
   * Returns heatmap density points for Unknown results and suspicious reports (FR-EW-02)
   */
  public getHeatmapPoints(): Array<{
    lat: number;
    lng: number;
    weight: number;
    area: string;
    type: 'unknown' | 'clone' | 'report';
  }> {
    const points: Array<{
      lat: number;
      lng: number;
      weight: number;
      area: string;
      type: 'unknown' | 'clone' | 'report';
    }> = [];

    for (const scan of this.scans) {
      if (scan.status === 'unknown') {
        points.push({
          lat: scan.lat,
          lng: scan.lng,
          weight: 1.0,
          area: scan.areaName,
          type: 'unknown',
        });
      } else if (scan.status === 'clone_suspected') {
        points.push({
          lat: scan.lat,
          lng: scan.lng,
          weight: 1.5,
          area: scan.areaName,
          type: 'clone',
        });
      }
    }

    return points;
  }

  /**
   * Returns active anomaly alerts (FR-EW-04, FR-EW-05, FR-EW-06)
   */
  public getAnomalyAlerts(statusFilter?: 'active' | 'investigating' | 'resolved'): AnomalyAlert[] {
    const list = Array.from(this.alerts.values());
    if (statusFilter) {
      return list.filter((a) => a.status === statusFilter);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Turn alert into investigation (FR-EW-07)
   */
  public turnAlertIntoInvestigation(
    alertId: string,
    notes?: string,
    inspector?: string
  ): InvestigationRecord {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert with id ${alertId} not found`);
    }

    const investigationId = crypto.randomUUID();
    const record: InvestigationRecord = {
      id: investigationId,
      alertId,
      rule: alert.rule,
      batchId: alert.batchId,
      batchNumber: alert.batchNumber,
      area: alert.area,
      status: 'investigating',
      notes: notes || `Investigation initiated by EFDA Rapid Response Unit for ${alert.title}. Inspection team dispatched to ${alert.area}.`,
      assignedInspector: inspector || 'EFDA Inspectorate Lead (Addis Ababa)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    alert.status = 'investigating';
    alert.investigationId = investigationId;

    this.investigations.set(investigationId, record);
    return record;
  }

  /**
   * One-click recall triggered from alert or investigation (FR-EW-07 / extends FR-RR-06)
   */
  public triggerOneClickRecall(
    alertId: string,
    reason?: string
  ): { alert: AnomalyAlert; recallInitiated: boolean; batchId: number } {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert with id ${alertId} not found`);
    }

    const batchId = alert.batchId || 1;
    const effectiveReason =
      reason ||
      `Rapid safety recall triggered from ${alert.rule} counterfeit anomaly: ${alert.title}`;

    // Initiates recall in the compliance engine (sets 48h deadline on-chain/in cache)
    recallComplianceService.recallBatch(batchId, 'ClassI', effectiveReason);

    alert.status = 'resolved';
    if (alert.investigationId && this.investigations.has(alert.investigationId)) {
      const inv = this.investigations.get(alert.investigationId)!;
      inv.status = 'recalled';
      inv.notes += ` | Recalled on-chain at ${new Date().toISOString()}`;
      inv.updatedAt = new Date().toISOString();
    }

    return {
      alert,
      recallInitiated: true,
      batchId,
    };
  }

  public getInvestigations(): InvestigationRecord[] {
    return Array.from(this.investigations.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Public Read-Only "Safety Pulse" (FR-EW-08):
   * Strictly aggregate metrics only. ZERO individual scans or pack-level details exposed.
   */
  public getPublicSafetyPulse(): PublicSafetyPulse {
    let totalScans = this.scans.length;
    let genuineScans = this.scans.filter((s) => s.status === 'genuine').length;
    let interventionsActive = Array.from(this.alerts.values()).filter(
      (a) => a.status === 'active' || a.status === 'investigating'
    ).length;

    const cells = this.getGeoCells();

    return {
      disclaimer: 'Public safety aggregate summary. No individual scans, device IDs, or pack serial numbers are disclosed.',
      period: 'Last 24 Hours (Real-Time)',
      totalScans,
      genuineScans,
      interventionsActive,
      monitoredZonesCount: cells.length,
      updatedAt: new Date().toISOString(),
    };
  }

  public clearAll() {
    this.scans = [];
    this.alerts.clear();
    this.investigations.clear();
    this.salesRegistry.clear();
  }

  /**
   * Seed demo data reproducing clone attack and fake-QR cluster scenarios (Section 10 Demo steps)
   */
  public seedDemoData() {
    this.clearAll();


    const now = new Date().getTime();
    const h = (hoursAgo: number) => new Date(now - hoursAgo * 3600 * 1000).toISOString();

    // 1. Legitimate genuine baseline scans across Addis Ababa
    this.logScan({
      batchId: 1,
      batchNumber: 'ET-AMOX-001',
      serialNumber: 'SN-ET-00123',
      channel: 'web',
      status: 'sold',
      lat: 9.035, // Arada
      lng: 38.752,
      rawDeviceId: 'dev-arada-dispenser-01',
      pharmacyId: '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
      pharmacyName: 'Arada Central Pharmacy',
      customTime: h(12),
    });

    for (let i = 1; i <= 8; i++) {
      this.logScan({
        batchId: 1,
        batchNumber: 'ET-AMOX-001',
        serialNumber: `SN-GENUINE-BOLE-${i}`,
        channel: 'telegram',
        status: 'genuine',
        lat: 9.002 + (i % 3) * 0.005,
        lng: 38.785 + (i % 2) * 0.004,
        rawDeviceId: `patient-phone-gen-${i}`,
        pharmacyName: 'Bole Med-Plus Pharmacy',
        customTime: h(6 - (i % 4)),
      });
    }

    // 2. Demo Step 4: Fake QR Unknown Spike in Merkato (Triggers Rule R4)
    // 12 Unknown scans on batch ET-AMOX-FAKE (>10 threshold)
    for (let i = 1; i <= 12; i++) {
      this.logScan({
        batchId: 999,
        batchNumber: 'ET-AMOX-FAKE',
        channel: 'telegram',
        status: 'unknown',
        lat: 9.028 + (i % 3) * 0.002, // Merkato center
        lng: 38.736 + (i % 2) * 0.003,
        rawDeviceId: `merkato-shopper-device-${i}`,
        customTime: h(4),
      });
    }

    // 3. Demo Step 4: Geographic Cluster in Bole within 5 km (Triggers Rule R5)
    // 4 distinct devices reporting unknown codes in Bole
    const boleClusterCoords = [
      { lat: 9.003, lng: 38.784 },
      { lat: 9.005, lng: 38.788 },
      { lat: 9.001, lng: 38.782 },
      { lat: 9.006, lng: 38.789 },
    ];
    for (let i = 0; i < boleClusterCoords.length; i++) {
      this.logScan({
        channel: 'web',
        status: 'unknown',
        lat: boleClusterCoords[i].lat,
        lng: boleClusterCoords[i].lng,
        rawDeviceId: `cluster-unique-device-${i + 101}`,
        customTime: h(2),
      });
    }

    // 4. Demo Step 3: Clone attack scan (Triggers Rule R6)
    // Photocopied QR serial SN-ET-00123 (sold earlier in Arada) scanned at Bole Med-Plus
    this.logScan({
      batchId: 1,
      batchNumber: 'ET-AMOX-001',
      serialNumber: 'SN-ET-00123',
      channel: 'web',
      status: 'clone_suspected',
      lat: 9.002,
      lng: 38.785,
      rawDeviceId: 'patient-counter-bole-99',
      pharmacyId: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
      pharmacyName: 'Bole Med-Plus Community Pharmacy',
      customTime: h(1),
    });
  }
}

export const earlyWarningService = new EarlyWarningService();
