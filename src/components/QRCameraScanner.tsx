/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Live Camera & Photo Upload QR Scanner for Medicine Packs
 * Implements camera capture, photo upload, and real-time jsQR frame decoding.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Flashlight,
  SwitchCamera,
  Maximize2,
} from 'lucide-react';
import { decodeQRFromFile, decodeQRFromVideo } from '../services/browserQRScanner.ts';

interface QRCameraScannerProps {
  onScanSuccess: (payload: string) => void;
  lang: 'en' | 'am';
}

export function QRCameraScanner({ onScanSuccess, lang }: QRCameraScannerProps) {
  const [mode, setMode] = useState<'camera' | 'upload' | 'closed'>('closed');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Play a gentle success beep using Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {}
  };

  // Start Live Camera
  const startCamera = async () => {
    setCameraError(null);
    setMode('camera');
    setIsScanning(true);

    try {
      // Prefer rear/back camera on mobile devices
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanVideoLoop();
      }
    } catch (err: any) {
      console.warn('Camera access failed:', err);
      setCameraError(
        lang === 'am'
          ? 'ካሜራውን መክፈት አልተቻለም። እባክዎ የካሜራ ፈቃድ ይስጡ ወይም ፎቶ ይስቀሉ።'
          : 'Unable to access camera. Please allow camera permissions or upload a photo of the medicine pack.'
      );
      setIsScanning(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // Scan loop running on animation frames
  const scanVideoLoop = () => {
    if (!videoRef.current || !streamRef.current) return;

    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const decoded = decodeQRFromVideo(videoRef.current);
      if (decoded) {
        playBeep();
        stopCamera();
        setMode('closed');
        onScanSuccess(decoded);
        return;
      }
    }

    animFrameRef.current = requestAnimationFrame(scanVideoLoop);
  };

  // Handle Photo File Upload or Snap
  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setIsProcessingFile(true);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const decoded = await decodeQRFromFile(file);
      if (decoded) {
        playBeep();
        setMode('closed');
        onScanSuccess(decoded);
      } else {
        setUploadError(
          lang === 'am'
            ? 'በዚህ ፎቶ ላይ የQR ኮድ ማግኘት አልተቻለም። እባክዎ የተሻለ ብርሃን ያለው ጥርት ያለ ፎቶ ያንሱ።'
            : 'No QR code detected in this photo. Please ensure clear lighting and focus on the QR code, or type the code text.'
        );
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error processing image file.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="space-y-3">
      {/* Scanner Mode Toggle Bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (mode === 'camera') {
              stopCamera();
              setMode('closed');
            } else {
              startCamera();
            }
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition shadow-xs ${
            mode === 'camera'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500'
          }`}
        >
          <Camera className="w-4 h-4 text-emerald-500" />
          <span>
            {mode === 'camera'
              ? lang === 'am' ? 'ካሜራ ዝጋ' : 'Close Camera'
              : lang === 'am' ? '📷 ካሜራ ክፈት / ፎቶ አንሳ' : '📷 Scan with Camera'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            stopCamera();
            setMode(mode === 'upload' ? 'closed' : 'upload');
            if (fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition shadow-xs ${
            mode === 'upload'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-500'
          }`}
        >
          <Upload className="w-4 h-4 text-indigo-500" />
          <span>{lang === 'am' ? '🖼️ የመድኃኒት ፎቶ ስቀል' : '🖼️ Upload Medicine Photo'}</span>
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
          className="hidden"
        />
      </div>

      {/* Live Camera Viewfinder Box */}
      {mode === 'camera' && (
        <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-emerald-500 shadow-xl aspect-4/3 max-h-80 w-full flex items-center justify-center">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Targeting Crosshairs & Scan Line */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-56 h-56 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

              {/* Animated scan line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Viewfinder Instructions & Close */}
          <div className="absolute top-3 inset-x-3 flex items-center justify-between text-white text-xs bg-slate-900/60 backdrop-blur-xs px-3 py-1.5 rounded-lg">
            <span>
              {lang === 'am'
                ? 'የመድኃኒቱን QR ኮድ በመስመሩ ውስጥ ያስተካክሉ'
                : 'Point camera at medicine pack QR code'}
            </span>
            <button
              onClick={() => {
                stopCamera();
                setMode('closed');
              }}
              className="p-1 hover:bg-white/20 rounded-md transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Shutter / Snap Button for manual picture taking */}
          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  const decoded = decodeQRFromVideo(videoRef.current);
                  if (decoded) {
                    playBeep();
                    stopCamera();
                    setMode('closed');
                    onScanSuccess(decoded);
                  } else {
                    setCameraError(
                      lang === 'am'
                        ? 'QR ኮድ አልተገኘም። እባክዎ ካሜራውን ወደ QR ኮዱ ያስጠጉ።'
                        : 'Could not read QR code. Move closer or steady your hands.'
                    );
                  }
                }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-2 cursor-pointer transition transform active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>{lang === 'am' ? 'ፎቶ አንሳና አረጋግጥ' : 'Snap & Verify'}</span>
            </button>
          </div>

          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center text-white space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500" />
              <p className="text-xs text-rose-200">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold"
              >
                Retry Camera
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload Preview & Processing Status */}
      {mode === 'upload' && previewUrl && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={previewUrl}
              alt="Medicine pack preview"
              className="w-14 h-14 object-cover rounded-lg border border-slate-300 dark:border-slate-600"
            />
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {isProcessingFile ? (
                  <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Scanning QR from photo...
                  </span>
                ) : (
                  'Photo Loaded'
                )}
              </div>
              <div className="text-2xs text-slate-500">
                {isProcessingFile ? 'Analyzing image matrix' : 'Ready to verify'}
              </div>
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-600 transition"
          >
            Change Photo
          </button>
        </div>
      )}

      {uploadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <span>{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="p-1 hover:bg-rose-200/50 rounded font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
