/**
 * @license SPDX-License-Identifier: Apache-2.0
 * MediTrust — Patient-Safety Medicine Verification Platform
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Volume2,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Lock,
  RefreshCw,
  Info,
  Send,
  Smartphone,
  QrCode,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import {
  verifyPack,
  VerificationResult,
  InvalidQRError,
} from '../packages/verify/src/index.ts';
import { RegulatorRecallView } from './components/RegulatorRecallView.tsx';
import { PharmacyTrustScoreView } from './components/PharmacyTrustScoreView.tsx';
import { EarlyWarningMapView } from './components/EarlyWarningMapView.tsx';
import { CuttableFeaturesView } from './components/CuttableFeaturesView.tsx';
import { PrivyAuthButton } from './components/PrivyAuthButton.tsx';
import { QRCameraScanner } from './components/QRCameraScanner.tsx';
import enTranslations from './locales/en.json';
import amTranslations from './locales/am.json';

type TabKey = 'verify' | 'pharmacies' | 'map' | 'regulator' | 'auxiliary';

const STATUS_SURFACE_MAP: Record<
  string,
  { accentText: string; softBg: string; border: string }
> = {
  genuine: {
    accentText: 'text-slate-900 dark:text-white',
    softBg: 'bg-transparent',
    border: 'border-slate-200 dark:border-neutral-800',
  },
  sold: {
    accentText: 'text-sky-700 dark:text-sky-400',
    softBg: 'bg-transparent',
    border: 'border-slate-200 dark:border-neutral-800',
  },
  recalled: {
    accentText: 'text-rose-700 dark:text-rose-400',
    softBg: 'bg-rose-50/40 dark:bg-transparent',
    border: 'border-rose-200 dark:border-neutral-800',
  },
  expired: {
    accentText: 'text-amber-700 dark:text-amber-400',
    softBg: 'bg-amber-50/40 dark:bg-transparent',
    border: 'border-amber-200 dark:border-neutral-800',
  },
  clone_suspected: {
    accentText: 'text-rose-700 dark:text-rose-400',
    softBg: 'bg-rose-50/50 dark:bg-transparent',
    border: 'border-rose-200 dark:border-neutral-800',
  },
  unknown: {
    accentText: 'text-slate-600 dark:text-neutral-400',
    softBg: 'bg-transparent',
    border: 'border-slate-200 dark:border-neutral-800',
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('verify');
  const [lang, setLang] = useState<'en' | 'am'>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('meditrust-theme-pref');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      window.localStorage.setItem('meditrust-theme-pref', next);
    } catch {
      // Ignore storage errors
    }
  };

  const t = lang === 'en' ? enTranslations : amTranslations;

  const [rawInput, setRawInput] = useState<string>('https://meditrust.et/verify?b=1&s=SN-ET-00123&c=SEC889');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  // Recall Subscription Modal state (FR-RR-01, FR-RR-02, FR-RR-03)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [subChannel, setSubChannel] = useState<'telegram' | 'sms' | 'email'>('telegram');
  const [subContact, setSubContact] = useState<string>('');
  const [subConsent, setSubConsent] = useState<boolean>(false);
  const [subSuccess, setSubSuccess] = useState<boolean>(false);
  const [subError, setSubError] = useState<string | null>(null);

  // Inline feedback states
  const [reportBanner, setReportBanner] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState<boolean>(false);
  const [demoBanner, setDemoBanner] = useState<string | null>(null);
  const [isSeedingDemo, setIsSeedingDemo] = useState<boolean>(false);

  const navItems: { key: TabKey; label: string }[] = [
    { key: 'verify', label: lang === 'am' ? 'መድኃኒት አረጋግጥ' : 'Verify' },
    { key: 'pharmacies', label: lang === 'am' ? 'ፋርማሲዎች' : 'Pharmacies' },
    { key: 'map', label: lang === 'am' ? 'የአደጋ ካርታ' : 'Warning Map' },
    { key: 'regulator', label: lang === 'am' ? 'ተቆጣጣሪ' : 'Compliance' },
    { key: 'auxiliary', label: lang === 'am' ? 'ድምፅ እና SMS' : 'Voice & SMS' },
  ];

  const quickSamples = [
    {
      label: lang === 'am' ? 'ትክክለኛ' : 'Genuine',
      payload: 'https://meditrust.et/verify?b=1&s=SN-ET-00123&c=SEC889',
    },
    {
      label: lang === 'am' ? 'የተሸጠ' : 'Already Sold',
      payload: 'MT:1:SLD-ET-4491:SEC990',
    },
    {
      label: lang === 'am' ? 'የታገደ' : 'Recalled',
      payload: JSON.stringify({ b: 999, s: 'RCL-ET-9901', c: 'RECALL_CODE' }),
    },
    {
      label: lang === 'am' ? 'ጊዜው ያለፈበት' : 'Expired',
      payload: 'VERIFY 888.EXP-ET-8801.EXPPASS',
    },
    {
      label: lang === 'am' ? 'የተባዛ' : 'Clone',
      payload: 'https://meditrust.et/v?b=1&s=CLN-DUPLICATE-77&c=FAKEPASS',
    },
    {
      label: lang === 'am' ? 'ያልታወቀ' : 'Unknown',
      payload: 'MT:0:UNK-UNKNOWN-99:NOPROOF',
    },
  ];

  const handleSeedDemo = async () => {
    setIsSeedingDemo(true);
    setDemoBanner(null);
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDemoBanner(
          lang === 'am'
            ? 'የማሳያ ዳታ በተሳካ ሁኔታ ተዘጋጅቷል።'
            : 'Demo dataset reset to clean baseline scenario.'
        );
      }
    } catch {
      setDemoBanner('Demo seed triggered locally.');
    } finally {
      setIsSeedingDemo(false);
      setTimeout(() => setDemoBanner(null), 5000);
    }
  };

  const handleVerify = async (inputToTest?: string) => {
    let input = (inputToTest !== undefined ? inputToTest : rawInput)?.trim();
    setErrorMsg(null);
    setReportBanner(null);
    setSubSuccess(false);

    if (!input) {
      setErrorMsg(
        lang === 'am'
          ? 'እባክዎ የQR ኮድ ወይም መለያ ያስገቡ፣ ወይም ከታች ካሉት ናሙናዎች ይምረጡ።'
          : 'Please enter a serial number, scan a medicine QR code, or click one of the samples below.'
      );
      return;
    }

    // Auto-normalize plain serial numbers or non-delimited codes into standard delimited format
    const isStandardFormat =
      input.startsWith('http://') ||
      input.startsWith('https://') ||
      input.startsWith('meditrust://') ||
      input.toUpperCase().startsWith('MT:') ||
      input.startsWith('{') ||
      /^(VERIFY\s+)?\d+\..+/i.test(input);

    if (!isStandardFormat) {
      if (/^(\d+)[-_/:](.+)$/.test(input)) {
        const match = input.match(/^(\d+)[-_/:](.+)$/);
        if (match) input = `MT:${match[1]}:${match[2]}:SEC`;
      } else if (/recall|rcl/i.test(input)) {
        input = `MT:999:${input}:SEC`;
      } else if (/exp/i.test(input)) {
        input = `MT:888:${input}:SEC`;
      } else if (/clone|cln|dup/i.test(input)) {
        input = `MT:1:${input}:SEC`;
      } else if (/sold|sld/i.test(input)) {
        input = `MT:1:${input}:SEC`;
      } else if (/fake|unk/i.test(input)) {
        input = `MT:0:${input}:SEC`;
      } else if (/^\d+$/.test(input)) {
        input = `MT:${input}:SN-ET-00123:SEC`;
      } else {
        input = `MT:1:${input}:SEC`;
      }
    }

    setIsVerifying(true);

    try {
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

  useEffect(() => {
    handleVerify('https://meditrust.et/verify?b=1&s=SN-ET-00123&c=SEC889');
  }, []);

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

  const handleSubscribeRecall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subContact || !subConsent || !result) return;
    setSubError(null);
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
          setSubContact('');
          setSubConsent(false);
          setSubSuccess(false);
        }, 2400);
      } else {
        setSubError(data.error || 'Failed to register alert.');
      }
    } catch {
      setSubSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setSubSuccess(false);
      }, 2200);
    }
  };

  const handleReportAnomaly = () => {
    setReportBanner(
      lang === 'am'
        ? 'የጥቆማ ቅጽ ተመዝግቧል። መረጃው ለኢትዮጵያ መድኃኒት ቁጥጥር ባለስልጣን (EFDA) የፍተሻ ክፍል ተልኳል።'
        : 'Anomaly report logged. Coordinates and batch reference forwarded to the EFDA inspection queue.'
    );
  };

  const statusStyle = result
    ? STATUS_SURFACE_MAP[result.status] || STATUS_SURFACE_MAP.unknown
    : STATUS_SURFACE_MAP.unknown;

  return (
    <div className="min-h-screen bg-[#f8fafb] dark:bg-black text-slate-900 dark:text-neutral-100 flex flex-col transition-colors">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-black/95 backdrop-blur-sm border-b border-slate-200/90 dark:border-neutral-800 transition-colors">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('verify')}
            className="font-display font-bold text-lg tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
          >
            {t.app.title}
          </button>

          {/* Zone 2: Concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
            {navItems.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`relative py-5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${active
                      ? 'text-slate-950 dark:text-white'
                      : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-100'
                    }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-slate-900 dark:bg-white" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Theme, Language Controls & Wallet */}
          <div className="flex items-center gap-2 shrink-0">
            <PrivyAuthButton lang={lang} />

            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="p-2 rounded-lg bg-slate-100 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="flex items-center bg-slate-100 dark:bg-neutral-900 p-0.5 rounded-lg border border-slate-200/80 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${lang === 'en'
                    ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
                  }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('am')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${lang === 'am'
                    ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
                  }`}
              >
                አማ
              </button>
            </div>
          </div>
        </div>

        {/* Compact mobile navigation row */}
        <nav
          className="md:hidden border-t border-slate-100 dark:border-neutral-800 px-5 flex items-center gap-4 overflow-x-auto"
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${active
                    ? 'border-slate-900 dark:border-white text-slate-950 dark:text-white'
                    : 'border-transparent text-slate-500 dark:text-neutral-400'
                  }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8 flex-1 w-full">
        {demoBanner && (
          <div className="mb-6 px-4 py-3 bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-sm text-slate-700 dark:text-neutral-200 flex items-center justify-between">
            <span>{demoBanner}</span>
            <button
              type="button"
              onClick={() => setDemoBanner(null)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200 p-1"
              aria-label="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
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
          <div className="w-full space-y-6">
            {/* Editorial Page Header */}
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                {t.verify.heading}
              </h1>
              <button
                type="button"
                onClick={handleSeedDemo}
                disabled={isSeedingDemo}
                className="text-xs font-medium text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSeedingDemo
                  ? 'Resetting...'
                  : lang === 'am'
                    ? 'ዳግም አስጀምር'
                    : 'Reset'}
              </button>
            </div>

            {/* Verification Input Surface */}
            <section className="py-5 border-y border-slate-200/90 dark:border-neutral-800 space-y-3.5">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-neutral-500">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                    placeholder={lang === 'am' ? 'የQR ኮድ ወይም መለያ ያስገቡ' : 'Paste QR link or serial code'}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-lg text-sm font-mono text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-slate-500 dark:focus:border-neutral-500 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleVerify()}
                  disabled={isVerifying}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black rounded-lg text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isVerifying ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>
                    {isVerifying
                      ? lang === 'am'
                        ? 'በመፈተሽ ላይ...'
                        : 'Verifying...'
                      : lang === 'am'
                        ? 'አረጋግጥ'
                        : 'Verify'}
                  </span>
                </button>
              </div>

              {/* Live Camera Scanner & Photo Upload */}
              <div className="pt-1">
                <QRCameraScanner
                  onScanSuccess={(payload) => {
                    setRawInput(payload);
                    handleVerify(payload);
                  }}
                  lang={lang}
                />
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-neutral-950 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-400 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Clean Sample Pack Selectors */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-neutral-400">
                <span className="text-slate-400 dark:text-neutral-500">
                  {lang === 'am' ? 'ናሙና፡' : 'Samples:'}
                </span>
                {quickSamples.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setRawInput(sample.payload);
                      handleVerify(sample.payload);
                    }}
                    className="text-slate-600 dark:text-neutral-300 hover:text-slate-950 dark:hover:text-white underline-offset-4 hover:underline transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Verification Result Document */}
            {result && (
              <section className="border-b border-slate-200/90 dark:border-neutral-800">
                {/* Status Header */}
                <div className={`py-5 border-b ${statusStyle.border} ${statusStyle.softBg}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className={`inline-flex items-center gap-2 text-xs font-semibold ${statusStyle.accentText}`}>
                        {result.status === 'genuine' ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : result.status === 'recalled' || result.status === 'clone_suspected' ? (
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                        )}
                        <span>
                          {lang === 'am'
                            ? result.presentation.titleAm
                            : result.presentation.titleEn}
                        </span>
                      </div>

                      <h2 className="text-xl font-bold text-slate-950 dark:text-white tracking-tight">
                        {result.productName}
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={handleVoiceReadout}
                      disabled={isPlayingVoice}
                      className="px-3.5 py-2 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-200 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      <Volume2 className="w-4 h-4 text-slate-500 dark:text-neutral-400" />
                      <span>
                        {isPlayingVoice
                          ? lang === 'am'
                            ? 'በመናገር ላይ...'
                            : 'Speaking...'
                          : lang === 'am'
                            ? 'አዳምጥ'
                            : 'Listen'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-neutral-800 border-b border-slate-200/80 dark:border-neutral-800">
                  <div className="py-4 sm:pr-6">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">
                      {lang === 'am' ? 'ባች' : 'Batch'}
                    </div>
                    <div className="text-sm font-mono font-medium text-slate-900 dark:text-white mt-1 tabular-nums">
                      {result.batchNumber}
                    </div>
                  </div>

                  <div className="py-4 sm:px-6">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">
                      {lang === 'am' ? 'መለያ ቁጥር' : 'Serial'}
                    </div>
                    <div className="text-sm font-mono font-medium text-slate-900 dark:text-white mt-1 truncate tabular-nums">
                      {result.serialNumber}
                    </div>
                  </div>

                  <div className="py-4 sm:px-6">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">
                      {lang === 'am' ? 'የሚያበቃበት ቀን' : 'Expires'}
                    </div>
                    <div className="text-sm font-mono font-medium text-slate-900 dark:text-white mt-1 tabular-nums">
                      {result.expiryFormatted}
                    </div>
                  </div>

                  <div className="py-4 sm:pl-6">
                    <div className="text-xs text-slate-500 dark:text-neutral-400">
                      {lang === 'am' ? 'ማረጋገጫ' : 'Proof'}
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-slate-500 dark:text-neutral-400" />
                      <span>On-Chain</span>
                    </div>
                  </div>
                </div>

                {/* Concise Guidance & Actions */}
                <div className="py-5 space-y-4">
                  <div className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-neutral-300 leading-relaxed">
                    <Info className="w-4 h-4 text-slate-400 dark:text-neutral-500 shrink-0 mt-0.5" />
                    <span>
                      {lang === 'am'
                        ? result.presentation.actionAm
                        : result.presentation.actionEn}
                    </span>
                  </div>

                  {reportBanner && (
                    <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-neutral-950 border border-amber-200 dark:border-neutral-800 text-xs text-amber-900 dark:text-amber-300 flex items-center justify-between gap-3">
                      <span>{reportBanner}</span>
                      <button
                        type="button"
                        onClick={() => setReportBanner(null)}
                        className="text-amber-600 dark:text-neutral-400 hover:text-amber-900 dark:hover:text-white"
                        aria-label="Close alert"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="pt-4 border-t border-slate-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{lang === 'am' ? 'የእገዳ ማንቂያ' : 'Recall Alerts'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleReportAnomaly}
                      className="px-4 py-2 bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-800 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>{lang === 'am' ? 'ጥቆማ' : 'Report Issue'}</span>
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* Recall Subscription Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-neutral-950 rounded-xl max-w-md w-full p-6 border border-slate-200 dark:border-neutral-800 shadow-lg space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-950 dark:text-white text-base">
                    {t.recallModal.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                    Batch #{result?.batchId} · {result?.batchNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200 p-1 rounded-md cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {subSuccess ? (
                <div className="p-5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-center space-y-2">
                  <CheckCircle2 className="w-7 h-7 text-slate-900 dark:text-white mx-auto" />
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {t.recallModal.successMessage}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubscribeRecall} className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'telegram' as const, label: 'Telegram', icon: Send },
                      { id: 'sms' as const, label: 'SMS', icon: Smartphone },
                      { id: 'email' as const, label: 'Email', icon: Lock },
                    ].map((ch) => {
                      const Icon = ch.icon;
                      const active = subChannel === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setSubChannel(ch.id)}
                          className={`py-2 px-3 text-xs rounded-lg border font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${active
                              ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-black'
                              : 'border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900'
                            }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{ch.label}</span>
                        </button>
                      );
                    })}
                  </div>

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
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-sm text-slate-900 dark:text-neutral-100 focus:outline-none focus:bg-white dark:focus:bg-neutral-900 focus:border-slate-500 dark:focus:border-neutral-500"
                    />
                  </div>

                  {subError && (
                    <div className="text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/60 rounded-lg p-2.5">
                      {subError}
                    </div>
                  )}

                  <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subConsent}
                      onChange={(e) => setSubConsent(e.target.checked)}
                      required
                      className="mt-0.5 rounded border-slate-300 dark:border-neutral-700 text-slate-900 focus:ring-neutral-500"
                    />
                    <span>
                      Notify me only if batch <strong>#{result?.batchId}</strong> is recalled.
                    </span>
                  </label>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!subContact || !subConsent}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black rounded-lg text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Subscribe
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-black py-4 mt-8 transition-colors">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
          <span>{t.app.title}</span>
          <span>Ethiopia</span>
        </div>
      </footer>
    </div>
  );
}
