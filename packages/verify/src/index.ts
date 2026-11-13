/**
 * @license SPDX-License-Identifier: Apache-2.0
 * MediTrust Shared Verification Library
 * Entry point for PWA, Bot, and SMS Verification services
 */

export type {
  PackStatus,
  ParsedQRPayload,
  StatusPresentation,
  NationalRegistryResult,
  VerificationResult,
  RegistryCheckOptions,
  VerifyOptions,
} from './types.ts';

export { InvalidQRError, parseQRPayload } from './parser.ts';
export { STATUS_PRESENTATION_MAP } from './presentation.ts';
export { checkNationalRegistry } from './registryHook.ts';
export {
  verifyPack,
  mapContractStatus,
  simulateDeterministicVerification,
  ESSENTIAL_MEDICINES_CATALOG,
} from './verifier.ts';
