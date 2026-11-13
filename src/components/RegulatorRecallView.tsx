/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Regulator Recall Compliance View
 * Implements: FR-RR-08, FR-RR-09, FR-RR-10
 * Hard rule 4: Status labels need text and icon, not color alone (FR-VA-03).
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FileText,
  ExternalLink,
  RefreshCw,
  FastForward,
  RotateCcw,
  UserCheck,
  Package,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  RecalledBatchSummary,
  RecallHolderRecord,
  RecallBanner,
} from '../services/recallComplianceService.ts';

interface RegulatorRecallViewProps {
  lang: 'en' | 'am';
}

export function RegulatorRecallView({ lang }: RegulatorRecallViewProps) {
  const [summaries, setSummaries] = useState<RecalledBatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeRolePerspective, setActiveRolePerspective] = useState<string>('regulator');
  const [banners, setBanners] = useState<RecallBanner[]>([]);

  // Fetch compliance data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recall-compliance');
      const data = await res.json();
      if (data.success && data.batches) {
        setSummaries(data.batches);
        if (data.batches.length > 0 && selectedBatchId === null) {
          setSelectedBatchId(data.batches[0].batchId);
        }
      }

      // Fetch banners
      const bRes = await fetch('/api/recall-compliance/banners');
      const bData = await bRes.json();
      if (bData.success) {
        setBanners(bData.banners);
      }
    } catch (err: any) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeBatch = summaries.find((b) => b.batchId === selectedBatchId) || summaries[0];

  // Action: Mark Overdue (FR-RR-09)
  const handleMarkOverdue = async (batchId: number, holder: string) => {
    setActionLoading(`overdue-${holder}`);
    setActionMsg(null);
    try {
      const res = await fetch('/api/recall-compliance/mark-overdue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, holder }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({
          text: `Successfully marked holder ${holder.slice(0, 8)}... as Overdue on-chain (FR-RR-09).`,
          type: 'success',
        });
        await fetchData();
      } else {
        setActionMsg({ text: `Failed: ${data.error}`, type: 'error' });
      }
    } catch (err: any) {
      setActionMsg({ text: `Network error: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Simulate Holder Quarantine Acknowledgement (FR-RR-06, FR-RR-07)
  const handleAcknowledge = async (batchId: number, holder: string, qty: number) => {
    setActionLoading(`ack-${holder}`);
    setActionMsg(null);
    try {
      const res = await fetch('/api/recall-compliance/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          holder,
          qty,
          evidenceCid: 'ipfs://bafybeihjklmedi7evidencequarantine',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({
          text: `Holder successfully quarantined ${qty} units with IPFS proof hash.`,
          type: 'success',
        });
        await fetchData();
      } else {
        setActionMsg({ text: `Failed: ${data.error}`, type: 'error' });
      }
    } catch (err: any) {
      setActionMsg({ text: `Network error: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Fast forward deadline past current time for demo testing
  const handleFastForward = async () => {
    if (!activeBatch) return;
    setActionLoading('fast-forward');
    try {
      await fetch('/api/recall-compliance/fast-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: activeBatch.batchId }),
      });
      setActionMsg({
        text: 'Fast-forwarded deadline past 48h. Deadline expired — Overdue button now actionable.',
        type: 'success',
      });
      await fetchData();
    } catch (err: any) {
      setActionMsg({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Reset demo seed
  const handleResetSeed = async () => {
    setActionLoading('seed');
    try {
      await fetch('/api/recall-compliance/seed', { method: 'POST' });
      setActionMsg({
        text: 'Reset seed to 1 recalled batch with 2 Pending holders (Section 10 Demo state).',
        type: 'success',
      });
      await fetchData();
    } catch (err: any) {
      setActionMsg({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Format relative time helper
  const getRelativeTime = (isoString: string) => {
    const diff = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Deadline calculation
  const getDeadlineStatus = (deadlineAt: string) => {
    const diff = new Date(deadlineAt).getTime() - Date.now();
    const hours = Math.round(diff / (3600 * 1000));
    if (diff <= 0) {
      return { isExpired: true, text: 'Deadline Expired' };
    }
    return { isExpired: false, text: `${hours}h remaining` };
  };

  // Active perspective banner check (FR-RR-10)
  const activeHolderBanner =
    activeRolePerspective !== 'regulator'
      ? banners.find((b) => b.holder.toLowerCase() === activeRolePerspective.toLowerCase())
      : null;

  return (
    <div className="space-y-6">
      {/* Role Switcher Toolbar for Demonstration */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400">
          <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">Demo Role Perspective:</span>
          <select
            value={activeRolePerspective}
            onChange={(e) => setActiveRolePerspective(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
          >
            <option value="regulator">🛡️ EFDA Regulator Console</option>
            <option value="0x70997970C51812dc3A010C7d01b50e0d17dc79C8">
              🏢 Central Addis Wholesaler (Distributor)
            </option>
            <option value="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC">
              💊 Bole Med-Plus Pharmacy (Community Pharmacy)
            </option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleFastForward}
            disabled={actionLoading !== null}
            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            title="Fast forward deadline past 48h to demonstrate markOverdue"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Fast-Forward 48h</span>
          </button>
          <button
            onClick={handleResetSeed}
            disabled={actionLoading !== null}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            title="Reset demo seed state"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Seed</span>
          </button>
        </div>
      </div>

      {/* Holder Dashboard Banner (FR-RR-10: Holder dashboard banners) */}
      {activeHolderBanner && (
        <div className="p-4 bg-rose-50 border-2 border-rose-500 rounded-2xl dark:bg-rose-950/40 dark:border-rose-600 shadow-sm flex items-start space-x-3.5 animate-in slide-in-from-top">
          <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-200">
                🚨 {lang === 'am' ? 'የእገዳ ማሳሰቢያ ባነር' : 'Urgent Recall Notice'} (FR-RR-10)
              </span>
              <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-200 dark:bg-rose-900/60 px-2 py-0.5 rounded-full">
                {activeHolderBanner.remainingHours <= 0 ? 'OVERDUE' : `${activeHolderBanner.remainingHours}h remaining`}
              </span>
            </div>
            <p className="text-xs font-medium text-rose-900 dark:text-rose-100 mt-1">
              {lang === 'am' ? activeHolderBanner.messageAm : activeHolderBanner.messageEn}
            </p>
            <div className="mt-2.5 flex items-center space-x-2">
              <button
                onClick={() => handleAcknowledge(activeHolderBanner.batchId, activeHolderBanner.holder, 200)}
                disabled={actionLoading !== null}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Quarantine Stock & Submit Acknowledgement</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Notification Message */}
      {actionMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
            actionMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
          }`}
        >
          {actionMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Main Recall Compliance View (FR-RR-08) */}
      {activeBatch ? (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-6">
          {/* Header Summary Card */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center space-x-2 mb-1.5">
                <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700 flex items-center space-x-1">
                  <span>🔴</span>
                  <span>{activeBatch.severity} RECALL</span>
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Batch #{activeBatch.batchId} ({activeBatch.batchNumber})
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {activeBatch.productName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                <strong>Reason:</strong> {activeBatch.recallReason}
              </p>
            </div>

            {/* Recalled Time & Deadline Summary */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-right">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Recalled
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {getRelativeTime(activeBatch.recalledAt)}
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border text-right ${
                  getDeadlineStatus(activeBatch.deadlineAt).isExpired
                    ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  48h Deadline
                </div>
                <div className="text-xs font-bold flex items-center justify-end space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{getDeadlineStatus(activeBatch.deadlineAt).text}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Aggregate Compliance Statistics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-medium text-slate-500">Holders Involved</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {activeBatch.totalHolders}
              </div>
              <div className="text-[10px] text-slate-400">Recorded Stock Custodians</div>
            </div>

            <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40">
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-center space-x-1">
                <span>⏳</span>
                <span>Pending Quarantine</span>
              </div>
              <div className="text-lg font-bold text-amber-800 dark:text-amber-200 mt-1">
                {activeBatch.pendingHolders}
              </div>
              <div className="text-[10px] text-amber-600 dark:text-amber-400">Action Required</div>
            </div>

            <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center space-x-1">
                <span>✅</span>
                <span>Acknowledged</span>
              </div>
              <div className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                {activeBatch.acknowledgedHolders}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Quarantine Confirmed</div>
            </div>

            <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/40">
              <div className="text-[11px] font-medium text-rose-700 dark:text-rose-300 flex items-center space-x-1">
                <span>⚠️</span>
                <span>Overdue Sanctions</span>
              </div>
              <div className="text-lg font-bold text-rose-800 dark:text-rose-200 mt-1">
                {activeBatch.overdueHolders}
              </div>
              <div className="text-[10px] text-rose-600 dark:text-rose-400">Score Penalty Active</div>
            </div>
          </div>

          {/* Quarantine Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Total Stock Quarantined: {activeBatch.totalQuarantined} / {activeBatch.totalHeld} units
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {activeBatch.compliancePercentage}% Compliant
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(activeBatch.compliancePercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Holders Compliance Table (FR-RR-08) */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Holder Organization</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status (FR-VA-03)</th>
                  <th className="px-4 py-3">Stock Held vs Quarantined</th>
                  <th className="px-4 py-3">Time Since Recall</th>
                  <th className="px-4 py-3">Evidence CID</th>
                  <th className="px-4 py-3 text-right">Regulatory Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeBatch.holders.map((holderRecord) => {
                  const deadlinePassed = getDeadlineStatus(activeBatch.deadlineAt).isExpired;

                  return (
                    <tr
                      key={holderRecord.holder}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Organization & Address */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {holderRecord.holderName}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[180px]">
                          {holderRecord.holder}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5">
                        <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {holderRecord.holderRole}
                        </span>
                      </td>

                      {/* Status Label (Never color alone! Icon + text) */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {holderRecord.status === 'Acknowledged' && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Acknowledged</span>
                          </span>
                        )}

                        {holderRecord.status === 'Pending' && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        )}

                        {holderRecord.status === 'Overdue' && (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Overdue</span>
                          </span>
                        )}
                      </td>

                      {/* Qty Held vs Quarantined */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {holderRecord.qtyQuarantined} / {holderRecord.qtyHeld} units
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {holderRecord.qtyHeld > 0
                            ? `${Math.round((holderRecord.qtyQuarantined / holderRecord.qtyHeld) * 100)}% quarantined`
                            : '0%'}
                        </div>
                      </td>

                      {/* Time Since Recall */}
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div>{getRelativeTime(holderRecord.recalledAt)}</div>
                        {holderRecord.ackedAt && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            Acked {getRelativeTime(holderRecord.ackedAt)}
                          </div>
                        )}
                      </td>

                      {/* Evidence CID */}
                      <td className="px-4 py-3.5">
                        {holderRecord.evidenceCid ? (
                          <a
                            href={`https://ipfs.io/ipfs/${holderRecord.evidenceCid.replace('ipfs://', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1 font-mono text-[11px]"
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[120px]">
                              {holderRecord.evidenceCid.replace('ipfs://', '')}
                            </span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No evidence uploaded</span>
                        )}
                      </td>

                      {/* Regulatory Actions (FR-RR-09 markOverdue button) */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Quick test button for simulating acknowledgement */}
                          {holderRecord.status === 'Pending' && (
                            <button
                              onClick={() =>
                                handleAcknowledge(
                                  activeBatch.batchId,
                                  holderRecord.holder,
                                  holderRecord.qtyHeld
                                )
                              }
                              disabled={actionLoading !== null}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded text-[11px] font-semibold transition-colors"
                              title="Simulate quarantine acknowledgement (FR-RR-06)"
                            >
                              Ack 100%
                            </button>
                          )}

                          {/* Mark Overdue button (FR-RR-09) */}
                          <button
                            onClick={() => handleMarkOverdue(activeBatch.batchId, holderRecord.holder)}
                            disabled={
                              actionLoading !== null ||
                              holderRecord.status === 'Acknowledged' ||
                              holderRecord.status === 'Overdue' ||
                              !deadlinePassed
                            }
                            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center space-x-1 transition-all ${
                              holderRecord.status === 'Overdue'
                                ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                                : holderRecord.status === 'Acknowledged'
                                ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                                : deadlinePassed
                                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer'
                                : 'bg-slate-200 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                            }`}
                            title={
                              !deadlinePassed
                                ? 'Cannot mark overdue until 48h deadline expires. Use Fast-Forward above to test.'
                                : holderRecord.status === 'Acknowledged'
                                ? 'Holder already acknowledged.'
                                : 'Call markOverdue on-chain'
                            }
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>
                              {holderRecord.status === 'Overdue'
                                ? 'Marked Overdue'
                                : 'Mark Overdue'}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500">No active recall compliance data found.</p>
          <button
            onClick={handleResetSeed}
            className="mt-3 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl"
          >
            Seed Demo Recalled Batch
          </button>
        </div>
      )}
    </div>
  );
}
