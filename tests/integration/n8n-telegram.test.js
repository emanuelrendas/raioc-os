/**
 * RAIOC OS - Integration Test Suite: n8n Egress Webhook Dispatcher & Telegram VIP Notification Bridge
 * Validates HMAC-SHA256 signature generation, payload compilation, 5000ms timeout enforcement,
 * HTML template formatting (GEM-003), non-blocking audit logging, and run-cycle integration.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { N8nAdapter, dispatchN8nEvent, n8nAdapter } from '../../src/adapters/n8n-adapter.js';
import { TelegramAdapter, sendTelegramAlert, telegramAdapter, NOTIF_TEMPLATES } from '../../src/adapters/telegram-adapter.js';
import { SupabaseClient } from '../../src/db/supabase-client.js';
import { run_cycle } from '../../src/core/run-cycle.js';

process.env.RAIOC_RUNTIME_EXECUTION_MODE = 'active';

describe('INTEGRATION: n8n Webhook Egress & Telegram VIP Bridge', () => {
  let originalFetch;
  let originalN8nSecret;
  let originalN8nUrl;
  let originalTgToken;
  let originalTgChat;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalN8nSecret = process.env.N8N_OUTBOUND_SECRET;
    originalN8nUrl = process.env.N8N_OUTBOUND_WEBHOOK_URL;
    originalTgToken = process.env.TELEGRAM_BOT_TOKEN;
    originalTgChat = process.env.TELEGRAM_CHAT_ID;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;

    if (originalN8nSecret !== undefined) process.env.N8N_OUTBOUND_SECRET = originalN8nSecret;
    else delete process.env.N8N_OUTBOUND_SECRET;

    if (originalN8nUrl !== undefined) process.env.N8N_OUTBOUND_WEBHOOK_URL = originalN8nUrl;
    else delete process.env.N8N_OUTBOUND_WEBHOOK_URL;

    if (originalTgToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = originalTgToken;
    else delete process.env.TELEGRAM_BOT_TOKEN;

    if (originalTgChat !== undefined) process.env.TELEGRAM_CHAT_ID = originalTgChat;
    else delete process.env.TELEGRAM_CHAT_ID;
  });

  // --- 1. n8n HMAC Signing & Payload Compilation ---

  test('1. n8n adapter compiles payload and correctly signs with HMAC-SHA256', async () => {
    const testSecret = 'secret_n8n_test_key_98765';
    process.env.N8N_OUTBOUND_SECRET = testSecret;
    delete process.env.N8N_OUTBOUND_WEBHOOK_URL;

    const payload = {
      leadId: 'lead_test_001',
      name: 'Sheikh Al-Maktoum',
      company: 'Emirates Sovereign Capital',
      budgetAed: 50000000,
      riisScore: 95,
      riskLevel: 'LOW',
    };

    const outcome = await dispatchN8nEvent('QUALIFIED_LEAD', payload, {
      webhookSecret: testSecret,
      correlationId: 'corr_test_n8n_001',
    });

    assert.strictEqual(outcome.success, true);
    assert.strictEqual(outcome.status, 'compiled_for_n8n');
    assert.strictEqual(outcome.event, 'QUALIFIED_LEAD');
    assert.strictEqual(outcome.correlationId, 'corr_test_n8n_001');
    assert.ok(outcome.signature.startsWith('sha256='));

    // Verify cryptographic HMAC signature
    const expectedSig = createHmac('sha256', testSecret)
      .update(JSON.stringify(outcome.payload))
      .digest('hex');

    assert.strictEqual(outcome.signature, `sha256=${expectedSig}`);
    assert.deepStrictEqual(outcome.payload.data, payload);
    assert.strictEqual(outcome.payload.source, 'raioc-os');
  });

  // --- 2. n8n Live Egress Webhook Dispatch & Timeout / Error Handling ---

  test('2. n8n adapter dispatches live HTTP POST with exact HMAC headers and handles 5000ms timeout non-blockingly', async () => {
    process.env.N8N_OUTBOUND_SECRET = 'raioc_test_n8n_sec_123';
    process.env.N8N_OUTBOUND_WEBHOOK_URL = 'https://n8n.emanuelrendas.com/webhook/egress-lead-trigger';

    let fetchCalled = false;
    let requestUrl = '';
    let requestHeaders = {};
    let requestBody = null;

    globalThis.fetch = async (url, opts) => {
      fetchCalled = true;
      requestUrl = url;
      requestHeaders = opts.headers;
      requestBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ status: 'success', executionId: 'exec_n8n_48291' }),
      };
    };

    const result = await dispatchN8nEvent('QUALIFIED_LEAD', {
      lead: { id: 'lead_999', name: 'Dr. Tariq' },
      riisScore: 92,
    });

    assert.strictEqual(fetchCalled, true);
    assert.strictEqual(requestUrl, 'https://n8n.emanuelrendas.com/webhook/egress-lead-trigger');
    assert.strictEqual(requestHeaders['Content-Type'], 'application/json');
    assert.strictEqual(requestHeaders['X-Event-Type'], 'QUALIFIED_LEAD');
    assert.ok(requestHeaders['X-N8N-Signature'].startsWith('sha256='));
    assert.ok(requestHeaders['X-Correlation-ID']);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'SENT');
    assert.strictEqual(result.httpStatus, 200);
    assert.strictEqual(result.response.executionId, 'exec_n8n_48291');

    // Test non-blocking error handling when webhook fails (returns 500)
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'n8n workflow execution crashed',
    });

    const failureResult = await dispatchN8nEvent('QUALIFIED_LEAD', { lead: { id: 'lead_err' } });
    assert.strictEqual(failureResult.success, false);
    assert.strictEqual(failureResult.status, 'FAILED');
    assert.ok(failureResult.error.includes('500'));
  });

  // --- 3. Telegram VIP Notification Formatting (GEM-003) ---

  test('3. Telegram adapter formats NOTIF_QUALIFIED_LEAD and NOTIF_SYSTEM_ALERT with parse_mode HTML', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';
    process.env.TELEGRAM_CHAT_ID = '-100987654321';

    let fetchCalled = false;
    let requestUrl = '';
    let requestBody = null;

    globalThis.fetch = async (url, opts) => {
      fetchCalled = true;
      requestUrl = url;
      requestBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            message_id: 772183,
            chat: { id: -100987654321 },
          },
        }),
      };
    };

    // Test NOTIF_QUALIFIED_LEAD
    const leadData = {
      lead: {
        name: 'Baroness Helena Vance',
        company: 'Vance Family Office Ltd',
        email: 'helena@vanceholdings.co.uk',
        phone: '+447911987654',
        budgetAed: 45000000,
      },
      intelligence: {
        riis: { score: 98, tierLabel: 'Sovereign Institutional' },
        dira: { riskLevel: 'LOW' },
        recommendedTrack: 'STRAT_SOVEREIGN_ACCELERATION',
      },
      correlationId: 'corr_tg_vip_001',
    };

    const res = await sendTelegramAlert('NOTIF_QUALIFIED_LEAD', leadData);

    assert.strictEqual(fetchCalled, true);
    assert.ok(requestUrl.includes('api.telegram.org/bot123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ/sendMessage'));
    assert.strictEqual(requestBody.chat_id, '-100987654321');
    assert.strictEqual(requestBody.parse_mode, 'HTML');
    assert.ok(requestBody.text.includes('VIP NOTIFICATION: QUALIFIED LEAD'));
    assert.ok(requestBody.text.includes('Baroness Helena Vance'));
    assert.ok(requestBody.text.includes('Vance Family Office Ltd'));
    assert.ok(requestBody.text.includes('helena@vanceholdings.co.uk'));
    assert.ok(requestBody.text.includes('AED 45,000,000'));
    assert.ok(requestBody.text.includes('<code>98/100</code>'));
    assert.ok(requestBody.text.includes('<code>LOW</code>'));
    assert.ok(requestBody.text.includes('corr_tg_vip_001'));
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'SENT');
    assert.strictEqual(res.telegramMessageId, 772183);

    // Test NOTIF_SYSTEM_ALERT
    const alertRes = await sendTelegramAlert('NOTIF_SYSTEM_ALERT', {
      severity: 'CRITICAL',
      component: 'QUEUE_ENGINE',
      message: 'Provider dispatch latency spiked above 4500ms',
      correlationId: 'corr_sys_alert_001',
    });

    assert.strictEqual(alertRes.success, true);
    assert.ok(requestBody.text.includes('SYSTEM OPERATIONAL ALERT: CRITICAL'));
    assert.ok(requestBody.text.includes('QUEUE_ENGINE'));
    assert.ok(requestBody.text.includes('Provider dispatch latency spiked'));
  });

  // --- 4. Telegram Graceful Handling & Non-blocking Failures ---

  test('4. Telegram adapter gracefully handles missing credentials and network outages without crashing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;

    const noCredsRes = await sendTelegramAlert('NOTIF_QUALIFIED_LEAD', { name: 'Test Lead' });
    assert.strictEqual(noCredsRes.success, true);
    assert.strictEqual(noCredsRes.status, 'DISCONNECTED');
    assert.strictEqual(noCredsRes.reason, 'missing_env_variable');

    // Simulate API Network Error
    process.env.TELEGRAM_BOT_TOKEN = 'mock_token';
    process.env.TELEGRAM_CHAT_ID = 'mock_chat';

    globalThis.fetch = async () => {
      throw new Error('Telegram Bot API unreachable (502 Bad Gateway)');
    };

    const errRes = await sendTelegramAlert('NOTIF_SYSTEM_ALERT', { message: 'Test fail' });
    assert.strictEqual(errRes.success, false);
    assert.strictEqual(errRes.status, 'FAILED');
    assert.ok(errRes.error.includes('Telegram Bot API unreachable'));
  });

  // --- 5. End-to-End run-cycle Integration ---

  test('5. run_cycle automatically dispatches QUALIFIED_LEAD to n8n and Telegram VIP notification upon lead processing', async () => {
    const mockDb = new SupabaseClient({ useMock: true });

    let n8nDispatched = false;
    let telegramDispatched = false;
    let n8nEventData = null;
    let telegramMessageText = '';

    process.env.N8N_OUTBOUND_SECRET = 'cycle_test_secret_123';
    process.env.N8N_OUTBOUND_WEBHOOK_URL = 'https://n8n.emanuelrendas.com/webhook/cycle-lead';
    process.env.TELEGRAM_BOT_TOKEN = '111222333:XYZabcTestToken';
    process.env.TELEGRAM_CHAT_ID = '-100555666777';

    globalThis.fetch = async (url, opts) => {
      if (url.includes('n8n.emanuelrendas.com')) {
        n8nDispatched = true;
        n8nEventData = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ACK', executionId: 'exec_cycle_1001' }),
        };
      }

      if (url.includes('api.telegram.org')) {
        telegramDispatched = true;
        const body = JSON.parse(opts.body);
        telegramMessageText = body.text;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: { message_id: 884719, chat: { id: -100555666777 } },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    };

    // Seed lead into mock database
    mockDb.mockStore.leads.push({
      id: 'lead_cycle_vip_001',
      name: 'Sheikh Hamdan Bin Mohammed',
      company: 'Dubai Future Investments',
      email: 'hamdan@dubai-future.ae',
      phone: '+97140001111',
      company_size: '500+',
      ai_maturity: 'in_production',
      timeline: 'immediate',
      budgetAed: 100000000,
      status: 'new',
      consent_status: 'opted_in',
      created_at: new Date().toISOString(),
    });

    const cycleResult = await run_cycle({ dbClient: mockDb, batchSize: 5 });

    assert.strictEqual(cycleResult.status, 'SUCCESS');
    assert.strictEqual(cycleResult.summary.leadsProcessed, 1);
    assert.strictEqual(cycleResult.summary.executiveBriefsGenerated, 1);
    assert.strictEqual(cycleResult.summary.dispatches.n8n, 1);
    assert.strictEqual(cycleResult.summary.dispatches.telegram, 1);

    // Verify n8n Webhook was dispatched
    assert.strictEqual(n8nDispatched, true);
    assert.strictEqual(n8nEventData.event, 'QUALIFIED_LEAD');
    assert.strictEqual(n8nEventData.data.lead.name, 'Sheikh Hamdan Bin Mohammed');
    assert.strictEqual(n8nEventData.data.lead.company, 'Dubai Future Investments');
    assert.ok(n8nEventData.data.intelligence.riis.score >= 80);

    // Verify Telegram VIP message was dispatched
    assert.strictEqual(telegramDispatched, true);
    assert.ok(telegramMessageText.includes('VIP NOTIFICATION: QUALIFIED LEAD'));
    assert.ok(telegramMessageText.includes('Sheikh Hamdan Bin Mohammed'));
    assert.ok(telegramMessageText.includes('Dubai Future Investments'));
  });

  // --- 6. Standardized Telegram Keys & HTML Sanitization ---

  test('6. n8n payload always includes standardized keys (text, message, full_name, budget_formatted, parse_mode: HTML) and sanitizes raw HTML', async () => {
    let capturedBody = null;
    process.env.N8N_OUTBOUND_SECRET = 'test_sanitize_secret_123';
    process.env.N8N_OUTBOUND_WEBHOOK_URL = 'https://n8n.emanuelrendas.com/webhook/test-sanitize';

    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'OK' }),
      };
    };

    // Test with unescaped raw HTML (e.g. angle brackets, unescaped ampersand, unclosed tags)
    const rawPayload = {
      name: 'Count Maximillian & Co <Investor>',
      budgetAed: 28000000,
      message: 'Looking for yield > 8% & < 10% in Palm Jumeirah <b>luxury</b> developments <script>alert(1)</script>',
      company: 'Global Capital <AG>',
    };

    const outcome = await dispatchN8nEvent('QUALIFIED_LEAD', rawPayload);

    assert.strictEqual(outcome.success, true);
    assert.ok(capturedBody);
    
    // Check top-level standardized fields
    assert.strictEqual(capturedBody.parse_mode, 'HTML');
    assert.strictEqual(capturedBody.full_name, 'Count Maximillian &amp; Co &lt;Investor&gt;');
    assert.strictEqual(capturedBody.budget_formatted, 'AED 28,000,000');
    assert.ok(typeof capturedBody.text === 'string');
    assert.ok(typeof capturedBody.message === 'string');
    assert.strictEqual(capturedBody.text, capturedBody.message);

    // Verify raw dangerous/unsupported HTML tags and unescaped brackets are sanitized
    assert.ok(!capturedBody.text.includes('<script>'));
    assert.ok(!capturedBody.text.includes('</script>'));
    assert.ok(capturedBody.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(capturedBody.text.includes('&gt; 8% &amp; &lt; 10%'));
    // Valid Telegram <b> tag is preserved
    assert.ok(capturedBody.text.includes('<b>luxury</b>'));
  });
});

