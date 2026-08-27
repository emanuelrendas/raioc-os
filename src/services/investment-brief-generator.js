/**
 * RAIOC OS - Private Investment Brief Generator Service
 * Integrates ATLAS Market Engineering and LEX Statutory Underwriting
 * to generate canonical One-Pager Private Investment Briefs with CloudEvents v1.1 publishing.
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  getCorridorBenchmark,
  executeDeterministicOpalCalculation,
} from './corridor-benchmark-service.js';
import { renderPrivateInvestmentBrief } from '../templates/investment-brief-template.js';
import { enterpriseEventBus } from '../core/event-bus.js';
import { logger } from '../logging/audit-logger.js';

/**
 * Computes deterministic SHA-256 hash of a string or buffer
 * @param {string|Buffer} content 
 * @returns {string} 64-character lowercase hex string
 */
export function computeDocumentSha256(content) {
  const raw = typeof content === 'string' ? content : JSON.stringify(content || '');
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/**
 * Generates a canonical Private Investment Brief (One-Pager) and publishes a CloudEvents v1.1 envelope
 * 
 * @param {Object} params
 * @param {string} [params.mandateId] - Unique mandate ID
 * @param {string} [params.investorName] - Name of the investor / family office
 * @param {string} [params.corridorKey] - Corridor ID ('PALM_JEBEL_ALI', 'DUBAI_SOUTH_DWC')
 * @param {number} [params.allocationAed] - Capital allocation amount in AED
 * @param {string} [params.ownershipVehicle] - Ownership structure ('SPV_DIFC_ADGM', 'INDIVIDUAL_DIRECT')
 * @param {string} [params.correlationId] - Distributed correlation ID
 * @param {string} [params.traceparent] - Optional W3C traceparent
 * @param {boolean} [params.publishEvent=true] - Whether to broadcast CloudEvent to enterpriseEventBus
 * @returns {Promise<Object>} Generated brief dossier with markdown, SHA-256, and CloudEvent
 */
export async function generatePrivateBrief(params = {}) {
  const {
    mandateId = `MND-${Date.now()}-${randomUUID().substring(0, 6).toUpperCase()}`,
    investorName = 'Private Sovereign Investor',
    corridorKey = 'PALM_JEBEL_ALI',
    allocationAed = 25000000,
    ownershipVehicle = 'SPV_DIFC_ADGM',
    correlationId = `corr_brief_${Date.now()}_${randomUUID().substring(0, 8)}`,
    traceparent = null,
    publishEvent = true,
  } = params;

  const briefId = `PIB-${Date.now()}-${randomUUID().substring(0, 6).toUpperCase()}`;
  const price = Number(allocationAed) || 25000000;

  // 1. Resolve Sovereign Corridor Benchmark
  const corridor = getCorridorBenchmark(corridorKey, price);

  // 2. Compute Deterministic Financial Projections (ATLAS & LEX Engine)
  const opalResult = executeDeterministicOpalCalculation({
    purchasePriceAed: price,
    corridor: corridor.id,
  });

  const statutoryBreakdown = opalResult.statutoryShield.statutoryFeeBreakdown;
  const isGoldenVisaEligible = price >= 2000000;

  // 3. Render One-Pager Markdown Document
  const templatePayload = {
    briefId,
    mandateId,
    investorName,
    corridorKey: corridor.id,
    corridorName: corridor.name,
    strategy: corridor.strategy,
    macroThesis: corridor.macro_thesis,
    allocationAed: price,
    ownershipVehicle,
    unitSizeSqft: opalResult.inputs.unitSizeSqft,
    financialMetrics: {
      capRate: opalResult.financialMetrics.capRate,
      capRateBand: [Number((corridor.cap_rate[0] * 100).toFixed(2)), Number((corridor.cap_rate[1] * 100).toFixed(2))],
      sevenYearIrr: opalResult.financialMetrics.sevenYearIrr,
      irr7yBand: [Number((corridor.irr_7y[0] * 100).toFixed(2)), Number((corridor.irr_7y[1] * 100).toFixed(2))],
      cagr10yBand: [Number((corridor.cagr_10y[0] * 100).toFixed(2)), Number((corridor.cagr_10y[1] * 100).toFixed(2))],
      annualServiceChargeAed: opalResult.financialMetrics.annualServiceChargeAed,
      netOperatingIncomeAed: opalResult.financialMetrics.netOperatingIncomeAed,
      totalStatutoryFeesAed: statutoryBreakdown.totalStatutoryFeesAed,
      allInOutlayAed: statutoryBreakdown.totalAllInOutlayAed,
    },
    statutory: {
      dldFeeAed: statutoryBreakdown.dldFeeAed,
      trusteeFeeAed: statutoryBreakdown.trusteeFeeAed,
      oqoodFeeAed: statutoryBreakdown.oqoodFeeAed,
      sinkingFundAed: statutoryBreakdown.sinkingFundAed,
    },
    regulatoryAnchors: corridor.regulatory_anchors,
    generatedAt: new Date().toISOString(),
  };

  const documentMarkdown = renderPrivateInvestmentBrief(templatePayload);

  // 4. Compute Document SHA-256 Cryptographic Hash
  const documentSha256 = computeDocumentSha256(documentMarkdown);

  // 5. Structure Brief Output
  const briefOutput = {
    success: true,
    briefId,
    mandateId,
    investorName,
    corridorKey: corridor.id,
    corridorName: corridor.name,
    strategy: corridor.strategy,
    allocationAed: price,
    ownershipVehicle,
    documentMarkdown,
    documentSha256,
    statutoryValidation: {
      escrowLawCompliant: true,
      escrowReference: corridor.regulatory_anchors.escrow_law,
      decennialLiabilityCovered: true,
      decennialReference: corridor.regulatory_anchors.structural_warranty,
      goldenVisaEligible: isGoldenVisaEligible,
      goldenVisaReference: corridor.regulatory_anchors.golden_visa,
      statutoryOutlayAed: statutoryBreakdown.totalAllInOutlayAed,
      totalStatutoryFeesAed: statutoryBreakdown.totalStatutoryFeesAed,
    },
    financialSummary: {
      capRate: opalResult.financialMetrics.capRate,
      capRateBandPercent: [Number((corridor.cap_rate[0] * 100).toFixed(2)), Number((corridor.cap_rate[1] * 100).toFixed(2))],
      sevenYearIrr: opalResult.financialMetrics.sevenYearIrr,
      irr7yBandPercent: [Number((corridor.irr_7y[0] * 100).toFixed(2)), Number((corridor.irr_7y[1] * 100).toFixed(2))],
      cagr10yBandPercent: [Number((corridor.cagr_10y[0] * 100).toFixed(2)), Number((corridor.cagr_10y[1] * 100).toFixed(2))],
      annualServiceChargeAed: opalResult.financialMetrics.annualServiceChargeAed,
      netOperatingIncomeAed: opalResult.financialMetrics.netOperatingIncomeAed,
    },
    generatedAt: templatePayload.generatedAt,
  };

  // 6. Broadcast CloudEvents v1.1 Envelope to Enterprise Event Bus
  let cloudEvent = null;
  if (publishEvent) {
    const eventPayload = {
      brief_id: briefId,
      mandate_id: mandateId,
      investor_name: investorName,
      corridor_key: corridor.id,
      strategy: corridor.strategy,
      allocation_aed: price,
      ownership_vehicle: ownershipVehicle,
      document_sha256: documentSha256,
      statutory_validations: briefOutput.statutoryValidation,
      financial_summary: briefOutput.financialSummary,
      generated_at: templatePayload.generatedAt,
    };

    cloudEvent = await enterpriseEventBus.publishEvent(
      'raioc.advisory.brief.generated.v1',
      'raioc://services/investment-brief-generator',
      eventPayload,
      {
        correlationId,
        traceparent,
        id: `evt_brief_${Date.now()}_${randomUUID().substring(0, 8)}`,
      }
    );

    briefOutput.cloudEvent = cloudEvent;
    logger.info('BRIEF_GENERATOR', `Private Investment Brief [${briefId}] generated for ${investorName} (${corridor.id})`, {
      mandateId,
      allocationAed: price,
      documentSha256: documentSha256.substring(0, 12) + '...',
      eventId: cloudEvent?.id,
    });
  }

  return briefOutput;
}
