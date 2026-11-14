/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Privy & Wagmi Configuration Provider (Task 3)
 * Configures:
 * 1. Login methods: Email, SMS/Phone, Google, and External Wallets (MetaMask, WalletConnect)
 * 2. Embedded wallets: Created automatically for users without a wallet
 * 3. Wagmi v2 with Privy connector and target chain support
 */

import React, { ReactNode, createContext, useContext } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { createConfig } from '@privy-io/wagmi';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { supportedChains, targetChain, hardhatChain } from '../chains.ts';

// Create a stable QueryClient instance
const queryClient = new QueryClient();

// Public RPC URL from environment
const publicRpc =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (typeof window !== 'undefined' && (window as any).__ENV__?.NEXT_PUBLIC_RPC_URL) ||
  'http://127.0.0.1:8545';

// 1. Wagmi Configuration using Privy Connector
export const wagmiConfig = createConfig({
  chains: supportedChains,
  transports: {
    [targetChain.id]: http(publicRpc),
    [hardhatChain.id]: http('http://127.0.0.1:8545'),
  },
});

export interface PrivyStatusContextValue {
  isConfigured: boolean;
  rawAppId?: string;
}

export const PrivyStatusContext = createContext<PrivyStatusContextValue>({
  isConfigured: false,
});

export const usePrivyStatus = () => useContext(PrivyStatusContext);

// 25-character valid dummy cuid format so Privy SDK initializes safely
// without throwing synchronous validation errors during development.
const FALLBACK_PRIVY_APP_ID = 'cl00000000000000000000000';

interface PrivyWagmiProviderProps {
  children: ReactNode;
}

export function PrivyWagmiProvider({ children }: PrivyWagmiProviderProps) {
  const rawPrivyAppId =
    process.env.NEXT_PUBLIC_PRIVY_APP_ID ||
    (typeof window !== 'undefined' && (window as any).__ENV__?.NEXT_PUBLIC_PRIVY_APP_ID);

  const isConfigured = Boolean(
    rawPrivyAppId &&
    typeof rawPrivyAppId === 'string' &&
    rawPrivyAppId.length === 25 &&
    !rawPrivyAppId.includes('your_privy') &&
    rawPrivyAppId !== FALLBACK_PRIVY_APP_ID
  );

  // Use the real configured ID if valid 25 chars, otherwise use the 25-char fallback format
  const privyAppId = isConfigured ? (rawPrivyAppId as string) : FALLBACK_PRIVY_APP_ID;

  return (
    <PrivyStatusContext.Provider value={{ isConfigured, rawAppId: rawPrivyAppId }}>
      <PrivyProvider
        appId={privyAppId}
        config={{
          // Login options: Email, Phone/SMS, Google, and External Wallets (Task 3)
          loginMethods: ['email', 'wallet', 'google', 'sms'],
          appearance: {
            theme: 'light',
            accentColor: '#059669', // Emerald brand
            showWalletLoginFirst: false,
            walletList: ['metamask', 'wallet_connect', 'coinbase_wallet', 'rainbow', 'detected_wallets'],
          },
          // Embedded wallets created automatically for users without a Web3 wallet (Task 3)
          embeddedWallets: {
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
            requireUserPasswordOnCreate: false,
          },
          defaultChain: targetChain,
          supportedChains: supportedChains,
        }}
      >
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>
            {children}
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </PrivyStatusContext.Provider>
  );
}
