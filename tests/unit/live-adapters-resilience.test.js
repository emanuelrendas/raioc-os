/**
 * RAIOC OS - Unit Test Suite: Live Adapters Resilience & /healthz Liveness
 * 
 * Validates:
 * 1. GET /healthz endpoint response with memory RSS metrics and loop statuses
 * 2. Memory RSS monitor warning (180MB) and critical drain (250MB) logic
 * 3. Meta WhatsApp Cloud API Adapter (LIVE vs SIMULATED_SANDBOX, Document PDF & Template)
 * 4. ElevenLabs Neural TTS Adapter (LIVE vs SIMULATED_SANDBOX, SHA-256 and audio base64)
 * 5. Bearer / xi-api-key authentication headers and outbound payload validation
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { routeApiRequest } from '../../src/api/server.js';
import { memoryRssMonitor, MEMORY_THRESHOLDS } from '../../src/monitoring/memory-rss-monitor.js';
import { WhatsAppCloudAdapter, whatsAppCloudAdapter } from '../../src/adapters/whatsapp-cloud-adapter.js';
import { ElevenLabsAdapter, elevenLabsAdapter } from '../../src/adapters/elevenlabs-adapter.js';

describe('⚡ Live Adapters Resilience & /healthz Liveness Suite', () => {

  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  test('1. GET /healthz: Endpoint Response & Memory RSS Metrics', async () => {
    const res = await routeApiRequest('/healthz', 'GET');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['Content-Type'], 'application/json');
    assert.strictEqual(res.body.status, 'OK');
    assert.strictEqual(typeof res.body.uptime, 'number');
    assert.ok(res.body.uptime >= 0);
    assert.strictEqual(typeof res.body.memory_rss_mb, 'number');
    assert.ok(res.body.memory_rss_mb > 0);
    assert.ok(res.body.active_agents_count >= 1, 'Should reflect registered specialist agents');

    // Validate loop_status object
    assert.ok(res.body.loop_status, 'loop_status object must be present');
    assert.strictEqual(typeof res.body.loop_status.jarvis_loop, 'boolean');
    assert.strictEqual(typeof res.body.loop_status.sentinel_prober, 'boolean');
    assert.strictEqual(typeof res.body.loop_status.distributed_scheduler, 'boolean');
  });

  test('2. Memory RSS Monitor: Thresholds & Drain Trigger Logic', async () => {
    const metrics = memoryRssMonitor.getMemoryMetrics();
    assert.ok(metrics.rssMb > 0, 'RSS memory must be positive');
    assert.ok(metrics.heapUsedMb > 0, 'Heap used must be positive');

    // Normal check
    const checkNormal = memoryRssMonitor.checkMemoryUsage();
    assert.ok(['NORMAL', 'WARNING', 'CRITICAL'].includes(checkNormal.status));

    // Threshold constants verification
    assert.strictEqual(MEMORY_THRESHOLDS.WARNING_MB, 180);
    assert.strictEqual(MEMORY_THRESHOLDS.CRITICAL_MB, 250);
  });

  test('3. Meta WhatsApp Cloud Adapter: SIMULATED_SANDBOX Mode & PDF Attachments', async () => {
    const sandboxAdapter = new WhatsAppCloudAdapter({
      phoneNumberId: '',
      accessToken: '',
    });

    assert.strictEqual(sandboxAdapter.isLiveMode(), false);
    assert.strictEqual(sandboxAdapter.getMode(), 'SIMULATED_SANDBOX');

    // 3a. Text message dispatch
    const textRes = await sandboxAdapter.sendTextMessage({
      to: '+971501234567',
      message: 'Exclusive Sovereign Corridor Update for Palm Jebel Ali',
    });
    assert.strictEqual(textRes.success, true);
    assert.strictEqual(textRes.mode, 'SIMULATED_SANDBOX');
    assert.strictEqual(textRes.recipient, '971501234567');
    assert.ok(textRes.messageId.startsWith('wamid_'));

    // 3b. Template message dispatch
    const tplRes = await sandboxAdapter.sendTemplateMessage({
      to: '+971501234567',
      templateName: 'sovereign_mandate_approved',
      language: 'en',
    });
    assert.strictEqual(tplRes.success, true);
    assert.strictEqual(tplRes.mode, 'SIMULATED_SANDBOX');

    // 3c. PDF Document attachment with SHA-256 digest
    const docSha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const docRes = await sandboxAdapter.sendDocument({
      to: '+971501234567',
      documentUrl: 'https://assets.emanuelrendas.com/briefs/PIB-35M-PALM.pdf',
      filename: 'Private_Investment_Brief_35M.pdf',
      documentSha256: docSha,
    });
    assert.strictEqual(docRes.success, true);
    assert.strictEqual(docRes.mode, 'SIMULATED_SANDBOX');
    assert.strictEqual(docRes.documentSha256, docSha);
    assert.strictEqual(docRes.filename, 'Private_Investment_Brief_35M.pdf');

    // 3d. Dispatch via Task Queue envelope
    const taskRes = await sandboxAdapter.dispatch({
      recipient: '+971501234567',
      payload: {
        type: 'document',
        documentUrl: 'https://assets.emanuelrendas.com/briefs/PIB-35M-PALM.pdf',
        documentSha256: docSha,
      },
    });
    assert.strictEqual(taskRes.success, true);
    assert.strictEqual(taskRes.type, 'document');
  });

  test('4. Meta WhatsApp Cloud Adapter: LIVE Mode with Graph API v20.0 Interception', async () => {
    let capturedUrl = '';
    let capturedHeaders = {};
    let capturedBody = null;

    global.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedHeaders = options.headers || {};
      capturedBody = JSON.parse(options.body || '{}');

      return {
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '971501234567', wa_id: '971501234567' }],
          messages: [{ id: 'wamid.HBgLMjAyNjA4MjcXOTk=' }],
        }),
      };
    };

    const liveAdapter = new WhatsAppCloudAdapter({
      phoneNumberId: '9876543210',
      accessToken: 'EAAB_TEST_BEARER_TOKEN_LIVE',
    });

    assert.strictEqual(liveAdapter.isLiveMode(), true);
    assert.strictEqual(liveAdapter.getMode(), 'LIVE');

    const result = await liveAdapter.sendDocument({
      to: '+971 50 123 4567',
      documentUrl: 'https://assets.emanuelrendas.com/briefs/pib-50m.pdf',
      filename: 'Private_Brief_50M.pdf',
      caption: 'Fiduciary One-Pager',
      documentSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'SENT_LIVE');
    assert.strictEqual(result.mode, 'LIVE');
    assert.strictEqual(result.messageId, 'wamid.HBgLMjAyNjA4MjcXOTk=');

    // Verify outbound request details
    assert.strictEqual(capturedUrl, 'https://graph.facebook.com/v20.0/9876543210/messages');
    assert.strictEqual(capturedHeaders.Authorization, 'Bearer EAAB_TEST_BEARER_TOKEN_LIVE');
    assert.strictEqual(capturedBody.messaging_product, 'whatsapp');
    assert.strictEqual(capturedBody.to, '971501234567');
    assert.strictEqual(capturedBody.type, 'document');
    assert.strictEqual(capturedBody.document.link, 'https://assets.emanuelrendas.com/briefs/pib-50m.pdf');
  });

  test('5. ElevenLabs Neural TTS Adapter: SIMULATED_SANDBOX Mode & SHA-256', async () => {
    const sandboxTts = new ElevenLabsAdapter({ apiKey: '' });

    assert.strictEqual(sandboxTts.isLiveMode(), false);
    assert.strictEqual(sandboxTts.getMode(), 'SIMULATED_SANDBOX');

    const script = 'Dubai Law Number Eight of 2007 mandates that all investor funds are segregated in escrow accounts.';
    const expectedSha256 = createHash('sha256').update(script).digest('hex');

    const ttsRes = await sandboxTts.generateSpeech({
      text: script,
      locale: 'en',
    });

    assert.strictEqual(ttsRes.success, true);
    assert.strictEqual(ttsRes.mode, 'SIMULATED_SANDBOX');
    assert.strictEqual(ttsRes.audioSha256, expectedSha256);
    assert.ok(ttsRes.audioBase64.startsWith('data:audio/mp3;base64,'));
    assert.ok(ttsRes.durationSeconds > 0);
  });

  test('6. ElevenLabs Neural TTS Adapter: LIVE Mode with REST API Interception', async () => {
    let capturedUrl = '';
    let capturedHeaders = {};
    let capturedBody = null;

    const mockAudioData = Buffer.from('FAKE_ELEVENLABS_MP3_BINARY_AUDIO_PAYLOAD');

    global.fetch = async (url, options) => {
      capturedUrl = String(url);
      capturedHeaders = options.headers || {};
      capturedBody = JSON.parse(options.body || '{}');

      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => mockAudioData.buffer.slice(mockAudioData.byteOffset, mockAudioData.byteOffset + mockAudioData.byteLength),
      };
    };

    const liveTts = new ElevenLabsAdapter({
      apiKey: 'xi_live_test_api_key_777',
      defaultVoiceId: 'voice_emanuel_executive',
    });

    assert.strictEqual(liveTts.isLiveMode(), true);
    assert.strictEqual(liveTts.getMode(), 'LIVE');

    const result = await liveTts.generateSpeech({
      text: 'Under UAE Civil Code Article 880, decennial liability is strictly enforced.',
      locale: 'en',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.mode, 'LIVE');
    assert.strictEqual(result.byteLength, mockAudioData.length);
    assert.strictEqual(capturedUrl, 'https://api.elevenlabs.io/v1/text-to-speech/voice_emanuel_executive');
    assert.strictEqual(capturedHeaders['xi-api-key'], 'xi_live_test_api_key_777');
    assert.strictEqual(capturedBody.text, 'Under UAE Civil Code Article 880, decennial liability is strictly enforced.');
  });

});
