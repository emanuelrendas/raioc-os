/**
 * RAIOC OS - JARVIS Live Voice Realtime Conversation Gateway (RAIOC-VOICE-SPEC-2026-LIVE)
 * 
 * Implements low-latency neural voice conversation endpoint:
 * - POST /api/v1/voice/conversation (alias: /api/voice/conversation)
 * - Synthesizes 1-2 sentence concise executive responses via Gemini Flash / Cognitive Router (< 200ms)
 * - Generates high-fidelity MP3 neural audio via ElevenLabs Turbo (eleven_turbo_v2_5)
 */

import { voiceAi } from '../../core/voice-ai.js';
import { authMiddleware } from '../../security/auth-middleware.js';
import { logger } from '../../logging/audit-logger.js';

/**
 * Handles live voice conversation requests
 * @param {string} url - Request URL path
 * @param {string} [method='POST'] - HTTP method
 * @param {Object} [body={}] - JSON body { message, history, locale, voiceId }
 * @param {Object} [query={}] - Query parameters
 * @param {Object} [headers={}] - Request headers
 * @returns {Promise<Object>} Formatted HTTP response object
 */
export async function handleVoiceConversationRequest(url, method = 'POST', body = {}, query = {}, headers = {}) {
  const startTime = Date.now();
  const correlationId = headers['x-correlation-id'] || body.correlationId || body.correlation_id || `corr_voice_conv_${Date.now()}`;

  // 1. Client Telemetry Ingestion (/api/v1/voice/telemetry)
  if (url.includes('/voice/telemetry')) {
    if (method !== 'POST') {
      return {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: `Method ${method} not allowed on voice telemetry endpoint` },
      };
    }
    const eventType = body.event || body.type || 'UNKNOWN_VOICE_EVENT';
    logger.info('SENTINEL_VOICE_WATCHDOG', `Client voice telemetry received: [${eventType}]`, {
      event: eventType,
      details: body.details || {},
      latencyMs: body.latencyMs || 0,
      timestamp: body.timestamp || new Date().toISOString(),
      correlationId,
    });
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true, recorded: true, event: eventType },
    };
  }

  // 2. Token-to-Chunk SSE Voice Streaming (/api/v1/voice/stream)
  if (url.includes('/voice/stream')) {
    if (method !== 'POST') {
      return {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: `Method ${method} not allowed on voice stream endpoint` },
      };
    }

    const auth = authMiddleware.authenticateRequest(headers);
    if (!auth.authenticated) {
      logger.warn('VOICE_STREAM', 'Rejected unauthorized voice stream request', { correlationId });
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { 
          success: false, 
          error: 'UNAUTHORIZED: Valid session or authorization token required.',
          code: 'AUTH_REQUIRED',
          diagnostic: auth.error || 'Missing or invalid session credentials.'
        },
      };
    }

    const message = (body.message || body.prompt || query.message || query.prompt || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const locale = body.locale || query.locale || 'pt';
    const voiceId = body.voiceId || query.voiceId;

    try {
      const streamResult = await voiceAi.streamLiveConversation({
        message,
        history,
        locale,
        voiceId,
        correlationId,
      });

      logger.info('VOICE_STREAM', `Streamed live voice response in ${streamResult.durationMs}ms (${streamResult.totalChunks} chunks): "${streamResult.fullText.substring(0, 40)}..."`, {
        correlationId,
        chunks: streamResult.totalChunks,
      });

      return {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
        body: streamResult.sseEvents,
      };
    } catch (err) {
      logger.error('VOICE_STREAM', `Failed to stream voice conversation: ${err.message}`, { correlationId });
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: false,
          error: err.message,
        },
      };
    }
  }

  if (method !== 'POST') {
    return {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
      body: { success: false, error: `Method ${method} not allowed on voice conversation endpoint` },
    };
  }

  // Authenticate request: support bearer/secret, session cookies, and local Mission Control origins
  const auth = authMiddleware.authenticateRequest(headers);

  if (!auth.authenticated) {
    logger.warn('VOICE_CONVERSATION', 'Rejected unauthorized voice conversation request', { correlationId });
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { 
        success: false, 
        error: 'UNAUTHORIZED: Valid session or authorization token required.',
        code: 'AUTH_REQUIRED',
        diagnostic: auth.error || 'Missing or invalid session credentials.'
      },
    };
  }

  const message = (body.message || body.prompt || query.message || query.prompt || '').trim();
  const history = Array.isArray(body.history) ? body.history : [];
  const locale = body.locale || query.locale || 'pt';
  const voiceId = body.voiceId || query.voiceId;

  try {
    const result = await voiceAi.synthesizeLiveConversation({
      message,
      history,
      locale,
      voiceId,
      correlationId,
    });

    const elapsedMs = Date.now() - startTime;

    logger.info('VOICE_CONVERSATION', `Synthesized live voice response in ${elapsedMs}ms: "${result.text.substring(0, 40)}..."`, {
      correlationId,
      elapsedMs,
      model: result.model,
    });

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        text: result.text,
        audioBase64: result.audioBase64,
        fallbackRequired: Boolean(result.fallbackRequired),
        mode: result.mode || 'SIMULATED_SANDBOX',
        mimeType: result.mimeType || 'audio/mpeg',
        latencyMs: elapsedMs,
        provider: result.provider || 'elevenlabs',
        model: result.model || 'eleven_turbo_v2_5',
        voiceId: result.voiceId,
        audioSha256: result.audioSha256,
        durationSeconds: result.durationSeconds,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err) {
    logger.error('VOICE_CONVERSATION', `Failed to synthesize live voice conversation: ${err.message}`, { correlationId });
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: false,
        error: err.message,
        text: 'JARVIS operacional. A frota de 12 agentes e os modelos fiduciários estão ativos.',
        latencyMs: Date.now() - startTime,
      },
    };
  }
}
