/**
 * RAIOC OS - Integration Test: Dynamic Executive Brief Public Viewer (/brief/:id)
 * Validates that /brief/:id and /api/brief/:id return HTTP 200 and compiled HTML containing
 * the Client Dossier, RIIS Radial Gauge, Golden Visa Stamp (Cabinet Res. 65/2022),
 * Target Asset Cards (Manus Off-Plan), Net Yield Matrix, and 1-Click Meeting Booking Button.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { routeApiRequest } from '../../src/api/server.js';
import { supabase } from '../../src/db/supabase-client.js';
import { renderExecutiveBriefHtml } from '../../src/site/brief-viewer-html.js';
import serverlessHandler from '../../api/index.js';

describe('INTEGRATION: Dynamic Executive Brief Public Viewer at /brief/:id', () => {
  const sampleBriefId = 'brief_vip_investor_999';

  beforeEach(() => {
    supabase.isMock = true;
    supabase.mockStore.executive_briefs = [];

    // Seed test executive brief record
    supabase.mockStore.executive_briefs.push({
      id: sampleBriefId,
      lead_id: 'lead_sheikh_mansoor',
      company_name: 'Mansoor Sovereign Capital',
      executive_summary: 'Bespoke ultra-prime capital allocation brief for Mansoor Sovereign Capital with 10-Year Golden Visa statutory certification.',
      dira_tier: 'SOVEREIGN_INSTITUTIONAL',
      riis_score: 96,
      action_plan: [
        {
          title: 'Prime Waterfront Sky Villa Allocation',
          timeframe: 'Day 1',
          description: 'Lock developer pricing on Jumeirah Bay Island private estate.',
        },
        {
          title: 'UAE Golden Visa Filing',
          timeframe: 'Day 5',
          description: 'Expedited residency filing under Cabinet Resolution 65/2022.',
        },
      ],
      raw_payload: {
        id: sampleBriefId,
        leadId: 'lead_sheikh_mansoor',
        companyName: 'Mansoor Sovereign Capital',
        contactName: 'Sheikh Mansoor Al-Nahyan',
        contactEmail: 'mansoor@sovereign-capital.ae',
        contactPhone: '+971501234567',
        riisScore: 96,
        diraTier: 'SOVEREIGN_INSTITUTIONAL',
        diraRiskLevel: 'LOW',
        budgetAed: 50000000,
        executiveSummary: 'Bespoke ultra-prime capital allocation brief for Mansoor Sovereign Capital with 10-Year Golden Visa statutory certification.',
      },
      created_at: new Date().toISOString(),
    });
  });

  test('1. renderExecutiveBriefHtml compiles institutional HTML with all required sections', () => {
    const briefRecord = supabase.mockStore.executive_briefs[0];
    const html = renderExecutiveBriefHtml(briefRecord);

    assert.ok(typeof html === 'string');
    assert.ok(html.startsWith('<!DOCTYPE html>'));

    // Client Dossier Header
    assert.ok(html.includes('Mansoor Sovereign Capital'));
    assert.ok(html.includes('Sheikh Mansoor Al-Nahyan'));
    assert.ok(html.includes(sampleBriefId));
    assert.ok(html.includes('AED 50,000,000'));

    // RIIS Score Radial Gauge
    assert.ok(html.includes('96'));
    assert.ok(html.includes('REAL ESTATE READINESS SCORE'));
    assert.ok(html.includes('SOVEREIGN INSTITUTIONAL'));
    assert.ok(html.includes('LOW RISK'));

    // Golden Visa Legal Stamp (Cabinet Res. 65/2022)
    assert.ok(html.includes('Cabinet Resolution No. 65 of 2022'));
    assert.ok(html.includes('10-YEAR SOVEREIGN RESIDENCY'));
    assert.ok(html.includes('Federal Decree-Law No. 29/2021'));

    // Target Asset Cards (Manus Off-Plan Projects)
    assert.ok(html.includes('PALM JUMEIRAH') || html.includes('Palm Jumeirah') || html.includes('Prime Institutional Assets'));
    assert.ok(html.includes('Como Residences') || html.includes('Armani Beach') || html.includes('Waterfront Sky Villa') || html.includes('Sobha Estates'));
    assert.ok(html.includes('Manus Off-Plan') || html.includes('Bulgari') || html.includes('Palace Creek Blue') || html.includes('Sobha'));

    // Net Yield Matrix
    assert.ok(html.includes('Net Yield &amp; Jurisdiction Tax Shield Matrix') || html.includes('Net Yield & Jurisdiction Tax Shield Matrix'));
    assert.ok(html.includes('100.0% RETAINED'));
    assert.ok(html.includes('0.0%'));

    // 1-Click Meeting Booking CTA
    assert.ok(html.includes('Book Private Briefing'));
    assert.ok(html.includes('WhatsApp VIP Concierge'));
    assert.ok(html.includes('Initiate Allocation &amp; Golden Visa Filing') || html.includes('Initiate Allocation & Golden Visa Filing'));
  });

  test('2. GET /brief/:id routes through unified API router and returns 200 with HTML content-type', async () => {
    const res = await routeApiRequest(`/brief/${sampleBriefId}`, 'GET');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['Content-Type'], 'text/html; charset=utf-8');
    assert.ok(typeof res.body === 'string');
    assert.ok(res.body.includes('Mansoor Sovereign Capital'));
    assert.ok(res.body.includes('Cabinet Resolution No. 65 of 2022'));
    assert.ok(res.body.includes('96'));
  });

  test('3. GET /api/brief/:id routes through API server and returns 200 with HTML', async () => {
    const res = await routeApiRequest(`/api/brief/${sampleBriefId}`, 'GET');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['Content-Type'], 'text/html; charset=utf-8');
    assert.ok(res.body.includes('Mansoor Sovereign Capital'));
    assert.ok(res.body.includes('Waterfront Sky Villa') || res.body.includes('Como Residences') || res.body.includes('Prime Institutional Assets'));
  });

  test('4. Vercel Serverless Entrypoint (api/index.js) serves /brief/:id as standalone landing page', async () => {
    let statusCode = 0;
    let headersSet = {};
    let responseBody = '';

    const mockReq = {
      method: 'GET',
      url: `/brief/${sampleBriefId}`,
      headers: { host: 'www.emanuelrendas.com' },
      query: { __path: `/brief/${sampleBriefId}` },
    };

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      setHeader(name, val) {
        headersSet[name] = val;
      },
      send(body) {
        responseBody = body;
        return this;
      },
      end(body) {
        if (body) responseBody = body;
        return this;
      },
    };

    await serverlessHandler(mockReq, mockRes);

    assert.strictEqual(statusCode, 200);
    assert.strictEqual(headersSet['Content-Type'], 'text/html; charset=utf-8');
    assert.ok(responseBody.includes('Mansoor Sovereign Capital'));
    assert.ok(responseBody.includes('UAE Cabinet Resolution No. 65 of 2022 Certified'));
    assert.ok(responseBody.includes('WhatsApp VIP Concierge'));
  });

  test('5. Non-existent brief gracefully renders institutional fallback brief without error', async () => {
    const res = await routeApiRequest('/brief/brief_non_existent_123', 'GET');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['Content-Type'], 'text/html; charset=utf-8');
    assert.ok(res.body.includes('brief_non_existent_123'));
    assert.ok(res.body.includes('Cabinet Resolution No. 65 of 2022'));
  });
});
