/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Contract Connection & Typed Helpers (Task 4)
 * Exports contract address (from env), ABI, typed read/write helpers, and useRole(address) hook.
 */

import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, http, keccak256, toHex, encodePacked, Address } from 'viem';
import { targetChain } from './chains.ts';
import mediTrustAbiJson from './abi/MediTrust.json' with { type: 'json' };

export const mediTrustAbi = mediTrustAbiJson;

export const contractAddress: Address = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  (typeof window !== 'undefined' && (window as any).__ENV__?.NEXT_PUBLIC_CONTRACT_ADDRESS) ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3'
) as Address;

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';

// Public read-only client created from NEXT_PUBLIC_RPC_URL (works with zero login)
export const readOnlyPublicClient = createPublicClient({
  chain: targetChain,
  transport: http(rpcUrl),
});

// Role hashes corresponding to MediTrust.sol AccessControl
export const ROLES = {
  ADMIN: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
  REGULATOR: keccak256(toHex('REGULATOR_ROLE')),
  MANUFACTURER: keccak256(toHex('MANUFACTURER_ROLE')),
  DISTRIBUTOR: keccak256(toHex('DISTRIBUTOR_ROLE')),
  PHARMACY: keccak256(toHex('PHARMACY_ROLE')),
};

export type UserRole = 'Admin' | 'Regulator' | 'Manufacturer' | 'Distributor' | 'Pharmacy' | 'Public';

export interface VerifyPackOnChainResult {
  status: number;
  gtin: string;
  batchNumber: string;
  expiryDate: bigint;
  isRecalled: boolean;
  isSold: boolean;
  isCloneSuspected: boolean;
}

/**
 * Typed Read Helper: verifyPack
 */
export async function verifyPackOnChain(
  batchId: bigint,
  serialHash: `0x${string}`,
  merkleProof: `0x${string}`[] = []
): Promise<VerifyPackOnChainResult> {
  const result: any = await readOnlyPublicClient.readContract({
    address: contractAddress,
    abi: mediTrustAbi,
    functionName: 'verifyPack',
    args: [batchId, serialHash, merkleProof],
  });

  return {
    status: Number(result.status),
    gtin: result.gtin,
    batchNumber: result.batchNumber,
    expiryDate: result.expiryDate,
    isRecalled: result.isRecalled,
    isSold: result.isSold,
    isCloneSuspected: result.isCloneSuspected,
  };
}

/**
 * Typed Read Helper: getBatch
 */
export async function getBatchOnChain(batchId: bigint) {
  return await readOnlyPublicClient.readContract({
    address: contractAddress,
    abi: mediTrustAbi,
    functionName: 'getBatch',
    args: [batchId],
  });
}

/**
 * Typed Read Helper: holdings
 */
export async function getHoldingsOnChain(batchId: bigint, holder: Address): Promise<number> {
  const count: any = await readOnlyPublicClient.readContract({
    address: contractAddress,
    abi: mediTrustAbi,
    functionName: 'holdings',
    args: [batchId, holder],
  });
  return Number(count);
}

/**
 * Typed Read Helper: hasRole
 */
export async function checkRoleOnChain(roleHash: `0x${string}`, account: Address): Promise<boolean> {
  try {
    const has: any = await readOnlyPublicClient.readContract({
      address: contractAddress,
      abi: mediTrustAbi,
      functionName: 'hasRole',
      args: [roleHash, account],
    });
    return Boolean(has);
  } catch {
    return false;
  }
}

/**
 * Reads all on-chain roles for an address and returns the primary role
 */
export async function getUserRoleOnChain(account?: string): Promise<UserRole> {
  if (!account || !account.startsWith('0x') || account.length !== 42) {
    return 'Public';
  }

  const addr = account as Address;

  try {
    const [isAdmin, isRegulator, isManufacturer, isDistributor, isPharmacy] = await Promise.all([
      checkRoleOnChain(ROLES.ADMIN, addr),
      checkRoleOnChain(ROLES.REGULATOR, addr),
      checkRoleOnChain(ROLES.MANUFACTURER, addr),
      checkRoleOnChain(ROLES.DISTRIBUTOR, addr),
      checkRoleOnChain(ROLES.PHARMACY, addr),
    ]);

    if (isAdmin) return 'Admin';
    if (isRegulator) return 'Regulator';
    if (isManufacturer) return 'Manufacturer';
    if (isDistributor) return 'Distributor';
    if (isPharmacy) return 'Pharmacy';
    return 'Public';
  } catch (err) {
    console.warn('Could not read role from chain, defaulting to Public:', err);
    return 'Public';
  }
}

/**
 * React Hook: useRole(address)
 * Implements Task 4: Reads on-chain roles and returns the user's role state.
 */
export function useRole(address?: string) {
  const [role, setRole] = useState<UserRole>('Public');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRole = useCallback(async () => {
    if (!address) {
      setRole('Public');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const detectedRole = await getUserRoleOnChain(address);
      setRole(detectedRole);
    } catch (err: any) {
      setError(err);
      setRole('Public');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  return {
    role,
    isAdmin: role === 'Admin',
    isRegulator: role === 'Regulator',
    isManufacturer: role === 'Manufacturer',
    isDistributor: role === 'Distributor',
    isPharmacy: role === 'Pharmacy',
    isPublic: role === 'Public',
    isLoading,
    error,
    refetch: fetchRole,
  };
}
