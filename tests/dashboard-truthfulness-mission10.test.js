import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseClient } from '../src/db/supabase-client.js';
import { executiveDashboard } from '../src/operational/executive-dashboard.js';
import { handleTelemetryRequest } from '../src/api/routes/telemetry-routes.js';
import { sitePages } from '../src/site/site-pages.js';
import fs from 'node:fs';
import path from 'node:path';

describe('MISSION-010: Real Production Lead Visibility & Dashboard Truthfulness', () => {
  test('1. SupabaseClient.fetchInvestorsMetrics returns zero metrics for empty mock store without fabricating revenue', async () => {
    const client = new SupabaseClient({ isMock: true, allowMockInProduction: false });
    client.mockStore.investors = [];

    const metrics = await client.fetchInvestorsMetrics();
    assert.equal(metrics.totalLeads, 0);
    assert.equal(metrics.pipelineRevenueAed, 0);
    assert.equal(metrics.projectedCommissionsAed, 0);
    assert.equal(metrics.activeLeads, 0);
  });

  test('2. SupabaseClient.fetchInvestorsMetrics correctly sums real investor budgets', async () => {
    const client = new SupabaseClient({ isMock: true, allowMockInProduction: false });
    client.mockStore.investors = [
      { id: 'inv-1', budget_aed: 5000000, status: 'VERIFIED' },
      { id: 'inv-2', budget_aed: 10000000, status: 'QUALIFIED' },
    ];

    const metrics = await client.fetchInvestorsMetrics();
    assert.equal(metrics.totalLeads, 2);
    assert.equal(metrics.pipelineRevenueAed, 15000000);
    assert.equal(metrics.projectedCommissionsAed, 300000);
    assert.equal(metrics.activeLeads, 2);
  });

  test('3. SupabaseClient in strict production mode throws PersistenceError on failure instead of falling back to mockStore', async () => {
    const client = new SupabaseClient({
      supabaseUrl: 'http://127.0.0.1:1',
      supabaseKey: 'invalid_key',
      nodeEnv: 'production',
      isStrictProduction: true,
      allowMockInProduction: false,
    });

    await assert.rejects(
      async () => {
        await client.fetchInvestors();
      },
      {
        name: 'PersistenceError',
      }
    );
  });

  test('4. ExecutiveDashboard.getDashboardData defaults financials to 0 AED when no metrics exist', () => {
    const data = executiveDashboard.getDashboardData();
    assert.ok(data.financials);
    assert.notEqual(data.financials.pipelineRevenueAed, 25000000, 'Must NOT default to 25,000,000 AED');
    assert.equal(typeof data.financials.pipelineRevenueAed, 'number');
    assert.equal(typeof data.financials.projectedCommissionsAed, 'number');
  });

  test('5. Telemetry route handler dispatches /api/executive/kpis with 200 and truthful structure', async () => {
    const res = await handleTelemetryRequest('/api/executive/kpis');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.pipelineValue !== undefined);
    assert.ok(res.body.pipelineRevenueAed !== undefined);
    assert.ok(res.body.totalLeads !== undefined);
  });

  test('6. Telemetry route handler dispatches /api/executive/alerts with 200', async () => {
    const res = await handleTelemetryRequest('/api/executive/alerts');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.alerts));
  });

  test('7. Telemetry route handler /api/dashboard/overview returns real financials', async () => {
    const res = await handleTelemetryRequest('/api/dashboard/overview');
    assert.equal(res.status, 200);
    assert.ok(res.body.financials);
    assert.notEqual(res.body.financials.pipelineRevenueAed, 25000000, 'Must NOT fabricate 25M');
  });

  test('8. dashboard.html does not contain hardcoded 120.0M or fake Maximillian von Bern event array', () => {
    const html = fs.readFileSync(path.resolve('dashboard.html'), 'utf8');
    assert.doesNotMatch(html, /AED 120\.0M/);
    assert.doesNotMatch(html, /Projected Fees: AED 2,400,000/);
    assert.doesNotMatch(html, /Count Maximillian von Bern/);
    assert.doesNotMatch(html, /18 Processed/);
  });

  test('9. sitePages.dashboard matches sanitized dashboard.html', () => {
    assert.ok(sitePages.dashboard);
    assert.doesNotMatch(sitePages.dashboard, /AED 120\.0M/);
    assert.doesNotMatch(sitePages.dashboard, /Count Maximillian von Bern/);
  });
});
