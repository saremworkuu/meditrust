/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Telegram Verification Bot (grammY)
 * Implements: FR-VA-01 to FR-VA-04, FR-VA-06 (buttons), FR-VA-07, FR-VA-08, NFR-23, NFR-27, NFR-28
 *
 * Constraints:
 * 1. Read-only from chain (Section 3.4: The bot has no wallet and no keys; only reads from chain).
 * 2. Message length strictly under 400 characters (Section 3.4).
 * 3. Salted hash of Telegram ID for language sessions (Section 7.2).
 * 4. Zero personal data logged in scan_events (FR-VA-08).
 */

import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import { verifyPack, VerificationResult } from '../../packages/verify/src/index.ts';
import { decodeQRFromBuffer } from '../services/qrImageDecoder.ts';
import { botSessionService } from '../services/botSessionService.ts';
import enTranslations from '../locales/en.json' with { type: 'json' };
import amTranslations from '../locales/am.json' with { type: 'json' };
import { recallAlertService } from '../services/recallAlertService.ts';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'MOCK_BOT_TOKEN_FOR_DEV_AND_TEST';

export const bot = new Bot(TELEGRAM_BOT_TOKEN);

/**
 * Formats verification result strictly under 400 characters for Telegram readability
 * Section 3.4 constraint & FR-VA-03
 */
export function formatTelegramVerificationReply(
  res: VerificationResult,
  lang: 'en' | 'am'
): string {
  const isAm = lang === 'am';
  const emoji = res.presentation.emoji;
  const title = isAm ? res.presentation.titleAm : res.presentation.titleEn;
  const sentence = isAm ? res.presentation.shortSentenceAm : res.presentation.shortSentenceEn;
  const action = isAm ? res.presentation.actionAm : res.presentation.actionEn;

  // Compact layout ensuring strictly < 400 chars
  let text = `${emoji} *${title}*\n\n`;
  text += isAm ? `📦 ምርት፡ ${res.productName}\n` : `📦 Product: ${res.productName}\n`;
  text += isAm ? `🏷️ ባች፡ ${res.batchNumber}\n` : `🏷️ Batch: ${res.batchNumber}\n`;
  text += isAm ? `📅 ማብቂያ፡ ${res.expiryFormatted}\n\n` : `📅 Expiry: ${res.expiryFormatted}\n\n`;
  text += isAm ? `ℹ️ ${sentence}\n` : `ℹ️ ${sentence}\n`;
  text += isAm ? `👉 መመሪያ፡ ${action}` : `👉 Direction: ${action}`;

  // Truncate if exceeds 400 characters (Section 3.4)
  if (text.length > 395) {
    return text.substring(0, 392) + '...';
  }
  return text;
}

/**
 * Constructs inline action buttons (FR-VA-06)
 */
export function buildVerificationButtons(batchId: string, lang: 'en' | 'am') {
  const t = lang === 'am' ? amTranslations : enTranslations;
  return new InlineKeyboard()
    .text(t.bot.btnReport, `report_${batchId}`)
    .text(t.bot.btnAlert, `alert_${batchId}`)
    .row()
    .text(t.bot.btnPharmacy, `pharmacy_${batchId}`);
}

/**
 * Language Selection Keyboard
 */
export function buildLanguageKeyboard() {
  return new InlineKeyboard()
    .text('🇬🇧 English', 'set_lang_en')
    .text('🇪🇹 አማርኛ', 'set_lang_am');
}

// --- grammY Bot Handlers ---

// Command /start or /help
bot.command(['start', 'help'], async (ctx) => {
  const lang = botSessionService.getLanguage(ctx.from?.id || 0);
  const t = lang === 'am' ? amTranslations : enTranslations;

  await ctx.reply(t.bot.welcome, {
    reply_markup: buildLanguageKeyboard(),
  });
});

// Command /language
bot.command('language', async (ctx) => {
  const lang = botSessionService.getLanguage(ctx.from?.id || 0);
  const t = lang === 'am' ? amTranslations : enTranslations;
  await ctx.reply(t.bot.chooseLanguage, {
    reply_markup: buildLanguageKeyboard(),
  });
});

// Language Callback query (Salted hash Telegram ID only, Section 7.2)
bot.callbackQuery(['set_lang_en', 'set_lang_am'], async (ctx) => {
  const selectedLang = ctx.callbackQuery.data === 'set_lang_am' ? 'am' : 'en';
  if (ctx.from) {
    botSessionService.setLanguage(ctx.from.id, selectedLang);
  }
  const t = selectedLang === 'am' ? amTranslations : enTranslations;
  const msg = selectedLang === 'am' ? t.bot.langSetAm : t.bot.langSetEn;

  await ctx.answerCallbackQuery();
  await ctx.reply(msg);
});

// Action Buttons Callbacks (FR-VA-06 stubs)
bot.callbackQuery(/^report_/, async (ctx) => {
  const lang = botSessionService.getLanguage(ctx.from?.id || 0);
  const t = lang === 'am' ? amTranslations : enTranslations;
  await ctx.answerCallbackQuery();
  await ctx.reply(t.bot.reportResponse);
});

bot.callbackQuery(/^alert_/, async (ctx) => {
  const batchId = Number(ctx.callbackQuery.data.replace('alert_', ''));
  const lang = botSessionService.getLanguage(ctx.from?.id || 0);
  const t = lang === 'am' ? amTranslations : enTranslations;

  // Register subscription (FR-RR-02, FR-RR-03: contact encrypted, linked to batch only)
  if (ctx.from) {
    recallAlertService.subscribe({
      batchId,
      channel: 'telegram',
      contact: String(ctx.from.id),
      language: lang,
      consentGiven: true,
    });
  }

  await ctx.answerCallbackQuery();
  await ctx.reply(t.bot.alertResponse.replace('{batchId}', String(batchId)));
});

bot.callbackQuery(/^pharmacy_/, async (ctx) => {
  const lang = botSessionService.getLanguage(ctx.from?.id || 0);
  const t = lang === 'am' ? amTranslations : enTranslations;
  await ctx.answerCallbackQuery();
  await ctx.reply(t.bot.pharmacyResponse);
});

// Handle QR photo messages (FR-VA-01, FR-VA-02, FR-VA-07)
bot.on('message:photo', async (ctx) => {
  const lang = botSessionService.getLanguage(ctx.from?.id || 0);
  const t = lang === 'am' ? amTranslations : enTranslations;

  try {
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];

    // Download photo buffer from Telegram
    const file = await ctx.api.getFile(largestPhoto.file_id);
    if (!file.file_path) {
      await ctx.reply(t.bot.decodeFailed);
      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Decode QR code from image buffer
    const decoded = decodeQRFromBuffer(buffer);
    if (!decoded || !decoded.data) {
      // FR-VA-07: Guide user to retake photo or type code
      await ctx.reply(t.bot.decodeFailed);
      return;
    }

    // Call shared verifyPack logic
    const res = await verifyPack(decoded.data, { checkRegistry: true });

    // FR-VA-08: Log scan event with channel = 'telegram' and NO user identity
    botSessionService.logScanEvent({
      status: res.status,
      batchId: res.batchId,
      batchNumber: res.batchNumber,
      channel: 'telegram',
    });

    const replyText = formatTelegramVerificationReply(res, lang);
    await ctx.reply(replyText, {
      parse_mode: 'Markdown',
      reply_markup: buildVerificationButtons(res.batchId, lang),
    });
  } catch (err: any) {
    await ctx.reply(t.bot.decodeFailed);
  }
});

// Handle text messages (Pasted QR code or typed SMS syntax)
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return; // Ignore unhandled commands

  const lang = botSessionService.getLanguage(ctx.from?.id || 0);
  const t = lang === 'am' ? amTranslations : enTranslations;

  try {
    // Call shared library verifyPack (FR-VA-09)
    const res = await verifyPack(text, { checkRegistry: true });

    // FR-VA-08: Log scan event (no personal info)
    botSessionService.logScanEvent({
      status: res.status,
      batchId: res.batchId,
      batchNumber: res.batchNumber,
      channel: 'telegram',
    });

    const replyText = formatTelegramVerificationReply(res, lang);
    await ctx.reply(replyText, {
      parse_mode: 'Markdown',
      reply_markup: buildVerificationButtons(res.batchId, lang),
    });
  } catch (err: any) {
    await ctx.reply(
      lang === 'am'
        ? `⚠️ የቀረበውን ኮድ ማረጋገጥ አልተቻለም። እባክዎ ኮዱን በትክክል ያስገቡ (ለምሳሌ፦ MT:1:ET-AMOX-001:SEC4491)።`
        : `⚠️ Unable to parse medicine code. Please check formatting (e.g., MT:1:ET-AMOX-001:SEC4491 or https://meditrust.et/v?b=1&s=SN123).`
    );
  }
});

// Webhook callback export for Express / Next.js API routes
export const telegramWebhookHandler = webhookCallback(bot, 'express');
