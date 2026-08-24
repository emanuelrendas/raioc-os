/**
 * RAIOC Specialist Agent: MARK (Lead Triage & Risk Intelligence)
 * Evaluates inbound investor profiles using DIRA risk matrices and RIIS scoring.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { diraRiisEngine } from '../../engines/dira-riis-engine.js';

export class MarkTriageAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'mark',
      name: 'MARK',
      role: 'Lead Triage & Risk Intelligence Specialist',
      capabilities: ['lead_triage', 'dira_risk_analysis', 'riis_scoring', 'investor_qualification'],
      systemPrompt: 'You analyze prospect readiness, evaluate risk vectors across operational readiness, regulatory compliance, and calculate deterministic RIIS scores.',
    });
  }

  async processTask(task, context = {}) {
    const { leadData } = task;
    if (!leadData) {
      throw new Error('MARK task failed: Missing leadData in payload');
    }

    const evaluation = diraRiisEngine.analyze(leadData);
    const riisScore = evaluation.riis?.score || 50;
    const riskLevel = evaluation.dira?.riskLevel || 'LOW';

    this.logDecision(
      `Evaluated prospect ${leadData.company_name || leadData.email || 'lead'}: RIIS score ${riisScore}, Risk Tier: ${riskLevel}`,
      riisScore >= 70 ? 'QUALIFY_HIGH_PRIORITY_LEAD' : 'QUALIFY_STANDARD_LEAD',
      {
        objectiveId: context.correlationId,
        confidenceScore: 0.98,
        impactLevel: riisScore >= 80 ? 'HIGH' : 'MEDIUM',
        metadata: { riisScore, riskLevel },
      }
    );

    this.storeMemory(
      `lead_evaluation_${leadData.id || leadData.email || Date.now()}`,
      evaluation,
      { tags: ['lead', 'riis', 'dira', leadData.company_name || ''] }
    );

    return evaluation;
  }
}

export const markTriageAgent = new MarkTriageAgent();
