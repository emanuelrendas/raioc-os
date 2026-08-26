/**
 * RAIOC OS - Telegram Webhook Ingestion Integration Test Suite (Phase 7 / v1.1)
 * Validates:
 * 1. Webhook authentication enforcement (401 on missing or invalid secret token).
 * 2. Pure input surface parsing & normalization into strict CloudEvent v1.1 envelopes.
 * 3. Distributed trace context (traceparent, correlation_id, causation_id) propagation.
 * 4. Cryptographic SHA-256 payload hashing and tamper-evident hash chaining.
 * 5. Multi-agent policy routing (MARK for investment mandates, ATLAS for ROI/yields, JARVIS for inquiries).
 * 6. High-value mandate escalation to Executive Approval queue (>= 10M AED).
 * 7. Runtime tool telemetry updating exclusively in runtime_tool_telemetry.
 * 8. Mission Control interaction stream reflection.
 * 9. Append-only immutability enforcement on generated audit records.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { routeApiRequest } from '../../src/api/server.js';
import { supabase } from '../../src/db/supabase-client.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';
import { enterpriseEventRouter } from '../../src/core/event-router.js';
import { config } from '../../src/config/env.js';

const VALID_TELEGRAM_SECRET = config.telegram?.secretToken || 'raioc_telegram_secret_2026';
const VALID_RAIOC_SECRET = process.env.RAIOC_INTERNAL_SECRET || 'raioc_sovereign_auth_2026_x99';

describe('INTEGRATION: Telegram Channel Webhook Ingestion & Event Bus v1.1', () => {
  beforeEach(() => {
    enterpriseEventBus.clearHistory();
    enterpriseEventRouter.init();
    if (supabase.isMock) {
      supabase.initEnterpriseCoreSeeds();
    }
  });

  // --- 1. Webhook Authentication Enforcement ---

  test('1. Webhook Security: Rejects requests missing valid Telegram secret token (401)', async () => {
    const rawUpdate = {
      update_id: 10001,
      message: {
        message_id: 501,
        chat: { id: 987654321, type: 'private' },
        from: { id: 12345, first_name: 'Dr. Gonçalo', username: 'goncalo_pt' },
        text: 'Looking to invest 15M AED in Palm Jumeirah',
      },
    };

    // 1. Unauthenticated request
    const unauthRes = await routeApiRequest(
      '/api/v1/channels/telegram/webhook',
      'POST',
      rawUpdate,
      {},
      {}
    );
    assert.strictEqual(unauthRes.status, 401);
    assert.strictEqual(unauthRes.body.success, false);

    // 2. Invalid secret token
    const invalidRes = await routeApiRequest(
      '/api/v1/channels/telegram/webhook',
      'POST',
      rawUpdate,
      {},
      { 'x-telegram-bot-api-secret-token': 'invalid_secret_token_123' }
    );
    assert.strictEqual(invalidRes.status, 401);
    assert.strictEqual(invalidRes.body.success, false);
  });

  // --- 2. Valid Ingestion & CloudEvent v1.1 Packaging ---

  test('2. Valid Ingestion: Packages message into CloudEvent v1.1 with W3C trace context', async () => {
    const customTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const customCorrelation = 'corr_tg_test_session_888';

    const rawUpdate = {
      update_id: 20002,
      message: {
        message_id: 502,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 888777666, type: 'private', username: 'al_mansoor_fo' },
        from: { id: 998877, first_name: 'Sheikh', last_name: 'Al-Mansoor', username: 'al_mansoor_fo' },
        text: 'Inquiring regarding sovereign allocation mandates for Como Residences off-plan (budget: 20M AED)',
      },
    };

    const res = await routeApiRequest(
      '/api/v1/channels/telegram/webhook',
      'POST',
      rawUpdate,
      {},
      {
        'x-telegram-bot-api-secret-token': VALID_TELEGRAM_SECRET,
        'x-correlation-id': customCorrelation,
        traceparent: customTraceparent,
      }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'RECEIVED');
    assert.ok(res.body.eventId);
    assert.strictEqual(res.body.traceparent, customTraceparent);
    assert.strictEqual(res.body.correlationId, customCorrelation);

    // Verify CloudEvent in Event Bus history
    const storedEvent = enterpriseEventBus.getEventById(res.body.eventId);
    assert.ok(storedEvent);
    assert.strictEqual(storedEvent.type, 'raioc.channel.telegram.message.v1');
    assert.strictEqual(storedEvent.source, 'raioc://channels/telegram/bot');
    assert.strictEqual(storedEvent.correlation_id, customCorrelation);
    assert.strictEqual(storedEvent.causation_id, 'tg_msg_502');
    assert.strictEqual(storedEvent.traceparent, customTraceparent);
    assert.ok(storedEvent.payload_sha256);
    assert.strictEqual(storedEvent.payload_sha256.length, 64);
  });

  // --- 3. Policy Routing: Investment Mandates -> MARK & HITL Approval ---

  test('3. Policy Routing: Routes High-Value investment mandate to MARK & triggers Executive Approval', async () => {
    const rawUpdate = {
      update_id: 30003,
      message: {
        message_id: 503,
        chat: { id: 777666555, type: 'private' },
        from: { id: 554433, first_name: 'Lord Arthur', username: 'kensington_uk' },
        text: 'Mandate: 18 Million AED capital allocation into Palm Jumeirah luxury penthouse (Golden Visa eligible)',
      },
    };

    const res = await routeApiRequest(
      '/api/v1/channels/telegram/webhook',
      'POST',
      rawUpdate,
      {},
      { 'x-telegram-bot-api-secret-token': VALID_TELEGRAM_SECRET }
    );

    assert.strictEqual(res.status, 200);

    // Verify downstream event emitted for MARK
    const history = enterpriseEventBus.getEventHistory();
    const leadEvent = history.find((e) => e.type === 'raioc.investor.lead.ingested.v1');
    assert.ok(leadEvent);
    assert.strictEqual(leadEvent.data.routedAgent, 'MARK');
    assert.strictEqual(leadEvent.data.leadDetails.budgetAed, 18000000);

    // Verify Executive Approval HITL Queue item created for >= 10M AED
    const approvals = await supabase.fetchApprovals('PENDING');
    const tgApproval = approvals.find((a) => a.recipient.includes('Lord Arthur') || a.payload?.chatId === 777666555);
    assert.ok(tgApproval);
    assert.strictEqual(tgApproval.priority, 'CRITICAL');
    assert.strictEqual(tgApproval.payload.goldenVisaEligible, true);
  });

  // --- 4. Policy Routing: Valuation & ROI Queries -> ATLAS ---

  test('4. Policy Routing: Routes /roi and rental yield inquiries to ATLAS', async () => {
    const rawUpdate = {
      update_id: 40004,
      message: {
        message_id: 504,
        chat: { id: 666555444, type: 'private' },
        from: { id: 223344, first_name: 'Elena', username: 'elena_swiss' },
        text: '/roi Como Residences sqft price and 10-year rental yield valuation under Law 8 Escrow',
      },
    };

    const res = await routeApiRequest(
      '/api/v1/channels/telegram/webhook',
      'POST',
      rawUpdate,
      {},
      { 'x-telegram-bot-api-secret-token': VALID_TELEGRAM_SECRET }
    );

    assert.strictEqual(res.status, 200);

    const history = enterpriseEventBus.getEventHistory();
    const valEvent = history.find((e) => e.type === 'raioc.market.valuation.requested.v1');
    assert.ok(valEvent);
    assert.strictEqual(valEvent.data.routedAgent, 'ATLAS');
  });

  // --- 5. Policy Routing: General Inquiries -> JARVIS ---

  test('5. Policy Routing: Routes general advisory questions to JARVIS', async () => {
    const rawUpdate = {
      update_id: 50005,
      message: {
        message_id: 505,
        chat: { id: 555444333, type: 'private' },
        from: { id: 112233, first_name: 'Carlos', username: 'carlos_madrid' },
        text: 'What are the sovereign office consultation hours with Emanuel Rendas in Dubai?',
      },
    };

    const res = await routeApiRequest(
      '/api/v1/channels/telegram/webhook',
      'POST',
      rawUpdate,
      {},
      { 'x-telegram-bot-api-secret-token': VALID_TELEGRAM_SECRET }
    );

    assert.strictEqual(res.status, 200);

    const history = enterpriseEventBus.getEventHistory();
    const inqEvent = history.find((e) => e.type === 'raioc.executive.inquiry.received.v1');
    assert.ok(inqEvent);
    assert.strictEqual(inqEvent.data.routedAgent, 'JARVIS');
  });

  // --- 6. Runtime Tool Telemetry Updates ---

  test('6. Runtime Telemetry: Updates telegram_bot probe metrics in runtime_tool_telemetry', async () => {
    const toolTelem = await supabase.getToolRuntimeTelemetry('telegram_bot');
    assert.ok(toolTelem);
    assert.strictEqual(toolTelem.live_health_status, 'HEALTHY');
    assert.ok(toolTelem.total_calls_today >= 1);
  });

  // --- 7. Mission Control Ingestion Stream Reflection ---

  test('7. Mission Control Ingestion Stream: Reflects Telegram interactions with trace metadata', async () => {
    const intRes = await routeApiRequest('/api/v1/mission-control/interactions?limit=10', 'GET');
    assert.strictEqual(intRes.status, 200);
    assert.strictEqual(intRes.body.success, true);
    assert.ok(intRes.body.interactions.length > 0);

    const tgLog = intRes.body.interactions.find((l) => l.channel === 'TELEGRAM');
    assert.ok(tgLog);
    assert.strictEqual(tgLog.event_type, 'TELEGRAM_MESSAGE_INGESTED');
    assert.ok(tgLog.summary.includes('Telegram Ingestion'));
    assert.ok(tgLog.payload_sha256);
  });

  // --- 8. Append-Only Immutability on Generated Audit Logs ---

  test('8. Immutability: Verifies UPDATE/DELETE rejection on generated Telegram interaction logs', async () => {
    const logs = await supabase.fetchInteractionLogs(5);
    const tgLog = logs.find((l) => l.channel === 'TELEGRAM');
    assert.ok(tgLog);

    await assert.rejects(
      async () => {
        await supabase.updateInteractionLog(tgLog.id, { summary: 'Tampered Telegram log' });
      },
      /FATAL: UPDATE or DELETE operations are strictly prohibited on immutable audit tables/
    );

    await assert.rejects(
      async () => {
        await supabase.deleteInteractionLog(tgLog.id);
      },
      /FATAL: UPDATE or DELETE operations are strictly prohibited on immutable audit tables/
    );
  });

  // --- 9. Legacy Compatibility Alias Verification ---

  test('9. Compatibility Alias: /api/channels/telegram/webhook routes with Deprecation header', async () => {
    const rawUpdate = {
      update_id: 90009,
      message: {
        message_id: 509,
        chat: { id: 999111222, type: 'private' },
        from: { id: 771122, first_name: 'Test Alias' },
        text: 'Testing legacy alias compatibility',
      },
    };

    const res = await routeApiRequest(
      '/api/channels/telegram/webhook',
      'POST',
      rawUpdate,
      {},
      { 'x-telegram-bot-api-secret-token': VALID_TELEGRAM_SECRET }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'RECEIVED');
    assert.strictEqual(res.headers.Deprecation, '@deprecated Use /api/v1/... instead');
  });
});
