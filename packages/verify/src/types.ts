/**
 * @license SPDX-License-Identifier: Apache-2.0
 * MediTrust Shared Verification Types
 * Implements: FR-VA-09, NFR-24, FR-VA-03, FR-IO-04
 */

export type PackStatus =
  | 'genuine'
  | 'sold'
  | 'recalled'
  | 'expired'
  | 'unknown'
  | 'clone_suspected';

export interface ParsedQRPayload {
  raw: string;
  batchId: bigint;
  serialNumber: string;
  secretCode?: string;
  serialHash: `0x${string}`;
  proof: `0x${string}`[];
  format: 'url' | 'delimited' | 'json' | 'sms_syntax';
}

export interface StatusPresentation {
  status: PackStatus;
  emoji: string;
  badgeClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  i18nKey: string;
  titleEn: string;
  titleAm: string;
  shortSentenceEn: string;
  shortSentenceAm: string;
  actionEn: string;
  actionAm: string;
}

export interface NationalRegistryResult {
  registered: boolean;
  status: 'confirmed' | 'unavailable' | 'unregistered';
  registryName?: string;
  nationalDrugCode?: string;
  checkedAt: string;
  isSimulated: boolean; // Hard rule 6: simulated items clearly labeled
}

export interface VerificationResult {
  status: PackStatus;
  productName: string;
  batchNumber: string;
  batchId: string;
  serialNumber: string;
  expiry: number; // unix timestamp in seconds
  expiryFormatted: string;
  reason: string;
  isRecalled: boolean;
  isSold: boolean;
  isCloneSuspected: boolean;
  presentation: StatusPresentation;
  nationalRegistry?: NationalRegistryResult;
  timestamp: number;
}

export interface RegistryCheckOptions {
  timeoutMs?: number;
  registryEndpoint?: string;
  customFetcher?: (gtin: string, batchNumber: string) => Promise<{ registered: boolean; nationalDrugCode?: string }>;
}

export interface VerifyOptions {
  contractAddress?: `0x${string}`;
  rpcUrl?: string;
  publicClient?: any;
  checkRegistry?: boolean;
  registryOptions?: RegistryCheckOptions;
  // Fallback simulator for offline or contract-less testing
  mockDatabaseFallback?: boolean;
}
