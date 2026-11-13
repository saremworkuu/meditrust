/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Seed script for Step 3 Regulator Recall Compliance View (FR-RR-08, Section 10 Demo Scene)
 * Sets up 1 recalled batch with 2 holders (both Pending).
 */

import { recallComplianceService } from '../src/services/recallComplianceService.ts';

async function main() {
  console.log('--- Seeding Recall Compliance Demo State (FR-RR-08, Section 10) ---');

  recallComplianceService.seedDemo();

  const summaries = recallComplianceService.getBatchSummaries();
  console.log(`Successfully seeded ${summaries.length} recalled batch:`);

  for (const b of summaries) {
    console.log(`\n📦 Batch #${b.batchId} (${b.batchNumber}) - ${b.productName}`);
    console.log(`   Severity: ${b.severity} | Reason: ${b.recallReason}`);
    console.log(`   Recalled At: ${b.recalledAt}`);
    console.log(`   Deadline: ${b.deadlineAt}`);
    console.log(`   Total Held: ${b.totalHeld} units | Quarantined: ${b.totalQuarantined} units (${b.compliancePercentage}%)`);
    console.log(`   Holders Compliance Status:`);

    for (const h of b.holders) {
      const statusIcon = h.status === 'Pending' ? '⏳' : h.status === 'Acknowledged' ? '✅' : '⚠️';
      console.log(`     ${statusIcon} [${h.status}] ${h.holderName} (${h.holderRole})`);
      console.log(`        Address: ${h.holder}`);
      console.log(`        Stock: ${h.qtyQuarantined}/${h.qtyHeld} units quarantined`);
    }
  }

  const banners = recallComplianceService.getBanners();
  console.log(`\nActive Dashboard Banners for Non-Compliant Holders (FR-RR-10): ${banners.length}`);
  for (const banner of banners) {
    console.log(`   🚨 [${banner.holder}] ${banner.messageEn}`);
  }

  console.log('\nSeed state ready for demo scenario verification.');
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
