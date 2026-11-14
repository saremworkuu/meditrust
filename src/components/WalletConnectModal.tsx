/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Web3 Wallet & On-Chain Contract Connection Modal
 */

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Shield,
  CheckCircle2,
  X,
  ExternalLink,
  Copy,
  Check,
  Server,
  Cpu,
  Layers,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  contractService,
  PREDEFINED_TEST_ACCOUNTS,
  PredefinedAccount,
} from '../services/contractService.ts';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'am';
}

export function WalletConnectModal({ isOpen, onClose, lang }: WalletConnectModalProps) {
  const [activeAccount, setActiveAccount] = useState<PredefinedAccount | null>(
    contractService.getActiveAccount()
  );
  const [connectionMode, setConnectionMode] = useState<string>(contractService.getConnectionMode());
  const [rpcUrl, setRpcUrl] = useState<string>(contractService.getRpcUrl());
  const [copied, setCopied] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setActiveAccount(contractService.getActiveAccount());
    setConnectionMode(contractService.getConnectionMode());
  }, [isOpen]);

  if (!isOpen) return null;

  const contractAddress = contractService.getContractAddress();

  const handleCopy = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectRole = async (acc: PredefinedAccount) => {
    setErrorMsg(null);
    await contractService.selectTestAccount(acc.id);
    setActiveAccount(acc);
    setConnectionMode(contractService.getConnectionMode());
  };

  const handleConnectBrowser = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const res = await contractService.connectBrowserWallet();
      setActiveAccount(contractService.getActiveAccount());
      setConnectionMode('browser_wallet');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect browser wallet.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {lang === 'am' ? 'የብሎክቼይን እና የዋሌት ግንኙነት' : 'Web3 Smart Contract Connection'}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'am' ? 'የኮንትራት ቁጥጥር እና የዲጂታል ሚና ምርጫ' : 'EVM Network & Role Authorization'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Connection Status Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-500">Connection Mode:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {connectionMode === 'browser_wallet'
                  ? 'MetaMask / Browser Wallet'
                  : connectionMode === 'rpc_node'
                  ? 'Hardhat Local Node (31337)'
                  : 'Active Smart Contract Engine'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">MediTrust.sol Contract:</span>
              <div className="flex items-center gap-1.5 font-mono text-slate-700">
                <span>{contractAddress.slice(0, 10)}...{contractAddress.slice(-6)}</span>
                <button
                  onClick={handleCopy}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500 transition"
                  title="Copy Address"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Network / Chain:</span>
              <span className="font-medium text-slate-700">Ethereum L2 / Local Devnet (Chain ID 31337)</span>
            </div>
          </div>

          {/* Connect Browser Wallet Button */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              {lang === 'am' ? 'የብሮውዘር ዋሌት ማገናኘት' : 'Browser Web3 Extension'}
            </label>
            <button
              onClick={handleConnectBrowser}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 text-slate-800 font-medium text-sm transition shadow-xs"
            >
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>
                {isConnecting
                  ? 'Connecting...'
                  : lang === 'am'
                  ? 'MetaMask / Web3 ዋሌት አገናኝ'
                  : 'Connect MetaMask / Injected Wallet'}
              </span>
            </button>
          </div>

          {/* 1-Click Role Switcher */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {lang === 'am' ? 'የሙከራ ሚና ይምረጡ (1-ጠቅታ)' : 'Simulated Test Roles (1-Click Switch)'}
              </label>
              <span className="text-2xs text-slate-400">Hardhat Accounts #0–#5</span>
            </div>

            <div className="space-y-2">
              {PREDEFINED_TEST_ACCOUNTS.map((acc) => {
                const isSelected = activeAccount?.id === acc.id;
                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSelectRole(acc)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          acc.role === 'Regulator'
                            ? 'bg-purple-100 text-purple-700'
                            : acc.role === 'Pharmacy'
                            ? 'bg-emerald-100 text-emerald-700'
                            : acc.role === 'Manufacturer'
                            ? 'bg-blue-100 text-blue-700'
                            : acc.role === 'Distributor'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {acc.role[0]}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                          <span>{acc.name}</span>
                          <span className="text-2xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                            {acc.role}
                          </span>
                        </div>
                        <div className="text-2xs text-slate-500 font-mono">
                          {acc.address.slice(0, 10)}...{acc.address.slice(-6)}
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-2xs text-slate-500">
            Current Role: <span className="font-semibold text-slate-700">{activeAccount?.role || 'None'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg transition"
          >
            {lang === 'am' ? 'ዝጋ' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

