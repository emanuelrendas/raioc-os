import { describe, it } from 'node:test';
import assert from 'node:assert';
import { cognitiveRouter, JARVIS_OMNISCIENT_SYSTEM_PROMPT, JARVIS_LIVE_STREAMING_VOICE_PROMPT, cleanSpokenText } from '../../src/core/cognitive-router.js';
import { voiceAi } from '../../src/core/voice-ai.js';
import { handleVoiceConversationRequest } from '../../src/api/routes/voice-routes.js';
import { routeApiRequest } from '../../src/api/server.js';

describe('🎙️ JARVIS Live Voice Engine & Ultra-Low Latency Conversation Suite (RAIOC-VOICE-SPEC-2026-LIVE)', () => {
  const authHeaders = {
    'content-type': 'application/json',
    'authorization': 'Bearer raioc_sovereign_auth_2026_x99',
    'x-raioc-secret': 'raioc_sovereign_auth_2026_x99',
  };

  const PROHIBITED_CHARS_REGEX = /[*_~`#\[\]\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}]/gu;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Spoken Text Sanitization & System Prompt Tests
  // ──────────────────────────────────────────────────────────────────────────
  it('1. Clean Spoken Text: Strips asterisks, emojis, markdown headers, and brackets', () => {
    const dirty = '## **JARVIS** Live Voice: 🌊 Palm Jebel Ali [110km] is *100%* protected! 🏝️';
    const cleaned = cleanSpokenText(dirty);
    assert.strictEqual(cleaned.includes('*'), false, 'Should strip asterisks');
    assert.strictEqual(cleaned.includes('#'), false, 'Should strip hashes');
    assert.strictEqual(cleaned.includes('['), false, 'Should strip brackets');
    assert.strictEqual(cleaned.includes('🌊'), false, 'Should strip emojis');
    assert.strictEqual(cleaned.includes('🏝️'), false, 'Should strip emojis');
    assert.strictEqual(cleaned, 'JARVIS Live Voice: Palm Jebel Ali 110km is 100% protected!');
  });

  it('2. Prompt Validation: JARVIS_OMNISCIENT_SYSTEM_PROMPT is omniscient, open and enforces clean voice mode', () => {
    assert.ok(JARVIS_OMNISCIENT_SYSTEM_PROMPT, 'Omniscient system prompt should exist');
    assert.ok(JARVIS_OMNISCIENT_SYSTEM_PROMPT.includes('Copiloto Omnisciente'), 'Should include omniscient copilot identity');
    assert.ok(JARVIS_OMNISCIENT_SYSTEM_PROMPT.includes('Quiet Luxury'), 'Should enforce Quiet Luxury posture');
    assert.ok(JARVIS_OMNISCIENT_SYSTEM_PROMPT.includes('12 agentes'), 'Should reference the 12-agent fleet');
    assert.ok(JARVIS_OMNISCIENT_SYSTEM_PROMPT.includes('Dubai Law No. 8/2007'), 'Should include Escrow Law 8');
    assert.ok(JARVIS_OMNISCIENT_SYSTEM_PROMPT.includes('UAE Civil Code Art. 880'), 'Should include Decennial Guarantee Art 880');
    assert.ok(JARVIS_LIVE_STREAMING_VOICE_PROMPT, 'Live streaming voice prompt alias should exist');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Cognitive Router Live Voice Generation (1-2 sentences, max_tokens: 50)
  // ──────────────────────────────────────────────────────────────────────────
  it('3. Cognitive Router: Generates ultra-concise Palm Jebel Ali voice synthesis (<200ms)', async () => {
    const start = Date.now();
    const res = await cognitiveRouter.dispatch('Explica a tese de Palm Jebel Ali', {
      conversationMode: 'voice_live',
      systemInstruction: JARVIS_LIVE_STREAMING_VOICE_PROMPT,
      maxOutputTokens: 50,
      max_tokens: 50,
    });
    const elapsed = Date.now() - start;

    assert.ok(res.text, 'Should return text response');
    assert.strictEqual(PROHIBITED_CHARS_REGEX.test(res.text), false, 'Must not contain prohibited characters');
    assert.ok(res.text.toLowerCase().includes('palm jebel ali'), 'Should mention Palm Jebel Ali');
    assert.ok(res.text.length < 250, 'Must be strictly concise (1-2 sentences)');
    assert.ok(elapsed < 200, 'Generation should execute in under 200ms in fallback/cached mode');
  });

  it('4. Cognitive Router: Generates ultra-concise Dubai South DWC voice synthesis', async () => {
    const res = await cognitiveRouter.dispatch('Qual é o potencial de Dubai South DWC e aeroporto Al Maktoum?', {
      conversationMode: 'voice_live',
      systemInstruction: JARVIS_LIVE_STREAMING_VOICE_PROMPT,
      maxOutputTokens: 50,
      max_tokens: 50,
    });

    assert.ok(res.text, 'Should return text');
    assert.strictEqual(PROHIBITED_CHARS_REGEX.test(res.text), false, 'Must not contain prohibited characters');
    assert.ok(res.text.toLowerCase().includes('dubai south') || res.text.toLowerCase().includes('al maktoum'), 'Should mention Dubai South or Al Maktoum');
    assert.ok(res.text.length < 250, 'Must be strictly concise');
  });

  it('5. Cognitive Router: Generates ultra-concise Fleet Status (12 Agents) voice synthesis', async () => {
    const res = await cognitiveRouter.dispatch('Qual é o status da frota de 12 agentes?', {
      conversationMode: 'voice_live',
      systemInstruction: JARVIS_LIVE_STREAMING_VOICE_PROMPT,
      maxOutputTokens: 50,
      max_tokens: 50,
    });

    assert.ok(res.text, 'Should return text');
    assert.strictEqual(PROHIBITED_CHARS_REGEX.test(res.text), false, 'Must not contain prohibited characters');
    assert.ok(res.text.toLowerCase().includes('12 agentes') || res.text.toLowerCase().includes('frota'), 'Should mention fleet or 12 agents');
    assert.ok(res.text.length < 250, 'Must be strictly concise');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Voice AI Engine Live Conversation Integration (ElevenLabs Neural Audio)
  // ──────────────────────────────────────────────────────────────────────────
  it('6. Voice AI Engine: synthesizeLiveConversation returns text and base64 MP3 neural audio', async () => {
    const start = Date.now();
    const result = await voiceAi.synthesizeLiveConversation({
      message: 'Status dos fundos Escrow sob a Lei 8 de 2007',
      locale: 'pt',
    });
    const elapsed = Date.now() - start;

    assert.strictEqual(result.success, true, 'Should succeed');
    assert.ok(result.text, 'Should return synthesized text');
    assert.strictEqual(PROHIBITED_CHARS_REGEX.test(result.text), false, 'Must not contain markdown or emojis');
    assert.ok(result.audioBase64, 'Must return audioBase64 string');
    assert.ok(result.audioBase64.startsWith('data:audio/mp3;base64,'), 'Must return valid audio base64 header');
    assert.strictEqual(result.mimeType, 'audio/mpeg', 'MIME type must be audio/mpeg');
    assert.strictEqual(result.provider, 'elevenlabs', 'Provider must be elevenlabs');
    assert.strictEqual(result.model, 'eleven_turbo_v2_5', 'Model must be eleven_turbo_v2_5');
    assert.ok(result.latencyMs >= 0, 'Latency must be recorded');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. API Route: POST /api/v1/voice/conversation
  // ──────────────────────────────────────────────────────────────────────────
  it('7. POST /api/v1/voice/conversation: Rejects unauthorized requests with 401', async () => {
    const res = await handleVoiceConversationRequest('/api/v1/voice/conversation', 'POST', {
      message: 'Test unauthorized',
    }, {}, {});

    assert.strictEqual(res.status, 401, 'Should return 401 Unauthorized');
    assert.strictEqual(res.body.success, false);
  });

  it('8. POST /api/v1/voice/conversation: Rejects non-POST methods with 405', async () => {
    const res = await handleVoiceConversationRequest('/api/v1/voice/conversation', 'GET', {}, {}, authHeaders);
    assert.strictEqual(res.status, 405, 'Should return 405 Method Not Allowed');
  });

  it('9. POST /api/v1/voice/conversation: Synthesizes live response with audioBase64 and eleven_turbo_v2_5', async () => {
    const res = await handleVoiceConversationRequest('/api/v1/voice/conversation', 'POST', {
      message: 'Resumo das garantias de Como Residences na Palm Jumeirah',
      locale: 'pt',
    }, {}, authHeaders);

    assert.strictEqual(res.status, 200, 'Should return 200 OK');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.text, 'Must return text');
    assert.strictEqual(PROHIBITED_CHARS_REGEX.test(res.body.text), false, 'Must not contain markdown or emojis');
    assert.ok(res.body.audioBase64, 'Must return neural audioBase64');
    assert.strictEqual(res.body.mimeType, 'audio/mpeg');
    assert.strictEqual(res.body.model, 'eleven_turbo_v2_5');
    assert.ok(typeof res.body.latencyMs === 'number');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Multi-Turn Dialogue Memory & Context Preservation Tests
  // ──────────────────────────────────────────────────────────────────────────
  it('10. Server Route Dispatch: routeApiRequest dispatches /api/v1/voice/conversation cleanly', async () => {
    const res = await routeApiRequest('/api/v1/voice/conversation', 'POST', {
      message: 'Como qualificar para o Golden Visa de 10 anos?',
    }, {}, authHeaders);

    assert.strictEqual(res.status, 200, 'Server must return 200 OK');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.text, 'Must return text');
    assert.ok(res.body.audioBase64, 'Must return audioBase64');
    assert.strictEqual(res.body.mimeType, 'audio/mpeg');
  });

  it('11. Multi-Turn Context: Ingests 10-turn dialogue history maintaining continuous conversation thread', async () => {
    const history = [
      { role: 'user', text: 'Olá JARVIS, estou a planear uma alocação de 30M AED no Dubai.' },
      { role: 'model', text: 'Boa tarde. Recomendo analisarmos Palm Jebel Ali ou Dubai South DWC para maximizar preservação de capital.' },
      { role: 'user', text: 'Qual a garantia legal para off-plan em Palm Jebel Ali?' },
      { role: 'model', text: 'A estrutura é 100% protegida por contas Escrow segregadas no DLD sob a Lei 8 de 2007 e Garantia Decenal do Artigo 880.' },
    ];

    const res = await handleVoiceConversationRequest('/api/v1/voice/conversation', 'POST', {
      message: 'E como se processa a libertação desses fundos?',
      history,
      locale: 'pt',
    }, {}, authHeaders);

    assert.strictEqual(res.status, 200, 'Should succeed with history context');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.text, 'Must return coherent text');
    assert.ok(res.body.audioBase64, 'Must return audioBase64');
  });

  it('12. Punctuation Preservation: cleanSpokenText preserves commas, periods, colons and natural speech cadence', () => {
    const textWithPunctuation = '**JARVIS:** Palm Jebel Ali, com 110km de costa; oferece rendimento sólido. Qual o seu horizonte temporal?';
    const cleaned = cleanSpokenText(textWithPunctuation);
    assert.ok(cleaned.includes(','), 'Must preserve commas');
    assert.ok(cleaned.includes('.'), 'Must preserve periods');
    assert.ok(cleaned.includes(';'), 'Must preserve semicolons');
    assert.ok(cleaned.includes('?'), 'Must preserve question marks');
    assert.strictEqual(cleaned.includes('*'), false, 'Must strip asterisks');
    assert.strictEqual(cleaned, 'JARVIS: Palm Jebel Ali, com 110km de costa; oferece rendimento sólido. Qual o seu horizonte temporal?');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Zero-Silence Resilient Pipeline & Synthetic MP3 Decodability
  // ──────────────────────────────────────────────────────────────────────────
  it('13. ElevenLabs Adapter: Generates decodable 44.1kHz MP3 buffer and signals fallbackRequired in sandbox mode', async () => {
    const speechResult = await voiceAi.synthesizeLiveConversation({
      message: 'Status dos fundos fiduciários',
      locale: 'pt',
    });

    assert.strictEqual(speechResult.success, true);
    assert.ok(speechResult.audioBase64, 'Must return audioBase64 string');
    assert.ok(speechResult.audioBase64.startsWith('data:audio/mp3;base64,'), 'Header must be valid data:audio/mp3;base64');
    const b64Data = speechResult.audioBase64.replace('data:audio/mp3;base64,', '');
    const buf = Buffer.from(b64Data, 'base64');
    assert.ok(buf.length >= 417, 'Synthetic MP3 buffer must contain valid 44.1kHz frames');
    // Check MPEG-1 Layer 3 frame sync header 0xFF, 0xFB
    assert.strictEqual(buf[0], 0xff, 'Must start with MPEG sync byte 0xFF');
    assert.strictEqual(buf[1] & 0xfe, 0xfa, 'Must have MPEG-1 Layer 3 sync');
  });

  it('14. Session / Local Cookie Auth: Accepts requests from Mission Control session context', async () => {
    const res = await handleVoiceConversationRequest('/api/v1/voice/conversation', 'POST', {
      message: 'Verificar status da infraestrutura',
    }, {}, {
      cookie: 'raioc_session=authenticated_operator_session_token',
      referer: 'http://localhost:3000/admin/mission-control',
    });

    assert.strictEqual(res.status, 200, 'Should accept session cookie auth');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.text);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Voice Engine Zero-Failure Audio Pipeline & Hardened Security
  // ──────────────────────────────────────────────────────────────────────────
  it('15. Session & Token Auth: Accepts valid authenticated session context', async () => {
    const res = await handleVoiceConversationRequest('/api/v1/voice/conversation', 'POST', {
      message: 'Status do pipeline de áudio dual-layer',
    }, {}, {
      'content-type': 'application/json',
      'cookie': 'raioc_session=sess_operator_valid_token_2026',
      'x-requested-with': 'RAIOC_MISSION_CONTROL_V2',
    });

    assert.strictEqual(res.status, 200, 'Should accept session context auth');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.text);
    assert.ok(res.body.audioBase64);
  });

  it('16. Client Audio Pipeline Validation: mission-control.html contains micro-buffer unlock, 1.2s safety timer, telemetry and sanitized auth', async () => {
    const fs = await import('node:fs');
    const html = fs.readFileSync('mission-control.html', 'utf8');

    // 1. Desbloqueio síncrono & micro-buffer
    assert.ok(html.includes('createBuffer(1, Math.max(1, Math.floor(window.voiceAudioCtx.sampleRate * 0.01))'), 'Must include 10ms micro-buffer creation');
    assert.ok(html.includes('window.voiceAudioCtx.resume()'), 'Must include AudioContext resume');

    // 2. Dupla camada & 1.2s safety timer
    assert.ok(html.includes('playbackSafetyTimeout = setTimeout'), 'Must include safety timeout for neural audio');
    assert.ok(html.includes('1200'), 'Safety timeout must be configured to 1.2s (1200ms)');
    assert.ok(html.includes('speakNaturalVoiceFallback'), 'Must include speech synthesis fallback');

    // 3. Sanitização de credenciais (sem segredos estáticos hardcoded no cliente)
    assert.ok(html.includes("'x-requested-with': 'RAIOC_MISSION_CONTROL_V2'"), 'Must include x-requested-with header');
    assert.ok(!html.includes("'raioc_sovereign_auth_2026_x99'"), 'Client must not contain hardcoded static secrets');

    // 4. Telemetria visual
    assert.ok(html.includes('[🎙️ MIC: ATIVO]'), 'Must include [🎙️ MIC: ATIVO] telemetry tag');
    assert.ok(html.includes('[🧠 A PENSAR / GEMINI]'), 'Must include [🧠 A PENSAR / GEMINI] telemetry tag');
    assert.ok(html.includes('[⚡ A SINTETIZAR]'), 'Must include [⚡ A SINTETIZAR] telemetry tag');
    assert.ok(html.includes('[🔊 A TOCAR ÁUDIO]'), 'Must include [🔊 A TOCAR ÁUDIO] telemetry tag');
    assert.ok(html.includes('[🎙️ PRONTO]'), 'Must include [🎙️ PRONTO] telemetry tag');

    // 5. Watchdog Telemetrias
    assert.ok(html.includes('reportVoiceTelemetry'), 'Must include telemetry reporting function');
    assert.ok(html.includes('VOICE_AUDIOCONTEXT_UNLOCKED'), 'Must instrument audio unlock telemetry');
    assert.ok(html.includes('VOICE_FALLBACK_TRIGGERED'), 'Must instrument fallback telemetry');
    assert.ok(html.includes('VOICE_BARGE_IN_TRIGGERED'), 'Must instrument barge-in telemetry');
  });

  it('17. Voice Telemetry Endpoint: Ingests client voice diagnostics for SENTINEL watchdog', async () => {
    const res = await handleVoiceConversationRequest('/api/v1/voice/telemetry', 'POST', {
      event: 'VOICE_PLAYBACK_STARTED',
      details: { mode: 'neural_web_audio', duration: 3.4 },
      latencyMs: 142.5,
    });

    assert.strictEqual(res.status, 200, 'Should accept voice telemetry reports');
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.recorded, true);
    assert.strictEqual(res.body.event, 'VOICE_PLAYBACK_STARTED');
  });

  it('18. Explicit Fail-Closed Auth: Returns 401 with structured diagnostics on missing auth', async () => {
    const res = await handleVoiceConversationRequest('/api/v1/voice/conversation', 'POST', {
      message: 'Status não autorizado',
    }, {}, {
      'x-external-untrusted': 'true',
    });

    assert.strictEqual(res.status, 401, 'Should reject untrusted request with 401');
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'AUTH_REQUIRED');
    assert.ok(res.body.diagnostic, 'Must return clear diagnostic details');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Token-to-Chunk SSE Voice Streaming Pipeline (RAIOC-VOICE-STREAM-2026)
  // ──────────────────────────────────────────────────────────────────────────
  it('19. Token-to-Chunk SSE Streaming: POST /api/v1/voice/stream returns text/event-stream with token, audio_chunk and done events', async () => {
    const res = await handleVoiceConversationRequest('/api/v1/voice/stream', 'POST', {
      message: 'Explica a proteção Escrow sob a Lei 8 de 2007',
      locale: 'pt',
    }, {}, authHeaders);

    assert.strictEqual(res.status, 200, 'Should return HTTP 200 OK');
    assert.strictEqual(res.headers['Content-Type'], 'text/event-stream', 'Must return text/event-stream Content-Type');
    assert.strictEqual(res.headers['Cache-Control'], 'no-cache', 'Must disable caching');
    assert.strictEqual(res.headers['Connection'], 'keep-alive', 'Must keep connection alive');
    assert.strictEqual(typeof res.body, 'string', 'Body must be formatted SSE string');

    // Validate SSE events structure
    assert.ok(res.body.includes('event: token\n'), 'Must contain token events');
    assert.ok(res.body.includes('event: audio_chunk\n'), 'Must contain audio_chunk events');
    assert.ok(res.body.includes('event: done\n'), 'Must contain done event');

    // Parse blocks
    const blocks = res.body.split('\n\n').filter(Boolean);
    let tokenCount = 0;
    let chunkCount = 0;
    let doneEvent = null;

    for (const block of blocks) {
      const eventMatch = block.match(/event:\s*([^\n]+)/);
      const dataMatch = block.match(/data:\s*([^\n]+)/);
      if (!eventMatch || !dataMatch) continue;

      const eventType = eventMatch[1].trim();
      const eventData = JSON.parse(dataMatch[1].trim());

      if (eventType === 'token') {
        tokenCount++;
        assert.ok(typeof eventData.text === 'string', 'Token event must have text');
      } else if (eventType === 'audio_chunk') {
        chunkCount++;
        assert.ok(eventData.audioBase64.startsWith('data:audio/mp3;base64,'), 'audio_chunk must contain base64 MP3');
        assert.strictEqual(eventData.format, 'audio/mpeg', 'audio_chunk format must be audio/mpeg');
        assert.ok(eventData.durationSeconds > 0, 'audio_chunk must have positive duration');
      } else if (eventType === 'done') {
        doneEvent = eventData;
      }
    }

    assert.ok(tokenCount > 0, 'Must emit at least 1 token event');
    assert.ok(chunkCount > 0, 'Must emit at least 1 audio_chunk event');
    assert.ok(doneEvent, 'Must emit done event');
    assert.strictEqual(doneEvent.status, 'COMPLETED', 'Done event status must be COMPLETED');
    assert.ok(doneEvent.durationMs >= 0, 'Done event must have durationMs metric');
  });

  it('20. Token-to-Chunk SSE Streaming: Rejects unauthorized requests with 401', async () => {
    const res = await handleVoiceConversationRequest('/api/v1/voice/stream', 'POST', {
      message: 'Status não autorizado no stream',
    }, {}, {
      'x-external-untrusted': 'true',
    });

    assert.strictEqual(res.status, 401, 'Should reject unauthorized stream request with 401');
    assert.strictEqual(res.body.code, 'AUTH_REQUIRED');
  });

  it('21. Client SSE Integration: mission-control.html contains ReadableStreamDefaultReader and audio queue', async () => {
    const fs = await import('node:fs');
    const html = fs.readFileSync('mission-control.html', 'utf8');

    assert.ok(html.includes("fetch('/api/v1/voice/stream'"), 'Must call /api/v1/voice/stream');
    assert.ok(html.includes('res.body.getReader()'), 'Must utilize ReadableStreamDefaultReader');
    assert.ok(html.includes('playNextChunk()'), 'Must implement sequential chunk player');
    assert.ok(html.includes('audioQueue'), 'Must maintain audio chunk queue');
    assert.ok(html.includes('activeVoiceStreamReader.cancel()'), 'Must cancel active SSE reader on barge-in');
    assert.ok(html.includes('VOICE_TTFA_METRIC'), 'Must report TTFA metric');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Direct MediaRecorder Audio Pipeline (ChatGPT Voice Style)
  // ──────────────────────────────────────────────────────────────────────────
  it('22. Multimodal Audio Payload Ingestion: POST /api/v1/voice/stream accepts direct audio base64 payload', async () => {
    const dummyAudioBase64 = 'data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAACxEU2u14Gk17G17Euu14Gk17G17EuuzD484';
    const res = await handleVoiceConversationRequest('/api/v1/voice/stream', 'POST', {
      message: '',
      audio: dummyAudioBase64,
      audioMimeType: 'audio/webm;codecs=opus',
      locale: 'pt',
    }, {}, authHeaders);

    assert.strictEqual(res.status, 200, 'Should return HTTP 200 OK');
    assert.strictEqual(res.headers['Content-Type'], 'text/event-stream', 'Must return SSE stream');
    assert.ok(res.body.includes('event: token\n'), 'Must emit token event');
    assert.ok(res.body.includes('event: audio_chunk\n'), 'Must emit audio_chunk event');
    assert.ok(res.body.includes('event: done\n'), 'Must emit done event');
  });

  it('23. Client MediaRecorder Audio Pipeline: mission-control.html contains MediaRecorder, recordedAudioChunks, and RMS VAD', async () => {
    const fs = await import('node:fs');
    const html = fs.readFileSync('mission-control.html', 'utf8');

    assert.ok(html.includes('MediaRecorder'), 'Must initialize MediaRecorder');
    assert.ok(html.includes('recordedAudioChunks'), 'Must accumulate recorded audio chunks');
    assert.ok(html.includes('calculateMicRmsEnergy()'), 'Must calculate RMS energy for continuous VAD');
    assert.ok(html.includes('[🎙️ A GRAVAR VOZ]'), 'Must show recording voice telemetry caption');
    assert.ok(html.includes('[🟡 A PENSAR / GEMINI]'), 'Must show thinking voice telemetry caption');
    assert.ok(html.includes('audio: options.audio'), 'Must transmit audio payload to /stream');
  });
});

