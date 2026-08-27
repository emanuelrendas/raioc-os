/**
 * RAIOC OS - Sovereign Investment Corridor Benchmark Service
 * Provides deterministic financial ratios, statutory fee schedules, and pro-forma models
 * for sovereign investment corridors (Palm Jebel Ali & Dubai South DWC).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const benchmarksPath = path.resolve(__dirname, '../config/corridor-benchmarks.json');
const triageRulesPath = path.resolve(__dirname, '../config/dm-triage-rules.json');

export const corridorBenchmarksData = JSON.parse(fs.readFileSync(benchmarksPath, 'utf8'));
export const dmTriageRulesData = JSON.parse(fs.readFileSync(triageRulesPath, 'utf8'));

/**
 * Resolves canonical corridor benchmark by ID or slug
 * @param {string} identifier - e.g. 'PALM_JEBEL_ALI', 'palm-jebel-ali', 'DUBAI_SOUTH_DWC', 'dubai-south'
 * @param {number} priceHint - Optional price to infer corridor if omitted
 * @returns {Object} Corridor benchmark configuration
 */
export function getCorridorBenchmark(identifier = '', priceHint = 0) {
  const norm = String(identifier || '').toUpperCase().replace(/-/g, '_').trim();
  
  if (norm.includes('JEBEL') || norm.includes('PALM') || norm === 'PALM_JEBEL_ALI') {
    return corridorBenchmarksData.corridors.PALM_JEBEL_ALI;
  }
  
  if (norm.includes('SOUTH') || norm.includes('DWC') || norm === 'DUBAI_SOUTH_DWC') {
    return corridorBenchmarksData.corridors.DUBAI_SOUTH_DWC;
  }

  // Price-based inference
  if (priceHint >= 15000000) {
    return corridorBenchmarksData.corridors.PALM_JEBEL_ALI;
  }
  
  return corridorBenchmarksData.corridors.DUBAI_SOUTH_DWC;
}

/**
 * Calculates exact statutory acquisition fees for a given corridor and purchase price
 * @param {number} purchasePriceAed 
 * @param {string|Object} corridorOrId 
 * @returns {Object} Detailed statutory fee breakdown
 */
export function calculateCorridorStatutoryFees(purchasePriceAed, corridorOrId = 'PALM_JEBEL_ALI') {
  const corridor = typeof corridorOrId === 'object' && corridorOrId.statutory 
    ? corridorOrId 
    : getCorridorBenchmark(corridorOrId, purchasePriceAed);

  const price = Number(purchasePriceAed) || 0;
  const { statutory } = corridor;

  const dldFeeAed = Math.round(price * statutory.dld);
  const trusteeFeeAed = Number(statutory.trustee);
  const oqoodFeeAed = Number(statutory.oqood);
  const sinkingFundAed = Math.round(price * statutory.sinking_fund);
  const adminFeeAed = 580; // Standard DLD e-system administration fee
  const totalStatutoryFeesAed = dldFeeAed + trusteeFeeAed + oqoodFeeAed + sinkingFundAed + adminFeeAed;
  const totalAllInOutlayAed = price + totalStatutoryFeesAed;

  return {
    corridorId: corridor.id,
    strategy: corridor.strategy,
    purchasePriceAed: price,
    dldFeeAed,
    dldFeePct: statutory.dld * 100,
    trusteeFeeAed,
    oqoodFeeAed,
    sinkingFundAed,
    sinkingFundPct: statutory.sinking_fund * 100,
    adminFeeAed,
    totalStatutoryFeesAed,
    totalAllInOutlayAed,
    regulatoryAnchors: corridor.regulatory_anchors,
  };
}

/**
 * Computes exact Internal Rate of Return (IRR / TIR) using Newton-Raphson method
 * @param {number[]} cashFlows 
 * @param {number} guess 
 * @returns {number} IRR decimal (e.g. 0.148 for 14.8%)
 */
export function calculateExactIrr(cashFlows, guess = 0.1) {
  let rate = guess;
  const maxIterations = 100;
  const tolerance = 1e-7;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dNpv = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      const discountFactor = Math.pow(1 + rate, t);
      npv += cashFlows[t] / discountFactor;
      if (t > 0) {
        dNpv -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
      }
    }

    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    if (Math.abs(dNpv) < 1e-10) break;

    const newRate = rate - npv / dNpv;
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }
    rate = newRate;
  }

  return rate;
}

/**
 * Executes full deterministic Opal ROI calculation grounded in corridor benchmarks
 * @param {Object} payload 
 * @returns {Object} Comprehensive institutional calculation result
 */
export function executeDeterministicOpalCalculation(payload = {}) {
  const price = Number(payload.purchasePriceAed || payload.propertyValueAed || payload.budgetAed || payload.price || 15000000);
  const sqft = Number(payload.unitSizeSqft || payload.sqft || (price > 15000000 ? 3800 : 1250));
  const corridorKey = payload.corridor || payload.corridorId || payload.corridor_id || payload.corridorSlug || '';
  const corridor = getCorridorBenchmark(corridorKey, price);

  // 1. Statutory Fees & All-In Outlay
  const statutoryFees = calculateCorridorStatutoryFees(price, corridor);
  const allInOutlayAed = statutoryFees.totalAllInOutlayAed;

  // 2. Service Charge
  const scMidpoint = (corridor.service_charge[0] + corridor.service_charge[1]) / 2;
  const scRate = Number(payload.serviceChargePerSqft || payload.serviceChargesPerSqFt || payload.sc || scMidpoint);
  const annualServiceCharge = Math.round(scRate * sqft);

  // 3. Gross & Net Rent / Yield
  const targetCapRateMidpoint = (corridor.cap_rate[0] + corridor.cap_rate[1]) / 2;
  const defaultAnnualRent = Math.round((price * targetCapRateMidpoint) + annualServiceCharge);
  const grossRent = Number(payload.expectedAnnualRentAed || payload.annualRentAed || payload.rent || defaultAnnualRent);
  const netOperatingIncomeY1 = grossRent - annualServiceCharge;
  const grossYieldPct = Number(((grossRent / price) * 100).toFixed(2));
  const capRate = Number(((netOperatingIncomeY1 / price) * 100).toFixed(2));
  const netYieldOnAllIn = Number(((netOperatingIncomeY1 / allInOutlayAed) * 100).toFixed(2));

  // 4. Growth Rates from Corridor Benchmarks
  const cagr10yMidpoint = (corridor.cagr_10y[0] + corridor.cagr_10y[1]) / 2;
  const capitalGrowthRate = Number(payload.capitalGrowthRate || cagr10yMidpoint);
  const rentalGrowthRate = Number(payload.rentalGrowthRate || (cagr10yMidpoint * 0.7));

  // 5. 7-Year & 5-Year Cash Flow Pro-Forma & IRR
  const proForma7Years = [];
  const proForma5Years = [];
  const irrCashFlowArray7Y = [-allInOutlayAed];
  const irrCashFlowArray5Y = [-allInOutlayAed];
  let currentRent = grossRent;
  let currentSc = annualServiceCharge;
  let currentValuation = price;

  for (let yr = 1; yr <= 7; yr++) {
    if (yr > 1) {
      currentRent *= (1 + rentalGrowthRate);
      currentSc *= 1.025; // 2.5% service charge escalation
      currentValuation *= (1 + capitalGrowthRate);
    }
    const noi = currentRent - currentSc;
    const netCashFlow7Y = yr === 7 ? noi + currentValuation : noi;
    const netCashFlow5Y = yr === 5 ? noi + currentValuation : noi;

    proForma7Years.push({
      year: yr,
      grossRentAed: Math.round(currentRent),
      serviceChargesAed: Math.round(currentSc),
      netOperatingIncomeAed: Math.round(noi),
      assetValuationAed: Math.round(currentValuation),
      netCashFlowAed: Math.round(netCashFlow7Y),
    });

    if (yr <= 5) {
      proForma5Years.push({
        year: yr,
        grossRentAed: Math.round(currentRent),
        serviceChargesAed: Math.round(currentSc),
        netOperatingIncomeAed: Math.round(noi),
        assetValuationAed: Math.round(currentValuation),
        netCashFlowAed: Math.round(netCashFlow5Y),
      });
      irrCashFlowArray5Y.push(netCashFlow5Y);
    }

    irrCashFlowArray7Y.push(netCashFlow7Y);
  }

  const sevenYearIrr = calculateExactIrr(irrCashFlowArray7Y);
  const sevenYearIrrPercent = Number((sevenYearIrr * 100).toFixed(2));
  const fiveYearIrr = calculateExactIrr(irrCashFlowArray5Y);
  const fiveYearIrrPercent = Number((fiveYearIrr * 100).toFixed(2));

  // 6. Golden Visa Statutory Check (Cabinet Res 65/2022)
  const isGoldenVisaEligible = price >= 2000000;

  const memorandumId = `MEMO-OPAL-${corridor.id.substring(0, 4)}-${Date.now()}`;
  const memorandumMarkdown = `# 🏛 INSTITUTIONAL REAL ESTATE INVESTMENT MEMORANDUM (OPAL v2.5)
**Reference ID:** \`${memorandumId}\`  
**Underwriter Engine:** ATLAS & LEX Opal Intelligence  
**Investment Corridor:** ${corridor.name}  
**Strategic Allocation:** ${corridor.strategy}  
**Asset Acquisition Price:** AED ${price.toLocaleString()}  
**Statutory Total Outlay:** AED ${allInOutlayAed.toLocaleString()}  
**Deterministic Cap Rate:** ${capRate}% Net p.a. [Benchmark Band: ${(corridor.cap_rate[0]*100).toFixed(1)}% - ${(corridor.cap_rate[1]*100).toFixed(1)}%]  
**7-Year Target IRR (TIR):** ${sevenYearIrrPercent}% p.a. [Benchmark Band: ${(corridor.irr_7y[0]*100).toFixed(1)}% - ${(corridor.irr_7y[1]*100).toFixed(1)}%]  
**10-Year Macro CAGR:** ${(corridor.cagr_10y[0]*100).toFixed(1)}% - ${(corridor.cagr_10y[1]*100).toFixed(1)}% p.a.  
**Statutory Escrow Guarantee:** ${corridor.regulatory_anchors.escrow_law}  
**Decennial Structural Warranty:** ${corridor.regulatory_anchors.structural_warranty}  
**Residency Status:** ${isGoldenVisaEligible ? 'QUALIFIED (10-Year UAE Golden Visa)' : 'BELOW THRESHOLD'} (${corridor.regulatory_anchors.golden_visa})  
`;

  return {
    success: true,
    tool: 'google_opal_roi_engine',
    version: 'v2.5.0-ENTERPRISE-DETERMINISTIC',
    memorandumId,
    corridorBenchmark: {
      id: corridor.id,
      slug: corridor.slug,
      name: corridor.name,
      strategy: corridor.strategy,
      macroThesis: corridor.macro_thesis,
      capRateBand: corridor.cap_rate,
      capRateBandPercent: [Number((corridor.cap_rate[0] * 100).toFixed(1)), Number((corridor.cap_rate[1] * 100).toFixed(1))],
      cagr10yBand: corridor.cagr_10y,
      cagr10yBandPercent: [Number((corridor.cagr_10y[0] * 100).toFixed(1)), Number((corridor.cagr_10y[1] * 100).toFixed(1))],
      irr7yBand: corridor.irr_7y,
      irr7yBandPercent: [Number((corridor.irr_7y[0] * 100).toFixed(1)), Number((corridor.irr_7y[1] * 100).toFixed(1))],
      serviceChargeBandAed: corridor.service_charge,
      statutoryRatios: corridor.statutory,
    },
    inputs: {
      purchasePriceAed: price,
      purchasePriceUsd: Math.round(price / 3.6725),
      unitSizeSqft: sqft,
      expectedAnnualRentAed: grossRent,
      serviceChargePerSqft: scRate,
      capitalGrowthRate,
      rentalGrowthRate,
    },
    statutoryShield: {
      goldenVisaEligible: isGoldenVisaEligible,
      goldenVisaThresholdAed: 2000000,
      goldenVisaThresholdUsd: 544590,
      statutoryDecree: corridor.regulatory_anchors.golden_visa,
      escrowProtection: corridor.regulatory_anchors.escrow_law,
      decennialLiability: corridor.regulatory_anchors.structural_warranty,
      statutoryFeeBreakdown: statutoryFees,
    },
    financialMetrics: {
      grossYieldPct,
      netYieldPct: capRate,
      capRate,
      netYieldOnAllIn,
      fiveYearIrr: fiveYearIrrPercent,
      sevenYearIrr: sevenYearIrrPercent,
      annualServiceChargeAed: annualServiceCharge,
      netOperatingIncomeAed: netOperatingIncomeY1,
      totalStatutoryFeesAed: statutoryFees.totalStatutoryFeesAed,
      allInOutlayAed,
    },
    sevenYearProForma: proForma7Years,
    fiveYearProForma: proForma5Years,
    institutionalMemorandum: {
      id: memorandumId,
      title: `INSTITUTIONAL REAL ESTATE INVESTMENT MEMORANDUM (${corridor.name})`,
      markdown: memorandumMarkdown,
      generatedAt: new Date().toISOString(),
      status: 'CERTIFIED_BY_LEX_AND_ATLAS',
    },
    auditTimestamp: new Date().toISOString(),
  };
}
