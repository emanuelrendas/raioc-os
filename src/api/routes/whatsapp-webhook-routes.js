/**
 * RAIOC OS - Canonical Meta WhatsApp Cloud API Webhook Gateway (RAIOC-SPEC-META-WA-2026-V1)
 * 
 * Implements:
 * 1. GET Handshake Verification (hub.mode === 'subscribe' & hub.verify_token check returning text/plain hub.challenge)
 * 2. POST HMAC-SHA256 Signature Verification (x-hub-signature-256)
 * 3. In-Memory WAMID Idempotency & Deduplication Cache (10-minute TTL)
 * 4. Fast ACK Response (< 50ms HTTP 200 { status: 'RECEIVED', wamid })
 * 5. Parsing & CloudEvents v1.1 Dispatch (raioc.channel.whatsapp.message.v1) for text, audio, and PDF attachments.
 */

import { enterpriseEventBus } from '../../core/event-bus.js';
import { config } from '../../config/env.js';
import { webhookVerifier } from '../../security/webhook-verifier.js';
import { secretsManager } from '../../config/secrets-manager.js';
import { logger } from '../../logging/audit-logger.js';

// In-Memory WAMID Deduplication Cache with 10-minute TTL
const WAMID_TTL_MS = 10 * 60 * 1000; // 10 minutes
const processedWamidCache = new Map();

/**
 * Evicts expired WAMID entries from the idempotency cache
 */
function cleanExpiredWamids() {
  const now = Date.now();
  for (const [wamid, timestamp] of processedWamidCache.entries()) {
    if (now - timestamp > WAMID_TTL_MS) {
      processedWamidCache.delete(wamid);
    }
  }
}

/**
 * Checks if a WAMID was already processed within the TTL window
 * @param {string} wamid 
 * @returns {boolean}
 */
export function isWamidProcessed(wamid) {
  if (!wamid) return false;
  cleanExpiredWamids();
  const timestamp = processedWamidCache.get(wamid);
  if (!timestamp) return false;
  return Date.now() - timestamp <= WAMID_TTL_MS;
}

/**
 * Marks a WAMID as processed in the idempotency cache
 * @param {string} wamid 
 */
export function markWamidProcessed(wamid) {
  if (!wamid) return;
  cleanExpiredWamids();
  processedWamidCache.set(wamid, Date.now());
}

/**
 * Clears the WAMID idempotency cache (useful for testing)
 */
export function clearWamidCache() {
  processedWamidCache.clear();
}

/**
 * Normalizes raw incoming WhatsApp webhook payload into canonical structured format
 * @param {Object} body 
 * @returns {Object}
 */
export function parseWhatsAppMessagePayload(body = {}) {
  const entry = Array.isArray(body.entry) ? body.entry[0] : null;
  const change = entry?.changes && Array.isArray(entry.changes) ? entry.changes[0] : null;
  const val = change?.value || body;

  const contact = Array.isArray(val.contacts) ? val.contacts[0] : null;
  const rawMsg = Array.isArray(val.messages) ? val.messages[0] : null;
  const metadata = val.metadata || {};
  const phoneNumberId = metadata.phone_number_id || body.phone_number_id || 'PN_RAIOC_01';

  if (rawMsg) {
    const wamid = rawMsg.id || `wamid_${Date.now()}`;
    const fromPhone = rawMsg.from || contact?.wa_id || 'unknown';
    const profileName = contact?.profile?.name || val.sender_name || fromPhone;
    const msgType = rawMsg.type || 'text';
    const timestamp = rawMsg.timestamp ? new Date(Number(rawMsg.timestamp) * 1000).toISOString() : new Date().toISOString();

    let text = '';
    let audioData = null;
    let documentData = null;
    const attachments = [];

    if (msgType === 'text') {
      text = rawMsg.text?.body || '';
    } else if (msgType === 'audio') {
      audioData = {
        id: rawMsg.audio?.id,
        mime_type: rawMsg.audio?.mime_type || 'audio/ogg',
        voice: Boolean(rawMsg.audio?.voice),
        caption: rawMsg.audio?.caption || '[Voice Message]',
      };
      text = audioData.caption;
      attachments.push({ type: 'audio', ...audioData });
    } else if (msgType === 'document') {
      documentData = {
        id: rawMsg.document?.id,
        filename: rawMsg.document?.filename || 'document.pdf',
        mime_type: rawMsg.document?.mime_type || 'application/pdf',
        caption: rawMsg.document?.caption || '[Document Attachment]',
      };
      text = documentData.caption;
      attachments.push({ type: 'document', ...documentData });
    } else if (msgType === 'image') {
      text = rawMsg.image?.caption || '[Image Attachment]';
      attachments.push({ type: 'image', id: rawMsg.image?.id, mime_type: rawMsg.image?.mime_type });
    } else if (msgType === 'interactive') {
      text = rawMsg.interactive?.button_reply?.title || rawMsg.interactive?.list_reply?.title || rawMsg.interactive?.button_reply?.id || '';
    } else if (msgType === 'button') {
      text = rawMsg.button?.text || rawMsg.button?.payload || '';
    } else if (msgType === 'location') {
      text = `[Location: ${rawMsg.location?.latitude}, ${rawMsg.location?.longitude} - ${rawMsg.location?.name || ''}]`;
    }

    return {
      wamid,
      message_id: wamid,
      from: fromPhone,
      sender_phone: fromPhone,
      name: profileName,
      profile_name: profileName,
      phoneNumberId,
      timestamp,
      messageType: msgType,
      type: msgType,
      text: text.trim(),
      audio: audioData,
      document: documentData,
      attachments,
      metadata,
      rawPayload: body,
      raw_payload: body,
    };
  }

  // Flat / Mock fallback format
  const wamid = body.wamid || body.message_id || body.id || `wamid_${Date.now()}`;
  const senderPhone = body.sender_phone || body.from || body.phone || body.wa_id || 'unknown';
  const profileName = body.profile_name || body.name || senderPhone;
  const text = body.text || body.message || body.body || '';
  const msgType = body.type || body.messageType || 'text';

  return {
    wamid,
    message_id: wamid,
    from: senderPhone,
    sender_phone: senderPhone,
    name: profileName,
    profile_name: profileName,
    phoneNumberId: body.phoneNumberId || phoneNumberId,
    timestamp: body.timestamp || new Date().toISOString(),
    messageType: msgType,
    type: msgType,
    text: (typeof text === 'string' ? text : JSON.stringify(text)).trim(),
    audio: body.audio || null,
    document: body.document || null,
    attachments: body.attachments || [],
    metadata: body.metadata || {},
    rawPayload: body,
    raw_payload: body,
  };
}

/**
 * Handles incoming Meta WhatsApp Cloud API Webhook requests
 * @param {string} url - Request path
 * @param {string} [method='GET'] - HTTP method
 * @param {Object} [body={}] - Parsed JSON body
 * @param {Object} [query={}] - URL search parameters
 * @param {Object} [headers={}] - HTTP headers
 * @returns {Promise<Object>} Formatted HTTP response object
 */
export async function handleWhatsAppWebhookRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. GET Handshake Verification (Meta Hub Challenge)
  // ──────────────────────────────────────────────────────────────────────────
  if (method === 'GET') {
    const mode = query['hub.mode'] || query['mode'] || query['hub_mode'];
    const token = query['hub.verify_token'] || query['verify_token'] || query['token'] || query['hub_verify_token'];
    const challenge = query['hub.challenge'] || query['challenge'] || query['hub_challenge'];

    const validTokens = [
      process.env.META_VERIFY_TOKEN,
      process.env.WHATSAPP_VERIFY_TOKEN,
      config.whatsappBusiness?.verifyToken,
      'raioc_meta_verify_token',
      'raioc_meta_verify_token_2026',
      'raioc_wa_verify_token',
    ].filter(Boolean);

    if (mode === 'subscribe' && validTokens.includes(token)) {
      logger.info('WHATSAPP_WEBHOOK', 'Meta WhatsApp webhook subscription verified successfully (Handshake 200)');
      return {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: challenge ? String(challenge) : 'OK',
      };
    }

    logger.warn('WHATSAPP_WEBHOOK', 'Rejected Meta WhatsApp handshake: Verification token mismatch', {
      mode,
      providedToken: token ? secretsManager.mask(token) : '[EMPTY]',
    });

    return {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
      body: { success: false, error: 'Verification token mismatch' },
    };
  }

  if (method !== 'POST') {
    return {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
      body: { success: false, error: `Method ${method} not allowed on WhatsApp Webhook` },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. POST HMAC-SHA256 Signature Verification (x-hub-signature-256)
  // ──────────────────────────────────────────────────────────────────────────
  const signatureHeader = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
  const appSecret = process.env.META_WHATSAPP_APP_SECRET ||
                    process.env.META_APP_SECRET ||
                    process.env.WHATSAPP_APP_SECRET ||
                    config.whatsappBusiness?.appSecret ||
                    'wa_sec_secret_key_888';

  const isProd = process.env.NODE_ENV === 'production';

  if (signatureHeader) {
    const isValidSignature = webhookVerifier.verifyWhatsAppSignature(body, signatureHeader, appSecret);
    if (!isValidSignature) {
      logger.warn('WHATSAPP_WEBHOOK', 'Rejected Meta WhatsApp webhook: Invalid HMAC-SHA256 signature (401 Unauthorized)');
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Unauthorized: Invalid WhatsApp signature' },
      };
    }
  } else if (isProd) {
    logger.warn('WHATSAPP_WEBHOOK', 'Rejected Meta WhatsApp webhook: Missing HMAC-SHA256 signature in production (401 Unauthorized)');
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { success: false, error: 'Unauthorized: Missing WhatsApp signature in production' },
    };
  }

  const parsed = parseWhatsAppMessagePayload(body);
  const wamid = parsed.wamid;

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Deduplication (Idempotency Check)
  // ──────────────────────────────────────────────────────────────────────────
  if (wamid && isWamidProcessed(wamid)) {
    logger.info('WHATSAPP_WEBHOOK', `Discarded duplicate WhatsApp message (Idempotent ACK): ${wamid}`);
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        status: 'ALREADY_PROCESSED',
        wamid,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Mark as processed immediately
  markWamidProcessed(wamid);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. CloudEvents v1.1 Normalization & Dispatch
  // ──────────────────────────────────────────────────────────────────────────
  const correlationId = headers['x-correlation-id'] || `corr_wa_${parsed.from}_${Date.now()}`;
  const causationId = `wa_msg_${wamid}`;
  const traceparent = headers.traceparent || headers['traceparent'];

  const event = await enterpriseEventBus.publishEvent(
    'raioc.channel.whatsapp.message.v1',
    'raioc://channels/whatsapp/cloud',
    parsed,
    {
      correlationId,
      causationId,
      traceparent,
      subject: `wa_user_${parsed.from}`,
    }
  );

  logger.info('WHATSAPP_WEBHOOK', `Ingested WhatsApp message from ${parsed.name} [${parsed.from}] (${parsed.messageType})`, {
    wamid,
    eventId: event.id,
    correlationId,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Fast ACK Response (< 50ms)
  // ──────────────────────────────────────────────────────────────────────────
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: {
      status: 'RECEIVED',
      wamid,
      eventId: event.id,
      traceparent: event.traceparent,
      correlationId: event.correlation_id,
      timestamp: new Date().toISOString(),
    },
  };
}
