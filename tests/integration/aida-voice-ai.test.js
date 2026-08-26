/**
 * Integration Test: AIDA Voice AI Capability Upgrade
 * Validates Voice AI request ingestion, prompt routing (followup, objections, outreach, call support),
 * fallback resilience, W3C trace propagation, HITL approval triggers, telemetry, and audit immutability.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import handler from '../../api/index.js';
import { supabase } from '../../src/db/supabase-client.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';
import { enterpriseEventRouter } from '../../src/core/event-router.js';
import { voiceAi, VOICE_INTENTS, OBJECTION_CATEGORIES } from '../../src/core/voice-ai.js';
import { aidaCommunication, MESSAGE_TYPES } from '../../src/core/aida-communication.js';

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
// 1. Ingestion Endpoint Validation & HTTP Response Checks
// ══════════════════════════════════════════════════════════════════════

test('AIDA VOICE AI: Rejection of non-POST method (HTTP 405)', async () => {
  const res = createMockRes();
  await handler({
    url: '/api/v1/communication/voice',
    method: 'GET',
    headers: { host: 'api.emanuelrendas.com' },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 405);
  assert.strictEqual(out.body.success, false);
});

test('AIDA VOICE AI: Rejection of invalid intent (HTTP 400)', async () => {
  const res = createMockRes();
  await handler({
    url: '/api/v1/communication/voice',
    method: 'POST',
    body: {
      intent: 'INVALID_SPAM_INTENT',
      recipient: 'Lord Alistair Sterling',
    },
    headers: { host: 'api.emanuelrendas.com' },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 400);
  assert.strictEqual(out.body.success, false);
  assert.match(out.body.error, /invalid voice intent/i);
});

test('AIDA VOICE AI: Legacy Route Deprecation Header on /api/communication/voice', async () => {
  const res = createMockRes();
  await handler({
    url: '/api/communication/voice',
    method: 'POST',
    body: {
      intent: 'INVESTOR_FOLLOWUP',
      recipient: 'Lord Arthur Kensington',
    },
    headers: { host: 'api.emanuelrendas.com' },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 200);
  assert.ok(out.headers.deprecation);
  assert.match(out.headers.deprecation, /@deprecated/);
  assert.strictEqual(out.body.status, 'RECEIVED');
  assert.strictEqual(out.body.intent, 'INVESTOR_FOLLOWUP');
});

// ══════════════════════════════════════════════════════════════════════
// 2. Executive Voice Synthesis & Objection Handling Use Cases
// ══════════════════════════════════════════════════════════════════════

test('AIDA VOICE AI: Synthesis for INVESTOR_FOLLOWUP and PREMIUM_OUTREACH', async () => {
  // 1. Investor Follow-up
  const followupResult = await voiceAi.synthesize(VOICE_INTENTS.INVESTOR_FOLLOWUP, {
    recipient: 'Lord Alistair Sterling',
    targetAsset: 'Como Residences in Palm Jumeirah',
    budgetAed: 25000000,
  });

  assert.strictEqual(followupResult.success, true);
  assert.strictEqual(followupResult.intent, VOICE_INTENTS.INVESTOR_FOLLOWUP);
  assert.ok(followupResult.script.length > 20);
  assert.ok(followupResult.audioSha256);
  assert.ok(followupResult.audioDurationSeconds > 0);
  assert.ok(followupResult.confidence >= 0.85);

  // 2. Premium Outreach
  const outreachResult = await voiceAi.synthesize(VOICE_INTENTS.PREMIUM_OUTREACH, {
    recipient: 'Baroness Helena Vance',
    targetAsset: 'The Oasis Super-Mansion Cluster',
  });

  assert.strictEqual(outreachResult.success, true);
  assert.strictEqual(outreachResult.intent, VOICE_INTENTS.PREMIUM_OUTREACH);
  assert.ok(outreachResult.script.includes('Baroness Helena Vance') || outreachResult.script.includes('dossier') || outreachResult.script.includes('Emanuel Rendas'));
});

test('AIDA VOICE AI: Objection Handling across Legal, Escrow & Golden Visa Categories', async () => {
  // 1. Off-Plan / Escrow Risk Objection
  const escrowObjection = await voiceAi.synthesize(VOICE_INTENTS.OBJECTION_HANDLING, {
    recipient: 'Dr. Afonso Henriques',
    objectionCategory: OBJECTION_CATEGORIES.OFF_PLAN_RISK,
    targetAsset: 'Palm Jebel Ali Fronds',
  });

  assert.strictEqual(escrowObjection.success, true);
  assert.match(escrowObjection.script, /escrow|law no\.? 8|rera/i);

  // 2. Golden Visa Objection
  const visaObjection = await voiceAi.synthesize(VOICE_INTENTS.OBJECTION_HANDLING, {
    recipient: 'Zhang Wei Family Office',
    objectionCategory: OBJECTION_CATEGORIES.GOLDEN_VISA,
    budgetAed: 18000000,
  });

  assert.strictEqual(visaObjection.success, true);
  assert.match(visaObjection.script, /golden visa|resolution no\.? 65|residency/i);
});

// ══════════════════════════════════════════════════════════════════════
// 3. W3C Trace Context Propagation & Full Event Bus Ingestion
// ══════════════════════════════════════════════════════════════════════

test('AIDA VOICE AI: End-to-End W3C Trace Propagation & Audit Record', async () => {
  const customTraceparent = '00-9bf73a4577b34da6a3ce929d0e0ea777-00f067aa0ba902b8-01';
  const customCorrelationId = 'corr_voice_sterling_v2_99';

  const res = createMockRes();
  await handler({
    url: '/api/v1/communication/voice',
    method: 'POST',
    body: {
      intent: 'OBJECTION_HANDLING',
      objectionCategory: 'TRUST',
      investorId: 'inv_sterling_001',
      recipient: 'Lord Alistair Sterling',
      channel: 'WHATSAPP',
      budgetAed: 25000000,
      targetAsset: 'Como Residences in Palm Jumeirah',
    },
    headers: {
      host: 'api.emanuelrendas.com',
      traceparent: customTraceparent,
      'x-correlation-id': customCorrelationId,
    },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.body.status, 'RECEIVED');
  assert.strictEqual(out.body.traceparent, customTraceparent);
  assert.strictEqual(out.body.correlationId, customCorrelationId);

  // 1. Verify Interaction Log Sanitization (NO raw base64 audio stored)
  const logs = await supabase.fetchInteractionLogs();
  const voiceLog = logs.find((l) => l.channel === 'VOICE_DISPATCH' && l.correlation_id === customCorrelationId);
  assert.ok(voiceLog, 'Voice interaction log should be recorded');
  assert.strictEqual(voiceLog.source_agent, 'AIDA');
  assert.strictEqual(voiceLog.direction, 'OUTBOUND');
  assert.strictEqual(voiceLog.traceparent, customTraceparent);
  assert.ok(voiceLog.payload.audioSha256);
  assert.strictEqual(voiceLog.payload.audioBase64, undefined); // Raw audio must be omitted

  // 2. Verify Pending HITL Approval created for High-Value Mandate (25M AED)
  const approvals = await supabase.fetchApprovals();
  const voiceApproval = approvals.find((a) => a.category === 'VOICE_BROADCAST' && a.recipient.includes('Sterling'));
  assert.ok(voiceApproval, 'Pending HITL Voice Approval must be created for high-value mandate');
  assert.strictEqual(voiceApproval.status, 'PENDING');
  assert.strictEqual(voiceApproval.priority, 'CRITICAL');
});

// ══════════════════════════════════════════════════════════════════════
// 4. Fallback Resilience & Circuit Breaker Protection
// ══════════════════════════════════════════════════════════════════════

test('AIDA VOICE AI: Circuit Breaker and Deterministic Fallback Output', async () => {
  // Synthesize directly using deterministic mode
  const fallback = voiceAi.deterministicVoiceSynthesis(VOICE_INTENTS.CALL_SUPPORT, {
    recipient: 'Princess Noura Al Saud',
    targetAsset: 'Armani Beach Residences',
  }, Date.now());

  assert.strictEqual(fallback.success, true);
  assert.strictEqual(fallback.provider, 'deterministic_sovereign_voice');
  assert.match(fallback.script, /Princess Noura Al Saud/);
  assert.match(fallback.script, /Emanuel Rendas/);
  assert.ok(fallback.audioSha256);
});

// ══════════════════════════════════════════════════════════════════════
// 5. Runtime Tool & Agent Telemetry
// ══════════════════════════════════════════════════════════════════════

test('AIDA VOICE AI: Telemetry Probes for Tool and Agent', async () => {
  // 1. Tool Telemetry Probe
  const toolTelemetry = await supabase.getToolRuntimeTelemetry('aida_voice_ai');
  assert.ok(toolTelemetry, 'aida_voice_ai telemetry record must exist');
  assert.strictEqual(toolTelemetry.tool_id, 'aida_voice_ai');
  assert.strictEqual(toolTelemetry.live_health_status, 'HEALTHY');
  assert.ok(toolTelemetry.total_calls_today >= 1);

  // 2. Agent Telemetry Probe
  const agentTelemetry = await supabase.getAgentRuntimeTelemetry('aida');
  assert.ok(agentTelemetry, 'aida agent telemetry record must exist');
  assert.strictEqual(agentTelemetry.agent_id, 'aida');
  assert.strictEqual(agentTelemetry.live_status, 'IDLE');
  assert.match(agentTelemetry.active_task, /voice note/i);
});

// ══════════════════════════════════════════════════════════════════════
// 6. Audit Log Immutability Protection
// ══════════════════════════════════════════════════════════════════════

test('AIDA VOICE AI: Rejection of UPDATE/DELETE on interaction_logs', async () => {
  await assert.rejects(
    async () => {
      await supabase.updateInteractionLog('log_sample', { summary: 'Tampered audio log' });
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
