/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Pharmacy Trust Score View
 * Implements: FR-TS-01 to FR-TS-07, NFR-26, Section 4.3 and 4.4
 *
 * Rules:
 * 1. Never color alone; always use emoji + text (FR-VA-03).
 * 2. Deterministic published formula (FR-TS-03).
 * 3. Explainability: every score delta links to cause (ref_tx or regulator action).
 * 4. Anonymous reports NEVER change score (Fairness rule 4.4).
 * 5. Mandatory label: "Based on recorded activity in MediTrust" (FR-TS-07).
 * 6. Pharmacy response note as IPFS hash on negative events (Section 4.4).
 */

import React, { useState, useEffect } from 'react';
import {
  Award,
  ShieldCheck,
  AlertTriangle,
  Building2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  ExternalLink,
  Filter,
  FileText,
  MessageSquare,
  Sparkles,
  Info,
  Calendar,
  Layers,
  TrendingDown,
  TrendingUp,
  RefreshCw,
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

  // Response note modal state (Section 4.4)
  const [respondingEvent, setRespondingEvent] = useState<ScoreEventRecord | null>(null);
  const [responseIpfs, setResponseIpfs] = useState<string>('');
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);
  const [responseSuccessMsg, setResponseSuccessMsg] = useState<string | null>(null);

  // Fetch ranked pharmacies
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
            (p: PharmacyProfile) => p.pharmacy.toLowerCase() === selectedPharmacy.pharmacy.toLowerCase()
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

  // Handle pharmacy response note attachment (Section 4.4)
  const handleAttachResponseNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPharmacy || !respondingEvent || !responseIpfs.trim()) return;

    setIsSubmittingNote(true);
    setResponseSuccessMsg(null);
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
            ? 'የፋርማሲው ምላሽ በIPFS በኩል ተመዝግቧል!'
            : 'Pharmacy response note attached via IPFS!'
        );
        setRespondingEvent(null);
        setResponseIpfs('');
        fetchPharmacies();
      } else {
        alert(data.error || 'Failed to submit response note');
      }
    } catch (err: any) {
      alert(`Error submitting note: ${err.message}`);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Badge presentation helper (Hard Rule 4: never color alone, always emoji + text)
  const renderBadge = (badge: BadgeLevel) => {
    switch (badge) {
      case 'Gold':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800">
            <span>🥇</span>
            <span>{lang === 'am' ? 'ወርቅ ደረጃ (Gold)' : 'Gold Verified'}</span>
          </span>
        );
      case 'Silver':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
            <span>🥈</span>
            <span>{lang === 'am' ? 'ብር ደረጃ (Silver)' : 'Silver Verified'}</span>
          </span>
        );
      case 'Bronze':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300 dark:bg-orange-950/70 dark:text-orange-200 dark:border-orange-800">
            <span>🥉</span>
            <span>{lang === 'am' ? 'ነሐስ ደረጃ (Bronze)' : 'Bronze Caution'}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Section / Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {lang === 'am' ? 'የፋርማሲ ታማኝነት ነጥብ (FR-TS-01)' : 'Pharmacy Trust Score'}
            </h2>
            <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-full font-semibold border border-emerald-300 dark:border-emerald-800">
              {lang === 'am' ? 'ግልጽ የነጥብ አሰጣጥ' : 'Deterministic Audit'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'am'
              ? 'በመረጃና በእውነተኛ ድርጊቶች ላይ የተመሰረተ የታማኝነት ማረጋገጫ (ክፍል 4.3)'
              : 'Deterministic scoring computed directly from on-chain recall actions and regulatory confirmations.'}
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setActiveSubTab('directory')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center space-x-1.5 ${
              activeSubTab === 'directory'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{lang === 'am' ? 'ፋርማሲዎች' : 'Pharmacy Directory'}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('formula')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center space-x-1.5 ${
              activeSubTab === 'formula'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{lang === 'am' ? 'ቀመርና መመሪያ (FR-TS-03)' : 'Published Formula'}</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'formula' ? (
        /* Published Formula & Weight Documentation Card (FR-TS-03) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <span>{lang === 'am' ? 'ግልጽ የነጥብ አሰጣጥ ቀመር (Published Formula)' : 'Public Deterministic Scoring Formula'}</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {lang === 'am'
                ? 'የኢትዮጵያ መድኃኒት ቁጥጥር ባለስልጣንና ታካሚዎችን ለመጠበቅ የተዘረጋው ቀመር ሙሉ በሙሉ ግልጽና ሊሰላ የሚችል ነው።'
                : 'Every weight and cap is published and deterministic. Recomputation from chain events is fully idempotent.'}
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
            <div className="font-bold text-slate-900 dark:text-white mb-1">
              {lang === 'am' ? 'የሂሳብ ቀመር፡' : 'Formula Specification:'}
            </div>
            {lang === 'am'
              ? TRUST_SCORE_CONFIG.formulaDocumentationAm
              : TRUST_SCORE_CONFIG.formulaDocumentationEn}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Positive Signals */}
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
              <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                <TrendingUp className="w-4 h-4" />
                <span>{lang === 'am' ? 'ነጥብ የሚጨምሩ ድርጊቶች' : 'Positive Compliance Signals'}</span>
              </div>
              <ul className="text-xs space-y-2 text-slate-700 dark:text-slate-300">
                <li className="flex justify-between">
                  <span>{lang === 'am' ? 'የመነሻ ነጥብ (Base Score)' : 'Base Starting Score'}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">50 pts</span>
                </li>
                <li className="flex justify-between">
                  <span>{lang === 'am' ? 'የእገዳ ጥሪ በ48 ሰዓት ማረጋገጥ' : 'Recall acknowledged on-time (FR-RR-06)'}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">+{TRUST_SCORE_CONFIG.weights.recallAcknowledgedOnTime} pts</span>
                </li>
                <li className="flex justify-between">
                  <span>{lang === 'am' ? 'የተባዛ ኮድ ሙከራን በጠረጴዛው መከልከል' : 'Clone attempt intercepted at counter'}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">+{TRUST_SCORE_CONFIG.weights.cloneAttemptCaught} pts / event (cap {TRUST_SCORE_CONFIG.weights.cloneAttemptCap})</span>
                </li>
                <li className="flex justify-between">
                  <span>{lang === 'am' ? 'ንቁ ወራት ያለ ቅሬታ' : 'Active months without incident'}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">+{TRUST_SCORE_CONFIG.weights.monthActiveNoIncident} pt / mo (cap {TRUST_SCORE_CONFIG.weights.monthActiveCap})</span>
                </li>
                <li className="flex justify-between">
                  <span>{lang === 'am' ? 'የማብቂያ ቀን ጥበቃ (Expiry Hygiene)' : 'Expiry hygiene audit passed'}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">+{TRUST_SCORE_CONFIG.weights.expiryHygiene} pts</span>
                </li>
              </ul>
            </div>

            {/* Negative Signals & Fairness */}
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 space-y-3">
              <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                <TrendingDown className="w-4 h-4" />
                <span>{lang === 'am' ? 'ነጥብ የሚቀንሱ ቅጣቶች' : 'Penalties & Fairness Rules'}</span>
              </div>
              <ul className="text-xs space-y-2 text-slate-700 dark:text-slate-300">
                <li className="flex justify-between">
                  <span>{lang === 'am' ? 'የእገዳ ጥሪ በ48 ሰዓት አለማረጋገጥ (Overdue)' : 'Recall overdue on-chain (FR-RR-09)'}</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{TRUST_SCORE_CONFIG.weights.recallOverdue} pts</span>
                </li>
                <li className="flex justify-between">
                  <span>{lang === 'am' ? 'የተረጋገጠ አጠራጣሪ መድኃኒት (Confirmed Report)' : 'Regulator-confirmed counterfeit'}</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{TRUST_SCORE_CONFIG.weights.confirmedCounterfeitReport} pts / report</span>
                </li>
                <li className="flex justify-between">
                  <span>{lang === 'am' ? 'ያለ ደረሰኝ ሽያጭ (Custody sales gap)' : 'Unreconciled custody sales gap'}</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{TRUST_SCORE_CONFIG.weights.custodySalesGap} pts</span>
                </li>
                <li className="flex justify-between pt-1 border-t border-rose-200 dark:border-rose-900">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {lang === 'am' ? 'ስም-አልባ ጥቆማዎች (Section 4.4)' : 'Anonymous / unverified reports'}
                  </span>
                  <span className="font-bold text-slate-500">0 pts (No change)</span>
                </li>
                <li className="flex justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {lang === 'am' ? 'ውድቅ የተደረጉ ቅሬታዎች' : 'Dismissed reports'}
                  </span>
                  <span className="font-bold text-slate-500">0 pts (No change)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Badge Tiers Table */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              {lang === 'am' ? 'የደረጃ እርከኖች (Badge Tiers)' : 'Badge Tiers & Thresholds (FR-TS-02)'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 text-xs">
                <div className="flex items-center space-x-1.5 font-bold text-amber-900 dark:text-amber-200">
                  <span>🥇 Gold Badge</span>
                </div>
                <div className="text-slate-600 dark:text-slate-300 mt-1">
                  Score &ge; <strong>80 / 100</strong>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">High compliance, safe pharmacy</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs">
                <div className="flex items-center space-x-1.5 font-bold text-slate-900 dark:text-slate-200">
                  <span>🥈 Silver Badge</span>
                </div>
                <div className="text-slate-600 dark:text-slate-300 mt-1">
                  Score <strong>60 to 79</strong>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Standard verified pharmacy</div>
              </div>
              <div className="p-3 rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/20 text-xs">
                <div className="flex items-center space-x-1.5 font-bold text-orange-900 dark:text-orange-200">
                  <span>🥉 Bronze Badge</span>
                </div>
                <div className="text-slate-600 dark:text-slate-300 mt-1">
                  Score &lt; <strong>60</strong>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Under regulatory scrutiny</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Pharmacy Directory & Detailed Profile */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Ranked List & Filters (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'am' ? 'በስም ወይም በፈቃድ ቁጥር ፈልግ...' : 'Search by name or EFDA license...'}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Filter Tabs & Regulator "Below Threshold" Filter (FR-TS-06) */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterMode === 'all'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    All ({pharmacies.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('gold')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterMode === 'gold'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    🥇 Gold
                  </button>
                  <button
                    onClick={() => setFilterMode('silver')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterMode === 'silver'
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    🥈 Silver
                  </button>
                  <button
                    onClick={() => setFilterMode('bronze')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      filterMode === 'bronze'
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    🥉 Bronze
                  </button>
                  <button
                    onClick={() => setFilterMode('below_threshold')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center space-x-1 ${
                      filterMode === 'below_threshold'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}
                    title="Regulator filter: shows pharmacies below safety threshold"
                  >
                    <Filter className="w-3 h-3" />
                    <span>{lang === 'am' ? 'ከደረጃው በታች (Regulator)' : 'Below Threshold'}</span>
                  </button>
                </div>

                {filterMode === 'below_threshold' && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs">
                    <span className="text-rose-800 dark:text-rose-200 font-medium">
                      {lang === 'am' ? 'የመቆጣጠሪያ ጣሪያ፡' : 'Cutoff Threshold:'}
                    </span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={thresholdValue}
                        onChange={(e) => setThresholdValue(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-center bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-lg font-mono text-xs font-bold"
                      />
                      <span className="text-slate-500 text-[10px]">pts</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pharmacies List */}
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Loading pharmacies...</span>
                </div>
              ) : pharmacies.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  {lang === 'am' ? 'ተመሳሳይ ፋርማሲ አልተገኘም' : 'No pharmacies match this filter criteria'}
                </div>
              ) : (
                pharmacies.map((p) => {
                  const isSelected = selectedPharmacy?.pharmacy.toLowerCase() === p.pharmacy.toLowerCase();
                  return (
                    <div
                      key={p.pharmacy}
                      onClick={() => setSelectedPharmacy(p)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-50/70 border-emerald-500 dark:bg-emerald-950/40 dark:border-emerald-600 shadow-xs'
                          : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                            {p.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {p.licenseNo} • {p.region}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                            {p.score}{' '}
                            <span className="text-[10px] font-normal text-slate-400">/ 100</span>
                          </div>
                          <div className="mt-0.5">{renderBadge(p.badge)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Profile, Breakdown & Explainability Feed (7 cols) */}
          <div className="lg:col-span-7">
            {selectedPharmacy ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
                {/* Profile Header */}
                <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        {renderBadge(selectedPharmacy.badge)}
                        <span className="text-xs text-slate-400 font-mono">
                          {selectedPharmacy.licenseNo}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1.5">
                        {selectedPharmacy.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        {selectedPharmacy.pharmacy}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                      <div className="text-center">
                        <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {selectedPharmacy.score}
                        </div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">
                          Trust Score
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mandatory Label (FR-TS-07) */}
                  <div className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{selectedPharmacy.disclaimer}</span>
                  </div>
                </div>

                {/* Deterministic Score Breakdown (FR-TS-01, FR-TS-05) */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                    {lang === 'am' ? 'የነጥብ ስሌት ዝርዝር (Score Breakdown)' : 'Deterministic Score Breakdown'}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Base Score</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {selectedPharmacy.breakdown.baseScore}
                      </div>
                      <div className="text-[10px] text-slate-400">Fixed starting point</div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Recall On-Time</div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +{selectedPharmacy.breakdown.recallAcknowledgedDelta}
                      </div>
                      <div className="text-[10px] text-slate-400">Quarantine compliance</div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Clones Blocked</div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +{selectedPharmacy.breakdown.cloneAttemptDelta}
                      </div>
                      <div className="text-[10px] text-slate-400">Capped at +10</div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Active Months</div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +{selectedPharmacy.breakdown.monthsActiveDelta}
                      </div>
                      <div className="text-[10px] text-slate-400">Clean operations</div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Recall Overdue</div>
                      <div className={`text-sm font-bold mt-0.5 ${selectedPharmacy.breakdown.recallOverdueDelta < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {selectedPharmacy.breakdown.recallOverdueDelta}
                      </div>
                      <div className="text-[10px] text-slate-400">-30 per overdue</div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Confirmed Fake</div>
                      <div className={`text-sm font-bold mt-0.5 ${selectedPharmacy.breakdown.confirmedReportDelta < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {selectedPharmacy.breakdown.confirmedReportDelta}
                      </div>
                      <div className="text-[10px] text-slate-400">-25 per confirmed</div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Custody Gap</div>
                      <div className={`text-sm font-bold mt-0.5 ${selectedPharmacy.breakdown.custodyGapDelta < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {selectedPharmacy.breakdown.custodyGapDelta}
                      </div>
                      <div className="text-[10px] text-slate-400">-20 per breach</div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Expiry Hygiene</div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +{selectedPharmacy.breakdown.expiryHygieneDelta}
                      </div>
                      <div className="text-[10px] text-slate-400">Expired stock audit</div>
                    </div>
                  </div>
                </div>

                {/* Explainability Event Feed (FR-TS-05, NFR-26) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      {lang === 'am' ? 'የተመዘገቡ ድርጊቶችና ማስረጃዎች (NFR-26 Explainability)' : 'Recorded Activity & Evidence Feed (NFR-26)'}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {selectedPharmacy.events.length} {lang === 'am' ? 'ድርጊቶች' : 'events'}
                    </span>
                  </div>

                  {responseSuccessMsg && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{responseSuccessMsg}</span>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {selectedPharmacy.events.map((ev) => (
                      <div
                        key={ev.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                          ev.isNegative
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start space-x-2">
                            {ev.isNegative ? (
                              <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {lang === 'am' ? ev.descriptionAm : ev.descriptionEn}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                                <span>{new Date(ev.createdAt).toLocaleDateString()}</span>
                                <span>•</span>
                                <span className="font-mono truncate max-w-[200px]">
                                  Ref: {ev.refTx ? `${ev.refTx.slice(0, 14)}...` : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                                ev.delta > 0
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : ev.delta < 0
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {ev.delta > 0 ? `+${ev.delta}` : ev.delta} pts
                            </span>
                          </div>
                        </div>

                        {/* Evidence link & response note */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                          {ev.evidenceCid ? (
                            <a
                              href={`https://ipfs.io/ipfs/${ev.evidenceCid.replace('ipfs://', '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Evidence: {ev.evidenceCid.slice(0, 18)}...</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">On-chain transaction proof verified</span>
                          )}

                          {/* Pharmacy Response Note (Section 4.4) */}
                          {ev.responseNoteIpfs ? (
                            <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              <span className="font-medium">
                                {lang === 'am' ? 'የፋርማሲው ምላሽ፡' : 'Pharmacy Note:'}
                              </span>
                              <a
                                href={`https://ipfs.io/ipfs/${ev.responseNoteIpfs.replace('ipfs://', '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-600 dark:text-sky-400 hover:underline font-mono"
                              >
                                {ev.responseNoteIpfs.slice(0, 20)}...
                              </a>
                            </div>
                          ) : ev.isNegative ? (
                            <button
                              onClick={() => setRespondingEvent(ev)}
                              className="text-slate-600 dark:text-slate-300 hover:text-emerald-600 font-semibold flex items-center space-x-1"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>{lang === 'am' ? 'ምላሽ አስቀምጥ (IPFS)' : 'Attach Response Note (IPFS)'}</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                Select a pharmacy from the directory to inspect its score breakdown.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Response Note Modal (Section 4.4) */}
      {respondingEvent && selectedPharmacy && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {lang === 'am' ? 'የፋርማሲ ምላሽ ማያያዣ (Section 4.4)' : 'Attach Pharmacy Response Note'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Event: {respondingEvent.descriptionEn}
                </p>
              </div>
              <button
                onClick={() => setRespondingEvent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAttachResponseNote} className="space-y-3.5">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {lang === 'am'
                  ? 'ፋርማሲዎች ለማንኛውም ቅጣት የራሳቸውን ማብራሪያ ወይም የማስተካከያ እርምጃ የIPFS ማስረጃ ማያያዝ ይችላሉ።'
                  : 'Pharmacies may publish a cryptographic response note (IPFS CID) to provide context or proof of corrective actions for any negative score event.'}
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  IPFS CID / Hash (e.g. ipfs://bafybeiclkmedi7...)
                </label>
                <input
                  type="text"
                  required
                  value={responseIpfs}
                  onChange={(e) => setResponseIpfs(e.target.value)}
                  placeholder="ipfs://bafybeia... or CID"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-300">
                  Fairness Invariant
                </div>
                <div>
                  Response notes are permanently linked to the event and visible on public audit logs without altering the deterministic chain score.
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRespondingEvent(null)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNote || !responseIpfs.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
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
