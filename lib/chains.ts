/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Chain Configuration (Task 2)
 * Defines the target EVM chain from environment variables, with full support for Hardhat (31337).
 */

import { defineChain, Chain } from 'viem';

// Read raw environment safely across Node and client
const rawChainId = process.env.NEXT_PUBLIC_CHAIN_ID || '31337';
const rawRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL || 'http://127.0.0.1:8545';
const rawExplorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://sepolia.etherscan.io';

const targetChainId = parseInt(rawChainId, 10);

// 1. Local Hardhat Chain Definition (31337)
export const hardhatChain: Chain = defineChain({
  id: 31337,
  name: 'Hardhat Local',
  nativeCurrency: {
    decimals: 18,
    name: 'Hardhat Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
    public: {
      http: ['http://127.0.0.1:8545'],
    },
  },
  testnet: true,
});

// 2. Dynamic Target Chain from Environment
export const targetChain: Chain =
  targetChainId === 31337
    ? hardhatChain
    : defineChain({
        id: targetChainId,
        name: targetChainId === 11155111 ? 'Ethereum Sepolia' : targetChainId === 84532 ? 'Base Sepolia' : `Chain #${targetChainId}`,
        nativeCurrency: {
          decimals: 18,
          name: 'Ether',
          symbol: 'ETH',
        },
        rpcUrls: {
          default: {
            http: [rawRpcUrl],
          },
          public: {
            http: [rawRpcUrl],
          },
        },
        blockExplorers: {
          default: {
            name: 'Explorer',
            url: rawExplorerUrl,
          },
        },
        testnet: targetChainId !== 1,
      });

// Array of supported chains for wagmi / Privy
export const supportedChains: [Chain, ...Chain[]] =
  targetChain.id === hardhatChain.id
    ? [hardhatChain]
    : [targetChain, hardhatChain];

export function getTargetChain(): Chain {
  return targetChain;
}

export function getTargetChainId(): number {
  return targetChain.id;
}

export function isSupportedChain(chainId?: number): boolean {
  if (!chainId) return false;
  return supportedChains.some((c) => c.id === chainId);
}
