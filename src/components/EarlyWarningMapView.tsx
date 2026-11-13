/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Counterfeit Early-Warning Map & Anomaly Alert View
 * Implements: FR-EW-01, FR-EW-02, FR-EW-03, FR-EW-04, FR-EW-05, FR-EW-06, FR-EW-07, FR-EW-08, Section 5.2
 *
 * Enforces:
 * 1. Hard Rule 4: Never color alone, always emoji + text.
 * 2. Privacy Rule (Section 5.2): 1 km cell rounding, salted non-reversible device hashes.
 * 3. Public view shows aggregate counts only (FR-EW-08).
 * 4. Alert cards for R4, R5, R6 with 1-click investigation and on-chain recall.
 */

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Flame,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Building2,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Crosshair,
  Layers,
  Radio,
  FileText,
  AlertOctagon,
  Eye,
  Lock,
} from 'lucide-react';
import {
  GeoCellSummary,
  AnomalyAlert,
  InvestigationRecord,
  PublicSafetyPulse,
} from '../services/earlyWarningService.ts';

interface EarlyWarningMapViewProps {
  lang: 'en' | 'am';
}

export function EarlyWarningMapView({ lang }: EarlyWarningMapViewProps) {
  const [viewMode, setViewMode] = useState<'regulator' | 'public'>('regulator');
  const [mapLayer, setMapLayer] = useState<'cells' | 'heatmap'>('cells');
  const [cells, setCells] = useState<GeoCellSummary[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationRecord[]>([]);
  const [publicPulse, setPublicPulse] = useState<PublicSafetyPulse | null>(null);
  const [selectedCell, setSelectedCell] = useState<GeoCellSummary | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AnomalyAlert | null>(null);

  // Modal states for Investigation & Recall
  const [isInvestigatingModal, setIsInvestigatingModal] = useState<boolean>(false);
  const [investigationNotes, setInvestigationNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cellsRes, alertsRes, pulseRes, invRes] = await Promise.all([
        fetch('/api/early-warning/geo-cells'),
        fetch('/api/early-warning/alerts'),
        fetch('/api/early-warning/safety-pulse'),
        fetch('/api/early-warning/investigations'),
      ]);

      const cellsData = await cellsRes.json();
      const alertsData = await alertsRes.json();
      const pulseData = await pulseRes.json();
      const invData = await invRes.json();

      if (cellsData.success) {
        setCells(cellsData.cells);
        if (cellsData.cells.length > 0 && !selectedCell) {
          setSelectedCell(cellsData.cells[0]);
        }
      }
      if (alertsData.success) setAlerts(alertsData.alerts);
      if (pulseData.success) setPublicPulse(pulseData.pulse);
      if (invData.success) setInvestigations(invData.investigations);
    } catch (err) {
      console.error('Failed to load early warning data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Turn alert into investigation (FR-EW-07)
  const handleTurnIntoInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;
    setIsSubmitting(true);
    setActionSuccessMsg(null);

    try {
      const res = await fetch('/api/early-warning/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: selectedAlert.id,
          notes: investigationNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMsg(
          lang === 'am'
            ? 'አደጋው ወደ ምርመራ ተቀይሯል! የEFDA ቡድን ተመድቧል።'
            : 'Alert escalated to official EFDA Investigation record!'
        );
        setIsInvestigatingModal(false);
        fetchData();
      } else {
        alert(data.error || 'Failed to initiate investigation');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // One-click recall from alert (FR-EW-07)
  const handleOneClickRecall = async (targetAlert: AnomalyAlert) => {
    const confirmPrompt =
      lang === 'am'
        ? `ባች #${targetAlert.batchId || 1} (${targetAlert.batchNumber}) ላይ አፋጣኝ የእገዳ ጥሪ እንዲጀመር ይፈልጋሉ? 48 ሰዓት የጊዜ ገደብ በሰንሰለቱ ላይ ይጀምራል።`
        : `Trigger immediate emergency recall for Batch #${targetAlert.batchId || 1} (${targetAlert.batchNumber})? This activates the 48h quarantine deadline on-chain.`;

    if (!window.confirm(confirmPrompt)) return;

    try {
      const res = await fetch('/api/early-warning/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId: targetAlert.id,
          reason: `Rapid regulatory recall triggered from Early-Warning Anomaly ${targetAlert.rule}: ${targetAlert.title}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMsg(
          lang === 'am'
            ? `ባች #${data.batchId} በእገዳ ስር ውሏል! የ48 ሰዓት ቆጣሪ ተጀምሯል።`
            : `Batch #${data.batchId} emergency recall initiated on-chain! 48h compliance timer activated.`
        );
        fetchData();
      } else {
        alert(data.error || 'Recall failed');
      }
    } catch (err: any) {
      alert(`Error initiating recall: ${err.message}`);
    }
  };

  // Seed demo scenarios (Section 10 Demo steps)
  const handleSeedDemo = async () => {
    try {
      const res = await fetch('/api/early-warning/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMsg(
          lang === 'am'
            ? 'የማሳያ ሁኔታዎች ተዘጋጅተዋል፡ የውሸት QR ጭማሪ (R4)፣ የቦሌ ክላስተር (R5)፣ የተባዛ ኮድ (R6)'
            : 'Demo scenarios seeded: Fake QR spike (R4), Bole cluster (R5), Clone scan (R6)!'
        );
        fetchData();
      }
    } catch (err: any) {
      alert(`Error seeding demo: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header & View Switcher */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {lang === 'am'
                ? 'አጠራጣሪ መድኃኒት ቅድመ-ማስጠንቀቂያ ካርታ (FR-EW-01)'
                : 'Counterfeit Early-Warning Map'}
            </h2>
            <span className="text-xs bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 px-2 py-0.5 rounded-full font-semibold border border-rose-300 dark:border-rose-800">
              Live Anomaly Grid
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'am'
              ? 'የ1 ኪ.ሜ የቦታ ድምር፣ አጠራጣሪ ፍተሻዎች ሙቀት ካርታ እና የR4፣ R5፣ R6 የማስጠንቀቂያ ካርዶች (ክፍል 5)'
              : 'Real-time 1 km geo-cells, counterfeit density heatmap, and automated R4, R5, R6 anomaly alert cards.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Regulator vs Public Safety Pulse View Switcher (FR-EW-08) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('regulator')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                viewMode === 'regulator'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{lang === 'am' ? 'የተቆጣጣሪ ካርታ' : 'Regulator Console'}</span>
            </button>
            <button
              onClick={() => setViewMode('public')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                viewMode === 'public'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{lang === 'am' ? 'የህዝብ ደህንነት (FR-EW-08)' : 'Public Pulse'}</span>
            </button>
          </div>

          {/* Reset Demo Button */}
          <button
            onClick={handleSeedDemo}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors flex items-center space-x-1.5"
            title="Reset demo seed scenarios"
          >
            <RefreshCw className="w-3 h-3 text-emerald-600" />
            <span>{lang === 'am' ? 'ማሳያ አስጀምር' : 'Seed Demo'}</span>
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-slate-400 hover:text-slate-600 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {viewMode === 'public' ? (
        /* Public Safety Pulse View (FR-EW-08) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {lang === 'am' ? 'የህዝብ ደህንነት ማጠቃለያ (Public Safety Pulse)' : 'National Medicine Safety Pulse'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {publicPulse?.disclaimer}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Safe Genuine Packs
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {publicPulse?.genuineScans || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Verified authentic today</div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Total Daily Verifications
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {publicPulse?.totalScans || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Across Web & Telegram</div>
            </div>

            <div className="p-4 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                Active Interventions
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {publicPulse?.interventionsActive || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">EFDA rapid response alerts</div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Monitored Geo-Zones
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {publicPulse?.monitoredZonesCount || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">1 km aggregated zones</div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start space-x-3 text-xs text-slate-600 dark:text-slate-300">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Privacy By Design Invariant (Section 5.2):
              </span>{' '}
              Public pulse displays aggregated totals only. Individual scan coordinates, timestamps, device fingerprints, and pack serials are cryptographically excluded from public visibility.
            </div>
          </div>
        </div>
      ) : (
        /* Regulator Early-Warning Console (FR-EW-01 to FR-EW-07) */
        <div className="space-y-6">
          {/* Active Anomaly Alert Cards (FR-EW-04, FR-EW-05, FR-EW-06) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="w-5 h-5 text-rose-600 animate-pulse" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  {lang === 'am' ? 'የማስጠንቀቂያ ካርዶች (Active Anomaly Cards)' : 'Live Anomaly Alert Cards'}
                </h3>
              </div>
              <span className="text-xs text-rose-700 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-300 dark:border-rose-800">
                {alerts.filter((a) => a.status === 'active').length} Active Flags
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                    alert.status === 'investigating'
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                      : alert.status === 'resolved'
                      ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 opacity-70'
                      : 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-rose-600 text-white">
                        {alert.rule} Trigger
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                          alert.severity === 'Critical'
                            ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200'
                            : 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                      {alert.title}
                    </h4>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 leading-snug">
                      {lang === 'am' ? alert.descriptionAm : alert.descriptionEn}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Area: {alert.area}</span>
                      <span>Count: {alert.count}</span>
                    </div>
                  </div>

                  {/* Action Buttons (FR-EW-07) */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    {alert.status === 'active' ? (
                      <>
                        <button
                          onClick={() => {
                            setSelectedAlert(alert);
                            setInvestigationNotes(
                              `Initiating investigation on ${alert.rule} flag in ${alert.area}`
                            );
                            setIsInvestigatingModal(true);
                          }}
                          className="flex-1 py-1.5 px-2 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-semibold flex items-center justify-center space-x-1"
                        >
                          <Search className="w-3 h-3 text-sky-500" />
                          <span>{lang === 'am' ? 'መርምር' : 'Investigate'}</span>
                        </button>
                        <button
                          onClick={() => handleOneClickRecall(alert)}
                          className="py-1.5 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1"
                          title="Trigger emergency recall on-chain"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          <span>{lang === 'am' ? 'እገዳ ጥራ' : '1-Click Recall'}</span>
                        </button>
                      </>
                    ) : alert.status === 'investigating' ? (
                      <div className="w-full py-1 text-center font-semibold text-amber-700 dark:text-amber-300 text-[11px] bg-amber-100 dark:bg-amber-950/60 rounded-md">
                        🔍 Under EFDA Investigation
                      </div>
                    ) : (
                      <div className="w-full py-1 text-center font-semibold text-emerald-700 dark:text-emerald-300 text-[11px] bg-emerald-100 dark:bg-emerald-950/60 rounded-md">
                        ✓ Recall Enforced On-Chain
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Geographic Map & Cell Inspector (FR-EW-01, FR-EW-02, FR-EW-03) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Map Canvas / Grid Layer (7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>
                      {lang === 'am' ? 'አዲስ አበባ የቁጥጥር ካርታ (Addis Ababa Grid)' : 'Addis Ababa 1 km Geo-Grid'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'am' ? 'በግምት 1 ኪ.ሜ የሆኑ የቁጥጥር ሴሎች' : 'Aggregated ~1 km cells (FR-EW-01)'}
                  </p>
                </div>

                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                  <button
                    onClick={() => setMapLayer('cells')}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      mapLayer === 'cells'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>Grid Cells</span>
                  </button>
                  <button
                    onClick={() => setMapLayer('heatmap')}
                    className={`px-2.5 py-1 rounded font-medium transition-all flex items-center space-x-1 ${
                      mapLayer === 'heatmap'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Flame className="w-3 h-3 text-rose-500" />
                    <span>Heatmap</span>
                  </button>
                </div>
              </div>

              {/* Visual Map Grid Canvas (Addis Ababa Zones Representation) */}
              <div className="relative h-[340px] rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden p-3 flex flex-col justify-between">
                {/* SVG Background Grid Map lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                {/* Heatmap overlay glow if selected */}
                {mapLayer === 'heatmap' && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[28%] left-[22%] w-36 h-36 bg-rose-500/30 rounded-full blur-2xl animate-pulse" />
                    <div className="absolute bottom-[30%] right-[25%] w-32 h-32 bg-amber-500/25 rounded-full blur-2xl animate-pulse" />
                  </div>
                )}

                {/* Zone Markers / Cells on Addis Ababa topology */}
                <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5 h-full content-center">
                  {cells.map((cell) => {
                    const isSelected = selectedCell?.cellId === cell.cellId;
                    const hasUnknowns = cell.unknownCount > 0;
                    const hasClones = cell.cloneCount > 0;

                    return (
                      <div
                        key={cell.cellId}
                        onClick={() => setSelectedCell(cell)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'ring-2 ring-emerald-500 shadow-md scale-102 bg-white dark:bg-slate-900 border-emerald-500'
                            : hasClones
                            ? 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800'
                            : hasUnknowns
                            ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800'
                            : 'bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                            {cell.areaName.split(',')[0]}
                          </span>
                          <span className="text-sm select-none">
                            {hasClones ? '🛑' : hasUnknowns ? '⚠️' : '🟢'}
                          </span>
                        </div>

                        <div className="mt-2 space-y-0.5 text-[10px] font-mono">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {cell.totalCount}
                            </span>
                          </div>
                          {hasUnknowns && (
                            <div className="flex justify-between text-amber-700 dark:text-amber-400 font-bold">
                              <span>Unknown:</span>
                              <span>{cell.unknownCount}</span>
                            </div>
                          )}
                          {hasClones && (
                            <div className="flex justify-between text-rose-700 dark:text-rose-400 font-bold">
                              <span>Clones:</span>
                              <span>{cell.cloneCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Map Legend (Hard Rule 4: emoji + text) */}
                <div className="relative z-10 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <span>🟢</span>
                      <span>Genuine Normal</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span>⚠️</span>
                      <span>Unknown Spike</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span>🛑</span>
                      <span>Clone Suspected</span>
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-slate-400">
                    Cell resolution: ~1.1 km
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Selected Cell Drill-Down (FR-EW-03) (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              {selectedCell ? (
                <>
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {selectedCell.cellId}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        1 km Window
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                      {selectedCell.areaName}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Lat: {selectedCell.latCenter.toFixed(4)}, Lng: {selectedCell.lngCenter.toFixed(4)}
                    </p>
                  </div>

                  {/* Cell Counts Breakdown */}
                  <div>
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Scan Result Breakdown (FR-EW-03)
                    </h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center space-x-1 font-semibold text-emerald-800 dark:text-emerald-300">
                          <span>🟢 Genuine:</span>
                        </div>
                        <div className="text-lg font-bold text-emerald-600 mt-0.5">
                          {selectedCell.genuineCount}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center space-x-1 font-semibold text-amber-800 dark:text-amber-300">
                          <span>⚠️ Unknown:</span>
                        </div>
                        <div className="text-lg font-bold text-amber-600 mt-0.5">
                          {selectedCell.unknownCount}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                        <div className="flex items-center space-x-1 font-semibold text-rose-800 dark:text-rose-300">
                          <span>🛑 Clones:</span>
                        </div>
                        <div className="text-lg font-bold text-rose-600 mt-0.5">
                          {selectedCell.cloneCount}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800">
                        <div className="flex items-center space-x-1 font-semibold text-sky-800 dark:text-sky-300">
                          <span>🔵 Dispensed Sold:</span>
                        </div>
                        <div className="text-lg font-bold text-sky-600 mt-0.5">
                          {selectedCell.soldCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Privacy Guarantees Notice (Section 5.2) */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-500 space-y-1">
                    <div className="flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-300">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>Privacy Guard (Section 5.2)</span>
                    </div>
                    <p className="leading-snug">
                      Precise GPS coordinates are rounded to ~1.1 km centroids before aggregation. Patient device IDs are hashed with HMAC-SHA256 and salt.
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  Select a zone on the map to inspect scan metrics.
                </div>
              )}
            </div>
          </div>

          {/* Active Regulatory Investigations Feed (FR-EW-07) */}
          {investigations.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    {lang === 'am' ? 'ንቁ የቁጥጥር ምርመራዎች (EFDA Investigations)' : 'Active EFDA Rapid Response Investigations'}
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {investigations.length} Active Dossiers
                </span>
              </div>

              <div className="space-y-2">
                {investigations.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 font-mono font-bold text-[10px] rounded">
                          {inv.rule} Anomaly
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Zone: {inv.area}
                        </span>
                        {inv.batchNumber && (
                          <span className="text-[11px] font-mono text-slate-500">
                            Batch: {inv.batchNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                        {inv.notes}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 rounded-md font-bold text-[10px]">
                        {inv.status}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {inv.assignedInspector}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Investigation Modal (FR-EW-07) */}
      {isInvestigatingModal && selectedAlert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {lang === 'am' ? 'አደጋውን ወደ ምርመራ ቀይር (FR-EW-07)' : 'Escalate Alert to EFDA Investigation'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedAlert.title}
                </p>
              </div>
              <button
                onClick={() => setIsInvestigatingModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTurnIntoInvestigation} className="space-y-3.5">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {lang === 'am'
                  ? 'ይህ እርምጃ ለኢትዮጵያ መድኃኒት ቁጥጥር ባለስልጣን (EFDA) የድንገተኛ አደጋ ቡድን የምርመራ መዝገብ ይከፍታል።'
                  : 'This opens an official regulatory dossier for the EFDA rapid inspection squad. Field officers in this zone will be notified to seize suspect inventory.'}
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Investigation Directives / Notes
                </label>
                <textarea
                  rows={3}
                  value={investigationNotes}
                  onChange={(e) => setInvestigationNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInvestigatingModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Opening Dossier...' : 'Confirm Investigation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
