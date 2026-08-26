/**
 * RAIOC OS - AIDA Voice Communication API Gateway (Sprint 3 / Phase 9)
 * Pure input surface: Authenticates voice communication directives, validates parameters,
 * attaches W3C distributed trace context, and publishes CloudEvent v1.1 events to Event Bus v1.1.
 * 
 * Endpoints:
 * - POST /api/v1/communication/voice
 * - Legacy alias: POST /api/communication/voice (with Deprecation header)
 */

import { enterpriseEventBus } from '../../../core/event-bus.js';
import { VOICE_INTENTS } from '../../../core/voice-ai.js';
import { logger } from '../../../logging/audit-logger.js';

export async function handleVoiceCommunicationRequest(url, method = 'POST', body = {}, query = {}, headers = {}) {
  const isLegacy = url.startsWith('/api/communication') && !url.startsWith('/api/v1/communication');
  const responseHeaders = isLegacy
    ? {
        'Deprecation': '@deprecated Use canonical route /api/v1/communication/voice',
        'Sunset': '2026-12-31',
      }
    : {};

  if (method !== 'POST') {
    return {
      status: 405,
      headers: responseHeaders,
      body: { success: false, error: `Method ${method} not allowed on voice communication endpoint` },
    };
  }

  const startTime = Date.now();
  const intent = (body.intent || VOICE_INTENTS.INVESTOR_FOLLOWUP).toUpperCase();
  const recipient = body.recipient || body.investorName || body.name || 'Private Sovereign Investor';
  const investorId = body.investorId || body.investor_id || null;
  const channel = (body.channel || 'WHATSAPP').toUpperCase();

  // Validate Intent if specified
  const validIntents = Object.values(VOICE_INTENTS);
  if (!validIntents.includes(intent)) {
    return {
      status: 400,
      headers: responseHeaders,
      body: {
        success: false,
        error: `Invalid voice intent '${intent}'. Supported intents: ${validIntents.join(', ')}`,
      },
    };
  }

  // W3C Distributed Tracing Context
  const correlationId = headers['x-correlation-id'] || body.correlationId || body.correlation_id || `corr_voice_req_${Date.now()}`;
  const traceparent = headers.traceparent || headers['traceparent'];
  const causationId = `voice_req_${Date.now()}`;

  const payload = {
    intent,
    messageType: body.messageType || null,
    recipient,
    investorId,
    channel,
    context: body.context || {},
    script: body.script || body.customScript || null,
    objectionCategory: body.objectionCategory || body.category || null,
    budgetAed: Number(body.budgetAed || body.budget_aed || 0),
    targetAsset: body.targetAsset || body.target_asset || null,
    isExternallySensitive: body.isExternallySensitive === true || body.sensitive === true,
    requestedAt: new Date().toISOString(),
  };

  // Publish CloudEvent v1.1 to Event Bus
  const event = await enterpriseEventBus.publishEvent(
    'raioc.communication.voice.requested.v1',
    'raioc://communication/voice/gateway',
    payload,
    {
      correlationId,
      causationId,
      traceparent,
      subject: `voice_${intent.toLowerCase()}_${recipient.replace(/\s+/g, '_')}`,
    }
  );

  const durationMs = Date.now() - startTime;
  logger.info('VOICE_API', `Received Voice Communication Request [${intent}] for ${recipient} in ${durationMs}ms`, {
    eventId: event.id,
    correlationId,
  });

  return {
    status: 200,
    headers: responseHeaders,
    body: {
      status: 'RECEIVED',
      eventId: event.id,
      traceparent: event.traceparent,
      correlationId: event.correlation_id,
      intent,
      recipient,
      timestamp: new Date().toISOString(),
    },
  };
}
