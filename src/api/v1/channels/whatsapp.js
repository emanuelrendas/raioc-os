/**
 * RAIOC OS - WhatsApp Cloud API Ingestion Gateway (Phase 8 / v1.1)
 * Pure input surface: Authenticates Meta webhooks, parses incoming WhatsApp messages,
 * normalizes them, and publishes CloudEvent v1.1 events to Enterprise Event Bus v1.1.
 * 
 * Endpoints:
 * - GET /api/v1/channels/whatsapp/webhook (Meta verification challenge)
 * - POST /api/v1/channels/whatsapp/webhook (Meta message updates)
 * - Compatibility aliases: /api/channels/whatsapp/webhook, /api/webhooks/whatsapp
 */

import { enterpriseEventBus } from '../../../core/event-bus.js';
import { config } from '../../../config/env.js';
import { webhookVerifier } from '../../../security/webhook-verifier.js';
import { logger } from '../../../logging/audit-logger.js';

/**
 * Normalizes WhatsApp raw webhook payload into a canonical data structure
 * @param {Object} body 
 * @returns {Object}
 */
export function normalizeWhatsAppPayload(body = {}) {
  // 1. Check if Meta nested payload format (entry -> changes -> value -> messages)
  const entry = Array.isArray(body.entry) ? body.entry[0] : null;
  const change = entry?.changes && Array.isArray(entry.changes) ? entry.changes[0] : null;
  const val = change?.value || body;

  const contact = Array.isArray(val.contacts) ? val.contacts[0] : null;
  const rawMsg = Array.isArray(val.messages) ? val.messages[0] : null;

  if (rawMsg) {
    const fromPhone = rawMsg.from || contact?.wa_id || 'unknown';
    const profileName = contact?.profile?.name || val.sender_name || fromPhone;
    const msgType = rawMsg.type || 'text';
    let text = '';
    let attachments = [];

    if (msgType === 'text') {
      text = rawMsg.text?.body || '';
    } else if (msgType === 'interactive') {
      text = rawMsg.interactive?.button_reply?.title || rawMsg.interactive?.list_reply?.title || rawMsg.interactive?.button_reply?.id || '';
    } else if (msgType === 'button') {
      text = rawMsg.button?.text || rawMsg.button?.payload || '';
    } else if (msgType === 'audio') {
      text = rawMsg.audio?.caption || '[Voice Message]';
      attachments.push({ type: 'audio', id: rawMsg.audio?.id, mime_type: rawMsg.audio?.mime_type });
    } else if (msgType === 'image') {
      text = rawMsg.image?.caption || '[Image Attachment]';
      attachments.push({ type: 'image', id: rawMsg.image?.id, mime_type: rawMsg.image?.mime_type });
    } else if (msgType === 'document') {
      text = rawMsg.document?.caption || rawMsg.document?.filename || '[Document Attachment]';
      attachments.push({ type: 'document', id: rawMsg.document?.id, filename: rawMsg.document?.filename, mime_type: rawMsg.document?.mime_type });
    } else if (msgType === 'location') {
      text = `[Location: ${rawMsg.location?.latitude}, ${rawMsg.location?.longitude} - ${rawMsg.location?.name || ''}]`;
    }

    return {
      message_id: rawMsg.id || `wa_${Date.now()}`,
      sender_phone: fromPhone,
      profile_name: profileName,
      timestamp: rawMsg.timestamp ? new Date(Number(rawMsg.timestamp) * 1000).toISOString() : new Date().toISOString(),
      type: msgType,
      text: text.trim(),
      attachments,
      metadata: val.metadata || {},
      raw_payload: body,
    };
  }

  // 2. Flat / Direct test mock format
  const senderPhone = body.sender_phone || body.from || body.sender || body.phone || body.wa_id || 'unknown';
  const profileName = body.profile_name || body.name || body.sender_name || senderPhone;
  const text = body.text || body.message || body.body || '';

  return {
    message_id: body.message_id || body.id || `wa_${Date.now()}`,
    sender_phone: senderPhone,
    profile_name: profileName,
    timestamp: body.timestamp || new Date().toISOString(),
    type: body.type || 'text',
    text: (typeof text === 'string' ? text : JSON.stringify(text)).trim(),
    attachments: body.attachments || [],
    metadata: body.metadata || {},
    raw_payload: body,
  };
}

export async function handleWhatsAppWebhookRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  // 1. Meta Verification Challenge (GET)
  if (method === 'GET') {
    const mode = query['hub.mode'] || query['mode'];
    const token = query['hub.verify_token'] || query['verify_token'] || query['token'];
    const challenge = query['hub.challenge'] || query['challenge'];

    const verifyToken = config.whatsappBusiness?.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'raioc_wa_verify_token';

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('WHATSAPP_INGEST', 'Meta WhatsApp webhook subscription verified successfully');
      return {
        status: 200,
        body: challenge,
        headers: { 'Content-Type': 'text/plain' },
      };
    }

    logger.warn('WHATSAPP_INGEST', 'Rejected invalid WhatsApp webhook verification challenge', {
      mode,
      providedToken: token ? '***' : '[EMPTY]',
    });
    return {
      status: 403,
      body: { success: false, error: 'Verification token mismatch' },
    };
  }

  if (method !== 'POST') {
    return {
      status: 405,
      body: { success: false, error: `Method ${method} not allowed on WhatsApp Webhook` },
    };
  }

  // 2. Meta Signature Verification (POST)
  const signatureHeader = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
  const appSecret = config.whatsappBusiness?.appSecret || process.env.WHATSAPP_APP_SECRET;

  if (signatureHeader && appSecret) {
    const isValidSignature = webhookVerifier.verifyWhatsAppSignature(body, signatureHeader, appSecret);
    if (!isValidSignature) {
      logger.warn('WHATSAPP_INGEST', 'Rejected WhatsApp webhook: Invalid HMAC signature');
      return {
        status: 401,
        body: { success: false, error: 'Unauthorized: Invalid WhatsApp signature' },
      };
    }
  }

  const startTime = Date.now();
  const normalized = normalizeWhatsAppPayload(body);
  const senderPhone = normalized.sender_phone;

  // 3. W3C Trace & Correlation Identifiers
  const correlationId = headers['x-correlation-id'] || `corr_wa_${senderPhone}_${Date.now()}`;
  const causationId = normalized.message_id ? `wa_msg_${normalized.message_id}` : `wa_upd_${Date.now()}`;
  const traceparent = headers.traceparent || headers['traceparent'];

  // 4. Publish CloudEvent v1.1 to Event Bus
  const event = await enterpriseEventBus.publishEvent(
    'raioc.channel.whatsapp.message.v1',
    'raioc://channels/whatsapp/cloud',
    normalized,
    {
      correlationId,
      causationId,
      traceparent,
      subject: `wa_user_${senderPhone}`,
    }
  );

  const processingDuration = Date.now() - startTime;
  logger.info('WHATSAPP_INGEST', `Ingested WhatsApp message from ${normalized.profile_name} [${senderPhone}] in ${processingDuration}ms`, {
    eventId: event.id,
    correlationId,
    textPreview: (normalized.text || '').substring(0, 60),
  });

  // 5. Return immediate 200 OK
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
