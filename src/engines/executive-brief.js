/**
 * RAIOC OS - Executive Brief Generator
 * Transforms raw leads and DIRA/RIIS intelligence results into structured executive intelligence briefs.
 * Consumes action plans, regulatory frameworks, tax rules, and templates from the Institutional Knowledge Layer (IKL v1.0).
 */

import { ikl } from '../core/ikl/index.js';

export class ExecutiveBriefGenerator {
  constructor(options = {}) {
    this.ikl = options.ikl || ikl;
  }

  /**
   * Generates an Executive Brief for an incoming lead
   * @param {Object} lead - Lead information
   * @param {Object} intelligence - DIRA & RIIS analysis output
   * @returns {Object} Executive Brief Object
   */
  generate(lead = {}, intelligence = {}) {
    const companyName = lead.company || lead.company_name || 'Enterprise Client';
    const contactName = lead.name || lead.full_name || 'Executive';
    const contactEmail = lead.email || '';
    const contactPhone = lead.phone || lead.whatsapp || '';
    const riis = intelligence.riis || { score: 70, tier: 'TIER_2_ACCELERATOR', tierLabel: 'Growth Acceleration' };
    const dira = intelligence.dira || { riskLevel: 'MODERATE', riskVectors: [] };
    const strategy = intelligence.strategy || this.ikl.getStrategy(intelligence.recommendedTrack) || this.ikl.getStrategies()[0];

    const executiveSummary = `Executive Intelligence Brief for ${companyName}. Lead score rated at RIIS ${riis.score}/100 (${riis.tierLabel}) with ${dira.riskLevel} operational risk profile. Recommended track: ${intelligence.recommendedTrack || strategy.code}.`;

    // Fetch action plan from IKL
    const actionPlan = this.ikl.generateActionPlan(strategy, dira.riskLevel);

    // Fetch relevant institutional context
    const persona = intelligence.persona || this.ikl.getPersona(strategy.targetPersonaCode);
    const taxRules = this.ikl.getTaxRules();
    const regulations = this.ikl.getRegulations();

    // WhatsApp tailored payload
    const whatsappMessage = `*RAIOC Intelligence Brief for ${contactName} (${companyName})*\n\n` +
      `📊 *RIIS Score:* ${riis.score}/100 [${riis.tierLabel}]\n` +
      `🛡️ *DIRA Risk Level:* ${dira.riskLevel}\n` +
      `⚡ *Recommended Next Step:* Immediate deployment of autonomous processing loop.\n\n` +
      `Your complete architecture brief has been computed and queued for dispatch.`;

    // Email markdown brief
    const emailSubject = `RAIOC Executive Brief: ${companyName} (RIIS Score: ${riis.score}/100)`;
    const emailBody = `# RAIOC Executive Intelligence Brief\n\n` +
      `**Client:** ${companyName} (${contactName})\n` +
      `**Evaluated At:** ${new Date().toISOString()}\n` +
      `**IKL Version:** ${this.ikl.getVersion()}\n\n` +
      `### Intelligence Assessment (RIIS & DIRA)\n` +
      `- **RIIS Score:** ${riis.score}/100 (${riis.tierLabel})\n` +
      `- **DIRA Risk Level:** ${dira.riskLevel}\n` +
      `- **Composite Readiness:** ${intelligence.compositeScore || 75}/100\n` +
      `- **Matched Persona:** ${persona ? persona.name : 'Enterprise Operating Candidate'}\n\n` +
      `### Key Risk Vectors\n` +
      dira.riskVectors.map((v) => `- **${v.vector}** [${v.severity}]: ${v.recommendation}`).join('\n') +
      `\n\n### Strategic Action Plan\n` +
      actionPlan.map((p) => `1. **${p.title}** (${p.timeframe}): ${p.description}`).join('\n');

    return {
      id: `brief_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      leadId: lead.id,
      assessmentId: lead.assessment_id || null,
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      riisScore: riis.score,
      diraTier: riis.tier,
      diraRiskLevel: dira.riskLevel,
      executiveSummary,
      actionPlan,
      dispatchPayloads: {
        whatsapp: {
          recipient: contactPhone,
          message: whatsappMessage,
        },
        email: {
          recipient: contactEmail,
          subject: emailSubject,
          body: emailBody,
        },
        crm: {
          companyName,
          contactName,
          email: contactEmail,
          phone: contactPhone,
          riisScore: riis.score,
          riskLevel: dira.riskLevel,
          lifecycleStage: 'opportunity',
          iklVersion: this.ikl.getVersion(),
        },
      },
      iklMetadata: {
        version: this.ikl.getVersion(),
        personaCode: persona ? persona.code : null,
        strategyCode: strategy.code,
        provenanceKey: `strategy_${strategy.code.toLowerCase()}`,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

export const executiveBriefGenerator = new ExecutiveBriefGenerator();
