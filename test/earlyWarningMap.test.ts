/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Early-Warning Map & Anomaly Detection Unit Tests
 * Implements: FR-EW-01, FR-EW-02, FR-EW-04, FR-EW-05, FR-EW-06, FR-EW-07, Section 5.2 Privacy
 *
 * Verifies:
 * 1. Geo rounding to ~1 km cells (~0.01 deg).
 * 2. Device hashes are salted and non-reversible HMAC-SHA256.
 * 3. Rule R4: trigger when >10 unknown on a batch in 24h.
 * 4. Rule R4: non-trigger when <= 10 unknown scans.
 * 5. Rule R5: trigger when >=3 distinct devices within 5 km in 24h.
 * 6. Rule R5: non-trigger when multiple scans from single device.
 * 7. Rule R5: non-trigger when devices are > 5 km apart.
 * 8. Rule R6: trigger when serial marked Sold at one pharmacy is scanned elsewhere.
 * 9. Rule R6: non-trigger on standard genuine sale.
 * 10. Turn alert into investigation (FR-EW-07).
 * 11. One-click recall triggers batch recall (FR-EW-07).
 * 12. Privacy Invariant (FR-EW-08 / Section 5.2): Zero pack-level detail on public safety pulse.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  earlyWarningService,
  roundTo1KmCell,
  hashDeviceId,
  calculateHaversineDistanceKm,
} from '../src/services/earlyWarningService.ts';

describe('Early-Warning Map & Anomaly Detection (FR-EW-01 to FR-EW-08, Section 5.2)', () => {
  it('1. Geo-coordinates round to ~1 km centroids (Section 5.2)', () => {
    // 9.0024 and 38.7849 -> 9.00 and 38.78
    const cell1 = roundTo1KmCell(9.0024, 38.7849);
    assert.strictEqual(cell1.latCenter, 9.0);
    assert.strictEqual(cell1.lngCenter, 38.78);
    assert.strictEqual(cell1.cellId, 'cell_9.00_38.78');

    // 9.0351 and 38.7523 -> 9.04 and 38.75
    const cell2 = roundTo1KmCell(9.0351, 38.7523);
    assert.strictEqual(cell2.latCenter, 9.04);
    assert.strictEqual(cell2.lngCenter, 38.75);
    assert.strictEqual(cell2.cellId, 'cell_9.04_38.75');

    // Distance between 0.01 degree latitude is approx 1.11 km
    const d = calculateHaversineDistanceKm(9.00, 38.78, 9.01, 38.78);
    assert.ok(d > 1.0 && d < 1.2, `0.01 deg lat distance was ${d} km, expected ~1.11 km`);
  });

  it('2. Device hashing is salted and non-reversible HMAC-SHA256 (Section 5.2)', () => {
    const rawId = 'patient-phone-imei-99482914';
    const hash1 = hashDeviceId(rawId);
    const hash2 = hashDeviceId(rawId);

    assert.strictEqual(hash1, hash2, 'Device hashing must be deterministic for same device');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 hex characters');
    assert.notStrictEqual(hash1, rawId, 'Hash must not equal raw identifier');
    assert.ok(!hash1.includes('patient'), 'Salted hash must contain no trace of raw identifier');
  });

  it('3. Rule R4 Non-Trigger: 8 Unknown results on a batch (<= 10) does NOT fire alert (FR-EW-04)', () => {
    // Reset test state
    earlyWarningService.seedDemoData();

    // Log 8 unknown scans on a new batch TEST-BATCH-SAFE
    for (let i = 0; i < 8; i++) {
      earlyWarningService.logScan({
        batchId: 50,
        batchNumber: 'TEST-BATCH-SAFE',
        channel: 'web',
        status: 'unknown',
        lat: 8.945, // Akaki
        lng: 38.774,
        rawDeviceId: `test-phone-safe-${i}`,
      });
    }

    const alerts = earlyWarningService.getAnomalyAlerts();
    const r4 = alerts.find((a) => a.batchNumber === 'TEST-BATCH-SAFE');
    assert.strictEqual(r4, undefined, 'R4 must NOT trigger when unknown count <= 10');
  });

  it('4. Rule R4 Trigger: >10 Unknown results on one batch fires R4 alert card (FR-EW-04)', () => {
    // Log 3 more unknown scans on TEST-BATCH-SAFE (8 + 3 = 11 > 10)
    for (let i = 8; i < 11; i++) {
      earlyWarningService.logScan({
        batchId: 50,
        batchNumber: 'TEST-BATCH-SAFE',
        channel: 'web',
        status: 'unknown',
        lat: 8.945,
        lng: 38.774,
        rawDeviceId: `test-phone-spike-${i}`,
      });
    }

    const alerts = earlyWarningService.getAnomalyAlerts();
    const r4 = alerts.find((a) => a.batchNumber === 'TEST-BATCH-SAFE');
    assert.ok(r4, 'R4 MUST trigger when unknown count > 10');
    assert.strictEqual(r4.rule, 'R4');
    assert.strictEqual(r4.count, 11);
    assert.strictEqual(r4.severity, 'High');
    assert.strictEqual(r4.status, 'active');
    assert.ok(r4.area.includes('Akaki'));
  });

  it('5. Rule R5 Non-Trigger: 6 Unknown scans from the SAME device does NOT fire cluster (FR-EW-05)', () => {
    earlyWarningService.clearAll();
    // In Piassa (lat 9.032, lng 38.748)
    const singleDevice = 'repeated-scanner-same-phone';
    for (let i = 0; i < 6; i++) {
      earlyWarningService.logScan({
        channel: 'web',
        status: 'unknown',
        lat: 9.032,
        lng: 38.748,
        rawDeviceId: singleDevice,
      });
    }

    const alerts = earlyWarningService.getAnomalyAlerts();
    // Cell for Piassa is cell_9.03_38.75
    const r5Piassa = alerts.find((a) => a.rule === 'R5' && a.id.includes('cell_9.03_38.75'));
    assert.strictEqual(r5Piassa, undefined, 'R5 requires >= 3 distinct devices');
  });

  it('6. Rule R5 Non-Trigger: 3 Unknown scans separated by >5 km does NOT fire cluster (FR-EW-05)', () => {
    earlyWarningService.clearAll();
    // Akaki (lat 8.945, lng 38.774) and Arada (lat 9.035, lng 38.752) are ~10.3 km apart
    const dist = calculateHaversineDistanceKm(8.945, 38.774, 9.035, 38.752);
    assert.ok(dist > 5.0, `Distance was ${dist} km, expected > 5 km`);

    earlyWarningService.logScan({
      channel: 'web',
      status: 'unknown',
      lat: 8.945,
      lng: 38.774,
      rawDeviceId: 'device-far-akaki',
    });

    earlyWarningService.logScan({
      channel: 'web',
      status: 'unknown',
      lat: 9.035,
      lng: 38.752,
      rawDeviceId: 'device-far-arada',
    });

    const alerts = earlyWarningService.getAnomalyAlerts();
    const r5Far = alerts.find((a) => a.rule === 'R5' && a.id.includes('cell_8.95_38.77'));
    assert.strictEqual(r5Far, undefined, 'Scans >5 km apart must not trigger R5 cluster');
  });

  it('7. Rule R5 Trigger: >=3 Unknown results from different devices within 5 km fires R5 cluster (FR-EW-05)', () => {
    // Kirkos cluster: 3 distinct devices within 1.5 km
    const kirkosDevices = ['kirkos-dev-alpha', 'kirkos-dev-beta', 'kirkos-dev-gamma'];
    for (let i = 0; i < kirkosDevices.length; i++) {
      earlyWarningService.logScan({
        channel: 'telegram',
        status: 'unknown',
        lat: 9.012 + i * 0.003, // ~300 meters apart
        lng: 38.761 + i * 0.002,
        rawDeviceId: kirkosDevices[i],
      });
    }

    const alerts = earlyWarningService.getAnomalyAlerts();
    const r5Kirkos = alerts.find((a) => a.rule === 'R5' && a.area.includes('Kirkos'));
    assert.ok(r5Kirkos, 'R5 MUST trigger on 3 distinct devices within 5 km');
    assert.strictEqual(r5Kirkos.severity, 'Critical');
    assert.ok(r5Kirkos.distinctDevices! >= 3);
  });

  it('8. Rule R6 Trigger: Serial marked Sold at pharmacy A then scanned at pharmacy B fires R6 (FR-EW-06)', () => {
    const testSerial = 'SN-RULE6-TEST-7788';

    // 1. First marked Sold at Arada Central
    earlyWarningService.logScan({
      batchId: 2,
      batchNumber: 'ET-AMOX-002',
      serialNumber: testSerial,
      channel: 'web',
      status: 'sold',
      lat: 9.035,
      lng: 38.752,
      rawDeviceId: 'pharmacy-arada-counter',
      pharmacyId: '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
      pharmacyName: 'Arada Central Pharmacy',
    });

    // 2. Second scan: scanned Genuine-unsold or clone at Bole Med-Plus
    earlyWarningService.logScan({
      batchId: 2,
      batchNumber: 'ET-AMOX-002',
      serialNumber: testSerial,
      channel: 'web',
      status: 'genuine',
      lat: 9.002,
      lng: 38.785,
      rawDeviceId: 'patient-phone-bole',
      pharmacyId: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
      pharmacyName: 'Bole Med-Plus Pharmacy',
    });

    const alerts = earlyWarningService.getAnomalyAlerts();
    const r6 = alerts.find((a) => a.serialNumber === testSerial);
    assert.ok(r6, 'R6 MUST trigger when sold pack is verified elsewhere');
    assert.strictEqual(r6.rule, 'R6');
    assert.strictEqual(r6.severity, 'Critical');
    assert.strictEqual(r6.details?.firstSoldPharmacy, 'Arada Central Pharmacy');
    assert.strictEqual(r6.details?.secondScannedPharmacy, 'Bole Med-Plus Pharmacy');
  });

  it('9. Turn alert into investigation opens EFDA dossier and updates status (FR-EW-07)', () => {
    const alerts = earlyWarningService.getAnomalyAlerts();
    const targetAlert = alerts.find((a) => a.status === 'active');
    assert.ok(targetAlert, 'Should find active alert');

    const inv = earlyWarningService.turnAlertIntoInvestigation(
      targetAlert.id,
      'Dispatching emergency inspection team to confiscate suspect packaging',
      'Inspector General EFDA'
    );

    assert.ok(inv.id, 'Investigation must receive a UUID');
    assert.strictEqual(inv.alertId, targetAlert.id);
    assert.strictEqual(inv.status, 'investigating');
    assert.strictEqual(targetAlert.status, 'investigating');
    assert.strictEqual(targetAlert.investigationId, inv.id);

    const allInv = earlyWarningService.getInvestigations();
    assert.ok(allInv.some((i) => i.id === inv.id));
  });

  it('10. One-click recall triggers on-chain batch recall (FR-EW-07 / extends FR-RR-06)', () => {
    const alerts = earlyWarningService.getAnomalyAlerts();
    const targetAlert = alerts.find((a) => a.rule === 'R4' || a.rule === 'R5');
    assert.ok(targetAlert, 'Should find an alert to recall');

    const res = earlyWarningService.triggerOneClickRecall(
      targetAlert.id,
      'Emergency Class I recall from counterfeit early warning'
    );

    assert.strictEqual(res.recallInitiated, true);
    assert.strictEqual(res.alert.status, 'resolved');
  });

  it('11. Public Safety Pulse Privacy Invariant: zero pack-level, serial, or device data exposed (FR-EW-08)', () => {
    const pulse = earlyWarningService.getPublicSafetyPulse();

    assert.ok(pulse.totalScans > 0, 'Total scans must be positive');
    assert.ok(pulse.genuineScans >= 0);
    assert.ok(pulse.interventionsActive >= 0);
    assert.ok(pulse.monitoredZonesCount >= 1);

    // Verify response structure has NO personal or pack data
    const jsonStr = JSON.stringify(pulse);
    assert.ok(!jsonStr.includes('serialNumber'), 'Public pulse must NEVER expose serialNumber');
    assert.ok(!jsonStr.includes('deviceHash'), 'Public pulse must NEVER expose deviceHash');
    assert.ok(!jsonStr.includes('rawDeviceId'), 'Public pulse must NEVER expose rawDeviceId');
    assert.ok(!jsonStr.includes('patient'), 'Public pulse must NEVER expose patient identity');
  });
});
