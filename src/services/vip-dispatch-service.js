/**
 * RAIOC OS - VIP Dispatch Service (Post-HITL Executive Dispatch)
 * Formats VIP notification dispatches in English and Portuguese with GST, BST, EST timezone windows
 * and calculates cryptographic SHA-256 payload digests.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const VIP_TEMPLATES_PATH = join(__dirname, '../config/vip-dispatch-templates.json');

function loadVipConfig() {
  try {
    const raw = readFileSync(VIP_TEMPLATES_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { templates: {}, timezones: {} };
  }
}

export const VIP_DISPATCH_CONFIG = loadVipConfig();

/**
 * Computes deterministic SHA-256 hash of a text string
 * @param {string} text 
 * @returns {string} 64-character lowercase hex string
 */
export function computeVipMessageSha256(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

/**
 * Formats the canonical VIP Post-Approval Dispatch message
 * 
 * @param {Object} params
 * @param {string} params.mandateId
 * @param {string} params.investorName
 * @param {string} [params.corridorName='Palm Jebel Ali Sovereign Corridor']
 * @param {string} [params.corridorKey='PALM_JEBEL_ALI']
 * @param {number} params.allocationAed
 * @param {string} [params.ownershipVehicle='DIFC SPV']
 * @param {string} params.briefId
 * @param {string} params.documentSha256
 * @param {string} [params.locale='en'] - 'en' (primary) or 'pt' (secondary)
 * @returns {Object} Formatted message text, subject, timezones, and SHA-256 digest
 */
export function formatVipPostApprovalDispatch(params = {}) {
  const config = Object.keys(VIP_DISPATCH_CONFIG.templates || {}).length > 0
    ? VIP_DISPATCH_CONFIG
    : loadVipConfig();

  const locale = (params.locale || 'en').toLowerCase() === 'pt' ? 'pt' : 'en';
  const template = config.templates?.VIP_POST_APPROVAL_DISPATCH?.locales?.[locale]
    || config.templates?.VIP_POST_APPROVAL_DISPATCH?.locales?.en;

  const allocationAed = Number(params.allocationAed) || 25000000;
  const allocationUsd = Math.round(allocationAed / 3.6725);
  const mandateId = params.mandateId || 'MND-CONFIDENTIAL';
  const investorName = params.investorName || (locale === 'pt' ? 'Investidor Soberano' : 'Sovereign Investor');
  const corridorName = params.corridorName || (locale === 'pt' ? 'Corredor Soberano Palm Jebel Ali' : 'Palm Jebel Ali Sovereign Corridor');
  const corridorKey = params.corridorKey || 'PALM_JEBEL_ALI';
  const ownershipVehicle = params.ownershipVehicle || 'SPV_DIFC_ADGM';
  const briefId = params.briefId || `PIB-${Date.now()}`;
  const documentSha256 = params.documentSha256 || '0000000000000000000000000000000000000000000000000000000000000000';

  const replacePlaceholders = (text) => {
    return text
      .replace(/\{\{mandateId\}\}/g, mandateId)
      .replace(/\{\{investorName\}\}/g, investorName)
      .replace(/\{\{corridorName\}\}/g, corridorName)
      .replace(/\{\{corridorKey\}\}/g, corridorKey)
      .replace(/\{\{allocationAed\}\}/g, allocationAed.toLocaleString('en-US'))
      .replace(/\{\{allocationUsd\}\}/g, allocationUsd.toLocaleString('en-US'))
      .replace(/\{\{ownershipVehicle\}\}/g, ownershipVehicle)
      .replace(/\{\{briefId\}\}/g, briefId)
      .replace(/\{\{documentSha256\}\}/g, documentSha256);
  };

  const subject = replacePlaceholders(template.subject);
  const header = template.header;
  const greeting = replacePlaceholders(template.greeting);
  const approvalNotice = template.approval_notice;
  const mandateDetails = template.mandate_details.map(replacePlaceholders).join('\n');
  const statutoryShield = template.statutory_shield;
  const briefingWindows = template.briefing_windows;
  const closing = template.closing;
  const signature = template.signature;

  const fullMessageText = [
    header,
    '',
    greeting,
    '',
    approvalNotice,
    '',
    mandateDetails,
    '',
    statutoryShield,
    '',
    briefingWindows,
    '',
    closing,
    '',
    signature,
  ].join('\n');

  const messageSha256 = computeVipMessageSha256(fullMessageText);

  return {
    success: true,
    locale,
    subject,
    messageText: fullMessageText,
    messageSha256,
    briefId,
    documentSha256,
    mandateId,
    timezones: config.timezones,
  };
}
