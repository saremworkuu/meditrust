/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Stub for @solana/kit to supply missing exports required by @solana-program/system in Vite builds.
 * MediTrust uses EVM (Ethereum / Hardhat), so Solana program calls are never executed at runtime.
 */

export * from '../../node_modules/@solana/kit/dist/index.browser.mjs';

export const SOLANA_ERROR__PROGRAM_CLIENTS__INSUFFICIENT_ACCOUNT_METAS = 1001;
export const SOLANA_ERROR__PROGRAM_CLIENTS__FAILED_TO_IDENTIFY_INSTRUCTION = 1002;
export const SOLANA_ERROR__PROGRAM_CLIENTS__UNRECOGNIZED_INSTRUCTION_TYPE = 1003;
export const extendClient = (..._args: any[]) => ({});
