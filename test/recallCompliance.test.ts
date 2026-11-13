/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Step 3 Test Suite: Recall Compliance Cache & Regulator View
 * Implements: FR-RR-08, FR-RR-09, FR-RR-10, Section 7.1
 */

import assert from 'node:assert';
import { recallComplianceService } from '../src/services/recallComplianceService.ts';

async function runStep3Tests() {
  console.log('--- Starting Step 3: Recall Compliance Cache & Regulator View Tests ---');

  // 1. Test Seed Script & Initial Compliance View (FR-RR-08)
  recallComplianceService.seedDemo();
  const summaries = recallComplianceService.getBatchSummaries();

  assert.strictEqual(summaries.length, 1, 'Should have exactly 1 recalled batch in demo seed');
  const batch1 = summaries[0];
  assert.strictEqual(batch1.batchId, 1);
  assert.strictEqual(batch1.batchNumber, 'ET-2026-MED01');
  assert.strictEqual(batch1.totalHolders, 2);
  assert.strictEqual(batch1.pendingHolders, 2, 'Both holders must start in Pending status');
  assert.strictEqual(batch1.acknowledgedHolders, 0);
  assert.strictEqual(batch1.overdueHolders, 0);
  assert.strictEqual(batch1.totalHeld, 700);
  assert.strictEqual(batch1.totalQuarantined, 0);
  assert.strictEqual(batch1.compliancePercentage, 0);
  console.log('✔ FR-RR-08 Seed: 1 recalled batch initialized with 2 Pending holders (500 + 200 units)');

  // 2. Test Dashboard Banners for Non-Compliant Holders (FR-RR-10)
  const initialBanners = recallComplianceService.getBanners();
  assert.strictEqual(initialBanners.length, 2, 'Should generate dashboard banners for both pending holders');

  const h1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const h2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

  const h1Banners = recallComplianceService.getBanners(h1);
  assert.strictEqual(h1Banners.length, 1);
  assert(h1Banners[0].messageEn.includes('Batch #1'));
  console.log('✔ FR-RR-10: Persistent dashboard banners generated for pending holders');

  // 3. Test Quarantine Acknowledgement (FR-RR-06, FR-RR-07)
  // Holder 2 (Pharmacy) acknowledges 200 units
  const ackRecord = recallComplianceService.acknowledgeRecall(
    1,
    h2,
    200,
    'ipfs://bafybeihjklmedi7evidencequarantine'
  );
  assert.strictEqual(ackRecord.status, 'Acknowledged');
  assert.strictEqual(ackRecord.qtyQuarantined, 200);
  assert.strictEqual(ackRecord.evidenceCid, 'ipfs://bafybeihjklmedi7evidencequarantine');
  assert(ackRecord.ackedAt !== undefined);

  // Check updated summaries
  const summariesAfterAck = recallComplianceService.getBatchSummaries()[0];
  assert.strictEqual(summariesAfterAck.pendingHolders, 1);
  assert.strictEqual(summariesAfterAck.acknowledgedHolders, 1);
  assert.strictEqual(summariesAfterAck.totalQuarantined, 200);
  assert.strictEqual(summariesAfterAck.compliancePercentage, 29); // 200 / 700 = 28.57% -> 29%
  console.log('✔ FR-RR-06 & FR-RR-07: Holder quarantine acknowledgement recorded with IPFS evidence');

  // 4. Test Rule 2: Cannot exceed recorded holdings
  assert.throws(
    () => recallComplianceService.acknowledgeRecall(1, h1, 501, 'ipfs://evidence-exceed'),
    /exceeds recorded holdings/
  );
  console.log('✔ Rule 2 Enforced: Acknowledgement exceeding holdings correctly rejected');

  // 5. Test Rule 3: Subsequent acknowledgement must increase quarantined stock
  assert.throws(
    () => recallComplianceService.acknowledgeRecall(1, h2, 200, 'ipfs://evidence-double'),
    /strictly increase/
  );
  console.log('✔ Rule 3 Enforced: Non-increasing second acknowledgement rejected');

  // 6. Test Rule 4: Mark Overdue (FR-RR-09)
  // Holder 2 already acknowledged, so marking overdue should fail
  assert.throws(
    () => recallComplianceService.markOverdue(1, h2),
    /already acknowledged/
  );
  console.log('✔ Rule 4 Enforced: Cannot mark overdue a holder that already acknowledged');

  // Mark Holder 1 (Distributor) overdue
  const overdueRecord = recallComplianceService.markOverdue(1, h1);
  assert.strictEqual(overdueRecord.status, 'Overdue');
  assert(overdueRecord.overdueAt !== undefined);

  const summariesAfterOverdue = recallComplianceService.getBatchSummaries()[0];
  assert.strictEqual(summariesAfterOverdue.pendingHolders, 0);
  assert.strictEqual(summariesAfterOverdue.acknowledgedHolders, 1);
  assert.strictEqual(summariesAfterOverdue.overdueHolders, 1);
  console.log('✔ FR-RR-09: Non-compliant holder marked Overdue after deadline');

  // 7. Verify banners update accordingly
  const h2BannersAfterAck = recallComplianceService.getBanners(h2);
  assert.strictEqual(h2BannersAfterAck.length, 0, 'Acknowledged holder should have no pending banners');

  const h1BannersAfterOverdue = recallComplianceService.getBanners(h1);
  assert.strictEqual(h1BannersAfterOverdue.length, 1);
  assert(h1BannersAfterOverdue[0].messageEn.includes('OVERDUE NOTICE'));
  console.log('✔ FR-RR-10: Overdue holder receives escalated overdue warning banner');

  console.log('\nAll Step 3 Recall Compliance Tests PASSED (7 test cases).');
}

runStep3Tests().catch((err) => {
  console.error('Step 3 tests failed:', err);
  process.exit(1);
});
