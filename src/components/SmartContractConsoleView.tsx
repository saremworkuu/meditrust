/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Smart Contract Operations & Real-Time Event Feed Console
 * Provides direct interactive execution for all on-chain functions in MediTrust.sol.
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Cpu,
  Package,
  Send,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Activity,
  History,
} from 'lucide-react';
import {
  contractService,
  ContractEventItem,
  PREDEFINED_TEST_ACCOUNTS,
} from '../services/contractService.ts';

interface SmartContractConsoleViewProps {
  lang: 'en' | 'am';
}

export function SmartContractConsoleView({ lang }: SmartContractConsoleViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'dispense' | 'register' | 'transfer' | 'events'>('dispense');
  const [events, setEvents] = useState<ContractEventItem[]>(contractService.getRecentEvents());
  const [activeAccount, setActiveAccount] = useState(contractService.getActiveAccount());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Dispense Form State
  const [dispenseBatchId, setDispenseBatchId] = useState<number>(1);
  const [dispenseSerial, setDispenseSerial] = useState<string>('SN-ET-00123');

  // Register Form State
  const [regGtin, setRegGtin] = useState<string>('07612345678900');
  const [regBatchNo, setRegBatchNo] = useState<string>('ETH-AMX-2026');
  const [regExpiryDays, setRegExpiryDays] = useState<number>(365);
  const [regInitialQty, setRegInitialQty] = useState<number>(1000);

  // Transfer Form State
  const [transBatchId, setTransBatchId] = useState<number>(1);
  const [transTo, setTransTo] = useState<string>(PREDEFINED_TEST_ACCOUNTS[4].address); // Bole Med-Plus
  const [transQty, setTransQty] = useState<number>(100);

  // Subscribe to live events
  useEffect(() => {
    const unsub = contractService.subscribeEvents((newEvent) => {
      setEvents(contractService.getRecentEvents());
    });
    return unsub;
  }, []);

  // Update active account when it changes
  useEffect(() => {
    setActiveAccount(contractService.getActiveAccount());
  }, []);

  // Action: Dispense Pack
  const handleDispense = async () => {
    setActionLoading('dispense');
    setActionResult(null);
    try {
      const serialHash = '0x' + Array.from(dispenseSerial).map(c => c.charCodeAt(0).toString(16)).join('').padEnd(64, '0');
      const res = await contractService.dispensePack(dispenseBatchId, serialHash);

      if (res.isCloneDetected) {
        setActionResult({
          text: `🛑 CLONE ATTACK DETECTED ON-CHAIN! Serial ${dispenseSerial} was already dispensed. Emitted CloneAttemptDetected (Tx: ${res.txHash.slice(0, 10)}...).`,
          type: 'warning',
        });
      } else {
        setActionResult({
          text: `✅ Pack dispensed successfully on-chain! Emitted PackSold event (Tx: ${res.txHash.slice(0, 10)}..., Block #${res.blockNumber}).`,
          type: 'success',
        });
      }
      setEvents(contractService.getRecentEvents());
    } catch (err: any) {
      setActionResult({ text: `Dispense failed: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Register Batch
  const handleRegisterBatch = async () => {
    setActionLoading('register');
    setActionResult(null);
    try {
      const res = await contractService.registerBatch(
        regGtin,
        regBatchNo,
        regExpiryDays,
        regInitialQty
      );
      setActionResult({
        text: `✅ New Batch #${res.batchId} (${regBatchNo}) registered directly on MediTrust.sol! (Tx: ${res.txHash.slice(0, 10)}...).`,
        type: 'success',
      });
      setEvents(contractService.getRecentEvents());
    } catch (err: any) {
      setActionResult({ text: `Registration failed: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Transfer Stock
  const handleTransferStock = async () => {
    setActionLoading('transfer');
    setActionResult(null);
    try {
      const res = await contractService.transferStock(transBatchId, transTo, transQty);
      setActionResult({
        text: `✅ Custody of ${transQty} units transferred on-chain to ${transTo.slice(0, 8)}... (Tx: ${res.txHash.slice(0, 10)}...).`,
        type: 'success',
      });
      setEvents(contractService.getRecentEvents());
    } catch (err: any) {
      setActionResult({ text: `Transfer failed: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const contractAddress = contractService.getContractAddress();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Cpu className="w-3.5 h-3.5" />
              <span>Solidity v0.8.24 • OpenZeppelin 5.6</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {lang === 'am' ? 'የስማርት ኮንትራት ኦፕሬሽንስ ኮንሶል' : 'MediTrust Smart Contract Console'}
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              {lang === 'am'
                ? 'በብሎክቼይን ላይ የተመዘገቡ መድኃኒቶችን ማስተዳደር፣ መስጠት እና የክሎን ሙከራዎችን በቀጥታ መከታተል።'
                : 'Directly execute on-chain functions in MediTrust.sol: dispense packs, register batches, transfer custody, and stream live EVM events.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-right">
              <div className="text-2xs text-slate-400">Target Contract</div>
              <div className="font-mono text-xs font-semibold text-emerald-400">
                {contractAddress.slice(0, 8)}...{contractAddress.slice(-6)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Notification */}
      {actionResult && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            actionResult.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : actionResult.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{actionResult.text}</span>
          <button
            onClick={() => setActionResult(null)}
            className="text-xs font-bold px-2 py-1 hover:bg-black/5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Interactive Operations */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveSubTab('dispense')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeSubTab === 'dispense'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              💊 Dispense & Clone Defense
            </button>
            <button
              onClick={() => setActiveSubTab('register')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeSubTab === 'register'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🏭 Batch Registration
            </button>
            <button
              onClick={() => setActiveSubTab('transfer')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeSubTab === 'transfer'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🚚 Custody Transfer
            </button>
          </div>

          {/* SubTab 1: Dispense & Clone Defense */}
          {activeSubTab === 'dispense' && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>Pharmacy Counter Dispensing</span>
                  <span className="text-2xs font-normal px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    onlyPharmacy
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Calling <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">dispensePack(batchId, serialHash)</code> permanently marks the serial as sold on-chain. Dispensing the same serial twice automatically triggers the on-chain clone alarm!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1">Batch ID</label>
                  <input
                    type="number"
                    value={dispenseBatchId}
                    onChange={(e) => setDispenseBatchId(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1">Pack Serial Number</label>
                  <input
                    type="text"
                    value={dispenseSerial}
                    onChange={(e) => setDispenseSerial(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-emerald-500 font-mono"
                    placeholder="e.g. SN-ET-00123"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={handleDispense}
                  disabled={actionLoading === 'dispense'}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {actionLoading === 'dispense' ? 'Executing On-Chain Tx...' : 'Execute dispensePack On-Chain'}
                  </span>
                </button>
                <button
                  onClick={() => setDispenseSerial(`SN-ET-${Math.floor(10000 + Math.random() * 90000)}`)}
                  className="px-3 py-2 text-2xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                >
                  Generate New Serial
                </button>
              </div>
            </div>
          )}

          {/* SubTab 2: Batch Registration */}
          {activeSubTab === 'register' && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>Register Pharmaceutical Batch</span>
                  <span className="text-2xs font-normal px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                    onlyManufacturer
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Initializes the batch metadata, registers the Merkle root on-chain, and assigns the initial holding balance to the manufacturer.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1">GTIN (GS1 Code)</label>
                  <input
                    type="text"
                    value={regGtin}
                    onChange={(e) => setRegGtin(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={regBatchNo}
                    onChange={(e) => setRegBatchNo(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1">Shelf Life (Days)</label>
                  <input
                    type="number"
                    value={regExpiryDays}
                    onChange={(e) => setRegExpiryDays(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1">Initial Quantity (Units)</label>
                  <input
                    type="number"
                    value={regInitialQty}
                    onChange={(e) => setRegInitialQty(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleRegisterBatch}
                  disabled={actionLoading === 'register'}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>
                    {actionLoading === 'register' ? 'Registering On-Chain...' : 'Execute registerBatch On-Chain'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* SubTab 3: Custody Transfer */}
          {activeSubTab === 'transfer' && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>Transfer Stock Holdings</span>
                  <span className="text-2xs font-normal px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    Approved Actors
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Transfer custody of medicine stock from current holder to a distributor or pharmacy. Emits <code className="bg-slate-100 px-1 py-0.5 rounded text-amber-700">StockTransferred</code> on-chain.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1">Batch ID</label>
                  <input
                    type="number"
                    value={transBatchId}
                    onChange={(e) => setTransBatchId(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1">Recipient Facility</label>
                  <select
                    value={transTo}
                    onChange={(e) => setTransTo(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-amber-500"
                  >
                    <option value={PREDEFINED_TEST_ACCOUNTS[4].address}>Bole Med-Plus Pharmacy</option>
                    <option value={PREDEFINED_TEST_ACCOUNTS[5].address}>Arada Central Pharmacy</option>
                    <option value={PREDEFINED_TEST_ACCOUNTS[3].address}>National Pharma Logistics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1">Units to Transfer</label>
                  <input
                    type="number"
                    value={transQty}
                    onChange={(e) => setTransQty(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleTransferStock}
                  disabled={actionLoading === 'transfer'}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {actionLoading === 'transfer' ? 'Transferring On-Chain...' : 'Execute transferStock On-Chain'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live On-Chain Event Feed */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Live On-Chain Events
              </h3>
            </div>
            <span className="text-2xs font-mono text-slate-400">
              {events.length} events logged
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1">
            {events.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No contract events captured yet. Execute a dispense or registration above to stream live events!
              </div>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                        ev.name === 'CloneAttemptDetected'
                          ? 'bg-rose-100 text-rose-700'
                          : ev.name === 'PackSold'
                          ? 'bg-blue-100 text-blue-700'
                          : ev.name === 'BatchRecalled'
                          ? 'bg-red-100 text-red-700'
                          : ev.name === 'RecallAcknowledged'
                          ? 'bg-emerald-100 text-emerald-700'
                          : ev.name === 'RecallOverdue'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {ev.name}
                    </span>
                    <span className="text-2xs text-slate-400 font-mono">
                      Block #{ev.blockNumber}
                    </span>
                  </div>

                  <div className="text-2xs font-mono text-slate-600 truncate">
                    Tx: {ev.transactionHash}
                  </div>

                  <div className="text-2xs text-slate-500 bg-white p-2 rounded-lg border border-slate-100 font-mono overflow-x-auto">
                    {JSON.stringify(ev.args, null, 1).replace(/[\{\}\n]/g, '')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

