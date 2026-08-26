/**
 * Integration Test: Website Private Wealth Upgrade & Sovereign Ingestion
 * Validates the quiet-luxury website experience, Opal simulator, confidential intake form,
 * Event Bus v1.1 publication, Supabase CRM record creation, and Mission Control V1 reflection.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import handler from '../../api/index.js';
import { supabase } from '../../src/db/supabase-client.js';

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

test('WEBSITE PRIVATE WEALTH: Public HTML Structure & Quiet Luxury System', async () => {
  const res = createMockRes();
  await handler({ url: '/', method: 'GET', headers: { host: 'www.emanuelrendas.com' } }, res);
  const out = res._get();

  assert.strictEqual(out.status, 200);
  assert.strictEqual(typeof out.body, 'string');
  assert.ok(out.body.includes('Private Wealth Advisory & Strategic'));
  assert.ok(out.body.includes('Capital Allocation'));
  assert.ok(out.body.includes('Palm Jumeirah Prime Freehold'));
  assert.ok(out.body.includes('Palm Jebel Ali Coastline'));
  assert.ok(out.body.includes('DIFC & Downtown Institutional'));
  assert.ok(out.body.includes('Dubai South & DWC Corridor'));
  assert.ok(out.body.includes('Interactive <span class="italic text-gold-champagne font-normal">Opal ROI Simulator</span>'));
  assert.ok(out.body.includes('id="private-mandate-form"'));
  assert.ok(out.body.includes('Conflict-Free Advisory'));
  assert.ok(out.body.includes('Statutory Escrow Law 8'));
});

test('WEBSITE PRIVATE WEALTH: Confidential Mandate Ingestion -> CRM & Event Bus', async () => {
  const initialInvestors = await supabase.fetchInvestors();
  const initialCount = initialInvestors.length;

  const res = createMockRes();
  const mandatePayload = {
    name: 'Lord Alistair Sterling',
    email: 'alistair@sterling-capital.co.uk',
    phone: '+442079460991',
    whatsapp: '+442079460991',
    preferred_channel: 'TELEGRAM',
    budget_aed: '30M+',
    capital_band: '30M+',
    horizon: 'Immediate',
    tax_jurisdiction: 'UK',
    strategic_focus: 'Palm Jebel Ali waterfront allocation with 10-Year Golden Visa structure',
    company: 'Sterling Capital Family Office',
  };

  await handler({
    url: '/api/assessment',
    method: 'POST',
    body: mandatePayload,
    headers: { 'content-type': 'application/json' },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.body.ok, true);
  assert.ok(out.body.investorId);

  // 1. Verify Investor saved to Supabase mockStore
  const updatedInvestors = await supabase.fetchInvestors();
  assert.strictEqual(updatedInvestors.length, initialCount + 1);

  const savedInvestor = updatedInvestors.find(inv => inv.email === 'alistair@sterling-capital.co.uk');
  assert.ok(savedInvestor);
  assert.strictEqual(savedInvestor.name, 'Lord Alistair Sterling');
  assert.strictEqual(savedInvestor.budget_aed, 30000000);
  assert.strictEqual(savedInvestor.segment, 'UK_NONDOM');
  assert.strictEqual(savedInvestor.golden_visa_eligible, true);
  assert.strictEqual(savedInvestor.preferred_channel, 'TELEGRAM');

  // 2. Verify Interaction Logged
  const logs = await supabase.fetchInteractionLogs();
  const webLog = logs.find(l => l.summary && l.summary.includes('Lord Alistair Sterling'));
  assert.ok(webLog);
  assert.strictEqual(webLog.channel, 'WEBSITE');
  assert.strictEqual(webLog.source_agent, 'MARK');

  // 3. Verify Mission Control State Aggregator reflects the new mandate
  const mcRes = createMockRes();
  await handler({
    url: '/api/v1/mission-control/v1-state',
    method: 'GET',
    headers: { host: 'api.emanuelrendas.com' },
  }, mcRes);

  const mcOut = mcRes._get();
  assert.strictEqual(mcOut.status, 200);
  assert.strictEqual(mcOut.body.success, true);
  assert.ok(mcOut.body.crmPipeline);
  assert.ok(mcOut.body.crmPipeline.totalPipelineAed >= 30000000);
  assert.ok(Array.isArray(mcOut.body.ingestionPulse));
});
