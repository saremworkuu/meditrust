/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Wrong Network Alert Banner (Task 3)
 * Displays a prominent banner when the user's connected wallet is on the wrong chain,
 * providing a 1-click "Switch network" button.
 */

import React from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { targetChain } from '../../lib/chains.ts';

interface WrongNetworkBannerProps {
  lang: 'en' | 'am';
}

export function WrongNetworkBanner({ lang }: WrongNetworkBannerProps) {
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  // If not connected or already on target chain, don't show banner
  if (!isConnected || currentChainId === targetChain.id) {
    return null;
  }

  const handleSwitch = () => {
    switchChain({ chainId: targetChain.id });
  };

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-semibold shadow-md flex items-center justify-between z-40 border-b border-amber-600">
      <div className="flex items-center space-x-2">
        <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950 animate-bounce" />
        <span>
          {lang === 'am'
            ? `የተሳሳተ ኔትወርክ፡ የተገናኙት ከቻይን #${currentChainId} ጋር ነው። እባክዎ ወደ ${targetChain.name} (Chain ID ${targetChain.id}) ይቀይሩ።`
            : `Wrong Network: Connected to Chain #${currentChainId}. Please switch to ${targetChain.name} (Chain ID ${targetChain.id}).`}
        </span>
      </div>

      <button
        onClick={handleSwitch}
        disabled={isPending}
        className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center space-x-1 cursor-pointer disabled:opacity-50 shrink-0 ml-4"
      >
        {isPending && <RefreshCw className="w-3 h-3 animate-spin" />}
        <span>{lang === 'am' ? 'ኔትወርክ ቀይር' : 'Switch network'}</span>
      </button>
    </div>
  );
}
