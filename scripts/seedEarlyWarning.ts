/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Early-Warning Demo Seed Script
 * Implements: Section 10 Demo Scenarios (Fake QR spike, Cluster, Clone attack)
 */

import { earlyWarningService } from '../src/services/earlyWarningService.ts';

async function main() {
  console.log('--- Seeding Counterfeit Early-Warning Map Demo Scenarios ---');
  earlyWarningService.seedDemoData();

  const cells = earlyWarningService.getGeoCells();
  const alerts = earlyWarningService.getAnomalyAlerts();
  const pulse = earlyWarningService.getPublicSafetyPulse();

  console.log(`\n✔ Geo-Cells Aggregated: ${cells.length} cells (~1.1 km resolution)`);
  for (const cell of cells) {
    console.log(
      `  - [${cell.cellId}] ${cell.areaName}: Total ${cell.totalCount} (Unknown: ${cell.unknownCount}, Clones: ${cell.cloneCount}, Genuine: ${cell.genuineCount})`
    );
  }

  console.log(`\n✔ Active Anomaly Alert Cards Generated: ${alerts.length}`);
  for (const alert of alerts) {
    console.log(`  - [Rule ${alert.rule}] ${alert.title}`);
    console.log(`    Area: ${alert.area} | Severity: ${alert.severity} | Status: ${alert.status}`);
    console.log(`    Detail: ${alert.descriptionEn}`);
  }

  console.log(`\n✔ Public Safety Pulse (Zero Pack-Level Detail):`);
  console.log(`  - Period: ${pulse.period}`);
  console.log(`  - Total Scans Today: ${pulse.totalScans}`);
  console.log(`  - Safe Genuine Packs: ${pulse.genuineScans}`);
  console.log(`  - Active Interventions: ${pulse.interventionsActive}`);
  console.log(`  - Disclaimer: ${pulse.disclaimer}`);

  console.log('\n--- Seed Finished Successfully ---');
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
