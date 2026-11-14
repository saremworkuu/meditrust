/**
 * @license SPDX-License-Identifier: Apache-2.0
 * MediTrust Full-Stack Server
 * Runs Express API endpoints and mounts Vite dev middleware on port 3000.
 */

import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEnv } from './lib/env.ts';
import { testPinataConnection } from './lib/ipfs.ts';
import { recallComplianceService } from './src/services/recallComplianceService.ts';
import {
  telegramWebhookHandler,
  formatTelegramVerificationReply,
  buildVerificationButtons,
} from './src/bot/telegramBot.ts';
import { botSessionService } from './src/services/botSessionService.ts';
import { verifyPack } from './packages/verify/src/index.ts';
import { decodeQRFromBuffer } from './src/services/qrImageDecoder.ts';
import enTranslations from './src/locales/en.json' with { type: 'json' };
import amTranslations from './src/locales/am.json' with { type: 'json' };
import { recallAlertService } from './src/services/recallAlertService.ts';
import { trustScoreService } from './src/services/trustScoreService.ts';
import { TRUST_SCORE_CONFIG } from './src/config/trustScoreConfig.ts';
import { earlyWarningService } from './src/services/earlyWarningService.ts';
import { nationalRegistryAdapter } from './src/services/nationalRegistryAdapter.ts';
import { voiceAudioService } from './src/services/voiceAudioService.ts';
import { smsVerificationService, SMS_SPEC_DOCS } from './src/services/smsVerificationService.ts';
import { seedFullDemoScenario } from './scripts/seedDemoScenario.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Task 1: Environment startup validation using Zod
  validateEnv(true);

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // --- API Routes for Recall Compliance & Registry ---

  // 1. Get recall compliance summary and holder statuses (FR-RR-08)
  app.get('/api/recall-compliance', (_req: Request, res: Response) => {
    try {
      const summaries = recallComplianceService.getBatchSummaries();
      res.json({
        success: true,
        batches: summaries,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Acknowledge recall (FR-RR-06, FR-RR-07)
  app.post('/api/recall-compliance/acknowledge', (req: Request, res: Response) => {
    try {
      const { batchId, holder, qty, evidenceCid } = req.body;
      if (!batchId || !holder || qty === undefined) {
        res.status(400).json({ success: false, error: 'Missing batchId, holder, or qty' });
        return;
      }

      const updated = recallComplianceService.acknowledgeRecall(
        Number(batchId),
        String(holder),
        Number(qty),
        evidenceCid || 'ipfs://bafybeiclkmedi7patientproof'
      );

      res.json({ success: true, record: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 3. Mark holder overdue after deadline (FR-RR-09)
  app.post('/api/recall-compliance/mark-overdue', (req: Request, res: Response) => {
    try {
      const { batchId, holder } = req.body;
      if (!batchId || !holder) {
        res.status(400).json({ success: false, error: 'Missing batchId or holder' });
        return;
      }

      const updated = recallComplianceService.markOverdue(Number(batchId), String(holder));
      res.json({ success: true, record: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 4. Fast forward deadline to test overdue workflow
  app.post('/api/recall-compliance/fast-forward', (req: Request, res: Response) => {
    try {
      const { batchId } = req.body;
      recallComplianceService.setFastForwardDeadline(Number(batchId || 1), 3600);
      res.json({ success: true, message: 'Deadline fast-forwarded past current time' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 5. Reset / seed demo scenario (FR-RR-08 demo seed)
  app.post('/api/recall-compliance/seed', (_req: Request, res: Response) => {
    recallComplianceService.seedDemo();
    res.json({
      success: true,
      message: 'Demo state reset: 1 recalled batch with 2 Pending holders',
      batches: recallComplianceService.getBatchSummaries(),
    });
  });

  // 6. Get dashboard banners for non-compliant holders (FR-RR-10)
  app.get('/api/recall-compliance/banners', (req: Request, res: Response) => {
    const holder = req.query.holder as string | undefined;
    const banners = recallComplianceService.getBanners(holder);
    res.json({ success: true, banners });
  });

  // 7. Mock National Interoperability Registry (FR-IO-01, FR-IO-03, simulated)
  app.get('/api/registry/check', async (req: Request, res: Response) => {
    try {
      const gtin = req.query.gtin as string | undefined;
      const batch = (req.query.batch as string) || (req.query.batchNumber as string);

      const result = await nationalRegistryAdapter.checkRegistry({
        gtin,
        batchNumber: batch,
      });

      res.json({
        ...result,
        gtin,
        batch,
      });
    } catch (err: any) {
      res.status(500).json({ registered: false, error: err.message, status: 'unavailable' });
    }
  });

  // 7b. Toggle simulated outage for registry resilience testing (FR-IO-04)
  app.post('/api/registry/toggle-outage', (req: Request, res: Response) => {
    const { offline } = req.body;
    const isOffline = offline !== undefined ? Boolean(offline) : !nationalRegistryAdapter.getIsOffline();
    nationalRegistryAdapter.setSimulatedOffline(isOffline);
    res.json({
      success: true,
      isSimulatedOffline: isOffline,
      message: isOffline
        ? 'National Registry simulated offline (testing FR-IO-04 resilience: verify must still succeed)'
        : 'National Registry online',
    });
  });

  // 7c. Get all registered mock products (FR-IO-01)
  app.get('/api/registry/records', (_req: Request, res: Response) => {
    res.json({
      success: true,
      isSimulated: true,
      records: nationalRegistryAdapter.getAllRecords(),
    });
  });


  // 8. Telegram Bot Webhook Route (grammY)
  app.post('/api/telegram/webhook', (req: Request, res: Response) => {
    // Passes to grammY express webhook handler
    telegramWebhookHandler(req, res);
  });

  // 9. Telegram Simulation Route for Local Testing & Demo without live BotFather token
  app.post('/api/telegram/simulate', async (req: Request, res: Response) => {
    try {
      const { text, telegramId, photoBase64, language } = req.body;
      const effectiveId = telegramId || 123456789;

      if (language === 'en' || language === 'am') {
        botSessionService.setLanguage(effectiveId, language);
      }
      const userLang = botSessionService.getLanguage(effectiveId);
      const t = userLang === 'am' ? amTranslations : enTranslations;

      let codeToVerify = text;

      // Handle photo simulation if provided
      if (photoBase64) {
        const buffer = Buffer.from(photoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const decoded = decodeQRFromBuffer(buffer);
        if (!decoded || !decoded.data) {
          res.json({
            success: false,
            reply: t.bot.decodeFailed,
            under400Chars: t.bot.decodeFailed.length < 400,
            charCount: t.bot.decodeFailed.length,
          });
          return;
        }
        codeToVerify = decoded.data;
      }

      if (!codeToVerify) {
        res.status(400).json({ success: false, error: 'Provide text code or photoBase64' });
        return;
      }

      const verifyResult = await verifyPack(codeToVerify, { checkRegistry: true });

      // Log scan event with channel = 'telegram' (no personal identity)
      const scanEvent = botSessionService.logScanEvent({
        status: verifyResult.status,
        batchId: verifyResult.batchId,
        batchNumber: verifyResult.batchNumber,
        channel: 'telegram',
      });

      const reply = formatTelegramVerificationReply(verifyResult, userLang);

      res.json({
        success: true,
        reply,
        under400Chars: reply.length < 400,
        charCount: reply.length,
        language: userLang,
        status: verifyResult.status,
        batchId: verifyResult.batchId,
        scanEvent,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 10. Get privacy-preserving scan events (FR-VA-08)
  app.get('/api/telegram/scan-events', (_req: Request, res: Response) => {
    res.json({
      success: true,
      events: botSessionService.getScanLogs(),
    });
  });

  // 11. Patient Recall Alerts Subscription (FR-RR-01, FR-RR-02, FR-RR-03)
  app.post('/api/recalls/subscribe', (req: Request, res: Response) => {
    try {
      const { batchId, channel, contact, language, consentGiven } = req.body;
      if (!batchId || !channel || !contact) {
        res.status(400).json({ success: false, error: 'batchId, channel, and contact are required' });
        return;
      }

      const result = recallAlertService.subscribe({
        batchId: Number(batchId),
        channel,
        contact,
        language: language === 'am' ? 'am' : 'en',
        consentGiven: Boolean(consentGiven),
      });

      res.json({
        success: true,
        subscriptionId: result.subscription.id,
        batchId: result.subscription.batchId,
        channel: result.subscription.channel,
        contactMasked: result.subscription.contactMasked,
        unsubscribeUrl: result.unsubscribeUrl,
        message: 'Recall alert registered. Contact encrypted with AES-256-GCM. No serial stored.',
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 12. One-tap Unsubscribe (FR-RR-05, NFR-25)
  app.post('/api/recalls/unsubscribe', (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ success: false, error: 'Unsubscribe token is required' });
        return;
      }
      const result = recallAlertService.unsubscribe(String(token));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/recalls/unsubscribe', (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        res.status(400).json({ success: false, error: 'Token query parameter missing' });
        return;
      }
      const result = recallAlertService.unsubscribe(token);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 13. Recall Worker Alert Dispatch (FR-RR-04, NFR-22)
  app.post('/api/recalls/dispatch', async (req: Request, res: Response) => {
    try {
      const { batchId, reason, batchNumber } = req.body;
      if (!batchId) {
        res.status(400).json({ success: false, error: 'batchId is required' });
        return;
      }

      const result = await recallAlertService.dispatchRecallAlerts({
        batchId: Number(batchId),
        batchNumber,
        reason: reason || 'Regulatory safety recall initiated by EFDA',
      });

      res.json({
        success: true,
        queued: result.queued,
        sent: result.sent,
        logs: result.logs,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 14. Recall Notification Logs
  app.get('/api/recalls/logs', (req: Request, res: Response) => {
    const batchId = req.query.batchId ? Number(req.query.batchId) : undefined;
    res.json({
      success: true,
      logs: recallAlertService.getNotificationLogs(batchId),
    });
  });

  // --- API Routes for Pharmacy Trust Score (FR-TS-01 to FR-TS-07, Section 4.3 & 4.4) ---

  // 15. Get ranked pharmacy trust scores (with optional filters)
  app.get('/api/pharmacies/scores', (req: Request, res: Response) => {
    try {
      const belowThreshold = req.query.belowThreshold
        ? Number(req.query.belowThreshold)
        : undefined;
      const badge = req.query.badge as any;
      const query = req.query.query as string | undefined;

      const pharmacies = trustScoreService.getRankedPharmacies({
        belowThreshold,
        badge,
        query,
      });

      res.json({
        success: true,
        count: pharmacies.length,
        disclaimer: 'Based on recorded activity in MediTrust',
        pharmacies,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 16. Get single pharmacy profile & event history
  app.get('/api/pharmacies/:address', (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const profile = trustScoreService.getPharmacyProfile(address);
      res.json({ success: true, profile });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message });
    }
  });

  // 17. Attach pharmacy response note (IPFS hash) to negative event (Section 4.4)
  app.post('/api/pharmacies/respond-to-event', (req: Request, res: Response) => {
    try {
      const { pharmacy, eventId, responseNoteIpfs } = req.body;
      if (!pharmacy || !eventId || !responseNoteIpfs) {
        res.status(400).json({
          success: false,
          error: 'pharmacy, eventId, and responseNoteIpfs are required',
        });
        return;
      }

      const updatedEvent = trustScoreService.attachResponseNote(
        pharmacy,
        eventId,
        responseNoteIpfs
      );
      const updatedProfile = trustScoreService.getPharmacyProfile(pharmacy);

      res.json({
        success: true,
        event: updatedEvent,
        profile: updatedProfile,
        message: 'Response note attached via IPFS hash',
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 18. Get published deterministic trust score formula and weights (FR-TS-03)
  app.get('/api/pharmacies/config/formula', (_req: Request, res: Response) => {
    res.json({
      success: true,
      config: TRUST_SCORE_CONFIG,
    });
  });

  // 19. Seed / reset demo pharmacy trust scores
  app.post('/api/pharmacies/seed', (_req: Request, res: Response) => {
    trustScoreService.seedDemo();
    res.json({
      success: true,
      message: 'Demo pharmacy trust scores reset to seed scenario',
      pharmacies: trustScoreService.getRankedPharmacies(),
    });
  });

  // --- API Routes for Counterfeit Early-Warning Map (FR-EW-01 to FR-EW-08, Section 5.2) ---

  // 20. Get aggregated ~1 km geo-cells (FR-EW-01)
  app.get('/api/early-warning/geo-cells', (_req: Request, res: Response) => {
    try {
      const cells = earlyWarningService.getGeoCells();
      res.json({
        success: true,
        count: cells.length,
        cells,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 21. Get heatmap density points (FR-EW-02)
  app.get('/api/early-warning/heatmap', (_req: Request, res: Response) => {
    try {
      const points = earlyWarningService.getHeatmapPoints();
      res.json({
        success: true,
        count: points.length,
        points,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 22. Get active anomaly alert cards (FR-EW-04, FR-EW-05, FR-EW-06)
  app.get('/api/early-warning/alerts', (req: Request, res: Response) => {
    try {
      const statusFilter = req.query.status as any;
      const alerts = earlyWarningService.getAnomalyAlerts(statusFilter);
      res.json({
        success: true,
        count: alerts.length,
        alerts,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 23. Turn alert into investigation (FR-EW-07)
  app.post('/api/early-warning/investigate', (req: Request, res: Response) => {
    try {
      const { alertId, notes, inspector } = req.body;
      if (!alertId) {
        res.status(400).json({ success: false, error: 'alertId is required' });
        return;
      }
      const investigation = earlyWarningService.turnAlertIntoInvestigation(
        String(alertId),
        notes,
        inspector
      );
      res.json({
        success: true,
        investigation,
        message: 'Investigation initiated by EFDA Rapid Response Unit',
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 24. One-click recall from alert (FR-EW-07 / extends FR-RR-06)
  app.post('/api/early-warning/recall', (req: Request, res: Response) => {
    try {
      const { alertId, reason } = req.body;
      if (!alertId) {
        res.status(400).json({ success: false, error: 'alertId is required' });
        return;
      }
      const result = earlyWarningService.triggerOneClickRecall(String(alertId), reason);
      res.json({
        success: true,
        recallInitiated: result.recallInitiated,
        batchId: result.batchId,
        alert: result.alert,
        message: 'One-click recall initiated on-chain. 48h compliance deadline active.',
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 25. Get list of investigations
  app.get('/api/early-warning/investigations', (_req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        investigations: earlyWarningService.getInvestigations(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 26. Public Read-Only "Safety Pulse" (FR-EW-08) - ZERO pack-level data
  app.get('/api/early-warning/safety-pulse', (_req: Request, res: Response) => {
    try {
      const pulse = earlyWarningService.getPublicSafetyPulse();
      res.json({
        success: true,
        pulse,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 27. Seed / reset demo early-warning scenarios (Section 10 Demo steps)
  app.post('/api/early-warning/seed', (_req: Request, res: Response) => {
    try {
      earlyWarningService.seedDemoData();
      res.json({
        success: true,
        message: 'Early-warning demo data seeded (Fake QR spike R4, Bole cluster R5, Clone attack R6)',
        alerts: earlyWarningService.getAnomalyAlerts(),
        cells: earlyWarningService.getGeoCells(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Step 8: Cuttable Features Endpoints (FR-VA-05, FR-VA-10, NFR-27) ---

  // 28. Voice Audio Transcript & Audio Clip Generation (FR-VA-05, NFR-27)
  app.get('/api/audio/status/:status', (req: Request, res: Response) => {
    try {
      const status = req.params.status as any;
      const lang = req.query.lang === 'am' ? 'am' : 'en';
      const productName = (req.query.product as string) || 'Amoxicillin 500mg Capsules';
      const batchNumber = (req.query.batch as string) || 'ET-AMOX-001';
      const format = req.query.format as string | undefined;

      if (format === 'wav') {
        const wavBuffer = voiceAudioService.getAudioWavBuffer(status);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Disposition', `inline; filename="status-${status}.wav"`);
        res.send(wavBuffer);
        return;
      }

      const voiceClip = voiceAudioService.getVoiceTranscript({
        status,
        lang,
        productName,
        batchNumber,
      });

      res.json({
        success: true,
        voiceClip,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 29. SMS Format Spec & Simulated Gateway Endpoint (FR-VA-10, simulated)
  app.post('/api/sms/simulate', async (req: Request, res: Response) => {
    try {
      const { message, fromPhoneNumber, lang } = req.body;
      if (!message) {
        res.status(400).json({
          success: false,
          error: 'message string is required (format: VERIFY <batch>.<serial>.<code>)',
        });
        return;
      }

      const response = await smsVerificationService.handleSms(
        String(message),
        fromPhoneNumber,
        lang === 'am' ? 'am' : 'en'
      );

      res.json({
        success: true,
        ...response,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 30. SMS Protocol Specification Documentation (FR-VA-10)
  app.get('/api/sms/spec', (_req: Request, res: Response) => {
    res.json({
      success: true,
      spec: SMS_SPEC_DOCS,
      isSimulated: true,
      label: '[SIMULATED SMS - EFDA 8899]',
    });
  });

  // 31. Master 3-Minute Demo Scenario Reset & Seed Endpoint (Section 10 & 11)
  app.post('/api/demo/seed', async (_req: Request, res: Response) => {
    try {
      const result = await seedFullDemoScenario();
      res.json({
        success: true,
        message: 'Master 3-Minute Buildathon Demo Scenario successfully seeded',
        result,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 32. Pinata IPFS Health Check Endpoint (Task 7)
  app.get('/api/health/pinata', async (_req: Request, res: Response) => {
    try {
      const result = await testPinataConnection();
      res.status(result.status).json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, status: 500, message: err.message });
    }
  });

  // 33. IPFS Evidence Upload Endpoint (Task 5)
  // Max 10MB, Images & PDFs only. PINATA_JWT never exposed to client.
  app.post('/api/upload', express.raw({ type: '*/*', limit: '10mb' }), async (req: Request, res: Response) => {
    try {
      const pinataJwt = process.env.PINATA_JWT;
      if (!pinataJwt || pinataJwt.includes('your_pinata_jwt')) {
        res.status(500).json({ error: 'Server configuration error: PINATA_JWT is not configured.' });
        return;
      }

      const contentType = (req.headers['content-type'] || '').toLowerCase();
      const isAllowed =
        contentType.startsWith('image/') ||
        contentType.includes('pdf') ||
        contentType.includes('multipart/form-data');

      if (!isAllowed) {
        res.status(400).json({
          error: `Invalid content type '${contentType}'. Only images and PDF files are allowed.`,
        });
        return;
      }

      const pinataFormData = new FormData();
      const bodyBuffer = req.body instanceof Buffer ? req.body : Buffer.from(req.body || '');
      const blob = new Blob([bodyBuffer], { type: contentType });
      pinataFormData.append('file', blob, `meditrust_${Date.now()}`);

      const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
        },
        body: pinataFormData,
      });

      if (!pinataRes.ok) {
        const errText = await pinataRes.text();
        res.status(pinataRes.status).json({ error: `Pinata IPFS upload failed: ${errText}` });
        return;
      }

      const pinataData = await pinataRes.json();
      res.json({
        success: true,
        cid: pinataData.IpfsHash,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Server upload error' });
    }
  });




  // --- Mount Vite Middleware in Development ---
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      port: PORT,
      host: '0.0.0.0',
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MediTrust Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MediTrust server:', err);
  process.exit(1);
});
