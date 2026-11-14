/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Public Verification View (Task 3)
 * Operates 100% WITHOUT login or wallet, using the read-only public client from NEXT_PUBLIC_RPC_URL.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  QrCode,
  Search,
  Building2,
  CheckCircle2,
  Volume2,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import { parseQRPayload } from '../../packages/verify/src/parser.ts';
import { verifyPackOnChain, contractAddress } from '../../lib/contract.ts';
import { STATUS_PRESENTATION_MAP } from '../../packages/verify/src/presentation.ts';
import { mapContractStatus, ESSENTIAL_MEDICINES_CATALOG } from '../../packages/verify/src/verifier.ts';
import { targetChain } from '../../lib/chains.ts';

interface PublicVerificationViewProps {
  initialCode?: string;
  lang: 'en' | 'am';
}

export function PublicVerificationView({ initialCode, lang }: PublicVerificationViewProps) {
  const [code, setCode] = useState<string>(
    initialCode ||
      (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('code') ||
          new URLSearchParams(window.location.search).get('c') ||
          window.location.pathname.replace(/^\/v\/?/, '') ||
          'https://meditrust.et/verify?b=1&s=SN-ET-00123&c=SEC889'
        : 'https://meditrust.et/verify?b=1&s=SN-ET-00123&c=SEC889')
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const handleVerify = async (codeToVerify?: string) => {
    const targetCode = codeToVerify || code;
    if (!targetCode || targetCode.trim().length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Parse QR payload
      const parsed = parseQRPayload(targetCode);

      // 2. Read directly on-chain via readOnlyPublicClient (ZERO WALLET / LOGIN REQUIRED)
      const chainData = await verifyPackOnChain(
        parsed.batchId,
        parsed.serialHash,
        parsed.proof
      );

      const typedStatus = mapContractStatus(chainData.status);
      const presentation = STATUS_PRESENTATION_MAP[typedStatus];

      const expiryTimestamp = Number(chainData.expiryDate);
      const expiryFormatted =
        expiryTimestamp > 0
          ? new Date(expiryTimestamp * 1000).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : 'N/A';

      const productName =
        ESSENTIAL_MEDICINES_CATALOG[chainData.gtin] ||
        (chainData.gtin ? `Registered Pharmaceutical (${chainData.gtin})` : 'Registered Medicine');

      setResult({
        status: typedStatus,
        productName,
        batchNumber: chainData.batchNumber || `BATCH-${parsed.batchId}`,
        batchId: parsed.batchId.toString(),
        serialNumber: parsed.serialNumber,
        expiryFormatted,
        isRecalled: chainData.isRecalled,
        isSold: chainData.isSold,
        isCloneSuspected: chainData.isCloneSuspected,
        presentation,
      });
    } catch (err: any) {
      setError(err.message || 'Verification could not be completed.');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleVerify();
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Banner */}
      <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">Public Medicine Verification</h2>
            <p className="text-2xs text-slate-400">Zero wallet or login required • Querying {targetChain.name}</p>
          </div>
        </div>

        <div className="text-right font-mono text-2xs text-emerald-400">
          <div>RPC: Public Read-Only</div>
          <div>Contract: {contractAddress.slice(0, 8)}...</div>
        </div>
      </div>

      {/* Input Box */}
      <div className="relative">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste verification link or QR text"
          className="w-full pl-4 pr-28 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-emerald-500 shadow-xs"
        />
        <button
          onClick={() => handleVerify()}
          disabled={isLoading}
          className="absolute inset-y-1.5 right-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
        >
          <Search className="w-3.5 h-3.5" />
          <span>{isLoading ? 'Reading Chain...' : 'Verify'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div
          className={`rounded-2xl border-2 p-6 shadow-md transition-all ${result.presentation.borderClass} ${result.presentation.bgClass}`}
        >
          <div className="flex items-start space-x-3.5 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
            <span className="text-3xl shrink-0 select-none">{result.presentation.emoji}</span>
            <div>
              <span className={`px-2.5 py-0.5 text-xs font-bold uppercase rounded-md border ${result.presentation.badgeClass}`}>
                {result.presentation.emoji} {lang === 'am' ? result.presentation.titleAm : result.presentation.titleEn}
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-2">{result.productName}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                {lang === 'am' ? result.presentation.shortSentenceAm : result.presentation.shortSentenceEn}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
            <div className="p-3 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-2xs font-semibold text-slate-500 uppercase">Batch Number</div>
              <div className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-1">{result.batchNumber}</div>
            </div>
            <div className="p-3 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-2xs font-semibold text-slate-500 uppercase">Serial Number</div>
              <div className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-1 truncate">{result.serialNumber}</div>
            </div>
            <div className="p-3 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-2xs font-semibold text-slate-500 uppercase">Expiry Date</div>
              <div className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-1">{result.expiryFormatted}</div>
            </div>
          </div>

          <div className="p-3 bg-slate-100/70 dark:bg-slate-800/70 rounded-xl text-2xs text-slate-600 dark:text-slate-300 flex items-center justify-between font-mono">
            <span>Verified on {targetChain.name} (Chain #{targetChain.id})</span>
            <span>Zero login required</span>
          </div>
        </div>
      )}
    </div>
  );
}
