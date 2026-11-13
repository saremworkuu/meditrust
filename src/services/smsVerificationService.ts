/**
 * @license SPDX-License-Identifier: Apache-2.0
 * SMS Verification Format Specification & Simulated Gateway
 * Implements: FR-VA-10, Section 3.3
 *
 * Rules:
 * - Documented SMS format spec: VERIFY <batch>.<serial>.<code>
 * - Must be clearly labeled "simulated" in the interface and demo (Hard Rule 6).
 * - Under 160 characters per GSM single segment SMS.
 * - Always includes text and emoji (FR-VA-03).
 */

import { verifyPack, VerificationResult } from '../../packages/verify/src/index.ts';

export interface SmsVerificationResponse {
  reply: string;
  charCount: number;
  under160Chars: boolean;
  status: string;
  isSimulated: true;
  label: '[SIMULATED SMS - EFDA 8899]';
  fromPhoneNumber?: string;
  processedAt: string;
}

export const SMS_SPEC_DOCS = {
  format: 'VERIFY <batch>.<serial>.<code>',
  shortCode: '8899',
  example: 'VERIFY 1.SN-ET-00123.SEC889',
  descriptionEn:
    'For 2G feature phones without smartphones, patients send an SMS to Ethiopian short-code 8899 with the scratch-off code syntax: VERIFY <batch>.<serial>.<code>',
  descriptionAm:
    'ስማርት ስልክ ለሌላቸው ታካሚዎች በአጭር የጽሑፍ መልዕክት (SMS) ወደ 8899 በመላክ መድኃኒት የሚያረጋግጡበት አሰራር፡ VERIFY <ባች>.<መለያ>.<የጭረት-ኮድ>',
  errorHelpEn:
    '[SIMULATED SMS] Invalid syntax. Format must be: VERIFY <batch>.<serial>.<code>. Example: VERIFY 1.SN-ET-00123.SEC889',
  errorHelpAm:
    '[SIMULATED SMS] የተሳሳተ አጻጻፍ። እባክዎ በዚህ መልኩ ይላኩ፡ VERIFY <ባች>.<መለያ>.<የጭረት-ኮድ>። ምሳሌ፡ VERIFY 1.SN-ET-00123.SEC889',
};

export class SmsVerificationService {
  /**
   * Parses and processes incoming SMS in the format: VERIFY <batch>.<serial>.<code>
   */
  public async handleSms(
    messageText: string,
    fromPhoneNumber?: string,
    lang: 'en' | 'am' = 'en'
  ): Promise<SmsVerificationResponse> {
    const raw = messageText.trim();

    // Regex matching: VERIFY <batch>.<serial>.<code> or VERIFY <batch>:<serial>:<code
    const match = raw.match(/^VERIFY\s+(\d+)[\.:]([A-Za-z0-9_-]+)[\.:]([A-Za-z0-9_-]+)/i);

    if (!match) {
      const errReply = lang === 'am' ? SMS_SPEC_DOCS.errorHelpAm : SMS_SPEC_DOCS.errorHelpEn;
      return {
        reply: errReply,
        charCount: errReply.length,
        under160Chars: errReply.length <= 160,
        status: 'invalid_syntax',
        isSimulated: true,
        label: '[SIMULATED SMS - EFDA 8899]',
        fromPhoneNumber,
        processedAt: new Date().toISOString(),
      };
    }

    const [, batchStr, serial, securityCode] = match;
    const batchId = parseInt(batchStr, 10);

    // Call the shared verify library using standard delimiter
    const payload = `MT:${batchId}:${serial}:${securityCode}`;
    const result: VerificationResult = await verifyPack(payload, { checkRegistry: true });

    // Format single-segment SMS response under 160 chars
    let reply = '';
    if (lang === 'am') {
      switch (result.status) {
        case 'genuine':
          reply = `[SIMULATED SMS] 🟢 ትክክለኛ! ${result.productName} ባች #${result.batchNumber} ደህንነቱ የተጠበቀ ነው። ኤፍዳ 8899`;
          break;
        case 'sold':
          reply = `[SIMULATED SMS] 🔵 ቀድሞ የተሸጠ! ባች #${result.batchNumber}። ድጋሚ የተሰጠ ሊሆን ስለሚችል ፋርማሲስትዎን ያማክሩ።`;
          break;
        case 'recalled':
          reply = `[SIMULATED SMS] 🔴 የታገደ መድኃኒት! ባች #${result.batchNumber}። አይውሰዱ! ወደ ጤና ተቋም ይመልሱ።`;
          break;
        case 'expired':
          reply = `[SIMULATED SMS] 🟠 ጊዜው ያለፈበት! ባች #${result.batchNumber} አልፏል። አይውሰዱ።`;
          break;
        case 'clone_suspected':
          reply = `[SIMULATED SMS] 🛑 የተባዛ ኮድ! ባች #${result.batchNumber}። አጠራጣሪ ኮድ ስለሆነ አይጠቀሙበት።`;
          break;
        default:
          reply = `[SIMULATED SMS] ⚠️ ያልታወቀ ኮድ! በኤፍዳ መዝገብ ውስጥ አልተገኘም። አይጠቀሙበት።`;
          break;
      }
    } else {
      switch (result.status) {
        case 'genuine':
          reply = `[SIMULATED SMS] 🟢 GENUINE! ${result.productName} Batch #${result.batchNumber}. Safe to use. EFDA 8899`;
          break;
        case 'sold':
          reply = `[SIMULATED SMS] 🔵 ALREADY SOLD! Batch #${result.batchNumber}. Possible duplicate, contact pharmacist.`;
          break;
        case 'recalled':
          reply = `[SIMULATED SMS] 🔴 RECALLED! Batch #${result.batchNumber}. Do not take, return to clinic.`;
          break;
        case 'expired':
          reply = `[SIMULATED SMS] 🟠 EXPIRED! Batch #${result.batchNumber}. Past expiry, do not consume.`;
          break;
        case 'clone_suspected':
          reply = `[SIMULATED SMS] 🛑 SUSPECTED CLONE! Batch #${result.batchNumber}. Duplicate code, do not take.`;
          break;
        default:
          reply = `[SIMULATED SMS] ⚠️ UNKNOWN CODE! Not found in EFDA registry. Do not use.`;
          break;
      }
    }

    return {
      reply,
      charCount: reply.length,
      under160Chars: reply.length <= 160,
      status: result.status,
      isSimulated: true,
      label: '[SIMULATED SMS - EFDA 8899]',
      fromPhoneNumber,
      processedAt: new Date().toISOString(),
    };
  }
}

export const smsVerificationService = new SmsVerificationService();
