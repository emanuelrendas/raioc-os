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

  if (method !== 'POST') {
    return {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
      body: { success: false, error: `Method ${method} not allowed on voice conversation endpoint` },
    };
  }

  // Authenticate request: support bearer/secret, session cookies, and local Mission Control origins
  let auth = authMiddleware.authenticateRequest(headers);
  if (!auth.authenticated) {
    const cookieHeader = headers['cookie'] || headers['Cookie'] || '';
    const referer = headers['referer'] || headers['Referer'] || '';
    const origin = headers['origin'] || headers['Origin'] || '';
    const secFetchSite = headers['sec-fetch-site'] || headers['Sec-Fetch-Site'] || '';

    const hasSessionCookie = cookieHeader.includes('raioc_session') || cookieHeader.includes('session=') || cookieHeader.includes('raioc_sovereign_auth');
    const isSameOriginOrLocal = (secFetchSite === 'same-origin' || referer.includes('/admin/mission-control') || referer.includes('mission-control') || origin.includes('localhost') || origin.includes('127.0.0.1')) && !headers['x-external-untrusted'];

    if (hasSessionCookie || isSameOriginOrLocal) {
      auth = { authenticated: true, role: 'ADMIN' };
    }
  }

  if (!auth.authenticated) {
    logger.warn('VOICE_CONVERSATION', 'Rejected unauthorized voice conversation request', { correlationId });
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: { success: false, error: 'UNAUTHORIZED: Valid API Secret or Bearer token required.' },
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
