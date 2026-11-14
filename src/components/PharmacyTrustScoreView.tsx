/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Pharmacy Trust Score View
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  PharmacyProfile,
  ScoreEventRecord,
} from '../services/trustScoreService.ts';
import { TRUST_SCORE_CONFIG, BadgeLevel } from '../config/trustScoreConfig.ts';

interface PharmacyTrustScoreViewProps {
  lang: 'en' | 'am';
}

export function PharmacyTrustScoreView({ lang }: PharmacyTrustScoreViewProps) {
  const [pharmacies, setPharmacies] = useState<PharmacyProfile[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyProfile | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'gold' | 'silver' | 'bronze' | 'below_threshold'>('all');
  const [thresholdValue, setThresholdValue] = useState<number>(60);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'formula'>('directory');

  const [respondingEvent, setRespondingEvent] = useState<ScoreEventRecord | null>(null);
  const [responseIpfs, setResponseIpfs] = useState<string>('');
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);
  const [responseSuccessMsg, setResponseSuccessMsg] = useState<string | null>(null);
  const [responseErrorMsg, setResponseErrorMsg] = useState<string | null>(null);

  const fetchPharmacies = async () => {
    setIsLoading(true);
    try {
      let url = '/api/pharmacies/scores?';
      if (filterMode === 'below_threshold') {
        url += `belowThreshold=${thresholdValue}&`;
      } else if (filterMode !== 'all') {
        const badgeMap: Record<string, string> = {
          gold: 'Gold',
          silver: 'Silver',
          bronze: 'Bronze',
        };
        url += `badge=${badgeMap[filterMode]}&`;
      }
      if (searchQuery.trim()) {
        url += `query=${encodeURIComponent(searchQuery.trim())}&`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPharmacies(data.pharmacies);
        if (data.pharmacies.length > 0 && !selectedPharmacy) {
          setSelectedPharmacy(data.pharmacies[0]);
        } else if (selectedPharmacy) {
          const updated = data.pharmacies.find(
            (p: PharmacyProfile) =>
              p.pharmacy.toLowerCase() === selectedPharmacy.pharmacy.toLowerCase()
          );
          if (updated) setSelectedPharmacy(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load pharmacy trust scores:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPharmacies();
  }, [filterMode, thresholdValue, searchQuery]);

  const handleAttachResponseNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPharmacy || !respondingEvent || !responseIpfs.trim()) return;

    setIsSubmittingNote(true);
    setResponseSuccessMsg(null);
    setResponseErrorMsg(null);
    try {
      const res = await fetch('/api/pharmacies/respond-to-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacy: selectedPharmacy.pharmacy,
          eventId: respondingEvent.id,
          responseNoteIpfs: responseIpfs.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResponseSuccessMsg(
          lang === 'am'
            ? 'የፋርማሲው ምላሽ በIPFS በኩል ተመዝግቧል።'
            : 'Pharmacy response note attached via IPFS.'
        );
        setRespondingEvent(null);
        setResponseIpfs('');
        fetchPharmacies();
      } else {
        setResponseErrorMsg(data.error || 'Failed to submit response note');
      }
    } catch (err: any) {
      setResponseErrorMsg(`Error submitting note: ${err.message}`);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const renderBadgeText = (badge: BadgeLevel) => {
    switch (badge) {
      case 'Gold':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <span aria-hidden="true">🥇</span>
            <span>{lang === 'am' ? 'ወርቅ ደረጃ (Gold)' : 'Gold Verified'}</span>
          </span>
        );
      case 'Silver':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-neutral-300">
            <span aria-hidden="true">🥈</span>
            <span>{lang === 'am' ? 'ብር ደረጃ (Silver)' : 'Silver Verified'}</span>
          </span>
        );
      case 'Bronze':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
            <span aria-hidden="true">🥉</span>
            <span>{lang === 'am' ? 'ነሐስ ደረጃ (Bronze)' : 'Bronze Caution'}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {lang === 'am' ? 'የፋርማሲ ታማኝነት ነጥብ' : 'Pharmacy Trust Directory'}
        </h1>

        <div className="inline-flex items-center bg-slate-100 dark:bg-neutral-900 p-1 rounded-lg border border-slate-200/80 dark:border-neutral-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('directory')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${activeSubTab === 'directory'
                ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            {lang === 'am' ? 'ፋርማሲዎች' : 'Directory'}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('formula')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${activeSubTab === 'formula'
                ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            {lang === 'am' ? 'የነጥብ ቀመር' : 'Scoring Formula'}
          </button>
        </div>
      </div>

      {activeSubTab === 'formula' ? (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200/90 dark:border-neutral-800 p-6 sm:p-8 space-y-8">
          <div className="border-b border-slate-100 dark:border-neutral-800 pb-5">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              {lang === 'am' ? 'ግልጽ የነጥብ አሰጣጥ ቀመር' : 'Public Deterministic Scoring Formula'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-neutral-400 mt-1">
              {lang === 'am'
                ? 'ቀመሩ ሙሉ በሙሉ ግልጽና ሊሰላ የሚችል ነው።'
                : 'Every weight and cap is published and deterministic. Recomputation is idempotent.'}
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-neutral-900 rounded-lg font-mono text-xs text-slate-800 dark:text-neutral-200 leading-relaxed">
            {lang === 'am'
              ? TRUST_SCORE_CONFIG.formulaDocumentationAm
              : TRUST_SCORE_CONFIG.formulaDocumentationEn}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {lang === 'am' ? 'ነጥብ የሚጨምሩ ድርጊቶች' : 'Positive Compliance Signals'}
              </h3>
              <dl className="divide-y divide-slate-100 dark:divide-neutral-800 text-sm">
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-600 dark:text-neutral-400">Base starting score</dt>
                  <dd className="font-mono font-medium text-slate-900 dark:text-white tabular-nums">50 pts</dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-600 dark:text-neutral-400">Recall acknowledged on-time</dt>
                  <dd className="font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                    +{TRUST_SCORE_CONFIG.weights.recallAcknowledgedOnTime} pts
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-600 dark:text-neutral-400">Clone attempt intercepted</dt>
                  <dd className="font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                    +{TRUST_SCORE_CONFIG.weights.cloneAttemptCaught} / event (cap {TRUST_SCORE_CONFIG.weights.cloneAttemptCap})
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-600 dark:text-neutral-400">Clean active months</dt>
                  <dd className="font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                    +{TRUST_SCORE_CONFIG.weights.monthActiveNoIncident} / mo (cap {TRUST_SCORE_CONFIG.weights.monthActiveCap})
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-600 dark:text-neutral-400">Expiry hygiene audit passed</dt>
                  <dd className="font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                    +{TRUST_SCORE_CONFIG.weights.expiryHygiene} pts
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {lang === 'am' ? 'ቅጣቶች እና የፍትህ ህግ' : 'Penalties & Fairness Rules'}
              </h3>
              <dl className="divide-y divide-slate-100 dark:divide-neutral-800 text-sm">
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-600 dark:text-neutral-400">Recall overdue on-chain</dt>
                  <dd className="font-mono font-medium text-rose-700 dark:text-rose-400 tabular-nums">
                    {TRUST_SCORE_CONFIG.weights.recallOverdue} pts
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-600 dark:text-neutral-400">Confirmed counterfeit report</dt>
                  <dd className="font-mono font-medium text-rose-700 dark:text-rose-400 tabular-nums">
                    {TRUST_SCORE_CONFIG.weights.confirmedCounterfeitReport} pts
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-600 dark:text-neutral-400">Unreconciled custody sales gap</dt>
                  <dd className="font-mono font-medium text-rose-700 dark:text-rose-400 tabular-nums">
                    {TRUST_SCORE_CONFIG.weights.custodySalesGap} pts
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-600 dark:text-neutral-400">Anonymous / unverified reports</dt>
                  <dd className="font-mono text-slate-500 dark:text-neutral-400 tabular-nums">0 pts</dd>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-slate-600 dark:text-neutral-400">Dismissed reports</dt>
                  <dd className="font-mono text-slate-500 dark:text-neutral-400 tabular-nums">0 pts</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-neutral-800 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">🥇 Gold Badge</div>
              <div className="text-slate-600 dark:text-neutral-300 mt-1 tabular-nums">Score ≥ 80 / 100</div>
              <div className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">High compliance, verified pharmacy</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">🥈 Silver Badge</div>
              <div className="text-slate-600 dark:text-neutral-300 mt-1 tabular-nums">Score 60 to 79</div>
              <div className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">Standard verified pharmacy</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">🥉 Bronze Badge</div>
              <div className="text-slate-600 dark:text-neutral-300 mt-1 tabular-nums">Score &lt; 60</div>
              <div className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">Under regulatory scrutiny</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Search, Filters, and List */}
          <div className="lg:col-span-5 bg-white dark:bg-neutral-950 rounded-xl border border-slate-200/90 dark:border-neutral-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-neutral-800 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'am' ? 'በስም ወይም በፈቃድ ቁጥር ፈልግ...' : 'Search by name or license...'}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-xs text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-neutral-900 focus:border-slate-500 dark:focus:border-neutral-500"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  { id: 'all' as const, label: `All (${pharmacies.length})` },
                  { id: 'gold' as const, label: '🥇 Gold' },
                  { id: 'silver' as const, label: '🥈 Silver' },
                  { id: 'bronze' as const, label: '🥉 Bronze' },
                  { id: 'below_threshold' as const, label: lang === 'am' ? 'ከጣሪያ በታች' : 'Below Threshold' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id)}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${filterMode === tab.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-black'
                        : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filterMode === 'below_threshold' && (
                <div className="pt-1 flex items-center justify-between text-xs text-slate-600 dark:text-neutral-400">
                  <span>{lang === 'am' ? 'የመቆጣጠሪያ ጣሪያ፡' : 'Cutoff threshold (pts):'}</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={thresholdValue}
                    onChange={(e) => setThresholdValue(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-center bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-md font-mono text-xs text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-neutral-800 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500 dark:text-neutral-400" />
                  <span>Loading pharmacies...</span>
                </div>
              ) : pharmacies.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {lang === 'am' ? 'ተመሳሳይ ፋርማሲ አልተገኘም' : 'No pharmacies match this filter.'}
                </div>
              ) : (
                pharmacies.map((p) => {
                  const isSelected =
                    selectedPharmacy?.pharmacy.toLowerCase() === p.pharmacy.toLowerCase();
                  return (
                    <button
                      key={p.pharmacy}
                      type="button"
                      onClick={() => setSelectedPharmacy(p)}
                      className={`w-full text-left px-4 py-3.5 transition-colors flex items-center justify-between gap-3 cursor-pointer ${isSelected
                          ? 'bg-slate-100/90 dark:bg-neutral-900'
                          : 'hover:bg-slate-50/80 dark:hover:bg-neutral-900'
                        }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5 truncate">
                          <span className="font-mono">{p.licenseNo}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{p.region}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-semibold text-slate-950 dark:text-white tabular-nums">
                          {p.score} <span className="text-xs font-normal text-slate-400">/ 100</span>
                        </div>
                        <div className="mt-0.5">{renderBadgeText(p.badge)}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Pharmacy Detail Profile */}
          <div className="lg:col-span-7">
            {selectedPharmacy ? (
              <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200/90 dark:border-neutral-800 overflow-hidden">
                {/* Profile Header */}
                <div className="p-6 border-b border-slate-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div>{renderBadgeText(selectedPharmacy.badge)}</div>
                    <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                      {selectedPharmacy.name}
                    </h2>
                    <div className="text-xs text-slate-500 dark:text-neutral-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono">{selectedPharmacy.licenseNo}</span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedPharmacy.region}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-400 dark:text-neutral-500">
                        {selectedPharmacy.pharmacy.slice(0, 10)}...{selectedPharmacy.pharmacy.slice(-6)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-neutral-400 pt-1">
                      {selectedPharmacy.disclaimer}
                    </p>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <div className="text-3xl font-mono font-semibold text-slate-950 dark:text-white tabular-nums">
                      {selectedPharmacy.score}
                      <span className="text-sm font-normal text-slate-400"> / 100</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Trust Score</div>
                  </div>
                </div>

                {/* Score Breakdown Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-x divide-slate-100 dark:divide-neutral-800 border-b border-slate-100 dark:border-neutral-800">
                  <div className="px-5 py-3.5">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">Base Score</div>
                    <div className="text-sm font-mono font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {selectedPharmacy.breakdown.baseScore}
                    </div>
                  </div>
                  <div className="px-5 py-3.5">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">Recall On-Time</div>
                    <div className="text-sm font-mono font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      +{selectedPharmacy.breakdown.recallAcknowledgedDelta}
                    </div>
                  </div>
                  <div className="px-5 py-3.5">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">Clones Blocked</div>
                    <div className="text-sm font-mono font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      +{selectedPharmacy.breakdown.cloneAttemptDelta}
                    </div>
                  </div>
                  <div className="px-5 py-3.5">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">Active Months</div>
                    <div className="text-sm font-mono font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      +{selectedPharmacy.breakdown.monthsActiveDelta}
                    </div>
                  </div>
                  <div className="px-5 py-3.5">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">Recall Overdue</div>
                    <div
                      className={`text-sm font-mono font-semibold mt-0.5 tabular-nums ${selectedPharmacy.breakdown.recallOverdueDelta < 0
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-slate-400 dark:text-neutral-500'
                        }`}
                    >
                      {selectedPharmacy.breakdown.recallOverdueDelta}
                    </div>
                  </div>
                  <div className="px-5 py-3.5">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">Confirmed Fake</div>
                    <div
                      className={`text-sm font-mono font-semibold mt-0.5 tabular-nums ${selectedPharmacy.breakdown.confirmedReportDelta < 0
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-slate-400 dark:text-neutral-500'
                        }`}
                    >
                      {selectedPharmacy.breakdown.confirmedReportDelta}
                    </div>
                  </div>
                  <div className="px-5 py-3.5">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">Custody Gap</div>
                    <div
                      className={`text-sm font-mono font-semibold mt-0.5 tabular-nums ${selectedPharmacy.breakdown.custodyGapDelta < 0
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-slate-400 dark:text-neutral-500'
                        }`}
                    >
                      {selectedPharmacy.breakdown.custodyGapDelta}
                    </div>
                  </div>
                  <div className="px-5 py-3.5">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">Expiry Hygiene</div>
                    <div className="text-sm font-mono font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      +{selectedPharmacy.breakdown.expiryHygieneDelta}
                    </div>
                  </div>
                </div>

                {/* Activity & Evidence Timeline */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {lang === 'am' ? 'የተመዘገቡ ድርጊቶችና ማስረጃዎች' : 'Recorded Activity & Evidence'}
                    </h3>
                    <span className="text-xs text-slate-400 dark:text-neutral-500 tabular-nums">
                      {selectedPharmacy.events.length} {lang === 'am' ? 'ድርጊቶች' : 'events'}
                    </span>
                  </div>

                  {responseSuccessMsg && (
                    <div className="p-3 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white rounded-lg text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{responseSuccessMsg}</span>
                    </div>
                  )}

                  <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                    {selectedPharmacy.events.map((ev) => (
                      <div key={ev.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            {ev.isNegative ? (
                              <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-slate-500 dark:text-neutral-400 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="text-sm font-medium text-slate-900 dark:text-white">
                                {lang === 'am' ? ev.descriptionAm : ev.descriptionEn}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                                <span className="tabular-nums">
                                  {new Date(ev.createdAt).toLocaleDateString()}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono">
                                  Ref {ev.refTx ? `${ev.refTx.slice(0, 12)}...` : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-xs font-mono font-semibold shrink-0 tabular-nums ${ev.delta > 0
                                ? 'text-slate-900 dark:text-white'
                                : ev.delta < 0
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : 'text-slate-500 dark:text-neutral-400'
                              }`}
                          >
                            {ev.delta > 0 ? `+${ev.delta}` : ev.delta} pts
                          </span>
                        </div>

                        <div className="pl-6 flex flex-wrap items-center justify-between gap-2 text-xs">
                          {ev.evidenceCid ? (
                            <a
                              href={`https://ipfs.io/ipfs/${ev.evidenceCid.replace('ipfs://', '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-700 dark:text-neutral-300 hover:underline inline-flex items-center gap-1 font-mono"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{ev.evidenceCid.slice(0, 22)}...</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 dark:text-neutral-500">On-chain proof verified</span>
                          )}

                          {ev.responseNoteIpfs ? (
                            <a
                              href={`https://ipfs.io/ipfs/${ev.responseNoteIpfs.replace('ipfs://', '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-600 dark:text-neutral-300 hover:text-slate-950 dark:hover:text-white inline-flex items-center gap-1.5"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                              <span>{lang === 'am' ? 'የፋርማሲው ምላሽ፡' : 'Pharmacy note:'}</span>
                              <span className="font-mono">{ev.responseNoteIpfs.slice(0, 16)}...</span>
                            </a>
                          ) : ev.isNegative ? (
                            <button
                              type="button"
                              onClick={() => {
                                setResponseErrorMsg(null);
                                setRespondingEvent(ev);
                              }}
                              className="text-slate-600 dark:text-neutral-300 hover:text-slate-950 dark:hover:text-white font-medium inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>
                                {lang === 'am' ? 'ምላሽ አስቀምጥ (IPFS)' : 'Attach response note'}
                              </span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-sm text-slate-400 bg-white dark:bg-neutral-950 rounded-xl border border-slate-200/90 dark:border-neutral-800">
                Select a pharmacy from the directory to inspect its score breakdown.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Response Note Modal */}
      {respondingEvent && selectedPharmacy && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-950 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-neutral-800 shadow-lg space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-950 dark:text-white text-base">
                  {lang === 'am' ? 'የፋርማሲ ምላሽ ማያያዣ' : 'Attach Pharmacy Response Note'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  {respondingEvent.descriptionEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRespondingEvent(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200 p-1 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAttachResponseNote} className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-neutral-300 leading-relaxed">
                {lang === 'am'
                  ? 'ፋርማሲዎች ለማንኛውም ቅጣት የራሳቸውን ማብራሪያ የIPFS ማስረጃ ማያያዝ ይችላሉ።'
                  : 'Publish a cryptographic response note (IPFS CID) providing context or corrective action proof without altering the deterministic score.'}
              </p>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1.5 block">
                  IPFS CID / Hash
                </label>
                <input
                  type="text"
                  required
                  value={responseIpfs}
                  onChange={(e) => setResponseIpfs(e.target.value)}
                  placeholder="ipfs://bafybeia..."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-xs font-mono text-slate-900 dark:text-neutral-100 focus:outline-none focus:bg-white dark:focus:bg-neutral-900 focus:border-slate-500 dark:focus:border-neutral-500"
                />
              </div>

              {responseErrorMsg && (
                <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-neutral-950 border border-rose-200 dark:border-rose-800 rounded-lg p-2.5">
                  {responseErrorMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRespondingEvent(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNote || !responseIpfs.trim()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black rounded-lg text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingNote ? 'Submitting...' : 'Attach Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
