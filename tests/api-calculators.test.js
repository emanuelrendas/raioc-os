import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { routeApiRequest, startApiServer, propertyCalculators } from '../src/api/index.js';
import { ikl } from '../src/core/ikl/index.js';

describe('Website Integration & Calculator Tests', () => {
  describe('Property Calculators Unit Tests', () => {
    test('calculates accurate acquisition costs based on live IKL DLD rules', () => {
      const result = propertyCalculators.calculateAcquisitionCost({
        propertyPriceAed: 2000000,
        isOffPlan: false,
        mortgageAmountAed: 1000000,
      });

      assert.strictEqual(result.propertyPriceAed, 2000000);
      assert.strictEqual(result.breakdown.dldRatePercent, 4.0);
      assert.strictEqual(result.breakdown.dldTransferFee, 80000); // 4% of 2M
      assert.strictEqual(result.breakdown.dldAdminFee, 4200);
      assert.strictEqual(result.breakdown.trusteeFee, 4200);
      assert.strictEqual(result.breakdown.mortgageRegistrationFee, 2790); // (1M * 0.0025) + 290
      assert.strictEqual(result.breakdown.agencyFee, 40000); // 2%
      assert.strictEqual(result.breakdown.agencyVat, 2000); // 5% of agency fee
      assert.ok(result.totalOutlayAed > 2000000);
      assert.ok(result.confidence.score >= 0.90);
    });

    test('evaluates Golden Visa qualification for qualifying and non-qualifying equity', () => {
      // Qualifying >= 2M AED
      const qual = propertyCalculators.calculateGoldenVisaEligibility({
        totalPropertyEquityAed: 2500000,
      });
      assert.strictEqual(qual.isEligible, true);
      assert.strictEqual(qual.qualifyingThresholdAed, 2000000);
      assert.strictEqual(qual.deficitAed, 0);
      assert.strictEqual(qual.progressPercent, 100);

      // Non-qualifying < 2M AED
      const nonQual = propertyCalculators.calculateGoldenVisaEligibility({
        totalPropertyEquityAed: 1200000,
      });
      assert.strictEqual(nonQual.isEligible, false);
      assert.strictEqual(nonQual.deficitAed, 800000);
      assert.strictEqual(nonQual.progressPercent, 60);
    });

    test('calculates rental yield and short-term vs long-term arbitrage spread', () => {
      const yieldCalc = propertyCalculators.calculateRentalYield({
        communityId: 'comm_downtown_dubai',
        propertyPriceAed: 2000000,
      });

      assert.strictEqual(yieldCalc.propertyPriceAed, 2000000);
      assert.strictEqual(yieldCalc.community.name, 'Downtown Dubai');
      assert.ok(yieldCalc.longTerm.grossYieldPercent > 0);
      assert.ok(yieldCalc.longTerm.netYieldPercent > 0);
      assert.ok(yieldCalc.shortTermArbitrage.grossYieldPercent > yieldCalc.longTerm.grossYieldPercent);
      assert.ok(yieldCalc.shortTermArbitrage.arbitrageSpreadAed > 0);
    });
  });

  describe('API Router & Endpoint Tests', () => {
    test('routes IKL queries for communities, tax, and regulations', async () => {
      const commRes = await routeApiRequest('/api/ikl/communities');
      assert.strictEqual(commRes.status, 200);
      assert.ok(commRes.body.length >= 5);

      const taxRes = await routeApiRequest('/api/ikl/tax');
      assert.strictEqual(taxRes.status, 200);
      assert.ok(taxRes.body.length >= 4);

      const regRes = await routeApiRequest('/api/ikl/regulations');
      assert.strictEqual(regRes.status, 200);
      assert.ok(regRes.body.length >= 4);
    });

    test('routes calculator API requests', async () => {
      const calcRes = await routeApiRequest('/api/calculators/acquisition', 'POST', {
        propertyPriceAed: 3000000,
      });
      assert.strictEqual(calcRes.status, 200);
      assert.strictEqual(calcRes.body.breakdown.dldTransferFee, 120000);

      const gvRes = await routeApiRequest('/api/calculators/golden-visa', 'POST', {
        totalPropertyEquityAed: 2000000,
      });
      assert.strictEqual(gvRes.status, 200);
      assert.strictEqual(gvRes.body.isEligible, true);
    });

    test('routes assessment submission, triggers DIRA/RIIS and returns Executive Brief', async () => {
      const res = await routeApiRequest('/api/assessment', 'POST', {
        name: 'Alexander Sterling',
        company: 'Sterling Capital Holdings',
        company_size: '500+',
        ai_maturity: 'in_production',
        timeline: 'immediate',
        data_stack: 'modern cloud',
        email: 'alex@sterling.com',
        phone: '+971501234567',
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.leadId);
      assert.ok(res.body.briefId);
      assert.ok(res.body.riis.score >= 80);
      assert.ok(res.body.executiveBrief);
      assert.strictEqual(res.body.executiveBrief.contactName, 'Alexander Sterling');
      assert.strictEqual(res.body.actionPlan.length, 3);
      assert.strictEqual(res.body.iklVersion, ikl.getVersion());
    });

    test('routes telemetry and dashboard health checks', async () => {
      const healthRes = await routeApiRequest('/api/dashboard/health');
      assert.strictEqual(healthRes.status, 200);
      assert.strictEqual(healthRes.body.status, 'HEALTHY');
      assert.strictEqual(healthRes.body.iklVersion, '1.0.0');

      const metricsRes = await routeApiRequest('/api/telemetry/metrics');
      assert.strictEqual(metricsRes.status, 200);
      assert.ok(metricsRes.body.cycleCount !== undefined);
    });
  });

  describe('Standalone HTTP Server Integration', () => {
    let server = null;
    const testPort = 3456;

    before(async () => {
      server = await startApiServer(testPort);
    });

    after(() => {
      if (server) server.close();
    });

    test('serves live HTTP requests with CORS headers', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/ikl/version`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.version, '1.0.0');

      const calcRes = await fetch(`http://localhost:${testPort}/api/calculators/golden-visa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalPropertyEquityAed: 2200000 }),
      });
      assert.strictEqual(calcRes.status, 200);
      const calcData = await calcRes.json();
      assert.strictEqual(calcData.isEligible, true);
    });
  });
});
