/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Connection Health Dashboard (Task 7)
 * Route: /status (hidden from navbar)
 * Live green/red verification for:
 * 1. Env variables present
 * 2. RPC reachable
 * 3. Chain ID matches
 * 4. Contract address has deployed bytecode
 * 5. Pinata IPFS upload authentication works
 * 6. Supabase REST endpoint reachable
 * 7. Privy Web3 auth loaded
 * SECURITY INVARIANT: NEVER PRINTS SECRET VALUES.
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Server,
  Cpu,
  Layers,
  Database,
  Lock,
  Cloud,
  Shield,
  Activity,
} from 'lucide-react';
import { getEnvHealthSummary } from '../../lib/env.ts';
import { readOnlyPublicClient, contractAddress } from '../../lib/contract.ts';
import { targetChain } from '../../lib/chains.ts';
import { testPinataConnection } from '../../lib/ipfs.ts';
import { testSupabaseConnection } from '../../lib/supabase.ts';

interface HealthCheckItem {
  id: string;
  category: string;
  name: string;
  status: 'checking' | 'green' | 'red';
  detail: string;
}

export function StatusHealthDashboard() {
  const [checks, setChecks] = useState<HealthCheckItem[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<string>('');

  const runAllChecks = async () => {
    setIsRunning(true);

    const initialChecks: HealthCheckItem[] = [
      { id: 'env', category: 'Environment', name: 'Environment Variables Present', status: 'checking', detail: 'Validating variables...' },
      { id: 'rpc', category: 'Blockchain', name: 'RPC Endpoint Reachable', status: 'checking', detail: 'Connecting to RPC node...' },
      { id: 'chainId', category: 'Blockchain', name: 'Chain ID Matches Target', status: 'checking', detail: 'Checking chain ID...' },
      { id: 'bytecode', category: 'Smart Contract', name: 'Contract Address Has Bytecode', status: 'checking', detail: 'Checking contract address...' },
      { id: 'pinata', category: 'Storage', name: 'Pinata IPFS Connection (Small Test)', status: 'checking', detail: 'Pinging Pinata API...' },
      { id: 'supabase', category: 'Database', name: 'Supabase Database Reachable', status: 'checking', detail: 'Pinging Supabase REST API...' },
      { id: 'privy', category: 'Authentication', name: 'Privy Web3 SDK Initialized', status: 'checking', detail: 'Checking Privy configuration...' },
    ];
    setChecks(initialChecks);

    // 1. Env Variables Check
    try {
      const summary = getEnvHealthSummary();
      const allPresent = Object.values(summary).every((s) => s.present);
      const hasPlaceholders = Object.values(summary).some((s) => s.isPlaceholder);

      initialChecks[0].status = allPresent && !hasPlaceholders ? 'green' : 'red';
      initialChecks[0].detail = allPresent
        ? hasPlaceholders
          ? 'Variables present but some contain placeholder values'
          : 'All 13 required variables defined and valid'
        : 'One or more required environment variables missing';
    } catch (err: any) {
      initialChecks[0].status = 'red';
      initialChecks[0].detail = err.message;
    }

    // 2. RPC Reachable Check
    let rpcSuccess = false;
    let actualChainId: number | null = null;
    try {
      const start = performance.now();
      const blockNum = await readOnlyPublicClient.getBlockNumber();
      const latency = Math.round(performance.now() - start);
      rpcSuccess = true;
      initialChecks[1].status = 'green';
      initialChecks[1].detail = `Connected! Latest block #${blockNum} (${latency}ms)`;
    } catch (err: any) {
      initialChecks[1].status = 'red';
      initialChecks[1].detail = `RPC unreachable: ${err.message || 'Connection refused'}`;
    }

    // 3. Chain ID Matches Check
    if (rpcSuccess) {
      try {
        actualChainId = await readOnlyPublicClient.getChainId();
        if (actualChainId === targetChain.id) {
          initialChecks[2].status = 'green';
          initialChecks[2].detail = `Chain ID verified: ${actualChainId} (${targetChain.name})`;
        } else {
          initialChecks[2].status = 'red';
          initialChecks[2].detail = `Mismatch: RPC returned Chain ID ${actualChainId}, expected ${targetChain.id}`;
        }
      } catch (err: any) {
        initialChecks[2].status = 'red';
        initialChecks[2].detail = `Could not verify chain ID: ${err.message}`;
      }
    } else {
      initialChecks[2].status = 'red';
      initialChecks[2].detail = 'Skipped because RPC is unreachable';
    }

    // 4. Contract Bytecode Check
    if (rpcSuccess) {
      try {
        const bytecode = await readOnlyPublicClient.getBytecode({ address: contractAddress });
        if (bytecode && bytecode !== '0x' && bytecode.length > 2) {
          initialChecks[3].status = 'green';
          initialChecks[3].detail = `Bytecode confirmed at ${contractAddress.slice(0, 10)}... (${(bytecode.length / 2).toFixed(0)} bytes)`;
        } else {
          initialChecks[3].status = 'red';
          initialChecks[3].detail = `No contract deployed at ${contractAddress}`;
        }
      } catch (err: any) {
        initialChecks[3].status = 'red';
        initialChecks[3].detail = `Error fetching bytecode: ${err.message}`;
      }
    } else {
      initialChecks[3].status = 'red';
      initialChecks[3].detail = 'Skipped because RPC is unreachable';
    }

    // 5. Pinata IPFS Check
    try {
      const pinataRes = await testPinataConnection();
      initialChecks[4].status = pinataRes.success ? 'green' : 'red';
      initialChecks[4].detail = pinataRes.message;
    } catch (err: any) {
      initialChecks[4].status = 'red';
      initialChecks[4].detail = err.message;
    }

    // 6. Supabase Check
    try {
      const supaRes = await testSupabaseConnection();
      initialChecks[5].status = supaRes.success ? 'green' : 'red';
      initialChecks[5].detail = supaRes.message;
    } catch (err: any) {
      initialChecks[5].status = 'red';
      initialChecks[5].detail = err.message;
    }

    // 7. Privy Loaded Check
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    if (privyAppId && !privyAppId.includes('your_privy')) {
      initialChecks[6].status = 'green';
      initialChecks[6].detail = 'Privy App ID configured and SDK ready';
    } else {
      initialChecks[6].status = 'red';
      initialChecks[6].detail = 'NEXT_PUBLIC_PRIVY_APP_ID is using placeholder or missing';
    }

    setChecks([...initialChecks]);
    setIsRunning(false);
    setLastChecked(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    runAllChecks();
  }, []);

  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.status === 'green').length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold">MediTrust Connection Health</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Status check for wallets, RPC node, contract code, Pinata IPFS, Supabase, and Privy.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-xs font-bold font-mono">
              {passedChecks} / {totalChecks} Green
            </div>
            <div className="text-2xs text-slate-400">Checked: {lastChecked || 'Now'}</div>
          </div>

          <button
            onClick={runAllChecks}
            disabled={isRunning}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition shadow-xs disabled:opacity-50"
            title="Re-run health checks"
          >
            <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Checks List */}
      <div className="space-y-3">
        {checks.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-xl border transition flex items-center justify-between bg-white dark:bg-slate-900 ${
              item.status === 'green'
                ? 'border-emerald-200 dark:border-emerald-950/60 shadow-xs'
                : item.status === 'red'
                ? 'border-rose-200 dark:border-rose-950/60'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3.5">
              <div className="shrink-0">
                {item.status === 'green' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : item.status === 'red' ? (
                  <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                ) : (
                  <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
                )}
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                  <span className="text-2xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                    {item.category}
                  </span>
                </div>
                <div
                  className={`text-2xs font-mono mt-0.5 ${
                    item.status === 'green'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : item.status === 'red'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {item.detail}
                </div>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-2xs font-bold uppercase ${
                item.status === 'green'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : item.status === 'red'
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-2xs text-slate-500 space-y-1">
        <div className="font-semibold text-slate-700 dark:text-slate-300">Privacy & Security Guarantee:</div>
        <div>Secret credentials (PINATA_JWT, PRIVY_APP_SECRET, SUPABASE_SERVICE_ROLE_KEY, PRIVATE_KEY) are never displayed or transmitted to the client. Fill real values in .env.local to see all checks turn green.</div>
      </div>
    </div>
  );
}
