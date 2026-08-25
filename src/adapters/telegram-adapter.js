/**
 * RAIOC OS - Telegram VIP Notification Bridge Adapter (GEM-003)
 * Formats and dispatches high-priority VIP intelligence alerts and system notifications
 * directly to Telegram Bot API using structured HTML templates and non-blocking execution.
 */

import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';
import { supabase } from '../db/supabase-client.js';

export const NOTIF_TEMPLATES = {
  NOTIF_QUALIFIED_LEAD: 'NOTIF_QUALIFIED_LEAD',
  NOTIF_SYSTEM_ALERT: 'NOTIF_SYSTEM_ALERT',
  NOTIF_EXECUTIVE_BRIEF: 'NOTIF_EXECUTIVE_BRIEF',
};

/**
 * Escapes HTML entities to ensure valid Telegram HTML format
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class TelegramAdapter {
  constructor(options = {}) {
    this.botToken = options.botToken || process.env.TELEGRAM_BOT_TOKEN || config.telegram?.botToken || '';
    this.chatId = options.chatId || process.env.TELEGRAM_CHAT_ID || config.telegram?.chatId || '';
    this.timeoutMs = options.timeoutMs || config.telegram?.timeoutMs || 5000;
    this.enabled = options.enabled !== undefined 
      ? options.enabled 
      : (process.env.TELEGRAM_ENABLED !== 'false' && config.telegram?.enabled !== false);
  }

  /**
   * Reloads credentials dynamically from environment
   */
  getCredentials() {
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN || this.botToken || config.telegram?.botToken || '',
      chatId: process.env.TELEGRAM_CHAT_ID || this.chatId || config.telegram?.chatId || '',
    };
  }

  /**
   * Formats HTML message using GEM-003 VIP templates
   * @param {string} templateId - Template identifier
   * @param {Object} data - Template variables
   * @returns {string} Formatted HTML string
   */
  formatTemplate(templateId, data = {}) {
    const correlationId = escapeHtml(data.correlationId || data.metadata?.correlationId || `corr_tg_${Date.now()}`);

    switch (templateId) {
      case NOTIF_TEMPLATES.NOTIF_QUALIFIED_LEAD:
      case 'QUALIFIED_LEAD': {
        const lead = data.lead || data.leadData || data;
        const intelligence = data.intelligence || {};
        const brief = data.brief || {};
        const riis = intelligence.riis || brief.riis || {};
        const dira = intelligence.dira || brief.dira || {};

        const name = escapeHtml(lead.name || lead.contactName || lead.full_name || 'Executive Lead');
        const company = escapeHtml(lead.company || lead.companyName || lead.company_name || 'Enterprise Candidate');
        const email = escapeHtml(lead.email || lead.contactEmail || 'N/A');
        const phone = escapeHtml(lead.phone || lead.contactPhone || lead.whatsapp || 'N/A');
        const budget = escapeHtml(lead.budgetAed ? `AED ${Number(lead.budgetAed).toLocaleString()}` : (lead.budget || lead.budget_aed || 'AED 15,000,000+'));
        const riisScore = riis.score !== undefined ? riis.score : (brief.riisScore || intelligence.score || 85);
        const tierLabel = escapeHtml(riis.tierLabel || brief.diraTier || 'Institutional Tier');
        const riskLevel = escapeHtml(dira.riskLevel || brief.diraRiskLevel || 'MODERATE');
        const strategy = escapeHtml(intelligence.recommendedTrack || brief.strategyCode || lead.timeline || 'Immediate Deployment');

        return `🚀 <b>VIP NOTIFICATION: QUALIFIED LEAD</b>\n\n` +
          `👤 <b>Name:</b> ${name}\n` +
          `🏢 <b>Company:</b> ${company}\n` +
          `📧 <b>Email:</b> ${email}\n` +
          `📱 <b>Phone:</b> ${phone}\n` +
          `💰 <b>Budget:</b> ${budget}\n` +
          `📊 <b>RIIS Score:</b> <code>${riisScore}/100</code> (${tierLabel})\n` +
          `🛡️ <b>DIRA Risk:</b> <code>${riskLevel}</code>\n` +
          `⚡ <b>Recommended Track:</b> ${strategy}\n` +
          `🆔 <b>Correlation ID:</b> <code>${correlationId}</code>`;
      }

      case NOTIF_TEMPLATES.NOTIF_SYSTEM_ALERT:
      case 'SYSTEM_ALERT': {
        const severity = escapeHtml(data.severity || 'WARNING');
        const component = escapeHtml(data.component || 'RAIOC_CORE');
        const message = escapeHtml(data.message || data.error || 'System event triggered');
        const timestamp = escapeHtml(data.timestamp || new Date().toISOString());

        const icon = severity === 'CRITICAL' ? '🔥' : severity === 'WARNING' ? '⚠️' : 'ℹ️';

        return `${icon} <b>SYSTEM OPERATIONAL ALERT: ${severity}</b>\n\n` +
          `⚙️ <b>Component:</b> ${component}\n` +
          `📝 <b>Message:</b> ${message}\n` +
          `🕒 <b>Timestamp:</b> <code>${timestamp}</code>\n` +
          `🆔 <b>Correlation ID:</b> <code>${correlationId}</code>`;
      }

      case NOTIF_TEMPLATES.NOTIF_EXECUTIVE_BRIEF:
      case 'EXECUTIVE_BRIEF': {
        const company = escapeHtml(data.companyName || data.company || 'Enterprise Client');
        const score = data.riisScore || 85;
        const risk = escapeHtml(data.riskLevel || 'LOW');
        const summary = escapeHtml(data.executiveSummary || 'Executive brief ready for dispatch.');

        return `📋 <b>EXECUTIVE BRIEF GENERATED</b>\n\n` +
          `🏢 <b>Client:</b> ${company}\n` +
          `📊 <b>RIIS:</b> <code>${score}/100</code> | <b>Risk:</b> <code>${risk}</code>\n\n` +
          `<i>${summary}</i>\n\n` +
          `🆔 <b>Correlation ID:</b> <code>${correlationId}</code>`;
      }

      default: {
        const rawText = data.text || data.message || JSON.stringify(data, null, 2);
        return `📢 <b>NOTIFICATION [${escapeHtml(templateId)}]</b>\n\n` +
          `${escapeHtml(rawText)}\n\n` +
          `🆔 <b>Correlation ID:</b> <code>${correlationId}</code>`;
      }
    }
  }

  /**
   * Posts alert directly to Telegram Bot API with parse_mode: 'HTML' and non-blocking error handling
   * @param {string} templateId - Template key from GEM-003
   * @param {Object} data - Template variables
   * @param {Object} options - Override options
   * @returns {Promise<Object>} Execution result (never throws)
   */
  async sendAlert(templateId, data = {}, options = {}) {
    const { botToken, chatId } = this.getCredentials();
    const targetChatId = options.chatId || chatId;
    const correlationId = options.correlationId || data.correlationId || `corr_tg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timeoutMs = options.timeoutMs || this.timeoutMs || 5000;

    const htmlMessage = this.formatTemplate(templateId, { ...data, correlationId });

    if (!this.enabled) {
      logger.info('TELEGRAM_ADAPTER', `Telegram disabled - simulating alert [${templateId}]`, { correlationId });
      return {
        success: true,
        status: 'simulated',
        templateId,
        correlationId,
        message: htmlMessage,
      };
    }

    if (!botToken || !targetChatId) {
      const reason = 'missing_env_variable';
      logger.warn('TELEGRAM_ADAPTER', `Telegram alert skipped: ${reason} (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured)`, {
        correlationId,
      });

      await supabase.recordAuditLog({
        category: 'TELEGRAM_ADAPTER',
        action: 'TELEGRAM_ALERT_SKIPPED',
        entityId: correlationId,
        message: `Telegram alert skipped due to missing environment variables for [${templateId}]`,
        correlationId,
        metadata: { templateId, reason },
      });

      return {
        success: true,
        status: 'DISCONNECTED',
        reason,
        templateId,
        correlationId,
        message: htmlMessage,
      };
    }

    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: targetChatId,
      text: htmlMessage,
      parse_mode: 'HTML',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      logger.info('TELEGRAM_ADAPTER', `Posting VIP alert [${templateId}] to Telegram chat ${targetChatId}...`, { correlationId });

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await res.json();

      if (!res.ok || !responseBody.ok) {
        throw new Error(`Telegram API responded with error: ${responseBody.description || res.statusText || res.status}`);
      }

      const telegramMessageId = responseBody.result?.message_id || `tg_msg_${Date.now()}`;

      logger.info('TELEGRAM_ADAPTER', `Telegram VIP alert [${templateId}] dispatched successfully (Msg ID: ${telegramMessageId})`, {
        correlationId,
        telegramMessageId,
      });

      await supabase.recordCommunication({
        type: 'telegram',
        recipient: targetChatId,
        message: htmlMessage,
        correlationId,
        status: 'SENT',
        messageId: telegramMessageId,
        metadata: { templateId, telegramMessageId },
      });

      await supabase.recordAuditLog({
        category: 'TELEGRAM_ADAPTER',
        action: 'TELEGRAM_ALERT_SENT',
        entityId: String(telegramMessageId),
        message: `VIP alert [${templateId}] sent to Telegram chat ${targetChatId}`,
        correlationId,
        metadata: { templateId, telegramMessageId },
      });

      return {
        success: true,
        status: 'SENT',
        httpStatus: 200,
        telegramMessageId,
        chatId: targetChatId,
        templateId,
        correlationId,
        message: htmlMessage,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
      const errorMessage = isTimeout 
        ? `Telegram API request timed out after ${timeoutMs}ms` 
        : err.message;

      // Non-blocking error handling: Log failure to audit log without failing parent process
      logger.error('TELEGRAM_ADAPTER', `Failed to send Telegram alert [${templateId}]: ${errorMessage}`, {
        correlationId,
        error: errorMessage,
        isTimeout,
      });

      await supabase.recordAuditLog({
        category: 'TELEGRAM_ADAPTER',
        action: 'TELEGRAM_ALERT_FAILED',
        entityId: correlationId,
        message: `Failed to send Telegram alert [${templateId}]: ${errorMessage}`,
        correlationId,
        metadata: { templateId, error: errorMessage, isTimeout },
      });

      return {
        success: false,
        status: 'FAILED',
        templateId,
        correlationId,
        error: errorMessage,
        isTimeout,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export const telegramAdapter = new TelegramAdapter();

/**
 * Top-level helper function for sending Telegram alerts
 * @param {string} templateId - Template identifier from GEM-003 (e.g. 'NOTIF_QUALIFIED_LEAD')
 * @param {Object} data - Alert payload
 * @param {Object} options - Optional overrides
 * @returns {Promise<Object>} Execution result (never throws)
 */
export async function sendTelegramAlert(templateId, data = {}, options = {}) {
  return await telegramAdapter.sendAlert(templateId, data, options);
}
