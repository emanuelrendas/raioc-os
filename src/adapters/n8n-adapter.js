/**
 * RAIOC OS - n8n Egress Webhook Dispatcher Adapter
 * Dispatches automated signed event webhooks to n8n workflows with HMAC-SHA256 authentication,
 * a bounded synchronous WF-01 timeout, and non-blocking audit error logging.
 */

import { createHmac } from 'node:crypto';
import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';
import { supabase } from '../db/supabase-client.js';

/**
 * WF-01's canary path only verifies the signed event context and responds, so
 * it is bounded to two seconds of n8n execution overhead. The same synchronous
 * webhook can also run the active-only MARK request, which is capped in WF-01
 * at 15 seconds. The caller budget is therefore 15s MARK + 2s workflow
 * overhead + 3s transport margin = 20s. This stays well below the 120-second
 * execution lease without changing execution-authority semantics.
 */
export const N8N_WF01_CANARY_MAX_PATH_MS = 2_000;
export const N8N_WF01_MARK_REQUEST_TIMEOUT_MS = 15_000;
export const N8N_WF01_SYNCHRONOUS_OVERHEAD_MS = 2_000;
export const N8N_WF01_TRANSPORT_MARGIN_MS = 3_000;
export const N8N_WF01_CALLER_TIMEOUT_MS =
  N8N_WF01_MARK_REQUEST_TIMEOUT_MS +
  N8N_WF01_SYNCHRONOUS_OVERHEAD_MS +
  N8N_WF01_TRANSPORT_MARGIN_MS;

const RUNTIME_MODES = new Set(['off', 'canary', 'active']);

/**
 * Escapes raw HTML entities to prevent Telegram parse errors
 * @param {string|null|undefined} text 
 * @returns {string}
 */
export function escapeTelegramHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sanitizes an HTML string so that only Telegram-supported tags remain intact,
 * and any unescaped rogue characters (<, >, &) that would break Telegram HTML parsing are escaped.
 * @param {string|null|undefined} htmlText 
 * @returns {string}
 */
export function sanitizeTelegramHtml(htmlText) {
  if (htmlText === null || htmlText === undefined) return '';
  const str = String(htmlText);

  // Supported Telegram HTML tags:
  // <b>, </b>, <strong>, </strong>, <i>, </i>, <em>, </em>, <u>, </u>, <ins>, </ins>,
  // <s>, </s>, <strike>, </strike>, <del>, </del>, <span>, </span>, <tg-spoiler>, </tg-spoiler>,
  // <a href="...">, </a>, <code>, </code>, <pre>, </pre>, <blockquote>, </blockquote>
  const validTagRegex = /<\/?(?:b|strong|i|em|u|ins|s|strike|del|span|tg-spoiler|code|pre|blockquote)\b[^>]*>|<a\s+(?:href="[^"]*"|href='[^']*')[^>]*>|<\/a>/gi;
  
  const tokens = [];
  const tokenized = str.replace(validTagRegex, (match) => {
    const placeholder = `__TG_TAG_${tokens.length}__`;
    tokens.push(match);
    return placeholder;
  });

  // Escape raw ampersands not part of valid character entities
  let sanitized = tokenized.replace(/&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
  // Escape raw < and >
  sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Restore valid tags
  tokens.forEach((tag, idx) => {
    sanitized = sanitized.replace(`__TG_TAG_${idx}__`, tag);
  });

  return sanitized;
}

/**
 * Extracts and sanitizes Telegram-ready fields from payload data
 * @param {string} event 
 * @param {Object} payload 
 * @param {string} correlationId 
 * @returns {Object} Standardized Telegram payload fields
 */
export function extractTelegramFields(event, payload = {}, correlationId = '') {
  const lead = payload.lead || payload.leadData || payload.data || payload;
  const intelligence = payload.intelligence || {};
  const brief = payload.brief || {};
  const riis = intelligence.riis || brief.riis || {};
  const dira = intelligence.dira || brief.dira || {};

  // 1. Full name
  const rawFullName = lead.name || lead.contactName || lead.full_name || payload.full_name || payload.name || 'Private Client';
  const fullName = escapeTelegramHtml(rawFullName);

  // 2. Budget formatted
  let rawBudget = lead.budgetAed ?? payload.budgetAed ?? lead.budget_aed ?? payload.budget_aed;
  let budgetFormatted = '';
  if (rawBudget !== undefined && rawBudget !== null && !isNaN(Number(rawBudget)) && Number(rawBudget) > 0) {
    budgetFormatted = `AED ${Number(rawBudget).toLocaleString()}`;
  } else {
    const fallbackBudget = lead.budget_formatted || payload.budget_formatted || lead.budget || payload.budget || 'AED 15,000,000+';
    budgetFormatted = escapeTelegramHtml(fallbackBudget);
  }

  // 3. Message text
  let messageText = '';
  const providedText = payload.text || payload.message || lead.message || lead.notes;
  if (providedText) {
    messageText = sanitizeTelegramHtml(providedText);
  } else if (event === 'QUALIFIED_LEAD' || event === 'LEAD_INGESTED') {
    const company = escapeTelegramHtml(lead.company || lead.companyName || lead.company_name || 'Enterprise Candidate');
    const email = escapeTelegramHtml(lead.email || lead.contactEmail || 'N/A');
    const phone = escapeTelegramHtml(lead.phone || lead.contactPhone || lead.whatsapp || 'N/A');
    const riisScore = riis.score !== undefined ? riis.score : (brief.riisScore || intelligence.score || 85);
    const tierLabel = escapeTelegramHtml(riis.tierLabel || brief.diraTier || 'Institutional Tier');
    const riskLevel = escapeTelegramHtml(dira.riskLevel || brief.diraRiskLevel || 'MODERATE');
    const strategy = escapeTelegramHtml(intelligence.recommendedTrack || brief.strategyCode || lead.timeline || 'Immediate Deployment');

    messageText = `🚀 <b>VIP NOTIFICATION: ${escapeTelegramHtml(event)}</b>\n\n` +
      `👤 <b>Name:</b> ${fullName}\n` +
      `🏢 <b>Company:</b> ${company}\n` +
      `📧 <b>Email:</b> ${email}\n` +
      `📱 <b>Phone:</b> ${phone}\n` +
      `💰 <b>Budget:</b> ${budgetFormatted}\n` +
      `📊 <b>RIIS Score:</b> <code>${riisScore}/100</code> (${tierLabel})\n` +
      `🛡️ <b>DIRA Risk:</b> <code>${riskLevel}</code>\n` +
      `⚡ <b>Recommended Track:</b> ${strategy}\n` +
      `🆔 <b>Correlation ID:</b> <code>${escapeTelegramHtml(correlationId)}</code>`;
  } else {
    messageText = `📢 <b>RAIOC EVENT: ${escapeTelegramHtml(event)}</b>\n\n` +
      `👤 <b>Lead:</b> ${fullName}\n` +
      `💰 <b>Budget:</b> ${budgetFormatted}\n` +
      `🆔 <b>Correlation ID:</b> <code>${escapeTelegramHtml(correlationId)}</code>`;
  }

  return {
    text: messageText,
    message: messageText,
    full_name: fullName,
    budget_formatted: budgetFormatted,
    parse_mode: 'HTML',
  };
}

export class N8nAdapter {
  constructor(options = {}) {
    this.webhookUrl = options.webhookUrl || process.env.N8N_OUTBOUND_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || config.n8n?.webhookUrl || '';
    this.webhookSecret = options.webhookSecret || process.env.N8N_OUTBOUND_SECRET || process.env.N8N_WEBHOOK_SECRET || config.n8n?.webhookSecret || 'raioc_n8n_hmac_secret';
    this.timeoutMs = options.timeoutMs ?? N8N_WF01_CALLER_TIMEOUT_MS;
    this.auditClient = options.auditClient || supabase;
    this.enabled = options.enabled !== undefined 
      ? options.enabled 
      : (process.env.N8N_ENABLED !== 'false' && config.n8n?.enabled !== false);
  }

  /**
   * Signs a payload using HMAC-SHA256
   * @param {Object|string} payload - Payload to sign
   * @param {string} secret - Secret key
   * @returns {string} Hex HMAC digest
   */
  signPayload(payload, secret = this.webhookSecret) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHmac('sha256', secret || 'raioc_n8n_hmac_secret').update(raw).digest('hex');
  }

  /**
   * Dispatches an event to n8n outbound webhook with non-blocking error handling
   * @param {string} event - Event name (e.g. 'QUALIFIED_LEAD', 'LEAD_INGESTED')
   * @param {Object} payload - Event data payload
   * @param {Object} options - Override options (webhookUrl, secret, timeoutMs)
   * @returns {Promise<Object>} Dispatch outcome (never throws)
   */
  async dispatchEvent(event, payload = {}, options = {}) {
    const targetUrl = options.webhookUrl || process.env.N8N_OUTBOUND_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || this.webhookUrl;
    const secret = options.webhookSecret || process.env.N8N_OUTBOUND_SECRET || process.env.N8N_WEBHOOK_SECRET || this.webhookSecret;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const timestamp = new Date().toISOString();
    const correlationId = options.correlationId || payload.correlationId || `corr_n8n_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const tgFields = extractTelegramFields(event, payload, correlationId);

    // The runtime mode is carried in the signed event body. An unknown value is
    // represented as null, never upgraded by the adapter, so WF-01 can refuse
    // it before any external fan-out.
    const runtimeMode = payload?.runtime?.mode;
    const runtime = RUNTIME_MODES.has(runtimeMode) ? { mode: runtimeMode } : { mode: null };

    const eventPayload = {
      event,
      timestamp,
      correlationId,
      source: 'raioc-os',
      runtime,
      text: tgFields.text,
      message: tgFields.message,
      full_name: tgFields.full_name,
      budget_formatted: tgFields.budget_formatted,
      parse_mode: tgFields.parse_mode,
      data: payload,
    };

    const signature = this.signPayload(eventPayload, secret);

    // If disabled
    if (!this.enabled) {
      logger.info('N8N_ADAPTER', `n8n webhook disabled - simulating event [${event}] dispatch`, { correlationId });
      return {
        success: true,
        status: 'simulated',
        event,
        correlationId,
        signature: `sha256=${signature}`,
        timestamp,
      };
    }

    // If no webhook URL configured
    if (!targetUrl) {
      logger.info('N8N_ADAPTER', `n8n outbound webhook URL not configured - event [${event}] compiled with HMAC-SHA256 signature`, {
        correlationId,
        signaturePreview: signature.substring(0, 10) + '...',
      });
      return {
        success: true,
        status: 'compiled_for_n8n',
        event,
        correlationId,
        signature: `sha256=${signature}`,
        payload: eventPayload,
        timestamp,
      };
    }

    // Execute the synchronous WF-01 request within the derived 20-second
    // caller budget and preserve the provider-response distinction below.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Set once response headers arrive. It is the difference between "n8n
    // answered and refused" (no delivery) and "we never heard back" (delivery
    // unknown) — the execution-effect ledger classifies those differently.
    let providerResponded = false;

    try {
      logger.info('N8N_ADAPTER', `Dispatching event [${event}] to n8n webhook: ${targetUrl}`, { correlationId });

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-Signature': `sha256=${signature}`,
          'X-Event-Type': event,
          'X-Timestamp': timestamp,
          'X-Correlation-ID': correlationId,
        },
        body: JSON.stringify(eventPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      providerResponded = true;

      if (!res.ok) {
        throw new Error(`n8n webhook returned status ${res.status}: ${res.statusText}`);
      }

      let responseData = {};
      try {
        responseData = await res.json();
      } catch {
        responseData = { status: 'OK' };
      }

      logger.info('N8N_ADAPTER', `Successfully dispatched event [${event}] to n8n`, { correlationId, status: res.status });
      logger.audit('N8N_ADAPTER', 'N8N_EVENT_DISPATCHED', correlationId, 'PENDING', 'SENT', {
        event,
        status: res.status,
      });

      await this.auditClient.recordAuditLog({
        category: 'N8N_ADAPTER',
        action: 'N8N_EVENT_DISPATCHED',
        entityId: correlationId,
        message: `n8n outbound webhook dispatched for event [${event}]`,
        correlationId,
        metadata: { event, status: res.status, response: responseData },
      });

      return {
        success: true,
        status: 'SENT',
        httpStatus: res.status,
        providerResponded: true,
        event,
        correlationId,
        signature: `sha256=${signature}`,
        response: responseData,
        timestamp,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
      const errorMessage = isTimeout 
        ? `n8n outbound webhook timed out after ${timeoutMs}ms` 
        : err.message;

      // Non-blocking error handling: Log failure to audit log without failing parent process
      logger.error('N8N_ADAPTER', `Failed to dispatch n8n event [${event}]: ${errorMessage}`, {
        correlationId,
        error: errorMessage,
        isTimeout,
      });

      logger.audit('N8N_ADAPTER', 'N8N_EVENT_FAILED', correlationId, 'PENDING', 'FAILED', {
        event,
        error: errorMessage,
      });

      await this.auditClient.recordAuditLog({
        category: 'N8N_ADAPTER',
        action: 'N8N_EVENT_FAILED',
        entityId: correlationId,
        message: `Failed to dispatch n8n event [${event}]: ${errorMessage}`,
        correlationId,
        metadata: { event, error: errorMessage, isTimeout },
      });

      return {
        success: false,
        status: 'FAILED',
        event,
        correlationId,
        error: errorMessage,
        isTimeout,
        providerResponded,
        timestamp,
      };
    }
  }
}

export const n8nAdapter = new N8nAdapter();

/**
 * Top-level helper function for dispatching n8n events
 * @param {string} event - Event name (e.g. 'QUALIFIED_LEAD')
 * @param {Object} payload - Event payload
 * @param {Object} options - Optional overrides
 * @returns {Promise<Object>} Dispatch result
 */
export async function dispatchN8nEvent(event, payload = {}, options = {}) {
  return await n8nAdapter.dispatchEvent(event, payload, options);
}
