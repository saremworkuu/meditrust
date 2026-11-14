/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Script to export MediTrust ABI to frontend/lib/abi/MediTrust.json
 * Implements Task 4: npm run export-abi
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const artifactPath = path.join(
  rootDir,
  'artifacts',
  'contracts',
  'MediTrust.sol',
  'MediTrust.json'
);

if (!fs.existsSync(artifactPath)) {
  console.error(`❌ Artifact not found at ${artifactPath}. Run 'npm run compile:contracts' first.`);
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const abi = artifact.abi;

// Export destinations
const targets = [
  path.join(rootDir, 'frontend', 'lib', 'abi', 'MediTrust.json'),
  path.join(rootDir, 'lib', 'abi', 'MediTrust.json'),
  path.join(rootDir, 'src', 'contracts', 'MediTrustAbi.json'),
];

targets.forEach((targetPath) => {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(targetPath, JSON.stringify(abi, null, 2), 'utf8');
  console.log(`✔ Exported MediTrust ABI to: ${targetPath}`);
});

console.log('✅ ABI export completed successfully.');
