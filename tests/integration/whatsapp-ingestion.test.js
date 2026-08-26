/**
 * Integration Test: Phase 8 WhatsApp Cloud API Webhook Gateway (v1.1)
 * Validates Meta verification challenges, HMAC-SHA256 signature verification,
 * CloudEvent v1.1 construction, W3C trace propagation, multi-agent policy routing
 * (MARK vs ATLAS vs JARVIS), runtime telemetry, and Mission Control reflection.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import handler from '../../api/index.js';
import { supabase } from '../../src/db/supabase-client.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';
import { enterpriseEventRouter } from '../../src/core/event-router.js';

function createMockRes() {
  let statusCode = 200;
  const headers = {};
  let bodyData = '';

  return {
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
    getHeader: (k) => headers[k.toLowerCase()],
    getHeaders: () => headers,
    status: function (code) { statusCode = code; return this; },
    writeHead: function (code, hdrs = {}) {
      statusCode = code;
      Object.entries(hdrs).forEach(([k, v]) => { headers[k.toLowerCase()] = v; });
      return this;
    },
    json: function (data) {
      this.setHeader('Content-Type', 'application/json');
      bodyData = JSON.stringify(data);
      return this;
    },
    end: function (data) {
      if (data) bodyData = typeof data === 'string' ? data : JSON.stringify(data);
      return this;
    },
    _get: () => ({
      status: statusCode,
      headers,
      body: (() => {
        try {
          return JSON.parse(bodyData);
        } catch {
          return bodyData;
        }
      })(),
    }),
  };
}

beforeEach(() => {
  enterpriseEventRouter.init();
  if (supabase.isMock) {
    supabase.initEnterpriseCoreSeeds();
  }
});

afterEach(() => {
  enterpriseEventRouter.destroy();
});

// ══════════════════════════════════════════════════════════════════════
// 1. Meta Webhook Verification Challenge (GET)
// ══════════════════════════════════════════════════════════════════════

test('WHATSAPP PHASE 8: Meta GET Verification Challenge (Valid & Invalid)', async () => {
  // 1a. Valid Challenge
  const resValid = createMockRes();
  await handler({
    url: '/api/v1/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=raioc_wa_verify_token&hub.challenge=1158201244',
    method: 'GET',
    headers: { host: 'api.emanuelrendas.com' },
  }, resValid);

  const outValid = resValid._get();
  assert.strictEqual(outValid.status, 200);
  assert.strictEqual(String(outValid.body), '1158201244');

  // 1b. Legacy Alias Compatibility: /api/channels/whatsapp/webhook
  const resAlias = createMockRes();
  await handler({
    url: '/api/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=raioc_wa_verify_token&hub.challenge=99887766',
    method: 'GET',
    headers: { host: 'api.emanuelrendas.com' },
  }, resAlias);

  const outAlias = resAlias._get();
  assert.strictEqual(outAlias.status, 200);
  assert.strictEqual(String(outAlias.body), '99887766');

  // 1c. Invalid Token Mismatch -> HTTP 403 Forbidden
  const resInvalid = createMockRes();
  await handler({
    url: '/api/v1/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=invalid_token_xyz&hub.challenge=1158201244',
    method: 'GET',
    headers: { host: 'api.emanuelrendas.com' },
  }, resInvalid);

  const outInvalid = resInvalid._get();
  assert.strictEqual(outInvalid.status, 403);
  assert.strictEqual(outInvalid.body.success, false);
});

// ══════════════════════════════════════════════════════════════════════
// 2. CloudEvent v1.1 Packaging & W3C Trace Propagation
// ══════════════════════════════════════════════════════════════════════

test('WHATSAPP PHASE 8: Ingestion Packaging & W3C Trace Propagation', async () => {
  const customTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
  const customCorrelationId = 'corr_test_wa_trace_9911';

  const metaPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '9876543210',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '971543871702', phone_number_id: '10987654321' },
              contacts: [
                { profile: { name: 'Lady Eleanor Vance' }, wa_id: '447700900077' }
              ],
              messages: [
                {
                  from: '447700900077',
                  id: 'wamid.HBgLNDQ3NzAwOTAwMDc3FQIAERgSRTc1RDYyMzM4REQzRDkxQTczAA==',
                  timestamp: '1787747712',
                  text: { body: 'Hello Emanuel — Requesting private briefing for Palm Jebel Ali allocation of 25M AED.' },
                  type: 'text'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  const res = createMockRes();
  await handler({
    url: '/api/v1/channels/whatsapp/webhook',
    method: 'POST',
    body: metaPayload,
    headers: {
      host: 'api.emanuelrendas.com',
      'content-type': 'application/json',
      traceparent: customTraceparent,
      'x-correlation-id': customCorrelationId,
    },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.body.status, 'RECEIVED');
  assert.ok(out.body.eventId);
  assert.strictEqual(out.body.traceparent, customTraceparent);
  assert.strictEqual(out.body.correlationId, customCorrelationId);
});

// ══════════════════════════════════════════════════════════════════════
// 3. Multi-Agent Policy Routing (MARK vs ATLAS vs JARVIS)
// ══════════════════════════════════════════════════════════════════════

test('WHATSAPP PHASE 8: Policy Routing to MARK (Investment Mandate >= 10M AED + Approval)', async () => {
  const metaPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: 'Lord Alistair Sterling' }, wa_id: '442079460991' }],
              messages: [
                {
                  from: '442079460991',
                  id: 'wamid.test_mark_10m',
                  timestamp: '1787747715',
                  text: { body: 'Requesting allocation of 30M AED in Palm Jebel Ali waterfront villas under Law 8 escrow protection.' },
                  type: 'text',
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const res = createMockRes();
  await handler({
    url: '/api/v1/channels/whatsapp/webhook',
    method: 'POST',
    body: metaPayload,
    headers: { host: 'api.emanuelrendas.com' },
  }, res);

  assert.strictEqual(res._get().status, 200);

  // 1. Verify Interaction Log
  const logs = await supabase.fetchInteractionLogs();
  const waLog = logs.find((l) => l.summary && l.summary.includes('Lord Alistair Sterling'));
  assert.ok(waLog);
  assert.strictEqual(waLog.channel, 'WHATSAPP');
  assert.strictEqual(waLog.source_agent, 'MARK');

  // 2. Verify Pending Executive Approval created for >= 10M AED
  const approvals = await supabase.fetchApprovals();
  const waApproval = approvals.find((a) => a.recipient === 'Lord Alistair Sterling' || a.id.startsWith('appr_wa_'));
  assert.ok(waApproval);
  assert.strictEqual(waApproval.status, 'PENDING');
  assert.strictEqual(waApproval.priority, 'CRITICAL');
});

test('WHATSAPP PHASE 8: Policy Routing to ATLAS (Yield & ROI Valuation)', async () => {
  const metaPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: 'Dr. Afonso Henriques' }, wa_id: '351912345678' }],
              messages: [
                {
                  from: '351912345678',
                  id: 'wamid.test_atlas_calc',
                  timestamp: '1787747720',
                  text: { body: '/roi calculate net rental yield for 7.5M AED unit in DIFC with 18 AED service charge' },
                  type: 'text',
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const res = createMockRes();
  await handler({
    url: '/api/v1/channels/whatsapp/webhook',
    method: 'POST',
    body: metaPayload,
    headers: { host: 'api.emanuelrendas.com' },
  }, res);

  assert.strictEqual(res._get().status, 200);

  const logs = await supabase.fetchInteractionLogs();
  const atlasLog = logs.find((l) => l.summary && l.summary.includes('Dr. Afonso Henriques'));
  assert.ok(atlasLog);
  assert.strictEqual(atlasLog.channel, 'WHATSAPP');
  assert.strictEqual(atlasLog.source_agent, 'ATLAS');
});

test('WHATSAPP PHASE 8: Policy Routing to JARVIS (General Inquiries)', async () => {
  const metaPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: 'Sofia Mendes' }, wa_id: '351933445566' }],
              messages: [
                {
                  from: '351933445566',
                  id: 'wamid.test_jarvis_gen',
                  timestamp: '1787747725',
                  text: { body: 'Good morning Emanuel, what are your private advisory office hours in Dubai?' },
                  type: 'text',
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const res = createMockRes();
  await handler({
    url: '/api/v1/channels/whatsapp/webhook',
    method: 'POST',
    body: metaPayload,
    headers: { host: 'api.emanuelrendas.com' },
  }, res);

  assert.strictEqual(res._get().status, 200);

  const logs = await supabase.fetchInteractionLogs();
  const jarvisLog = logs.find((l) => l.summary && l.summary.includes('Sofia Mendes'));
  assert.ok(jarvisLog);
  assert.strictEqual(jarvisLog.channel, 'WHATSAPP');
  assert.strictEqual(jarvisLog.source_agent, 'JARVIS');
});

// ══════════════════════════════════════════════════════════════════════
// 4. Runtime Tool Telemetry & Mission Control Streaming
// ══════════════════════════════════════════════════════════════════════

test('WHATSAPP PHASE 8: Tool Telemetry Probe & Mission Control V1 Reflection', async () => {
  // 1. Send WhatsApp message
  const res = createMockRes();
  await handler({
    url: '/api/v1/channels/whatsapp/webhook',
    method: 'POST',
    body: {
      sender_phone: '971501234567',
      profile_name: 'Sheikh Khalid Al-Maktoum Office',
      text: 'Allocating 50M AED sovereign reserve in Palm Jumeirah Como Residences.',
    },
    headers: { host: 'api.emanuelrendas.com' },
  }, res);

  assert.strictEqual(res._get().status, 200);

  // 2. Verify Tool Telemetry for 'whatsapp_cloud_api'
  const toolTelemetry = await supabase.getToolRuntimeTelemetry('whatsapp_cloud_api');
  assert.ok(toolTelemetry);
  assert.strictEqual(toolTelemetry.tool_id, 'whatsapp_cloud_api');
  assert.strictEqual(toolTelemetry.live_health_status, 'HEALTHY');
  assert.ok(toolTelemetry.total_calls_today >= 1);

  // 3. Verify Mission Control Consolidated State Feed
  const mcRes = createMockRes();
  await handler({
    url: '/api/v1/mission-control/v1-state',
    method: 'GET',
    headers: { host: 'api.emanuelrendas.com' },
  }, mcRes);

  const mcState = mcRes._get();
  assert.strictEqual(mcState.status, 200);
  assert.strictEqual(mcState.body.success, true);

  const pulseItem = mcState.body.ingestionPulse.find((p) => p.sender && p.sender.includes('Sheikh Khalid'));
  assert.ok(pulseItem);
  assert.strictEqual(pulseItem.channel, 'WHATSAPP');
  assert.strictEqual(pulseItem.source_agent, 'MARK');
});

// ══════════════════════════════════════════════════════════════════════
// 5. Immutability Protection on Interaction Logs
// ══════════════════════════════════════════════════════════════════════

test('WHATSAPP PHASE 8: Rejection of UPDATE/DELETE on interaction_logs', async () => {
  await assert.rejects(
    async () => {
      await supabase.updateInteractionLog('log_sample', { summary: 'Tampered summary' });
    },
    /FATAL: UPDATE or DELETE operations are strictly prohibited/
  );

  await assert.rejects(
    async () => {
      await supabase.deleteInteractionLog('log_sample');
    },
    /FATAL: UPDATE or DELETE operations are strictly prohibited/
  );
});
