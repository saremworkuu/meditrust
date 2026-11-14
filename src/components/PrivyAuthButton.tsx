/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Privy Authentication Button (Task 3)
 * One "Sign in" button opening Privy (Email, Phone, Google, Wallets),
 * displaying shortened address and on-chain role after login.
 */

import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { LogIn, LogOut, Wallet, Check, Copy, ChevronDown, AlertCircle, X, ExternalLink } from 'lucide-react';
import { useRole } from '../../lib/contract.ts';
import { usePrivyStatus } from '../../lib/auth/PrivyWagmiProvider.tsx';

interface PrivyAuthButtonProps {
  lang: 'en' | 'am';
}

export function PrivyAuthButton({ lang }: PrivyAuthButtonProps) {
  const { login, logout, authenticated, user } = usePrivy();
  const { address: wagmiAddress, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();
  const { isConfigured } = usePrivyStatus();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Address can come from wagmi or Privy user wallet
  const address = wagmiAddress || user?.wallet?.address;
  const { role, isLoading: isRoleLoading } = useRole(address);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignOut = async () => {
    setIsMenuOpen(false);
    disconnect();
    try {
      await logout();
    } catch {}
  };

  const handleSignInClick = () => {
    if (isConfigured) {
      login();
    } else {
      setShowSetupModal(true);
    }
  };

  if (!authenticated && !isConnected) {
    return (
      <>
        <button
          onClick={handleSignInClick}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
          title={isConfigured ? 'Sign in with Email, Google, Phone, or MetaMask' : 'Configure Privy or Connect Injected Wallet'}
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>{lang === 'am' ? 'ግባ (Sign In)' : 'Sign In'}</span>
        </button>

        {showSetupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
              <button
                onClick={() => setShowSetupModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Privy App ID Setup</h3>
                  <p className="text-xs text-slate-500">Web3 Social & Email Authentication</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <p>
                  To enable seamless login with <strong>Email, SMS, Google, and Embedded Wallets</strong>, enter your Privy App ID:
                </p>

                <ol className="list-decimal list-inside space-y-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-2xs">
                  <li>Get a free App ID at <a href="https://dashboard.privy.io" target="_blank" rel="noreferrer" className="text-emerald-600 underline font-semibold inline-flex items-center gap-1">dashboard.privy.io <ExternalLink className="w-2.5 h-2.5" /></a></li>
                  <li>Paste into <span className="font-bold">.env.local</span>: <br /><span className="text-emerald-700 dark:text-emerald-400 font-bold">NEXT_PUBLIC_PRIVY_APP_ID="cl..."</span></li>
                  <li>Restart the server (<span className="italic">npm run dev</span>)</li>
                </ol>

                <div className="pt-2">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Or connect an installed wallet right now:</p>
                  <button
                    onClick={() => {
                      setShowSetupModal(false);
                      connect({ connector: injected() });
                    }}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold transition"
                  >
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span>Connect Injected Wallet (MetaMask)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected';

  return (
    <div className="relative">
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center space-x-2 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 transition shadow-xs cursor-pointer"
      >
        <Wallet className="w-3.5 h-3.5 text-emerald-600" />
        <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{shortAddress}</span>
        <span
          className={`text-2xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            role === 'Regulator'
              ? 'bg-purple-100 text-purple-700'
              : role === 'Manufacturer'
              ? 'bg-blue-100 text-blue-700'
              : role === 'Pharmacy'
              ? 'bg-emerald-100 text-emerald-700'
              : role === 'Distributor'
              ? 'bg-amber-100 text-amber-700'
              : role === 'Admin'
              ? 'bg-rose-100 text-rose-700'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {isRoleLoading ? '...' : role}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 space-y-3">
          <div className="space-y-1">
            <div className="text-2xs text-slate-400 uppercase tracking-wider font-semibold">Active Account</div>
            <div className="flex items-center justify-between text-xs font-mono p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
              <span className="truncate">{address}</span>
              <button onClick={handleCopy} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs py-1 px-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">On-Chain Role:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{role}</span>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{lang === 'am' ? 'ውጣ (Disconnect)' : 'Sign Out'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
