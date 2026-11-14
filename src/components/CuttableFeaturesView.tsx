/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Cuttable Features View (Step 8)
 * Implements: FR-VA-05 (voice), FR-VA-10 (SMS spec), FR-IO-01 to FR-IO-05, FR-EW-08, Section 3.3
 *
 * Rules:
 * 1. Amharic voice clips: voice and text carry the exact same information (NFR-27).
 * 2. Mock national registry (FR-IO-01): labeled "simulated" (Hard rule 6), non-blocking (FR-IO-04).
 * 3. Documented SMS spec: VERIFY <batch>.<serial>.<code> (FR-VA-10), labeled simulated.
 * 4. Public "Safety Pulse" with aggregate counts only (FR-EW-08).
 */

import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Smartphone,
  Building2,
  ShieldCheck,
  Radio,
  FileText,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Info,
  Power,
  Lock,
  Send,
  ExternalLink,
} from 'lucide-react';
import { SMS_SPEC_DOCS } from '../services/smsVerificationService.ts';

interface CuttableFeaturesViewProps {
  lang: 'en' | 'am';
}

export function CuttableFeaturesView({ lang }: CuttableFeaturesViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'voice' | 'registry' | 'sms' | 'pulse'>('voice');

  // Voice playback state (FR-VA-05, NFR-27)
  const [playingStatus, setPlayingStatus] = useState<string | null>(null);
  const [voiceClips, setVoiceClips] = useState<Record<string, any>>({});
  const [selectedVoiceStatus, setSelectedVoiceStatus] = useState<string>('genuine');

  // National Registry state (FR-IO-01 to FR-IO-05)
  const [registryRecords, setRegistryRecords] = useState<any[]>([]);
  const [isRegistryOffline, setIsRegistryOffline] = useState<boolean>(false);
  const [registryTestResult, setRegistryTestResult] = useState<any | null>(null);
  const [testGtin, setTestGtin] = useState<string>('07612345678900');
  const [testBatch, setTestBatch] = useState<string>('ET-AMOX-001');

  // SMS Gateway Simulator state (FR-VA-10)
  const [smsInput, setSmsInput] = useState<string>('VERIFY 1.SN-ET-00123.SEC889');
  const [smsResponse, setSmsResponse] = useState<any | null>(null);
  const [isSendingSms, setIsSendingSms] = useState<boolean>(false);

  // Safety Pulse state (FR-EW-08)
  const [safetyPulse, setSafetyPulse] = useState<any | null>(null);

  // Fetch initial registry records and pulse
  useEffect(() => {
    fetch('/api/registry/records')
      .then((r) => r.json())
      .then((d) => d.success && setRegistryRecords(d.records))
      .catch(console.error);

    fetch('/api/early-warning/safety-pulse')
      .then((r) => r.json())
      .then((d) => d.success && setSafetyPulse(d.pulse))
      .catch(console.error);
  }, []);

  // Fetch voice clip transcript for selected status
  useEffect(() => {
    fetch(`/api/audio/status/${selectedVoiceStatus}?lang=${lang}&product=Amoxicillin+500mg&batch=ET-AMOX-001`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setVoiceClips((prev) => ({ ...prev, [selectedVoiceStatus]: d.voiceClip }));
        }
      })
      .catch(console.error);
  }, [selectedVoiceStatus, lang]);

  // Play audio WAV synthesis
  const handlePlayAudio = (status: string) => {
    setPlayingStatus(status);
    const audio = new Audio(`/api/audio/status/${status}?format=wav`);
    audio.onended = () => setPlayingStatus(null);
    audio.onerror = () => {
      // Fallback to speech synthesis if browser audio element encounters codec restriction
      if ('speechSynthesis' in window) {
        const textToRead = voiceClips[status]?.transcript || 'Medicine status audio';
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = lang === 'am' ? 'am-ET' : 'en-US';
        utterance.onend = () => setPlayingStatus(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setTimeout(() => setPlayingStatus(null), 1200);
      }
    };
    audio.play().catch(() => {
      // Fallback to speech synthesis
      if ('speechSynthesis' in window) {
        const textToRead = voiceClips[status]?.transcript || 'Medicine status audio';
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = lang === 'am' ? 'am-ET' : 'en-US';
        utterance.onend = () => setPlayingStatus(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setTimeout(() => setPlayingStatus(null), 1200);
      }
    });
  };

  // Toggle simulated registry outage (FR-IO-04)
  const handleToggleRegistryOutage = async () => {
    try {
      const res = await fetch('/api/registry/toggle-outage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offline: !isRegistryOffline }),
      });
      const data = await res.json();
      if (data.success) {
        setIsRegistryOffline(data.isSimulatedOffline);
      }
    } catch (err) {
      console.error('Failed to toggle outage:', err);
    }
  };

  // Test registry query
  const handleTestRegistryQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(
        `/api/registry/check?gtin=${encodeURIComponent(testGtin)}&batch=${encodeURIComponent(testBatch)}`
      );
      const data = await res.json();
      setRegistryTestResult(data);
    } catch (err: any) {
      setRegistryTestResult({ registered: false, error: err.message, status: 'unavailable' });
    }
  };

  // Simulate SMS verification (FR-VA-10)
  const handleSendSimulatedSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsInput.trim()) return;
    setIsSendingSms(true);
    setSmsResponse(null);

    try {
      const res = await fetch('/api/sms/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: smsInput.trim(),
          fromPhoneNumber: '+251 91 122 3344',
          lang,
        }),
      });
      const data = await res.json();
      setSmsResponse(data);
    } catch (err: any) {
      alert(`SMS Gateway Error: ${err.message}`);
    } finally {
      setIsSendingSms(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {lang === 'am' ? 'ተጨማሪ አገልግሎቶች (Step 8 Cuttable Features)' : 'Patient Safety Auxiliary Features'}
            </h2>
            <span className="text-xs bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 px-2.5 py-0.5 rounded-full font-semibold border border-sky-300 dark:border-sky-800">
              Interoperability & Access
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'am'
              ? 'የአማርኛ ድምፅ ማብራሪያ (FR-VA-05)፣ የብሔራዊ መዝገብ አገናኝ (FR-IO-01)፣ የSMS መመሪያ (FR-VA-10) እና የህዝብ ደህንነት ማጠቃለያ (FR-EW-08)'
              : 'Amharic voice clips (NFR-27), Mock National Registry (FR-IO), SMS Spec (FR-VA-10), and Public Safety Pulse.'}
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={() => setActiveSubTab('voice')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${activeSubTab === 'voice'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
              }`}
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'am' ? 'ድምፅ (Voice)' : 'Voice Replies'}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('registry')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${activeSubTab === 'registry'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
              }`}
          >
            <Building2 className="w-3.5 h-3.5 text-sky-600" />
            <span>{lang === 'am' ? 'ብሔራዊ መዝገብ' : 'National Registry'}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('sms')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${activeSubTab === 'sms'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
              }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-500" />
            <span>{lang === 'am' ? 'SMS መመሪያ' : 'SMS Gateway'}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('pulse')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center space-x-1.5 ${activeSubTab === 'pulse'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
              }`}
          >
            <Radio className="w-3.5 h-3.5 text-rose-500" />
            <span>{lang === 'am' ? 'የደህንነት ድምር' : 'Safety Pulse'}</span>
          </button>
        </div>
      </div>

      {/* Item a: Amharic Voice Replies (FR-VA-05, NFR-27) */}
      {activeSubTab === 'voice' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-emerald-600" />
              <span>{lang === 'am' ? 'የአማርኛ ድምፅ ማብራሪያ (FR-VA-05)' : 'Amharic Voice Replies & Audio Engine'}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === 'am'
                ? 'የድምፅና የጽሑፍ መረጃው ፍፁም ተመሳሳይ መሆኑን የሚያረጋግጥ ስርዓት (NFR-27 Parity)'
                : 'Pre-recorded / synthesized status audio clips with exact transcript parity (NFR-27). Product name read as text.'}
            </p>
          </div>

          {/* Status Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              {lang === 'am' ? 'የመድኃኒት ሁኔታ ምረጥ፡' : 'Select Pack Verification Status:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'genuine', label: '🟢 Genuine / ትክክለኛ' },
                { id: 'sold', label: '🔵 Sold / ቀድሞ የተሸጠ' },
                { id: 'recalled', label: '🔴 Recalled / የታገደ' },
                { id: 'expired', label: '🟠 Expired / ጊዜው ያለፈበት' },
                { id: 'clone_suspected', label: '🛑 Clone / የተባዛ' },
                { id: 'unknown', label: '⚠️ Unknown / ያልታወቀ' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedVoiceStatus(s.id)}
                  className={`p-3 text-xs font-bold rounded-xl border text-left transition-all ${selectedVoiceStatus === s.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/30'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300'
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Status Audio Card */}
          {voiceClips[selectedVoiceStatus] && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {voiceClips[selectedVoiceStatus].title}
                  </h4>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Audio Duration: ~{voiceClips[selectedVoiceStatus].audioDurationSeconds}s • Format: 16-bit PCM WAV
                  </div>
                </div>

                <button
                  onClick={() => handlePlayAudio(selectedVoiceStatus)}
                  disabled={playingStatus === selectedVoiceStatus}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors disabled:opacity-50 shadow-xs"
                >
                  <Play className={`w-3.5 h-3.5 ${playingStatus === selectedVoiceStatus ? 'animate-pulse' : ''}`} />
                  <span>
                    {playingStatus === selectedVoiceStatus
                      ? lang === 'am'
                        ? 'እያዳመጡ ነው...'
                        : 'Playing Audio...'
                      : lang === 'am'
                        ? 'ድምፁን አጫውት'
                        : 'Play Voice Audio'}
                  </span>
                </button>
              </div>

              {/* Parity Transcript Box (NFR-27) */}
              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{lang === 'am' ? 'የድምፅ የቃል በቃል ግልባጭ (NFR-27 Parity):' : 'Auditory Transcript (Identical Content Invariant):'}</span>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  "{voiceClips[selectedVoiceStatus].transcript}"
                </p>
              </div>

              <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {lang === 'am'
                    ? 'ታካሚው መድኃኒቱን እንዲወስድ ወይም እንዳይወስድ ግልጽና የማያስደነግጥ መመሪያ ይሰጣል (NFR-29)'
                    : 'Adheres to NFR-29 non-alarmist directions (contact pharmacist, never self-treat).'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Item b: Mock National Registry API & Non-Blocking Adapter (FR-IO-01 to FR-IO-05) */}
      {activeSubTab === 'registry' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'am' ? 'ብሔራዊ የመድኃኒት መዝገብ አገናኝ (FR-IO-01 to 05)' : 'National Interoperability Registry Adapter'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'am'
                  ? 'ከኢትዮጵያ መድኃኒት ቁጥጥር ባለስልጣን (EFDA) መዝገብ ጋር የተገናኘ አስመሳይ መረጃ (በህግ አስመሳይ ተብሎ የተሰየመ)'
                  : 'Simulated cross-check against EFDA national registry (FR-IO-01). Clearly labeled simulated (Hard Rule 6).'}
              </p>
            </div>

            {/* Outage Toggle (FR-IO-04 Non-blocking proof) */}
            <button
              onClick={handleToggleRegistryOutage}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition-all ${isRegistryOffline
                ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200'
                }`}
            >
              <Power className={`w-3.5 h-3.5 ${isRegistryOffline ? 'text-rose-600' : 'text-emerald-500'}`} />
              <span>
                {isRegistryOffline
                  ? 'Registry Offline [Outage Simulated]'
                  : 'Registry Online [Normal]'}
              </span>
            </button>
          </div>

          {/* Outage Notice (FR-IO-04) */}
          {isRegistryOffline && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">FR-IO-04 Non-Blocking Invariant Active:</span> The simulated national registry is currently offline. Verifications on the PWA and bot continue to function without interruption, safely displaying "Registry check unavailable".
              </div>
            </div>
          )}

          {/* Interactive Test Form */}
          <form onSubmit={handleTestRegistryQuery} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {lang === 'am' ? 'የመዝገብ ፍተሻ ሙከራ (Cross-Check Query)' : 'Test National Registry Adapter Query'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Product GTIN
                </label>
                <input
                  type="text"
                  value={testGtin}
                  onChange={(e) => setTestGtin(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Batch Number
                </label>
                <input
                  type="text"
                  value={testBatch}
                  onChange={(e) => setTestBatch(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-[11px] text-slate-400">
                Label: <strong className="text-emerald-600">[Simulated EFDA Database]</strong>
              </span>
              <button
                type="submit"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Cross-Check Batch (FR-IO-02)
              </button>
            </div>
          </form>

          {/* Query Result Badge (FR-IO-03) */}
          {registryTestResult && (
            <div className={`p-4 rounded-xl border text-xs space-y-2 ${registryTestResult.registered
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
              : registryTestResult.registryStatus === 'Unavailable'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
              }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center space-x-1.5">
                  {registryTestResult.registered ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-900 dark:text-emerald-200">
                        Also registered in the national registry (simulated)
                      </span>
                    </>
                  ) : registryTestResult.registryStatus === 'Unavailable' ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-amber-900 dark:text-amber-200">
                        National registry check unavailable (offline)
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span className="text-rose-900 dark:text-rose-200">
                        Not registered in national registry (simulated)
                      </span>
                    </>
                  )}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/80 dark:bg-slate-800 border">
                  [Simulated]
                </span>
              </div>

              {registryTestResult.nationalDrugCode && (
                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                  NDC: {registryTestResult.nationalDrugCode} • {registryTestResult.productName} ({registryTestResult.manufacturer})
                </div>
              )}
            </div>
          )}

          {/* Seeded Records Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
              Registered Essential Medicines Mock Catalog (FR-IO-01)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="p-2.5">GTIN</th>
                    <th className="p-2.5">Batch</th>
                    <th className="p-2.5">Product Name</th>
                    <th className="p-2.5">Manufacturer</th>
                    <th className="p-2.5">National Drug Code</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {registryRecords.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 font-mono text-[11px]">
                      <td className="p-2.5">{r.gtin}</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">{r.batchNumber}</td>
                      <td className="p-2.5 font-sans font-medium">{r.productName}</td>
                      <td className="p-2.5 font-sans text-slate-500">{r.manufacturer}</td>
                      <td className="p-2.5 text-emerald-600">{r.nationalDrugCode}</td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                          {r.registrationStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Item c: SMS Verification Spec & Simulated Gateway (FR-VA-10) */}
      {activeSubTab === 'sms' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Smartphone className="w-5 h-5 text-amber-500" />
              <span>{lang === 'am' ? 'የSMS ማረጋገጫ መመሪያ (FR-VA-10)' : 'Documented SMS Verification Protocol'}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === 'am' ? SMS_SPEC_DOCS.descriptionAm : SMS_SPEC_DOCS.descriptionEn}
            </p>
          </div>

          {/* SMS Protocol Spec Documentation Box */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {lang === 'am' ? 'የSMS ፎርማት ደንብ (Specification):' : 'Official SMS Syntax Specification:'}
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 font-mono text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>{SMS_SPEC_DOCS.format}</span>
              <span className="text-xs text-emerald-600 font-semibold">Short Code: {SMS_SPEC_DOCS.shortCode}</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <strong>Example:</strong> <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px]">{SMS_SPEC_DOCS.example}</code>
            </div>
            <div className="text-[11px] text-slate-500">
              * Messages fit within 160 characters (single GSM segment) to ensure compatibility with 2G feature phones across all Ethiopian regions.
            </div>
          </div>

          {/* Interactive Simulated Gateway Console */}
          <form onSubmit={handleSendSimulatedSms} className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/10 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center space-x-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-600" />
                <span>Simulated SMS Gateway Tester</span>
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-800 font-bold">
                [SIMULATED SMS - EFDA 8899]
              </span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                Incoming SMS Message Text (From Feature Phone)
              </label>
              <input
                type="text"
                value={smsInput}
                onChange={(e) => setSmsInput(e.target.value)}
                placeholder="VERIFY 1.SN-ET-00123.SEC889"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSmsInput('VERIFY 1.SN-ET-00123.SEC889')}
                className="text-[11px] px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-lg hover:bg-slate-100"
              >
                Sample Genuine (1.SN-ET-00123)
              </button>
              <button
                type="button"
                onClick={() => setSmsInput('VERIFY 1.SLD-ET-4491.SEC990')}
                className="text-[11px] px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-lg hover:bg-slate-100"
              >
                Sample Sold (1.SLD-ET-4491)
              </button>
              <button
                type="button"
                onClick={() => setSmsInput('VERIFY 999.RCL-ET-9901.RECALL_CODE')}
                className="text-[11px] px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-lg hover:bg-slate-100"
              >
                Sample Recalled (999.RCL)
              </button>
            </div>

            <button
              type="submit"
              disabled={isSendingSms || !smsInput.trim()}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingSms ? 'Simulating Gateway...' : 'Send Simulated SMS to 8899'}</span>
            </button>
          </form>

          {/* SMS Simulated Reply */}
          {smsResponse && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>SMS Reply from 8899</span>
                <span>Length: {smsResponse.charCount} / 160 chars ({smsResponse.under160Chars ? 'Single Segment' : 'Multi-Segment'})</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium">
                {smsResponse.reply}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Item d: Standalone Public "Safety Pulse" (FR-EW-08) */}
      {activeSubTab === 'pulse' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center space-x-2">
              <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'am' ? 'የህዝብ ደህንነት ማጠቃለያ (Public Safety Pulse - FR-EW-08)' : 'Public Safety Pulse Page (Aggregate Only)'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {safetyPulse?.disclaimer}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
              <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                Safe Genuine Packs
              </div>
              <div className="text-3xl font-black text-emerald-600 mt-1">
                {safetyPulse?.genuineScans || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Verified Authentic</div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                Total Daily Scans
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {safetyPulse?.totalScans || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Across All Channels</div>
            </div>

            <div className="p-4 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
              <div className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase">
                Interventions Active
              </div>
              <div className="text-3xl font-black text-rose-600 mt-1">
                {safetyPulse?.interventionsActive || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Counterfeit Flags Seized</div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                Monitored Zones
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {safetyPulse?.monitoredZonesCount || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">1 km Grid Cells</div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start space-x-3 text-xs text-slate-600 dark:text-slate-300">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Privacy By Design (FR-EW-08):
              </span>{' '}
              This public dashboard displays aggregated counts only. No pack-level details, serial numbers, patient device IDs, or exact coordinates are ever displayed.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
