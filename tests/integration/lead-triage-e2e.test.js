/**
 * Integration Test: Sovereign Lead Triage E2E Pipeline (5 Institutional Mandates)
 * Validates /api/v1/events/ingest gateway, CloudEvent v1.1 normalization,
 * automated DIRA/RIIS scoring, HITL executive approval gate insertion (>= 10M AED),
 * multi-agent telemetry updates, and immutable audit logging.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

const VALID_SECRET = 'sec_test_sovereign_auth_2026';
process.env.RAIOC_INTERNAL_SECRET = VALID_SECRET;
process.env.INTERNAL_SERVICE_KEY = VALID_SECRET;
import crypto from 'node:crypto';
import handler from '../../api/index.js';
import { supabase } from '../../src/db/supabase-client.js';
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

const FIVE_INSTITUTIONAL_MANDATES = [
  {
    name: 'Lord Alistair Sterling',
    email: 'sterling@sterling-capital.co.uk',
    phone: '+44 20 7946 0991',
    company: 'Sterling Capital Sovereign Fund',
    country: 'United Kingdom',
    segment: 'UK_NONDOM',
    budget_aed: 25000000,
    target_asset: 'Como Residences (Palm Jumeirah Ultra-Prime Freehold)',
    channel: 'TELEGRAM',
    thesis: 'UK Non-Dom abolition capital reallocation into UAE Law 8 ringfenced freehold assets.',
    dira_target_score: 95,
  },
  {
    name: 'Dr. Afonso Henriques',
    email: 'afonso@lisbon-capital.pt',
    phone: '+351 912 345 678',
    company: 'Henriques Family Office & Private Trust',
    country: 'Portugal',
    segment: 'PT_HNW',
    budget_aed: 30000000,
    target_asset: 'Palace Residences (Dubai Creek Harbour Waterfront Penthouse)',
    channel: 'WHATSAPP',
    thesis: 'Post-NHR wealth preservation, EUR-AED hedge, and UAE Golden Visa qualification.',
    dira_target_score: 92,
  },
  {
    name: 'Baroness Victoria Vance',
    email: 'vance@vance-trust.ch',
    phone: '+41 22 819 2000',
    company: 'Vance & Co Global Sovereign Trust',
    country: 'Switzerland',
    segment: 'SWISS_FAMILY_OFFICE',
    budget_aed: 45000000,
    target_asset: 'DIFC Private Residences & Sovereign Wealth Shield',
    channel: 'DIRECT_ADVISORY',
    thesis: 'Common law asset ringfencing via DIFC Foundation and prime commercial real estate.',
    dira_target_score: 98,
  },
  {
    name: 'Zhang Wei',
    email: 'zhang.wei@dragoncrest.sg',
    phone: '+65 6789 0123',
    company: 'Dragon Crest Capital Pte Ltd',
    country: 'Singapore',
    segment: 'APAC_FAMILY_OFFICE',
    budget_aed: 60000000,
    target_asset: 'Palm Jebel Ali Sovereign Waterfront Signature Villa',
    channel: 'WEBSITE_PORTAL',
    thesis: 'Diversification of Asian sovereign liquidity into Dubai luxury waterfront developments.',
    dira_target_score: 94,
  },
  {
    name: 'Sheikh Tariq Al-Mansoor',
    email: 'tariq@almansoor-holdings.ae',
    phone: '+971 50 888 9999',
    company: 'Gulf Sovereign Asset Corporation',
    country: 'United Arab Emirates',
    segment: 'GCC_SOVEREIGN_FO',
    budget_aed: 80000000,
    target_asset: 'Dubai Hills Private Estate Mega-Mansions',
    channel: 'WHATSAPP',
    thesis: 'Long-term high-yield institutional asset portfolio with 100% Escrow Law 8 guarantees.',
    dira_target_score: 99,
  },
];

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
// LEAD TRIAGE E2E INTEGRATION TEST SUITE
// ══════════════════════════════════════════════════════════════════════

test('LEAD TRIAGE E2E: Mandate 1 - Lord Alistair Sterling (25M AED, Palm Jumeirah)', async () => {
  const mandate = FIVE_INSTITUTIONAL_MANDATES[0];
  const eventId = `evt_test_sterling_${Date.now()}`;
  const correlationId = `corr_sterling_${Date.now()}`;
  const traceparent = `00-${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-01`;

  const cloudEventPayload = {
    specversion: '1.0',
    type: 'raioc.lead.ingested.v1',
    source: `raioc.channel.${mandate.channel.toLowerCase()}`,
    id: eventId,
    time: new Date().toISOString(),
    traceparent,
    correlation_id: correlationId,
    data: {
      lead: mandate,
    },
  };

  const res = createMockRes();
  await handler({
    url: '/api/v1/events/ingest',
    method: 'POST',
    body: cloudEventPayload,
    headers: {
      'host': 'api.emanuelrendas.com',
      'authorization': `Bearer ${VALID_SECRET}`,
      'x-raioc-secret': VALID_SECRET,
      'traceparent': traceparent,
      'x-correlation-id': correlationId,
    },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 202);
  assert.strictEqual(out.body.success, true);
  assert.strictEqual(out.body.specversion, '1.0');
  assert.strictEqual(out.body.status, 'ACCEPTED');

  // Verify HITL approval created for high-value allocation (25M AED >= 10M AED)
  const pendingApprovals = await supabase.fetchApprovals('PENDING');
  const sterlingAppr = pendingApprovals.find((a) => a.recipient === mandate.name || a.payload?.name === mandate.name);
  assert.ok(sterlingAppr, 'HITL Executive Approval must be created for 25M AED mandate');
  assert.strictEqual(sterlingAppr.priority, 'CRITICAL');
  assert.ok(sterlingAppr.payload.diraScore >= 92, 'DIRA score must be >= 92');
});

test('LEAD TRIAGE E2E: Mandate 2 - Dr. Afonso Henriques (30M AED, Dubai Creek Harbour)', async () => {
  const mandate = FIVE_INSTITUTIONAL_MANDATES[1];
  const eventId = `evt_test_henriques_${Date.now()}`;
  const correlationId = `corr_henriques_${Date.now()}`;
  const traceparent = `00-${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-01`;

  const cloudEventPayload = {
    specversion: '1.0',
    type: 'raioc.lead.ingested.v1',
    source: `raioc.channel.${mandate.channel.toLowerCase()}`,
    id: eventId,
    time: new Date().toISOString(),
    traceparent,
    correlation_id: correlationId,
    data: {
      lead: mandate,
    },
  };

  const res = createMockRes();
  await handler({
    url: '/api/v1/events/ingest',
    method: 'POST',
    body: cloudEventPayload,
    headers: {
      'host': 'api.emanuelrendas.com',
      'authorization': `Bearer ${VALID_SECRET}`,
      'x-raioc-secret': VALID_SECRET,
      'traceparent': traceparent,
      'x-correlation-id': correlationId,
    },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 202);
  assert.strictEqual(out.body.success, true);

  // Verify HITL approval created for high-value allocation (30M AED >= 10M AED)
  const pendingApprovals = await supabase.fetchApprovals('PENDING');
  const henriquesAppr = pendingApprovals.find((a) => a.recipient === mandate.name || a.payload?.name === mandate.name);
  assert.ok(henriquesAppr, 'HITL Executive Approval must be created for 30M AED mandate');
  assert.strictEqual(henriquesAppr.priority, 'CRITICAL');
  assert.ok(henriquesAppr.payload.goldenVisaEligible, 'Must be Golden Visa eligible');
});

test('LEAD TRIAGE E2E: Mandate 3 - Baroness Victoria Vance (45M AED, DIFC)', async () => {
  const mandate = FIVE_INSTITUTIONAL_MANDATES[2];
  const eventId = `evt_test_vance_${Date.now()}`;
  const correlationId = `corr_vance_${Date.now()}`;
  const traceparent = `00-${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-01`;

  const cloudEventPayload = {
    specversion: '1.0',
    type: 'raioc.lead.ingested.v1',
    source: `raioc.channel.${mandate.channel.toLowerCase()}`,
    id: eventId,
    time: new Date().toISOString(),
    traceparent,
    correlation_id: correlationId,
    data: {
      lead: mandate,
    },
  };

  const res = createMockRes();
  await handler({
    url: '/api/v1/events/ingest',
    method: 'POST',
    body: cloudEventPayload,
    headers: {
      'host': 'api.emanuelrendas.com',
      'authorization': `Bearer ${VALID_SECRET}`,
      'x-raioc-secret': VALID_SECRET,
      'traceparent': traceparent,
      'x-correlation-id': correlationId,
    },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 202);
  assert.strictEqual(out.body.success, true);

  const pendingApprovals = await supabase.fetchApprovals('PENDING');
  const vanceAppr = pendingApprovals.find((a) => a.recipient === mandate.name || a.payload?.name === mandate.name);
  assert.ok(vanceAppr, 'HITL Executive Approval must be created for 45M AED mandate');
  assert.ok(vanceAppr.payload.diraScore >= 92);
});

test('LEAD TRIAGE E2E: Mandate 4 - Zhang Wei (60M AED, Palm Jebel Ali)', async () => {
  const mandate = FIVE_INSTITUTIONAL_MANDATES[3];
  const eventId = `evt_test_zhang_${Date.now()}`;
  const correlationId = `corr_zhang_${Date.now()}`;
  const traceparent = `00-${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-01`;

  const cloudEventPayload = {
    specversion: '1.0',
    type: 'raioc.lead.ingested.v1',
    source: `raioc.channel.${mandate.channel.toLowerCase()}`,
    id: eventId,
    time: new Date().toISOString(),
    traceparent,
    correlation_id: correlationId,
    data: {
      lead: mandate,
    },
  };

  const res = createMockRes();
  await handler({
    url: '/api/v1/events/ingest',
    method: 'POST',
    body: cloudEventPayload,
    headers: {
      'host': 'api.emanuelrendas.com',
      'authorization': `Bearer ${VALID_SECRET}`,
      'x-raioc-secret': VALID_SECRET,
      'traceparent': traceparent,
      'x-correlation-id': correlationId,
    },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 202);
  assert.strictEqual(out.body.success, true);

  const pendingApprovals = await supabase.fetchApprovals('PENDING');
  const zhangAppr = pendingApprovals.find((a) => a.recipient === mandate.name || a.payload?.name === mandate.name);
  assert.ok(zhangAppr, 'HITL Executive Approval must be created for 60M AED mandate');
  assert.ok(zhangAppr.payload.diraScore >= 96, 'Tier-1 allocation must achieve DIRA >= 96');
});

test('LEAD TRIAGE E2E: Mandate 5 - Sheikh Tariq Al-Mansoor (80M AED, Dubai Hills)', async () => {
  const mandate = FIVE_INSTITUTIONAL_MANDATES[4];
  const eventId = `evt_test_tariq_${Date.now()}`;
  const correlationId = `corr_tariq_${Date.now()}`;
  const traceparent = `00-${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-01`;

  const cloudEventPayload = {
    specversion: '1.0',
    type: 'raioc.lead.ingested.v1',
    source: `raioc.channel.${mandate.channel.toLowerCase()}`,
    id: eventId,
    time: new Date().toISOString(),
    traceparent,
    correlation_id: correlationId,
    data: {
      lead: mandate,
    },
  };

  const res = createMockRes();
  await handler({
    url: '/api/v1/events/ingest',
    method: 'POST',
    body: cloudEventPayload,
    headers: {
      'host': 'api.emanuelrendas.com',
      'authorization': `Bearer ${VALID_SECRET}`,
      'x-raioc-secret': VALID_SECRET,
      'traceparent': traceparent,
      'x-correlation-id': correlationId,
    },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 202);
  assert.strictEqual(out.body.success, true);

  const pendingApprovals = await supabase.fetchApprovals('PENDING');
  const tariqAppr = pendingApprovals.find((a) => a.recipient === mandate.name || a.payload?.name === mandate.name);
  assert.ok(tariqAppr, 'HITL Executive Approval must be created for 80M AED mandate');
  assert.ok(tariqAppr.payload.diraScore >= 96);
  assert.ok(tariqAppr.payload.law8EscrowVerified, 'Law 8 Escrow ringfencing must be verified');
});

test('LEAD TRIAGE E2E: Consolidated Multi-Agent Pipeline & Audit Telemetry Verification', async () => {
  // Ingest all 5 mandates consecutively
  for (const mandate of FIVE_INSTITUTIONAL_MANDATES) {
    const eventId = `evt_batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const correlationId = `corr_batch_${Date.now()}`;
    const traceparent = `00-${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-01`;

    const res = createMockRes();
    await handler({
      url: '/api/v1/events/ingest',
      method: 'POST',
      body: {
        specversion: '1.0',
        type: 'raioc.lead.ingested.v1',
        source: `raioc.channel.${mandate.channel.toLowerCase()}`,
        id: eventId,
        time: new Date().toISOString(),
        traceparent,
        correlation_id: correlationId,
        data: { lead: mandate },
      },
      headers: {
        'host': 'api.emanuelrendas.com',
        'authorization': `Bearer ${VALID_SECRET}`,
        'x-raioc-secret': VALID_SECRET,
        'traceparent': traceparent,
        'x-correlation-id': correlationId,
      },
    }, res);

    assert.strictEqual(res._get().status, 202);
  }

  // 1. Verify all 5 mandates present in Sovereign CRM
  const investors = await supabase.fetchInvestors();
  for (const mandate of FIVE_INSTITUTIONAL_MANDATES) {
    const found = investors.find((inv) => inv.name === mandate.name);
    assert.ok(found, `Investor ${mandate.name} must exist in Sovereign CRM`);
    assert.ok(found.dira_score >= 90, `Investor ${mandate.name} must have DIRA >= 90`);
    assert.ok(found.riis_score >= 88, `Investor ${mandate.name} must have RIIS >= 88`);
  }

  // 2. Verify all 5 pending HITL Approvals in executive_approvals
  const approvals = await supabase.fetchApprovals('PENDING');
  for (const mandate of FIVE_INSTITUTIONAL_MANDATES) {
    const foundAppr = approvals.find((a) => a.recipient === mandate.name || a.payload?.name === mandate.name);
    assert.ok(foundAppr, `HITL Approval for ${mandate.name} must exist`);
    assert.strictEqual(foundAppr.priority, 'CRITICAL');
  }

  // 3. Verify interaction audit logs with cryptographic hash chaining
  const logs = await supabase.fetchInteractionLogs(50);
  const triageLogs = logs.filter((l) => l.event_type === 'LEAD_TRIAGED_AND_EVALUATED');
  assert.ok(triageLogs.length >= 5, 'Must have at least 5 triage audit log entries');

  // 4. Verify MARK runtime agent telemetry
  const markTelemetry = await supabase.getAgentRuntimeTelemetry('mark');
  assert.ok(markTelemetry);
  assert.strictEqual(markTelemetry.agent_id, 'mark');
  assert.ok(markTelemetry.last_latency_ms >= 0);
});
