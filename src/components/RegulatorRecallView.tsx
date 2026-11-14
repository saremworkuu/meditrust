/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Regulator Recall Compliance View
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
  FastForward,
  RotateCcw,
} from 'lucide-react';
import {
  RecalledBatchSummary,
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

      const bRes = await fetch('/api/recall-compliance/banners');
      const bData = await bRes.json();
      if (bData.success) {
        setBanners(bData.banners);
      }
    } catch (err) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeBatch = summaries.find((b) => b.batchId === selectedBatchId) || summaries[0];

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
          text: `Marked holder ${holder.slice(0, 8)}... as Overdue on-chain.`,
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
          text: `Holder quarantined ${qty} units with IPFS proof hash.`,
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
        text: 'Fast-forwarded deadline past 48h. Overdue actions are now enabled.',
        type: 'success',
      });
      await fetchData();
    } catch (err: any) {
      setActionMsg({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetSeed = async () => {
    setActionLoading('seed');
    try {
      await fetch('/api/recall-compliance/seed', { method: 'POST' });
      setActionMsg({
        text: 'Reset demo seed to 1 recalled batch with 2 pending holders.',
        type: 'success',
      });
      await fetchData();
    } catch (err: any) {
      setActionMsg({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const getRelativeTime = (isoString: string) => {
    const diff = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getDeadlineStatus = (deadlineAt: string) => {
    const diff = new Date(deadlineAt).getTime() - Date.now();
    const hours = Math.round(diff / (3600 * 1000));
    if (diff <= 0) {
      return { isExpired: true, text: 'Deadline Expired' };
    }
    return { isExpired: false, text: `${hours}h remaining` };
  };

  const activeHolderBanner =
    activeRolePerspective !== 'regulator'
      ? banners.find((b) => b.holder.toLowerCase() === activeRolePerspective.toLowerCase())
      : null;

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {lang === 'am' ? 'የእገዳ ተገዢነት ክትትል' : 'Recall Compliance'}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeRolePerspective}
            onChange={(e) => setActiveRolePerspective(e.target.value)}
            aria-label="Role perspective"
            className="bg-white dark:bg-neutral-950 text-slate-800 dark:text-neutral-200 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 font-medium focus:outline-none focus:border-slate-500 dark:focus:border-neutral-500"
          >
            <option value="regulator">EFDA Regulator Console</option>
            <option value="0x70997970C51812dc3A010C7d01b50e0d17dc79C8">
              Central Addis Wholesaler (Distributor)
            </option>
            <option value="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC">
              Bole Med-Plus Pharmacy (Pharmacy)
            </option>
          </select>

          <button
            type="button"
            onClick={handleFastForward}
            disabled={actionLoading !== null}
            className="px-3 py-2 bg-white dark:bg-neutral-950 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-800 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
          >
            <FastForward className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Fast-Forward 48h</span>
          </button>

          <button
            type="button"
            onClick={handleResetSeed}
            disabled={actionLoading !== null}
            className="px-3 py-2 bg-white dark:bg-neutral-950 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-800 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-neutral-400" />
            <span>Reset Seed</span>
          </button>
        </div>
      </div>

      {/* Holder Dashboard Banner (FR-RR-10) */}
      {activeHolderBanner && (
        <div className="p-5 bg-rose-50/80 dark:bg-neutral-950 border border-rose-200 dark:border-rose-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'am' ? 'የእገዳ ማሳሰቢያ' : 'Urgent Recall Notice'} ·{' '}
                {activeHolderBanner.remainingHours <= 0
                  ? 'Overdue'
                  : `${activeHolderBanner.remainingHours}h remaining`}
              </span>
            </div>
            <p className="text-sm text-rose-950 dark:text-rose-100">
              {lang === 'am' ? activeHolderBanner.messageAm : activeHolderBanner.messageEn}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              handleAcknowledge(activeHolderBanner.batchId, activeHolderBanner.holder, 200)
            }
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Quarantine Stock &amp; Acknowledge</span>
          </button>
        </div>
      )}

      {actionMsg && (
        <div
          className={`px-4 py-3 rounded-lg border text-xs flex items-center gap-2 ${actionMsg.type === 'success'
              ? 'bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white'
              : 'bg-rose-50 dark:bg-neutral-950 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
        >
          {actionMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {loading && !activeBatch ? (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200/90 dark:border-neutral-800 p-10 text-center text-sm text-slate-400">
          Loading compliance records...
        </div>
      ) : activeBatch ? (
        <section className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200/90 dark:border-neutral-800 overflow-hidden">
          {/* Batch Header */}
          <div className="p-6 border-b border-slate-100 dark:border-neutral-800 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-rose-700 dark:text-rose-400">
                  🔴 {activeBatch.severity} Recall
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                <span className="font-mono text-slate-500 dark:text-neutral-400 tabular-nums">
                  Batch #{activeBatch.batchId} ({activeBatch.batchNumber})
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-950 dark:text-white">{activeBatch.productName}</h2>
              <p className="text-sm text-slate-600 dark:text-neutral-300">{activeBatch.recallReason}</p>
            </div>

            <div className="flex items-center gap-6 shrink-0 text-right">
              <div>
                <div className="text-xs text-slate-400 dark:text-neutral-500">Recalled</div>
                <div className="text-sm font-medium text-slate-900 dark:text-white tabular-nums mt-0.5">
                  {getRelativeTime(activeBatch.recalledAt)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 dark:text-neutral-500">48h Deadline</div>
                <div
                  className={`text-sm font-medium flex items-center gap-1.5 tabular-nums mt-0.5 ${getDeadlineStatus(activeBatch.deadlineAt).isExpired
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-slate-900 dark:text-white'
                    }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{getDeadlineStatus(activeBatch.deadlineAt).text}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-neutral-800 border-b border-slate-100 dark:border-neutral-800">
            <div className="px-6 py-4">
              <div className="text-xs text-slate-500 dark:text-neutral-400">Holders Involved</div>
              <div className="text-2xl font-mono font-semibold text-slate-950 dark:text-white mt-1 tabular-nums">
                {activeBatch.totalHolders}
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-xs text-amber-700 dark:text-amber-400">⏳ Pending Quarantine</div>
              <div className="text-2xl font-mono font-semibold text-amber-800 dark:text-amber-300 mt-1 tabular-nums">
                {activeBatch.pendingHolders}
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-xs text-slate-600 dark:text-neutral-300">Acknowledged</div>
              <div className="text-2xl font-mono font-semibold text-slate-950 dark:text-white mt-1 tabular-nums">
                {activeBatch.acknowledgedHolders}
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-xs text-rose-700 dark:text-rose-400">⚠️ Overdue</div>
              <div className="text-2xl font-mono font-semibold text-rose-800 dark:text-rose-300 mt-1 tabular-nums">
                {activeBatch.overdueHolders}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-neutral-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-neutral-300 tabular-nums">
                Stock quarantined: {activeBatch.totalQuarantined} / {activeBatch.totalHeld} units
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                {activeBatch.compliancePercentage}%
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-neutral-900 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-slate-900 dark:bg-white h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(activeBatch.compliancePercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Compliance Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 border-b border-slate-100 dark:border-neutral-800">
                <tr>
                  <th className="px-6 py-3 font-medium">Holder Organization</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Quarantined</th>
                  <th className="px-4 py-3 font-medium">Elapsed</th>
                  <th className="px-4 py-3 font-medium">Evidence</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                {activeBatch.holders.map((holderRecord) => {
                  const deadlinePassed = getDeadlineStatus(activeBatch.deadlineAt).isExpired;
                  return (
                    <tr key={holderRecord.holder} className="hover:bg-slate-50/60 dark:hover:bg-neutral-900 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-slate-900 dark:text-white">{holderRecord.holderName}</div>
                        <div className="font-mono text-[11px] text-slate-400 dark:text-neutral-500 truncate max-w-[160px]">
                          {holderRecord.holder}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 capitalize text-slate-600 dark:text-neutral-300">
                        {holderRecord.holderRole}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {holderRecord.status === 'Acknowledged' && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Acknowledged</span>
                          </span>
                        )}
                        {holderRecord.status === 'Pending' && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pending</span>
                          </span>
                        )}
                        {holderRecord.status === 'Overdue' && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Overdue</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-800 dark:text-neutral-200 tabular-nums whitespace-nowrap">
                        {holderRecord.qtyQuarantined} / {holderRecord.qtyHeld}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">
                        {getRelativeTime(holderRecord.recalledAt)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {holderRecord.evidenceCid ? (
                          <a
                            href={`https://ipfs.io/ipfs/${holderRecord.evidenceCid.replace('ipfs://', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-700 dark:text-neutral-300 hover:underline inline-flex items-center gap-1 font-mono"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{holderRecord.evidenceCid.replace('ipfs://', '').slice(0, 10)}...</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 dark:text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {holderRecord.status === 'Pending' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleAcknowledge(
                                  activeBatch.batchId,
                                  holderRecord.holder,
                                  holderRecord.qtyHeld
                                )
                              }
                              disabled={actionLoading !== null}
                              className="px-2.5 py-1 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-900 dark:text-white border border-slate-200 dark:border-neutral-800 rounded-md text-xs font-medium cursor-pointer"
                            >
                              Ack 100%
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleMarkOverdue(activeBatch.batchId, holderRecord.holder)
                            }
                            disabled={
                              actionLoading !== null ||
                              holderRecord.status === 'Acknowledged' ||
                              holderRecord.status === 'Overdue' ||
                              !deadlinePassed
                            }
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${holderRecord.status === 'Overdue' ||
                                holderRecord.status === 'Acknowledged' ||
                                !deadlinePassed
                                ? 'bg-slate-100 dark:bg-neutral-900 text-slate-400 dark:text-neutral-500 cursor-not-allowed'
                                : 'bg-rose-700 hover:bg-rose-800 text-white cursor-pointer'
                              }`}
                          >
                            {holderRecord.status === 'Overdue' ? 'Overdue' : 'Mark Overdue'}
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
        <div className="p-10 text-center bg-white dark:bg-neutral-950 rounded-xl border border-slate-200/90 dark:border-neutral-800 space-y-3">
          <p className="text-sm text-slate-500 dark:text-neutral-400">No active recall compliance data found.</p>
          <button
            type="button"
            onClick={handleResetSeed}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-medium rounded-lg cursor-pointer"
          >
            Seed Demo Recalled Batch
          </button>
        </div>
      )}
    </div>
  );
}
