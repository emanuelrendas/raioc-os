/**
 * Integration Test: AIDA Voice AI Gateway & ATLAS/LEX Opal ROI E2E Pipeline
 * Tests:
 * 1. Strict voice blockage when HITL executive approval is PENDING (HTTP 403)
 * 2. Voice dispatch authorization after HITL executive committee approval (HTTP 200)
 * 3. Mathematical precision of ATLAS ROI engine (Cap Rate, 5-Year IRR, 5-Year Cash Flow Pro-Forma)
 * 4. LEX Dubai Law No. 8 of 2007 Escrow Shield compliance and Institutional Memorandum generation
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

const VALID_SECRET = 'sec_test_sovereign_auth_2026';
process.env.RAIOC_INTERNAL_SECRET = VALID_SECRET;
process.env.INTERNAL_SERVICE_KEY = VALID_SECRET;
import crypto from 'node:crypto';
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
// 1. AIDA VOICE AI HITL APPROVAL GATE TESTS
// ══════════════════════════════════════════════════════════════════════

test('AIDA VOICE GATEWAY: Voice outreach blocked when HITL approval is PENDING (HTTP 403)', async () => {
  // 1. Create a high-value pending approval for Dr. Afonso Henriques (30M AED)
  const approval = await supabase.createApproval({
    id: `appr_voice_test_${Date.now()}`,
    title: 'High-Value Mandate Approval - Dr. Afonso Henriques',
    agent: 'MARK (Lead Triage Specialist)',
    category: 'HIGH_VALUE_MANDATE',
    priority: 'CRITICAL',
    status: 'PENDING',
    recipient: 'Dr. Afonso Henriques',
    targetAsset: 'Palace Residences (Dubai Creek Harbour)',
    payload: {
      budgetAed: 30000000,
      targetAsset: 'Palace Residences (Dubai Creek Harbour)',
      recipient: 'Dr. Afonso Henriques',
    },
  });

  const res = createMockRes();
  await handler({
    url: '/api/v1/communication/voice',
    method: 'POST',
    body: {
      recipient: 'Dr. Afonso Henriques',
      budgetAed: 30000000,
      targetAsset: 'Palace Residences (Dubai Creek Harbour)',
      intent: 'INVESTOR_FOLLOWUP',
      channel: 'WHATSAPP',
      approvalId: approval.id,
      checkApproval: true,
    },
    headers: {
      'host': 'api.emanuelrendas.com',
      'authorization': `Bearer ${VALID_SECRET}`,
    },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 403, 'Should return HTTP 403 Forbidden for pending approval');
  assert.strictEqual(out.body.success, false);
  assert.strictEqual(out.body.error, 'HITL_APPROVAL_REQUIRED');
  assert.strictEqual(out.body.status, 'PENDING');
  assert.strictEqual(out.body.approvalId, approval.id);
});

test('AIDA VOICE GATEWAY: Voice outreach successfully dispatched after HITL approval is GRANTED (HTTP 200)', async () => {
  // 1. Create and APPROVE the HITL record for Lord Alistair Sterling (25M AED)
  const approvalId = `appr_voice_sterling_${Date.now()}`;
  await supabase.createApproval({
    id: approvalId,
    title: 'High-Value Mandate Approval - Lord Alistair Sterling',
    agent: 'MARK (Lead Triage Specialist)',
    category: 'HIGH_VALUE_MANDATE',
    priority: 'CRITICAL',
    status: 'APPROVED',
    recipient: 'Lord Alistair Sterling',
    targetAsset: 'Como Residences (Palm Jumeirah)',
    payload: {
      budgetAed: 25000000,
      targetAsset: 'Como Residences (Palm Jumeirah)',
      recipient: 'Lord Alistair Sterling',
    },
  });

  // Track dispatched event
  let dispatchedEventCaptured = null;
  const unsub = enterpriseEventBus.subscribe('raioc.voice.outreach_dispatched.v1', (data) => {
    dispatchedEventCaptured = data;
  });

  const res = createMockRes();
  await handler({
    url: '/api/v1/communication/voice',
    method: 'POST',
    body: {
      recipient: 'Lord Alistair Sterling',
      budgetAed: 25000000,
      targetAsset: 'Como Residences (Palm Jumeirah)',
      intent: 'INVESTOR_FOLLOWUP',
      channel: 'WHATSAPP',
      approvalId: approvalId,
      script: 'Good afternoon Lord Sterling. Emanuel Rendas here with the audited Law 8 escrow allocation dossier for Como Residences.',
    },
    headers: {
      'host': 'api.emanuelrendas.com',
      'authorization': `Bearer ${VALID_SECRET}`,
    },
  }, res);

  unsub();

  const out = res._get();
  assert.strictEqual(out.status, 200, 'Should return HTTP 200 OK after approval');
  assert.strictEqual(out.body.success, true);
  assert.strictEqual(out.body.status, 'DISPATCHED');
  assert.ok(out.body.audio, 'Audio payload must be generated');
  assert.strictEqual(out.body.audio.voiceId, 'AidaExecutiveDubaiWealthV1');
  assert.ok(out.body.audio.durationSeconds > 0, 'Duration must be positive');
  assert.ok(out.body.audio.sha256, 'SHA-256 hash must be generated');

  // Verify Event Bus v1.1 emission
  assert.ok(dispatchedEventCaptured, 'raioc.voice.outreach_dispatched.v1 must be emitted');
  assert.strictEqual(dispatchedEventCaptured.recipient, 'Lord Alistair Sterling');
  assert.strictEqual(dispatchedEventCaptured.approvalId, approvalId);
});

// ══════════════════════════════════════════════════════════════════════
// 2. ATLAS & LEX OPAL ROI ENGINE & STATUTORY COMPLIANCE TESTS
// ══════════════════════════════════════════════════════════════════════

test('ATLAS & LEX OPAL ROI: Mathematical Precision of Cap Rate, 5-Year IRR & Cash Flows', async () => {
  const purchasePriceAed = 20000000; // 20M AED
  const unitSizeSqft = 3500;
  const annualRentAed = 1400000; // 7.0% Gross Rent
  const serviceChargePerSqft = 20; // 20 AED/sqft -> 70,000 AED/yr
  const expectedNoi = annualRentAed - (serviceChargePerSqft * unitSizeSqft); // 1,330,000 AED
  const expectedCapRate = (expectedNoi / purchasePriceAed) * 100; // 6.65%

  const res = createMockRes();
  await handler({
    url: '/api/opal/roi',
    method: 'POST',
    body: {
      purchasePriceAed,
      unitSizeSqft,
      expectedAnnualRentAed: annualRentAed,
      serviceChargePerSqft,
      capitalGrowthRate: 0.05,
      rentalGrowthRate: 0.04,
    },
    headers: {
      'host': 'api.emanuelrendas.com',
    },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.body.success, true);
  assert.strictEqual(out.body.tool, 'google_opal_roi_engine');

  const { financialMetrics, fiveYearProForma } = out.body;

  // 1. Cap Rate & Yield Precision
  assert.strictEqual(financialMetrics.capRate, Number(expectedCapRate.toFixed(2)));
  assert.strictEqual(financialMetrics.netOperatingIncomeAed, expectedNoi);
  assert.ok(financialMetrics.fiveYearIrr >= 8.0 && financialMetrics.fiveYearIrr <= 20.0, '5-Year IRR should be realistic (8-20%)');

  // 2. 5-Year Pro-Forma Cash Flows Validation
  assert.strictEqual(fiveYearProForma.length, 5);
  assert.strictEqual(fiveYearProForma[0].year, 1);
  assert.strictEqual(fiveYearProForma[4].year, 5);
  assert.ok(fiveYearProForma[4].assetValuationAed > purchasePriceAed, 'Year 5 valuation must reflect compounding capital appreciation');
  assert.ok(fiveYearProForma[4].netCashFlowAed > fiveYearProForma[4].netOperatingIncomeAed, 'Year 5 cash flow must include terminal exit value');
});

test('ATLAS & LEX OPAL ROI: Dubai Law No. 8 of 2007 Escrow Shield & Institutional Memorandum Generation', async () => {
  const purchasePriceAed = 45000000; // Baroness Victoria Vance 45M Mandate

  const res = createMockRes();
  await handler({
    url: '/api/opal/roi',
    method: 'POST',
    body: {
      purchasePriceAed,
      unitSizeSqft: 6000,
      expectedAnnualRentAed: 3150000,
      serviceChargePerSqft: 25,
    },
    headers: {
      'host': 'api.emanuelrendas.com',
    },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.body.success, true);

  // 1. Statutory Shield & Law 8 Verification
  const { statutoryShield, institutionalMemorandum } = out.body;
  assert.strictEqual(statutoryShield.goldenVisaEligible, true);
  assert.match(statutoryShield.escrowProtection, /Dubai Law No\. \(8\) of 2007/i);
  assert.match(statutoryShield.decennialLiability, /UAE Civil Code Art\. 880/i);

  // 2. Institutional Memorandum Verification
  assert.ok(institutionalMemorandum, 'Institutional Memorandum must be generated');
  assert.ok(institutionalMemorandum.id.startsWith('MEMO-OPAL-'));
  assert.strictEqual(institutionalMemorandum.status, 'CERTIFIED_BY_LEX_AND_ATLAS');
  assert.match(institutionalMemorandum.markdown, /INSTITUTIONAL REAL ESTATE INVESTMENT MEMORANDUM/i);
  assert.match(institutionalMemorandum.markdown, /AED 45,000,000/i);
  assert.match(institutionalMemorandum.markdown, /Dubai Law No\. \(8\) of 2007/i);
});
