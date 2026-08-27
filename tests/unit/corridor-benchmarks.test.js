/**
 * RAIOC OS - Unit Test Suite: Corridor Benchmarks & DM Triage Rules
 * Verifies deterministic financial ratios, statutory fee limits, IRR calculation,
 * and surgical qualification parameters across sovereign corridors.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  corridorBenchmarksData,
  dmTriageRulesData,
  getCorridorBenchmark,
  calculateCorridorStatutoryFees,
  calculateExactIrr,
  executeDeterministicOpalCalculation,
} from '../../src/services/corridor-benchmark-service.js';
import { handleOpalRoi } from '../../src/api/routes/ai-tools-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('🏛 Sovereign Corridor Benchmarks & DM Triage Unit Suite', () => {

  test('1. JSON Config Integrity: corridor-benchmarks.json schema and corridors', () => {
    const rawData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/config/corridor-benchmarks.json'), 'utf8'));
    assert.strictEqual(rawData.jurisdiction, 'DUBAI_DLD_RERA');
    assert.ok(rawData.corridors.PALM_JEBEL_ALI, 'PALM_JEBEL_ALI must exist');
    assert.ok(rawData.corridors.DUBAI_SOUTH_DWC, 'DUBAI_SOUTH_DWC must exist');
  });

  test('2. PALM_JEBEL_ALI: Deterministic Ratios and Statutory Limits', () => {
    const pja = corridorBenchmarksData.corridors.PALM_JEBEL_ALI;
    assert.strictEqual(pja.strategy, 'CAPITAL_PRESERVATION_ULTRA_PRIME');
    
    // Cap Rate: [0.048, 0.055]
    assert.deepStrictEqual(pja.cap_rate, [0.048, 0.055]);
    assert.ok(pja.cap_rate[0] < pja.cap_rate[1]);

    // CAGR 10Y: [0.085, 0.102]
    assert.deepStrictEqual(pja.cagr_10y, [0.085, 0.102]);
    assert.ok(pja.cagr_10y[0] < pja.cagr_10y[1]);

    // IRR 7Y: [0.135, 0.158]
    assert.deepStrictEqual(pja.irr_7y, [0.135, 0.158]);
    assert.ok(pja.irr_7y[0] < pja.irr_7y[1]);

    // Service Charge: [18, 26]
    assert.deepStrictEqual(pja.service_charge, [18, 26]);

    // Statutory Ratios
    assert.strictEqual(pja.statutory.dld, 0.04, 'DLD fee must be exactly 4%');
    assert.strictEqual(pja.statutory.trustee, 4200, 'Trustee fee must be 4200 AED');
    assert.strictEqual(pja.statutory.oqood, 1000, 'Oqood fee must be 1000 AED');
    assert.strictEqual(pja.statutory.sinking_fund, 0.0125, 'Sinking fund reserve must be 1.25%');
  });

  test('3. DUBAI_SOUTH_DWC: Deterministic Ratios and Statutory Limits', () => {
    const dsc = corridorBenchmarksData.corridors.DUBAI_SOUTH_DWC;
    assert.strictEqual(dsc.strategy, 'MACRO_INFRASTRUCTURE_HIGH_YIELD');

    // Cap Rate: [0.078, 0.088]
    assert.deepStrictEqual(dsc.cap_rate, [0.078, 0.088]);
    assert.ok(dsc.cap_rate[0] < dsc.cap_rate[1]);

    // CAGR 10Y: [0.060, 0.075]
    assert.deepStrictEqual(dsc.cagr_10y, [0.060, 0.075]);
    assert.ok(dsc.cagr_10y[0] < dsc.cagr_10y[1]);

    // IRR 7Y: [0.145, 0.165]
    assert.deepStrictEqual(dsc.irr_7y, [0.145, 0.165]);
    assert.ok(dsc.irr_7y[0] < dsc.irr_7y[1]);

    // Service Charge: [12, 16]
    assert.deepStrictEqual(dsc.service_charge, [12, 16]);

    // Statutory Ratios
    assert.strictEqual(dsc.statutory.dld, 0.04, 'DLD fee must be exactly 4%');
    assert.strictEqual(dsc.statutory.trustee, 4200, 'Trustee fee must be 4200 AED');
    assert.strictEqual(dsc.statutory.oqood, 1000, 'Oqood fee must be 1000 AED');
    assert.strictEqual(dsc.statutory.sinking_fund, 0.0150, 'Sinking fund reserve must be 1.50%');
  });

  test('4. DM_TRIAGE_RULES: 3 Surgical Questions and 10M AED HITL Threshold', () => {
    const rules = dmTriageRulesData;
    assert.strictEqual(rules.agent, 'DM_CONVERSION');
    assert.strictEqual(rules.hitl_threshold_aed, 10000000, 'HITL threshold must be 10,000,000 AED');

    const wf = rules.qualification_workflow;
    
    // Step 1: CAPITAL_SCOPE
    assert.ok(wf.step_1);
    assert.strictEqual(wf.step_1.step_id, 'CAPITAL_SCOPE');
    const step1Keys = wf.step_1.options.map(o => o.key);
    assert.ok(step1Keys.includes('TIER_SOVEREIGN_UHNW'));
    assert.ok(step1Keys.includes('TIER_PRIVATE_WEALTH'));
    assert.ok(step1Keys.includes('TIER_ACCELERATED_ENTRY'));

    // Step 2: CORRIDOR_VETOR
    assert.ok(wf.step_2);
    assert.strictEqual(wf.step_2.step_id, 'CORRIDOR_VETOR');
    const step2Corridors = wf.step_2.options.map(o => o.corridor_id);
    assert.ok(step2Corridors.includes('PALM_JEBEL_ALI'));
    assert.ok(step2Corridors.includes('DUBAI_SOUTH_DWC'));

    // Step 3: OWNERSHIP_VEHICLE
    assert.ok(wf.step_3);
    assert.strictEqual(wf.step_3.step_id, 'OWNERSHIP_VEHICLE');
    const step3Keys = wf.step_3.options.map(o => o.key);
    assert.ok(step3Keys.includes('SPV_DIFC_ADGM'));
    assert.ok(step3Keys.includes('INDIVIDUAL_DIRECT'));
  });

  test('5. Statutory Fee Calculation Accuracy: Palm Jebel Ali (35M AED)', () => {
    const price = 35000000;
    const fees = calculateCorridorStatutoryFees(price, 'PALM_JEBEL_ALI');

    assert.strictEqual(fees.purchasePriceAed, 35000000);
    assert.strictEqual(fees.dldFeeAed, 1400000); // 4% of 35M
    assert.strictEqual(fees.trusteeFeeAed, 4200);
    assert.strictEqual(fees.oqoodFeeAed, 1000);
    assert.strictEqual(fees.sinkingFundAed, 437500); // 1.25% of 35M
    assert.strictEqual(fees.adminFeeAed, 580);
    assert.strictEqual(fees.totalStatutoryFeesAed, 1400000 + 4200 + 1000 + 437500 + 580);
    assert.strictEqual(fees.totalAllInOutlayAed, price + fees.totalStatutoryFeesAed);
  });

  test('6. Statutory Fee Calculation Accuracy: Dubai South DWC (5M AED)', () => {
    const price = 5000000;
    const fees = calculateCorridorStatutoryFees(price, 'DUBAI_SOUTH_DWC');

    assert.strictEqual(fees.purchasePriceAed, 5000000);
    assert.strictEqual(fees.dldFeeAed, 200000); // 4% of 5M
    assert.strictEqual(fees.trusteeFeeAed, 4200);
    assert.strictEqual(fees.oqoodFeeAed, 1000);
    assert.strictEqual(fees.sinkingFundAed, 75000); // 1.50% of 5M
    assert.strictEqual(fees.adminFeeAed, 580);
    assert.strictEqual(fees.totalStatutoryFeesAed, 200000 + 4200 + 1000 + 75000 + 580);
    assert.strictEqual(fees.totalAllInOutlayAed, price + fees.totalStatutoryFeesAed);
  });

  test('7. Exact IRR Mathematical Solver (Newton-Raphson)', () => {
    // Standard test cash flows: Year 0: -100, Year 1: +10, Year 2: +110 -> Exact IRR = 10% (0.10)
    const testCashFlows = [-100, 10, 110];
    const irr = calculateExactIrr(testCashFlows);
    assert.strictEqual(Number((irr * 100).toFixed(2)), 10.00);
  });

  test('8. Deterministic Opal Calculation Engine: Full Pro-Forma & Sovereign Ringfencing', () => {
    const result = executeDeterministicOpalCalculation({
      purchasePriceAed: 28000000,
      corridor: 'PALM_JEBEL_ALI',
      unitSizeSqft: 4200,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.corridorBenchmark.id, 'PALM_JEBEL_ALI');
    assert.strictEqual(result.corridorBenchmark.strategy, 'CAPITAL_PRESERVATION_ULTRA_PRIME');
    assert.ok(result.financialMetrics.capRate >= 4.0 && result.financialMetrics.capRate <= 6.5);
    assert.ok(result.financialMetrics.sevenYearIrr >= 12.0 && result.financialMetrics.sevenYearIrr <= 18.0);
    assert.strictEqual(result.statutoryShield.goldenVisaEligible, true);
    assert.strictEqual(result.sevenYearProForma.length, 7);
    assert.strictEqual(result.fiveYearProForma.length, 5);
    assert.ok(result.institutionalMemorandum.markdown.includes('UAE Law No. 8 of 2007'));
    assert.ok(result.institutionalMemorandum.markdown.includes('UAE Civil Code Art. 880'));
  });

  test('9. HTTP Endpoint /api/v1/opal/roi integration via handleOpalRoi', async () => {
    const response = await handleOpalRoi({
      purchasePriceAed: 6500000,
      corridor: 'DUBAI_SOUTH_DWC',
      unitSizeSqft: 1800,
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.corridorBenchmark.id, 'DUBAI_SOUTH_DWC');
    assert.strictEqual(response.body.corridorBenchmark.strategy, 'MACRO_INFRASTRUCTURE_HIGH_YIELD');
    assert.ok(response.body.financialMetrics.capRate >= 7.0 && response.body.financialMetrics.capRate <= 9.5);
    assert.ok(response.body.statutoryShield.statutoryFeeBreakdown.sinkingFundPct === 1.5);
  });

});
