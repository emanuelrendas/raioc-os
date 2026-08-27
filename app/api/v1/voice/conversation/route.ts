import { NextResponse } from 'next/server';
import { voiceAi } from '@/src/core/voice-ai.js';
import { authMiddleware } from '@/src/security/auth-middleware.js';
import { logger } from '@/src/logging/audit-logger.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/voice/conversation
 * JARVIS Live Voice Realtime Conversation API:
 * Synthesizes ultra-concise responses via Gemini Flash / Cognitive Router (<200ms)
 * and generates high-fidelity neural MP3 audio via ElevenLabs Turbo.
 */
export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const rawHeaders: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      rawHeaders[k.toLowerCase()] = v;
    });

    const auth = authMiddleware.authenticateRequest(rawHeaders);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED: Valid API Secret or Bearer token required.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const message = (body.message || body.prompt || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const locale = body.locale || 'pt';
    const voiceId = body.voiceId;
    const correlationId = rawHeaders['x-correlation-id'] || body.correlation_id || `corr_voice_conv_${Date.now()}`;

    const result = await voiceAi.synthesizeLiveConversation({
      message,
      history,
      locale,
      voiceId,
      correlationId,
    });

    const elapsedMs = Date.now() - startTime;

    logger.info('VOICE_CONVERSATION_APP_ROUTER', `Synthesized live voice response in ${elapsedMs}ms: "${result.text.substring(0, 40)}..."`);

    return NextResponse.json({
      success: true,
      text: result.text,
      audioBase64: result.audioBase64,
      mimeType: result.mimeType || 'audio/mpeg',
      latencyMs: elapsedMs,
      provider: result.provider || 'elevenlabs',
      model: result.model || 'eleven_turbo_v2_5',
      voiceId: result.voiceId,
      audioSha256: result.audioSha256,
      durationSeconds: result.durationSeconds,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('VOICE_CONVERSATION_APP_ROUTER', `Voice synthesis error: ${err.message}`);
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        text: 'JARVIS operacional. A frota de 12 agentes e os modelos fiduciários estão ativos.',
        latencyMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
