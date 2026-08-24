/**
 * RAIOC Specialist Agent: LEX (Compliance, Tax & Golden Visa)
 * Evaluates UAE regulatory statutes, 4% DLD acquisition costs, Golden Visa compliance, and tax rules.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { ikl } from '../../core/ikl/index.js';
import { propertyCalculators } from '../../api/calculators/property-calculators.js';

export class LexComplianceAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'lex',
      name: 'LEX',
      role: 'Compliance, Tax & Regulatory Specialist',
      capabilities: ['regulatory_audit', 'tax_optimization', 'golden_visa_verification', 'dld_cost_computation'],
      systemPrompt: 'You enforce UAE statutory real estate regulations, Golden Visa AED 2M compliance, Escrow verification, and tax structuring.',
    });
  }

  async processTask(task, context = {}) {
    const { propertyPriceAed = 2000000, buyerType = 'INDIVIDUAL_FOREIGN', offPlan = true } = task;

    // 1. Compute acquisition breakdown (DLD 4%, Admin fees, Trustee)
    const acquisitionBreakdown = propertyCalculators.calculateAcquisitionCost({
      propertyPriceAed,
      isOffPlan: offPlan,
    });

    // 2. Golden Visa verification (AED 2M threshold)
    const goldenVisaEligibility = propertyCalculators.calculateGoldenVisaEligibility({
      totalPropertyEquityAed: propertyPriceAed,
    });

    // 3. Tax & Regulation check from IKL
    const dldRegulation = ikl.getRegulation('reg_dld_registration');
    const incomeTaxRule = ikl.getTaxRule('tax_personal_income');
    const corporateTaxRule = ikl.getTaxRule('tax_corporate');

    const complianceAudit = {
      propertyPriceAed,
      acquisitionBreakdown,
      goldenVisaEligibility,
      statutoryFramework: {
        registration: dldRegulation,
        taxRules: [incomeTaxRule, corporateTaxRule],
      },
      compliant: true,
      timestamp: new Date().toISOString(),
    };

    const dldFee = acquisitionBreakdown.breakdown.dldTransferFee;
    this.logDecision(
      `Conducted regulatory audit for acquisition AED ${propertyPriceAed.toLocaleString()}: Golden Visa ${goldenVisaEligibility.isEligible ? 'QUALIFIED' : 'NOT QUALIFIED'}, DLD Transfer Fee AED ${dldFee.toLocaleString()}`,
      'APPROVE_REGULATORY_STRUCTURING',
      {
        objectiveId: context.correlationId,
        confidenceScore: 0.99,
        impactLevel: 'HIGH',
        metadata: { goldenVisaQualified: goldenVisaEligibility.isEligible },
      }
    );

    this.storeMemory(`compliance_audit_${Date.now()}`, complianceAudit, {
      tags: ['compliance', 'tax', 'golden_visa', 'dld'],
    });

    return complianceAudit;
  }
}

export const lexComplianceAgent = new LexComplianceAgent();
