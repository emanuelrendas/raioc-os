import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { TelegramClient, telegramClient, sendTelegramMessage } from '../src/connectors/telegram-client.js';
import { agentEventBus, AgentEvents } from '../src/events/agent-event-bus.js';
import { supabase } from '../src/db/supabase-client.js';

describe('MISSION ID: AG-003 — Automated Telegram Notifications via Event Bus', () => {
  let originalFetch;
  let originalToken;
  let originalChatId;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalToken = process.env.TELEGRAM_BOT_TOKEN;
    originalChatId = process.env.TELEGRAM_CHAT_ID;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalToken) process.env.TELEGRAM_BOT_TOKEN = originalToken;
    else delete process.env.TELEGRAM_BOT_TOKEN;

    if (originalChatId) process.env.TELEGRAM_CHAT_ID = originalChatId;
    else delete process.env.TELEGRAM_CHAT_ID;
  });

  test('1. formatInvestorMessage generates exact required template', () => {
    const formatted = telegramClient.formatInvestorMessage({
      name: 'Sheikh Mansoor Al-Nahyan',
      email: 'investor@sovereign-advisory.ae',
      phone: '+971501234567',
      budget: 'AED 45,000,000',
      community: 'Palm Jumeirah Ultra Prime',
      correlationId: 'corr_test_001',
    });

    const expected = `----------------------------------------

🚀 NEW INVESTOR LEAD

Name:
Sheikh Mansoor Al-Nahyan

Email:
investor@sovereign-advisory.ae

Phone:
+971501234567

Budget:
AED 45,000,000

Community:
Palm Jumeirah Ultra Prime

Correlation ID:
corr_test_001

----------------------------------------`;

    assert.strictEqual(formatted, expected);
  });

  test('2. Event Bus BRIEF_DISPATCHED automatically triggers Telegram notification, stores in communications and audit_log, and emits TELEGRAM_MESSAGE_SENT', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';
    process.env.TELEGRAM_CHAT_ID = '-100987654321';

    let fetchCalled = false;
    let requestPayload = null;
    let targetUrl = '';

    globalThis.fetch = async (url, opts) => {
      fetchCalled = true;
      targetUrl = url;
      requestPayload = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          ok: true,
          result: {
            message_id: 994821,
            chat: { id: -100987654321 },
            date: 1787644900,
            text: requestPayload.text,
          },
        }),
      };
    };

    let telegramSentEventReceived = false;
    let telegramSentPayload = null;

    const unsub = agentEventBus.subscribe(AgentEvents.TELEGRAM_MESSAGE_SENT, (evt) => {
      telegramSentEventReceived = true;
      telegramSentPayload = evt.payload;
    });

    const correlationId = `corr_brief_tg_${Date.now()}`;

    // Publish BRIEF_DISPATCHED on Event Bus
    agentEventBus.publish(
      AgentEvents.BRIEF_DISPATCHED,
      {
        lead: {
          name: 'Lady Eleanor Vance',
          email: 'vance.familyoffice@mayfair-investments.co.uk',
          phone: '+447911123456',
          budget: 'AED 35,000,000',
        },
        recommendation: {
          community: 'Dubai Hills Estate Parkway Vistas',
        },
        correlationId,
      },
      { correlationId, sourceAgent: 'aida' }
    );

    // Allow async handlers on Event Bus to process
    await new Promise((resolve) => setTimeout(resolve, 150));

    unsub();

    // Assert fetch call to Telegram API
    assert.strictEqual(fetchCalled, true);
    assert.ok(targetUrl.includes('api.telegram.org/bot123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ/sendMessage'));
    assert.strictEqual(requestPayload.chat_id, '-100987654321');
    assert.ok(requestPayload.text.includes('Lady Eleanor Vance'));
    assert.ok(requestPayload.text.includes('vance.familyoffice@mayfair-investments.co.uk'));
    assert.ok(requestPayload.text.includes('+447911123456'));
    assert.ok(requestPayload.text.includes('AED 35,000,000'));
    assert.ok(requestPayload.text.includes('Dubai Hills Estate Parkway Vistas'));
    assert.ok(requestPayload.text.includes(correlationId));

    // Assert Event Bus TELEGRAM_MESSAGE_SENT was emitted
    assert.strictEqual(telegramSentEventReceived, true);
    assert.strictEqual(telegramSentPayload.telegramMessageId, 994821);
    assert.strictEqual(telegramSentPayload.chatId, '-100987654321');
    assert.strictEqual(telegramSentPayload.correlationId, correlationId);

    // Assert Communications storage in Supabase
    const comms = supabase.mockStore.communications || [];
    const commRecord = comms.find((c) => c.correlation_id === correlationId);
    assert.ok(commRecord, 'Communication record must exist in communications table');
    assert.strictEqual(commRecord.type, 'telegram');
    assert.strictEqual(commRecord.status, 'SENT');
    assert.strictEqual(commRecord.message_id, 994821);

    // Assert Audit Log in Supabase
    const auditLogs = supabase.mockStore.audit_logs || [];
    const auditRecord = auditLogs.find((a) => a.correlation_id === correlationId && a.action === 'TELEGRAM_MESSAGE_SENT');
    assert.ok(auditRecord, 'Audit log entry must exist in audit_log table');
  });

  test('3. Retries 3x on network failure before raising error', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test_token';
    process.env.TELEGRAM_CHAT_ID = 'test_chat';

    let attempts = 0;
    globalThis.fetch = async () => {
      attempts++;
      throw new Error('Telegram gateway timeout 504');
    };

    const client = new TelegramClient({
      botToken: 'test_token',
      chatId: 'test_chat',
      maxRetries: 3,
      retryDelayMs: 10,
    });

    try {
      await client.sendTelegramMessage('Test retry message', { correlationId: 'corr_retry_test' });
      assert.fail('Should have thrown error after 3 retries');
    } catch (err) {
      assert.strictEqual(attempts, 3);
      assert.ok(err.message.includes('Telegram dispatch failed after 3 attempts'));
    }
  });

  test('4. Handles missing environment variables gracefully with DISCONNECTED status', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;

    const client = new TelegramClient({
      botToken: '',
      chatId: '',
    });

    const result = await client.sendTelegramMessage('Test missing credentials', { correlationId: 'corr_missing_env' });
    assert.strictEqual(result.status, 'DISCONNECTED');
    assert.strictEqual(result.reason, 'missing_env_variable');
  });

  test('5. sendTelegramMessage top-level helper function dispatches successfully', async () => {
    process.env.TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.TELEGRAM_CHAT_ID = 'chat_123';

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: { message_id: 88123 },
      }),
    });

    const res = await sendTelegramMessage('Direct helper dispatch', { correlationId: 'corr_helper' });
    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.httpStatus, 200);
    assert.strictEqual(res.telegramMessageId, 88123);
  });
});
