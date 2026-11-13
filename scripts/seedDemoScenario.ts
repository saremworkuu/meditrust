/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Master Seed Script for MediTrust 3-Minute Buildathon Demo Scenario
 * Implements: Section 10 (Demo Scenario Steps 1 to 7) & Section 11 (Acceptance)
 *
 * Sets up the complete synchronized demo state across all services:
 * 1. Steps 1 to 5 (v1.0 foundation): Approvals, batch registration, shipment, genuine scan, sale.
 * 2. Telegram scan (20s): Patient verifies Amoxicillin, receives green result in Amharic + voice, subscribes to recall alerts.
 * 3. Clone attack (25s): Photocopied duplicate QR presented at a second pharmacy -> duplicate sale blocked on-chain -> Early-Warning map lights up.
 * 4. Fake QR (10s): Unknown invented QR scanned -> 3+ Unknown scans clustered within 5 km in Addis Ababa -> fires Rule R5 cluster alert card.
 * 5. Recall (30s): Regulator recalls contaminated Amoxicillin batch (ETH-AMX-2026) -> patient receives instant alert -> regulator compliance view shows 2 holders Pending.
 * 6. Acknowledgement & Score (25s):
 *    - Bole Med-Plus Pharmacy acknowledges & quarantines 200 units with IPFS evidence (Gold Badge, 90 pts).
 *    - Arada Central Pharmacy fails to acknowledge and is marked Overdue on-chain (Bronze Badge, 20 pts).
 * 7. Close (10s): "Provenance tells you where it came from. MediTrust makes sure a recall reaches the patient, and the evidence can't be erased."
 */

import { recallComplianceService } from '../src/services/recallComplianceService.ts';
import { earlyWarningService } from '../src/services/earlyWarningService.ts';
import { trustScoreService } from '../src/services/trustScoreService.ts';
import { recallAlertService } from '../src/services/recallAlertService.ts';
import { nationalRegistryAdapter } from '../src/services/nationalRegistryAdapter.ts';
import { botSessionService } from '../src/services/botSessionService.ts';

export async function seedFullDemoScenario() {
  console.log('================================================================');
  console.log('   MEDITRUST: 3-MINUTE BUILDATHON DEMO MASTER SEED (SECTION 10)  ');
  console.log('================================================================');

  // --- 1. Reset & Seed Recall Compliance State (FR-RR-08, FR-RR-09) ---
  console.log('\n[1/6] Seeding Batch Recalls & Holder Compliance State...');
  recallComplianceService.seedDemo();

  // --- 2. Seed Pharmacy Trust Scores (FR-TS-01 to FR-TS-07) ---
  console.log('[2/6] Seeding Pharmacy Trust Scores (Gold vs Bronze)...');
  trustScoreService.seedDemo();

  // --- 3. Seed Counterfeit Early-Warning Map (FR-EW-01 to FR-EW-07) ---
  console.log('[3/6] Seeding Anomaly Scans, Clusters (R5), Spikes (R4), & Clones (R6)...');
  earlyWarningService.seedDemoData();

  // --- 4. Seed Patient Recall Alert Subscription & Dispatch (FR-RR-01 to FR-RR-04, NFR-21) ---
  console.log('[4/6] Seeding Patient Subscriptions & Alert Notifications...');
  // Patient subscribed to the recalled Amoxicillin batch #1 (ETH-AMX-2026) via Telegram handle
  const subResult = recallAlertService.subscribe({
    batchId: 1,
    channel: 'telegram',
    contact: '@sarem_patient_eth',
    language: 'am',
    consentGiven: true,
  });

  // Also simulate dispatch for batch #1
  const dispatchResult = await recallAlertService.dispatchRecallAlerts({
    batchId: 1,
    batchNumber: 'ETH-AMX-2026',
    reason: 'Glass particle contamination detected during post-market surveillance audit',
  });

  // --- 5. Seed Bot Session & Scan Logger (FR-VA-04, FR-VA-08) ---
  console.log('[5/6] Seeding Telegram Session & Salted Hash Scan Events...');
  botSessionService.setLanguage(987654321, 'am');
  botSessionService.logScanEvent({
    batchNumber: 'ETH-AMX-2026',
    status: 'genuine',
    channel: 'telegram',
  });

  // --- 6. Confirm National Registry Mock Online (FR-IO-01) ---
  console.log('[6/6] Verifying National Drug Registry Interoperability Adapter...');
  const regCheck = await nationalRegistryAdapter.checkRegistry({ batchNumber: 'ET-2026-MED01' });

  console.log('----------------------------------------------------------------');
  console.log('✔ Master Demo State Successfully Configured:');
  console.log(`  • Recalled Batches: 1 (ETH-AMX-2026)`);
  console.log(`  • Holders: 1 Acknowledged (Bole Med-Plus), 1 Overdue (Arada Central)`);
  console.log(`  • Trust Scores: Bole Med-Plus (Gold 90), Arada Central (Bronze 20)`);
  console.log(`  • Patient Alert: Subscribed & Dispatched (${dispatchResult.sent} alert sent via Telegram)`);
  console.log(`  • Early-Warning Map: Rule R4 (Spike), Rule R5 (Cluster), Rule R6 (Clone Attack) active`);
  console.log(`  • National Registry Mock: ${regCheck.registered ? 'Verified Connected' : 'Offline'}`);
  console.log('================================================================\n');

  return {
    success: true,
    batchId: 'ETH-AMX-2026',
    subId: subResult.subscription.id,
    sentCount: dispatchResult.sent,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedFullDemoScenario()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Demo seed failed:', err);
      process.exit(1);
    });
}
