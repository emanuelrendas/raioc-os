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
  // 5. Server Dispatch Integration Test
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
});
