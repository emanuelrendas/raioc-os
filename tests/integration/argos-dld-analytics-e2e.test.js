/**
 * RAIOC OS - ARGOS Market Intelligence & Corridor Projections E2E Integration Test Suite (Phase 6)
 * 
 * Tests:
 * 1. Ingestion of official DLD/DXBInteract transactions, normalization, and price-per-sqft metric computation.
 * 2. Autonomous Whale Alert dispatch (CloudEvent raioc.market.whale_alert.v1) for a 45M AED transaction in Palm Jebel Ali.
 * 3. Mathematical precision of inventory absorption rates, 3-year price compounding, and yield modeling across target corridors.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { argosMarketIntelligence, ASSET_TYPES, PROJECT_STATUS } from '../../src/core/argos-market-intelligence.js';
import { corridorProjectionEngine, CORRIDOR_CONFIGS } from '../../src/api/analytics/corridor-projections.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';
import { routeApiRequest } from '../../src/api/server.js';

test('ARGOS DLD INGESTION: Normalization, Ingestion Batching & Metrics per Sqft', async () => {
  const sampleBatch = [
    {
      transactionId: 'dld_pja_001',
      corridor: 'palm_jebel_ali',
      assetType: 'Villa',
      projectStatus: 'Off-Plan',
      priceAed: 18500000,
      areaSqft: 5000,
      developer: 'Nakheel',
    },
    {
      transactionId: 'dld_islands_002',
      corridor: 'dubai_islands',
      assetType: 'Sky Penthouse',
      projectStatus: 'Off-Plan',
      priceAed: 12000000,
      areaSqft: 4000,
      developer: 'Nakheel',
    },
    {
      transactionId: 'dld_hills_003',
      corridor: 'Dubai Hills Estate',
      assetType: 'Townhouse',
      projectStatus: 'Ready',
      priceAed: 6500000,
      areaSqft: 2800,
      developer: 'Emaar Properties',
    },
  ];

  const out = await routeApiRequest(
    '/api/v1/market/dld-sync',
    'POST',
    { transactions: sampleBatch },
    {},
    {
      'x-correlation-id': `corr_argos_test_${Date.now()}`,
      'Content-Type': 'application/json',
    }
  );

  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.body.success, true);
  assert.strictEqual(out.body.batchSize, 3);
  assert.strictEqual(out.body.transactions.length, 3);

  // 1. Validate Transaction 1 (Palm Jebel Ali Villa)
  const tx1 = out.body.transactions[0];
  assert.strictEqual(tx1.corridor, 'Palm Jebel Ali');
  assert.strictEqual(tx1.assetType, ASSET_TYPES.VILLA);
  assert.strictEqual(tx1.projectStatus, PROJECT_STATUS.OFF_PLAN);
  assert.strictEqual(tx1.pricePerSqftAed, Math.round(18500000 / 5000)); // 3700 AED/sqft
  assert.strictEqual(tx1.isWhaleTransaction, false);

  // 2. Validate Transaction 2 (Dubai Islands Penthouse)
  const tx2 = out.body.transactions[1];
  assert.strictEqual(tx2.corridor, 'Dubai Islands');
  assert.strictEqual(tx2.assetType, ASSET_TYPES.PENTHOUSE);
  assert.strictEqual(tx2.pricePerSqftAed, Math.round(12000000 / 4000)); // 3000 AED/sqft

  // 3. Validate Transaction 3 (Dubai Hills Ready Townhouse)
  const tx3 = out.body.transactions[2];
  assert.strictEqual(tx3.corridor, 'Dubai Hills Estate');
  assert.strictEqual(tx3.assetType, ASSET_TYPES.TOWNHOUSE);
  assert.strictEqual(tx3.projectStatus, PROJECT_STATUS.READY);
  assert.strictEqual(tx3.pricePerSqftAed, Math.round(6500000 / 2800)); // 2321 AED/sqft
});

test('ARGOS WHALE ALERT: Autonomous Detection & Event Broadcast for 45M AED Palm Jebel Ali Mandate', async () => {
  const whalePayload = {
    transactionId: `dld_whale_pja_${Date.now()}`,
    corridor: 'Palm Jebel Ali',
    assetType: 'Mansions / Ultra-Luxury Waterfront Villa',
    projectStatus: 'Off-Plan Fronds Collection',
    priceAed: 45000000, // 45M AED >= 20M AED threshold
    areaSqft: 7500,
    developer: 'Nakheel Master Developments',
    buyerCategory: 'SOVEREIGN_ENTITY',
  };

  const correlationId = `corr_whale_test_${Date.now()}`;

  const out = await routeApiRequest(
    '/api/v1/market/dld-sync',
    'POST',
    whalePayload,
    {},
    {
      'x-correlation-id': correlationId,
      'traceparent': '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    }
  );

  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.body.success, true);
  assert.strictEqual(out.body.whaleCount, 1);

  const tx = out.body.transactions[0];
  assert.strictEqual(tx.isWhaleTransaction, true);
  assert.strictEqual(tx.priceAed, 45000000);
  assert.strictEqual(tx.areaSqft, 7500);
  assert.strictEqual(tx.pricePerSqftAed, 6000); // 45,000,000 / 7,500 = 6,000 AED/sqft
  assert.strictEqual(tx.corridor, 'Palm Jebel Ali');

  // Verify CloudEvent raioc.market.whale_alert.v1 on Enterprise Event Bus
  const eventHistory = enterpriseEventBus.getEventHistory(10);
  const whaleEvent = eventHistory.find((e) => e.type === 'raioc.market.whale_alert.v1' && e.data?.priceAed === 45000000);

  assert.ok(whaleEvent, 'Event raioc.market.whale_alert.v1 must be published on enterprise event bus');
  assert.strictEqual(whaleEvent.data.corridor, 'Palm Jebel Ali');
  assert.strictEqual(whaleEvent.data.priceAed, 45000000);
  assert.strictEqual(whaleEvent.data.pricePerSqftAed, 6000);
  assert.strictEqual(whaleEvent.data.assetType, ASSET_TYPES.MANSION);
  assert.strictEqual(whaleEvent.data.developer, 'Nakheel Master Developments');
});

test('CORRIDOR ANALYTICAL PROJECTIONS: Mathematical Precision across Target Corridors (Absorption, Price & Yields)', async () => {
  const out = await routeApiRequest(
    '/api/v1/analytics/corridor-insights?corridor=all',
    'GET'
  );

  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.body.success, true);
  assert.ok(Array.isArray(out.body.corridors), 'Must return array of corridor insights');

  const corridors = out.body.corridors;
  const pja = corridors.find((c) => c.corridorId === 'palm_jebel_ali');
  const islands = corridors.find((c) => c.corridorId === 'dubai_islands');
  const hills = corridors.find((c) => c.corridorId === 'dubai_hills');

  assert.ok(pja, 'Palm Jebel Ali insight model must be present');
  assert.ok(islands, 'Dubai Islands insight model must be present');
  assert.ok(hills, 'Dubai Hills Estate insight model must be present');

  // 1. Palm Jebel Ali Precision Verification
  // Absorption = 1200 / 75 = 16.0 months
  assert.strictEqual(pja.inventoryMetrics.inventoryAbsorptionMonths, 16.0);
  assert.strictEqual(pja.pricingMetrics.baseHistoricalPricePerSqftAed, 3200);
  assert.strictEqual(pja.pricingMetrics.annualCapitalGrowthRatePercent, 12.5);
  // Yr 1 = 3200 * 1.125 = 3600
  assert.strictEqual(pja.pricingMetrics.projectedPricePerSqftAedYear1, 3600);
  // Yr 3 = Math.round(3200 * (1.125^3)) = 4556
  assert.strictEqual(pja.pricingMetrics.projectedPricePerSqftAedYear3, 4556);
  assert.strictEqual(pja.yieldMetrics.baseGrossYieldPercent, 6.5);
  assert.strictEqual(pja.yieldMetrics.baseNetYieldPercent, 5.2);
  assert.strictEqual(pja.yieldMetrics.threeYearYieldProjections.length, 3);

  // 2. Dubai Islands Precision Verification
  // Absorption = 1850 / 110 = 16.8 months
  assert.strictEqual(islands.inventoryMetrics.inventoryAbsorptionMonths, 16.8);
  assert.strictEqual(islands.pricingMetrics.baseHistoricalPricePerSqftAed, 2400);
  assert.strictEqual(islands.pricingMetrics.annualCapitalGrowthRatePercent, 11.0);
  // Yr 1 = 2400 * 1.11 = 2664
  assert.strictEqual(islands.pricingMetrics.projectedPricePerSqftAedYear1, 2664);
  // Yr 3 = Math.round(2400 * (1.11^3)) = 3282
  assert.strictEqual(islands.pricingMetrics.projectedPricePerSqftAedYear3, 3282);
  assert.strictEqual(islands.yieldMetrics.baseGrossYieldPercent, 7.4);
  assert.strictEqual(islands.yieldMetrics.baseNetYieldPercent, 6.1);

  // 3. Dubai Hills Estate Precision Verification
  // Absorption = 950 / 85 = 11.2 months
  assert.strictEqual(hills.inventoryMetrics.inventoryAbsorptionMonths, 11.2);
  assert.strictEqual(hills.pricingMetrics.baseHistoricalPricePerSqftAed, 2100);
  assert.strictEqual(hills.pricingMetrics.annualCapitalGrowthRatePercent, 8.5);
  // Yr 1 = 2100 * 1.085 = 2279
  assert.strictEqual(hills.pricingMetrics.projectedPricePerSqftAedYear1, 2279);
  // Yr 3 = Math.round(2100 * (1.085^3)) = 2682
  assert.strictEqual(hills.pricingMetrics.projectedPricePerSqftAedYear3, 2682);
  assert.strictEqual(hills.yieldMetrics.baseGrossYieldPercent, 7.1);
  assert.strictEqual(hills.yieldMetrics.baseNetYieldPercent, 5.8);
});
