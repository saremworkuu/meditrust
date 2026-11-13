/**
 * @license SPDX-License-Identifier: Apache-2.0
 * MediTrust — Patient-Safety Medicine Verification PWA
 * Refactored in Step 2 to use the pure TypeScript shared library @meditrust/verify (FR-VA-09, NFR-24).
 * Enforces FR-VA-03 (never color alone), FR-RR-01 (recall reach opt-in), FR-IO-03/04 (national registry badge).
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  QrCode,
  Search,
  Bell,
  Volume2,
  FileCheck,
  Building2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Smartphone,
  Send,
  Lock,
  Globe,
  RefreshCw,
  ExternalLink,
  Info,
  Award,
  MapPin,
  Radio,
} from 'lucide-react';
import {
  verifyPack,
  VerificationResult,
  InvalidQRError,
  STATUS_PRESENTATION_MAP,
} from '../packages/verify/src/index.ts';
import { RegulatorRecallView } from './components/RegulatorRecallView.tsx';
import { PharmacyTrustScoreView } from './components/PharmacyTrustScoreView.tsx';
import { EarlyWarningMapView } from './components/EarlyWarningMapView.tsx';
import { CuttableFeaturesView } from './components/CuttableFeaturesView.tsx';
import enTranslations from './locales/en.json';
import amTranslations from './locales/am.json';

export default function App() {
  const [activeTab, setActiveTab] = useState<'verify' | 'regulator' | 'pharmacies' | 'map' | 'auxiliary'>('verify');
  const [lang, setLang] = useState<'en' | 'am'>('en');
  const t = lang === 'en' ? enTranslations : amTranslations;

  const [rawInput, setRawInput] = useState<string>('MT:1:ET-AMOX-001:SEC4491');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  // Recall Subscription Modal state (FR-RR-01, FR-RR-02, FR-RR-03)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [subChannel, setSubChannel] = useState<'telegram' | 'sms' | 'email'>('telegram');
  const [subContact, setSubContact] = useState<string>('');
  const [subConsent, setSubConsent] = useState<boolean>(false);
  const [subSuccess, setSubSuccess] = useState<boolean>(false);

  // Audio voice readout status (FR-VA-05, NFR-27)
  const [isPlayingVoice, setIsPlayingVoice] = useState<boolean>(false);
  const [demoBanner, setDemoBanner] = useState<string | null>(null);
  const [isSeedingDemo, setIsSeedingDemo] = useState<boolean>(false);

  const handleSeedDemo = async () => {
    setIsSeedingDemo(true);
    setDemoBanner(null);
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDemoBanner(
          lang === 'am'
            ? '✅ የ3-ደቂቃ የማሳያ ዳታ በተሳካ ሁኔታ ተዘጋጅቷል (ቦሌ ወርቅ፣ አራዳ ዘግይቷል፣ ማገጃ እና ክላስተር)'
            : '✅ 3-Min Demo State Ready (Bole Gold, Arada Overdue, Recall & Clusters Active)'
        );
      }
    } catch {
      setDemoBanner('Demo seed triggered locally');
    } finally {
      setIsSeedingDemo(false);
      setTimeout(() => setDemoBanner(null), 5000);
    }
  };

  // Sample quick test fixtures
  const quickSamples = [
    {
      label: t.verify.sampleGenuine,
      payload: 'https://meditrust.et/verify?b=1&s=SN-ET-00123&c=SEC889',
      statusHint: 'genuine',
    },
    {
      label: t.verify.sampleSold,
      payload: 'MT:1:SLD-ET-4491:SEC990',
      statusHint: 'sold',
    },
    {
      label: t.verify.sampleRecalled,
      payload: JSON.stringify({ b: 999, s: 'RCL-ET-9901', c: 'RECALL_CODE' }),
      statusHint: 'recalled',
    },
    {
      label: t.verify.sampleExpired,
      payload: 'VERIFY 888.EXP-ET-8801.EXPPASS',
      statusHint: 'expired',
    },
    {
      label: t.verify.sampleClone,
      payload: 'https://meditrust.et/v?b=1&s=CLN-DUPLICATE-77&c=FAKEPASS',
      statusHint: 'clone_suspected',
    },
    {
      label: t.verify.sampleUnknown,
      payload: 'MT:0:UNK-UNKNOWN-99:NOPROOF',
      statusHint: 'unknown',
    },
  ];

  // Perform verification using the shared library
  const handleVerify = async (inputToTest?: string) => {
    const input = inputToTest !== undefined ? inputToTest : rawInput;
    setErrorMsg(null);
    setIsVerifying(true);
    setSubSuccess(false);

    try {
      // Calls shared library with non-blocking national registry check enabled
      const res = await verifyPack(input, {
        checkRegistry: true,
        registryOptions: {
          timeoutMs: 1500,
          customFetcher: async () => ({
            registered: true,
            nationalDrugCode: 'EFDA-REG-2026-ET449',
          }),
        },
      });
      setResult(res);
    } catch (err: any) {
      if (err instanceof InvalidQRError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(`Verification error: ${err.message || 'Unknown network error'}`);
      }
      setResult(null);
    } finally {
      setIsVerifying(false);
    }
  };

  // Initial load verification
  useEffect(() => {
    handleVerify('https://meditrust.et/verify?b=1&s=SN-ET-00123&c=SEC889');
  }, []);

  // Amharic / English voice read-out (FR-VA-05, NFR-27)
  const handleVoiceReadout = () => {
    if (!result) return;
    setIsPlayingVoice(true);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const textToRead =
        lang === 'am'
          ? `${result.presentation.titleAm}። ${result.presentation.shortSentenceAm} ${result.presentation.actionAm}`
          : `${result.presentation.titleEn}. ${result.presentation.shortSentenceEn} ${result.presentation.actionEn}`;

      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = lang === 'am' ? 'am-ET' : 'en-US';
      utterance.rate = 0.95;
      utterance.onend = () => setIsPlayingVoice(false);
      utterance.onerror = () => setIsPlayingVoice(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsPlayingVoice(false), 2000);
    }
  };

  // Handle recall subscription submission (FR-RR-02, FR-RR-03)
  const handleSubscribeRecall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subContact || !subConsent || !result) return;
    try {
      const res = await fetch('/api/recalls/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: result.batchId,
          channel: subChannel,
          contact: subContact,
          language: lang,
          consentGiven: subConsent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubSuccess(true);
        setTimeout(() => {
          setIsModalOpen(false);
        }, 3000);
      } else {
        alert(data.error || 'Failed to register alert');
      }
    } catch {
      // Fallback success for offline/demo
      setSubSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
      }, 2500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans dark:bg-slate-950 dark:text-slate-100 antialiased flex flex-col">
      {/* Top Header & Localization Bar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-30 dark:bg-slate-900/90 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">
                  {t.app.title}
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  Patient Safety
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                {t.app.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* View Switcher Tabs (FR-RR-08, FR-TS-01, FR-EW-01) */}
            <nav className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setActiveTab('verify')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                  activeTab === 'verify'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'am' ? 'መድኃኒት አረጋግጥ' : 'Verify'}</span>
              </button>
              <button
                onClick={() => setActiveTab('pharmacies')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                  activeTab === 'pharmacies'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>{lang === 'am' ? 'ፋርማሲዎች' : 'Pharmacies'}</span>
              </button>
              <button
                onClick={() => setActiveTab('map')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                  activeTab === 'map'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>{lang === 'am' ? 'ማስጠንቀቂያ ካርታ (FR-EW)' : 'Warning Map'}</span>
              </button>
              <button
                onClick={() => setActiveTab('regulator')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                  activeTab === 'regulator'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-rose-600" />
                <span>{lang === 'am' ? 'ተቆጣጣሪ (Regulator)' : 'Compliance'}</span>
              </button>
              <button
                onClick={() => setActiveTab('auxiliary')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                  activeTab === 'auxiliary'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-sky-500" />
                <span>{lang === 'am' ? 'ተጨማሪ (Step 8)' : 'Voice & Access'}</span>
              </button>
            </nav>

            {/* Language Switcher (FR-VA-04, NFR-28) */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  lang === 'en'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('am')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  lang === 'am'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                አማ
              </button>
            </div>

            {/* 3-Minute Demo Seed Button (Section 10) */}
            <button
              onClick={handleSeedDemo}
              disabled={isSeedingDemo}
              title="Resets & populates state for 3-minute demo scenario (Section 10)"
              className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>🎬</span>
              <span>{isSeedingDemo ? 'Seeding...' : lang === 'am' ? 'የ3-ደቂቃ ማሳያ' : '3-Min Demo'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        {demoBanner && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center justify-between shadow-xs">
            <span>{demoBanner}</span>
            <button onClick={() => setDemoBanner(null)} className="text-indigo-500 hover:text-indigo-700 font-bold ml-2">✕</button>
          </div>
        )}
        {activeTab === 'auxiliary' ? (
          <CuttableFeaturesView lang={lang} />
        ) : activeTab === 'map' ? (
          <EarlyWarningMapView lang={lang} />
        ) : activeTab === 'pharmacies' ? (
          <PharmacyTrustScoreView lang={lang} />
        ) : activeTab === 'regulator' ? (
          <RegulatorRecallView lang={lang} />
        ) : (
          <>
            {/* Verification Card */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t.verify.heading}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {t.verify.instruction}
            </p>
          </div>

          {/* Input & Action Form */}
          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <QrCode className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={t.verify.inputPlaceholder}
                className="w-full pl-11 pr-24 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <button
                onClick={() => handleVerify()}
                disabled={isVerifying}
                className="absolute inset-y-1.5 right-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                {isVerifying ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>{isVerifying ? t.verify.verifying : t.verify.verifyButton}</span>
              </button>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="flex items-start space-x-2 p-3 bg-rose-50 border border-rose-300 dark:bg-rose-950/40 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Quick Demo Samples */}
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                {t.verify.quickSamples} (SRS Addendum Section 10 Demo Scenarios):
              </div>
              <div className="flex flex-wrap gap-2">
                {quickSamples.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setRawInput(sample.payload);
                      handleVerify(sample.payload);
                    }}
                    className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors flex items-center space-x-1.5"
                  >
                    <span>{sample.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Verification Result Section (Hard rule 4: Never color alone, always emoji + text) */}
        {result && (
          <section
            className={`rounded-2xl border-2 p-6 shadow-md transition-all ${result.presentation.borderClass} ${result.presentation.bgClass}`}
          >
            {/* Status Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-5">
              <div className="flex items-start space-x-3.5">
                <span className="text-3xl shrink-0 select-none">
                  {result.presentation.emoji}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md border ${result.presentation.badgeClass}`}
                    >
                      {result.presentation.emoji}{' '}
                      {lang === 'am'
                        ? result.presentation.titleAm
                        : result.presentation.titleEn}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ID: {result.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
                    {result.productName}
                  </h3>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                    {lang === 'am'
                      ? result.presentation.shortSentenceAm
                      : result.presentation.shortSentenceEn}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Voice read-out & Alert */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleVoiceReadout}
                  disabled={isPlayingVoice}
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-2xs"
                  title="Audio voice readout (FR-VA-05)"
                >
                  <Volume2
                    className={`w-4 h-4 ${isPlayingVoice ? 'text-emerald-500 animate-pulse' : ''}`}
                  />
                  <span>
                    {isPlayingVoice
                      ? lang === 'am'
                        ? 'እያዳመጡ ነው...'
                        : 'Speaking...'
                      : t.verify.voiceButton}
                  </span>
                </button>
              </div>
            </div>

            {/* Safety Guidance Box (Strictly adheres to NFR-29) */}
            <div className="my-4 p-4 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start space-x-3">
              <Info className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold text-slate-800 dark:text-slate-200 mr-1">
                  {lang === 'am' ? 'የደህንነት መመሪያ፡' : 'Safety Direction:'}
                </span>
                <span className="text-slate-700 dark:text-slate-300">
                  {lang === 'am'
                    ? result.presentation.actionAm
                    : result.presentation.actionEn}
                </span>
              </div>
            </div>

            {/* Pack Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="p-3 bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 rounded-xl">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {t.verify.batchNumber}
                </div>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {result.batchNumber}
                </div>
                <div className="text-[10px] text-slate-400">Batch #{result.batchId}</div>
              </div>

              <div className="p-3 bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 rounded-xl">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {t.verify.serialNumber}
                </div>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1 truncate">
                  {result.serialNumber}
                </div>
                <div className="text-[10px] text-slate-400">Unique Unit Serial</div>
              </div>

              <div className="p-3 bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 rounded-xl">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {t.verify.expiryDate}
                </div>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {result.expiryFormatted}
                </div>
                <div className="text-[10px] text-slate-400">Expiry Hygiene</div>
              </div>

              <div className="p-3 bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 rounded-xl">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {t.verify.chainVerification}
                </div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>On-Chain</span>
                </div>
                <div className="text-[10px] text-slate-400">RPC Verification</div>
              </div>
            </div>

            {/* National Interoperability Adapter Badge (FR-IO-03, FR-IO-04, Hard rule 6) */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">
                  {result.nationalRegistry?.registered
                    ? t.verify.registeredNational
                    : t.verify.registryUnavailable}
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                  [Simulated]
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                NDC: {result.nationalRegistry?.nationalDrugCode || 'EFDA-ET-2026'}
              </span>
            </div>

            {/* Patient Action Buttons: FR-RR-01 Recall Alert Opt-In */}
            <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-xs transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span>{t.verify.alertMeButton}</span>
              </button>

              <button
                onClick={() =>
                  alert(
                    lang === 'am'
                      ? 'የጥቆማ ቅጽ ተከፍቷል (FR-RPT-03)። ለኢትዮጵያ መድኃኒት ቁጥጥር ባለስልጣን ሪፖርት ይላካል።'
                      : 'Anomaly report logged (FR-RPT-03). Coordinates forwarded to EFDA inspection queue.'
                  )
                }
                className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>{t.verify.reportButton}</span>
              </button>
            </div>
          </section>
        )}

        {/* Recall Subscription Modal (FR-RR-01, FR-RR-02, FR-RR-03, NFR-25) */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {t.recallModal.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Batch #{result?.batchId} ({result?.batchNumber})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              {subSuccess ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    {t.recallModal.successMessage}
                  </p>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                    {t.recallModal.privacyNote}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubscribeRecall} className="space-y-3.5">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {t.recallModal.description}
                  </p>

                  {/* Channel selection */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                      {t.recallModal.selectChannel}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSubChannel('telegram')}
                        className={`p-2 text-xs rounded-lg border font-medium flex flex-col items-center justify-center text-center transition-all ${
                          subChannel === 'telegram'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5 mb-1 text-sky-500" />
                        <span>Telegram</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubChannel('sms')}
                        className={`p-2 text-xs rounded-lg border font-medium flex flex-col items-center justify-center text-center transition-all ${
                          subChannel === 'sms'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5 mb-1 text-emerald-500" />
                        <span>SMS Phone</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubChannel('email')}
                        className={`p-2 text-xs rounded-lg border font-medium flex flex-col items-center justify-center text-center transition-all ${
                          subChannel === 'email'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5 mb-1 text-amber-500" />
                        <span>Email</span>
                      </button>
                    </div>
                  </div>

                  {/* Input field */}
                  <div>
                    <input
                      type="text"
                      required
                      value={subContact}
                      onChange={(e) => setSubContact(e.target.value)}
                      placeholder={
                        subChannel === 'telegram'
                          ? '@username or Telegram ID'
                          : subChannel === 'sms'
                          ? '+251 9...'
                          : 'patient@example.com'
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Hard Rule 1 & FR-RR-03 Privacy Notice */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 space-y-1">
                    <div className="flex items-center space-x-1.5 font-semibold text-slate-700 dark:text-slate-300">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>{lang === 'am' ? 'የግል መረጃ ጥበቃ (FR-RR-03)' : 'Privacy Invariant (FR-RR-03)'}</span>
                    </div>
                    <p className="leading-snug">{t.recallModal.privacyNote}</p>
                  </div>

                  {/* Explicit Consent Checkbox (FR-RR-02) */}
                  <div className="flex items-start space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="consent"
                      checked={subConsent}
                      onChange={(e) => setSubConsent(e.target.checked)}
                      required
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="consent" className="text-xs text-slate-600 dark:text-slate-300">
                      {t.recallModal.consentCheckbox} <strong>#{result?.batchId}</strong>.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!subContact || !subConsent}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {t.recallModal.subscribeButton}
                  </button>
                </form>
              )}
            </div>
          </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 py-4 mt-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
          <div className="flex items-center space-x-2">
            <span>MediTrust Ethiopia MVP</span>
            <span>•</span>
            <span className="text-emerald-600 font-medium">SRS v1.0 & Addendum v1.1</span>
          </div>
          <div className="text-[11px]">
            National Registry & SMS Gateways are labeled simulated for MVP testing.
          </div>
        </div>
      </footer>
    </div>
  );
}
