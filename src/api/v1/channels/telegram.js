/**
 * RAIOC OS - Telegram Webhook Ingestion Gateway (Phase 7 / v1.1)
 * Pure input surface: Authenticates, parses, normalizes, and publishes
 * Telegram update events directly into the Enterprise Event Bus v1.1.
 * 
 * Endpoints:
 * - POST /api/v1/channels/telegram/webhook
 * - POST /api/channels/telegram/webhook (Legacy compatibility alias)
 */

import { enterpriseEventBus } from '../../../core/event-bus.js';
import { config } from '../../../config/env.js';
import { logger } from '../../../logging/audit-logger.js';

/**
 * Validates incoming Telegram webhook secret token
 * @param {Object} headers 
 * @returns {boolean}
 */
function validateTelegramSecret(headers = {}) {
  const secretToken = headers['x-telegram-bot-api-secret-token'] || headers['X-Telegram-Bot-Api-Secret-Token'];
  const internalSecret = headers['x-raioc-secret'] || headers['X-RAIOC-Secret'] || headers['x-internal-secret'];
  const authHeader = headers['authorization'] || headers['Authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const validTelegramSecret = config.telegram?.secretToken || process.env.TELEGRAM_SECRET_TOKEN || 'raioc_telegram_secret_2026';
  const validRaiocSecret = process.env.RAIOC_INTERNAL_SECRET || 'raioc_sovereign_auth_2026_x99';

  // 1. Direct Telegram Secret Token match
  if (secretToken && (secretToken === validTelegramSecret || secretToken === validRaiocSecret)) {
    return true;
  }

  // 2. Dev / Staging Internal Secret match
  if (internalSecret && (internalSecret === validRaiocSecret || internalSecret === validTelegramSecret)) {
    return true;
  }

  // 3. Bearer Token match
  if (bearerToken && (bearerToken === validRaiocSecret || bearerToken === validTelegramSecret)) {
    return true;
  }

  return false;
}

/**
 * Normalizes Telegram raw update payload into a clean data structure
 * @param {Object} update 
 * @returns {Object}
 */
function normalizeTelegramUpdate(update = {}) {
  const message = update.message || update.edited_message || update.channel_post || update.callback_query?.message || {};
  const from = message.from || update.callback_query?.from || {};
  const chat = message.chat || {};

  const text = message.text || message.caption || update.callback_query?.data || '';
  const attachments = [];

  if (message.photo) {
    attachments.push({ type: 'photo', file_ids: message.photo.map((p) => p.file_id) });
  }
  if (message.document) {
    attachments.push({ type: 'document', file_id: message.document.file_id, file_name: message.document.file_name, mime_type: message.document.mime_type });
  }
  if (message.voice) {
    attachments.push({ type: 'voice', file_id: message.voice.file_id, duration: message.voice.duration });
  }
  if (message.video) {
    attachments.push({ type: 'video', file_id: message.video.file_id, duration: message.video.duration });
  }

  return {
    update_id: update.update_id || null,
    message_id: message.message_id || null,
    date: message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
    from: {
      id: from.id || null,
      is_bot: Boolean(from.is_bot),
      first_name: from.first_name || '',
      last_name: from.last_name || '',
      username: from.username || null,
      language_code: from.language_code || 'en',
    },
    chat: {
      id: chat.id || null,
      type: chat.type || 'private', // 'private', 'group', 'supergroup', 'channel'
      title: chat.title || null,
      username: chat.username || null,
    },
    text,
    caption: message.caption || null,
    attachments,
    raw_update: update,
  };
}

export async function handleTelegramWebhookRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  if (method !== 'POST') {
    return {
      status: 405,
      body: { success: false, error: `Method ${method} not allowed on Telegram Webhook` },
    };
  }

  // 1. Strict Authentication
  if (!validateTelegramSecret(headers)) {
    logger.warn('TELEGRAM_INGEST', 'Rejected unauthenticated Telegram webhook request', {
      ip: headers['x-forwarded-for'] || 'unknown',
    });
    return {
      status: 401,
      body: { success: false, error: 'Unauthorized: Invalid or missing Telegram secret token' },
    };
  }

  const startTime = Date.now();
  const normalized = normalizeTelegramUpdate(body);

  const chatId = normalized.chat.id || 'anonymous';
  const correlationId = headers['x-correlation-id'] || `corr_tg_${chatId}_${Date.now()}`;
  const causationId = normalized.message_id ? `tg_msg_${normalized.message_id}` : `tg_upd_${normalized.update_id || Date.now()}`;
  const traceparent = headers.traceparent || headers['traceparent'];

  // 2. Publish CloudEvent v1.1 to Event Bus
  const event = await enterpriseEventBus.publishEvent(
    'raioc.channel.telegram.message.v1',
    'raioc://channels/telegram/bot',
    normalized,
    {
      correlationId,
      causationId,
      traceparent,
      subject: `tg_chat_${chatId}`,
    }
  );

  const processingDuration = Date.now() - startTime;
  logger.info('TELEGRAM_INGEST', `Ingested Telegram message from chat ${chatId} [@${normalized.from.username || 'unknown'}] in ${processingDuration}ms`, {
    eventId: event.id,
    correlationId,
    textPreview: (normalized.text || '').substring(0, 60),
  });

  // 3. Return immediate 200 OK
  return {
    status: 200,
    body: {
      status: 'RECEIVED',
      eventId: event.id,
      traceparent: event.traceparent,
      correlationId: event.correlation_id,
      timestamp: new Date().toISOString(),
    },
  };
}
