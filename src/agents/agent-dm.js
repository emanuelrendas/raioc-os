/**
 * RAIOC Specialist Agent: DM (Inbound Direct Message Conversion Specialist)
 * Qualifies inbound social media DMs, scores leads via DIRA/RIIS engine, and synchronizes with CRM.
 */

import { BaseSpecialistAgent } from './specialists/base-agent.js';
import { diraRiisEngine } from '../engines/dira-riis-engine.js';
import { supabase } from '../db/supabase-client.js';
import { AgentEvents } from '../events/agent-event-bus.js';
import { logger } from '../logging/audit-logger.js';

export class DmConversionAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'dm',
      name: 'DM_CONVERSION',
      role: 'Inbound Direct Message Conversion Specialist',
      capabilities: [
        'dm_triage',
        'lead_qualification',
        'dira_scoring_sync',
        'calendar_booking_trigger',
        'private_client_onboarding',
      ],
      systemPrompt:
        'You triage and qualify inbound direct messages from Instagram, Meta, TikTok, and LinkedIn. You extract investor requirements, calculate DIRA/RIIS scores, ingest qualified leads, and provide bespoke VIP conversion replies.',
    });
  }

  async processTask(task, context = {}) {
    const {
      platform = 'instagram',
      senderId = `sender_${Date.now()}`,
      senderHandle = 'prospect_investor',
      messageText = '',
      extractedData = {},
    } = task;

    if (!messageText && !extractedData.name) {
      throw new Error('DM_CONVERSION task failed: Missing messageText or extractedData');
    }

    // 1. Extract prospect parameters from message text and provided payload
    const parsedLead = this._extractLeadData(messageText, extractedData, senderHandle, platform);

    // 2. Score lead through DIRA/RIIS engine
    const evaluation = diraRiisEngine.analyze(parsedLead);
    const rawTier = evaluation.riis?.tier || 'TIER_1_SOVEREIGN';
    const isTier1 = rawTier === 'TIER_1_SOVEREIGN' || rawTier === 1 || parsedLead.budgetAed >= 20000000;
    const tierNumeric = isTier1 ? 1 : (rawTier === 'TIER_2_STRATEGIC' || rawTier === 2 || parsedLead.budgetAed >= 5000000 ? 2 : 3);
    const riisScore = evaluation.riis?.score || (isTier1 ? 95 : 80);

    // 3. Persist lead record into Supabase
    let leadRecord = null;
    try {
      if (typeof supabase.insertLead === 'function') {
        leadRecord = await supabase.insertLead({
          fullName: parsedLead.name,
          companyName: parsedLead.company || `${parsedLead.name} Family Office`,
          email: parsedLead.email || `${senderHandle}@social.${platform}.com`,
          phone: parsedLead.phone || null,
          investmentBudgetAed: parsedLead.budgetAed,
          strategicIntent: parsedLead.strategicIntent,
          status: tierNumeric <= 2 ? 'QUALIFIED' : 'INGESTED',
          notes: `Inbound social lead from ${platform} (@${senderHandle}): "${messageText}"`,
        });
      }
    } catch (err) {
      logger.warn('DM_CONVERSION', `Supabase lead ingestion notice: ${err.message}`);
    }

    // 4. Synthesize bespoke VIP direct response
    const replyMessage = this._generateDmReply(parsedLead, tierNumeric);

    const result = {
      leadId: leadRecord?.id || `lead_soc_${Date.now()}`,
      platform,
      senderHandle,
      parsedLead,
      evaluation: {
        score: riisScore,
        tier: tierNumeric,
        tierLabel: rawTier,
        category: evaluation.persona?.name || 'Sovereign Investor',
      },
      replyMessage,
      bookingUrl: 'https://www.emanuelrendas.com/advisory',
      whatsappVipUrl: `https://wa.me/971543871702?text=${encodeURIComponent('Hello Emanuel — I reached out on ' + platform + ' (@' + senderHandle + ') regarding allocation in ' + (parsedLead.preferredCorridor || 'Dubai prime real estate') + '.')}`,
      processedAt: new Date().toISOString(),
    };

    this.logDecision(
      `Qualified inbound ${platform} DM from @${senderHandle} (RIIS Score: ${riisScore}, Tier: ${tierNumeric})`,
      'QUALIFY_SOCIAL_LEAD',
      {
        objectiveId: context.correlationId || result.leadId,
        confidenceScore: 0.95,
        impactLevel: tierNumeric <= 2 ? 'HIGH' : 'MEDIUM',
        metadata: { platform, senderHandle, riis: riisScore },
      }
    );

    this.storeMemory(`dm_lead_${result.leadId}`, result, {
      tags: ['social_lead', platform, senderHandle, `tier_${tierNumeric}`],
    });

    // 5. Emit LEAD_INGESTED event to trigger automated memorandum & brief generator
    this.emitEvent(
      AgentEvents.LEAD_INGESTED,
      {
        lead: {
          id: result.leadId,
          full_name: parsedLead.name,
          company_name: parsedLead.company,
          email: parsedLead.email,
          phone: parsedLead.phone,
          budget_aed: parsedLead.budgetAed,
          strategic_focus: parsedLead.strategicIntent,
          source: `social_${platform}`,
        },
        evaluation,
      },
      context.correlationId
    );

    return result;
  }

  _extractLeadData(text, explicitData, handle, platform) {
    const lower = (text || '').toLowerCase();

    // Estimate budget
    let budgetAed = explicitData.budgetAed || explicitData.budget;
    if (!budgetAed) {
      if (lower.includes('20m') || lower.includes('25m') || lower.includes('30m') || lower.includes('como') || lower.includes('armani') || lower.includes('palm jebel ali')) {
        budgetAed = 25000000;
      } else if (lower.includes('10m') || lower.includes('15m') || lower.includes('sobha')) {
        budgetAed = 15000000;
      } else if (lower.includes('5m') || lower.includes('6m') || lower.includes('saadiyat') || lower.includes('3m') || lower.includes('dubai south')) {
        budgetAed = 5000000;
      } else if (lower.includes('golden visa') || lower.includes('2m')) {
        budgetAed = 2500000;
      } else {
        budgetAed = 3500000; // Default entry
      }
    }

    // Determine strategic intent
    let strategicIntent = explicitData.strategicIntent;
    if (!strategicIntent) {
      if (lower.includes('visa') || lower.includes('residency') || lower.includes('passport')) {
        strategicIntent = 'golden_visa_and_tax_shield';
      } else if (lower.includes('yield') || lower.includes('roi') || lower.includes('cash') || lower.includes('wynn')) {
        strategicIntent = 'high_net_yield_generation';
      } else if (lower.includes('preservation') || lower.includes('estate') || lower.includes('frond') || lower.includes('family office')) {
        strategicIntent = 'capital_preservation_and_estate_shielding';
      } else {
        strategicIntent = 'capital_appreciation';
      }
    }

    // Determine preferred corridor
    let preferredCorridor = 'Dubai Prime Corridor';
    if (lower.includes('south') || lower.includes('airport') || lower.includes('dwc')) {
      preferredCorridor = 'Dubai South Aerotropolis';
    } else if (lower.includes('jebel ali') || lower.includes('palm')) {
      preferredCorridor = 'Palm Jebel Ali Sovereign Waterfront';
    } else if (lower.includes('saadiyat') || lower.includes('abu dhabi')) {
      preferredCorridor = 'Saadiyat Cultural District (Abu Dhabi)';
    } else if (lower.includes('wynn') || lower.includes('marjan') || lower.includes('rak')) {
      preferredCorridor = 'Al Marjan Island Enclave';
    }

    return {
      name: explicitData.name || explicitData.fullName || `@${handle}`,
      company: explicitData.company || `@${handle} Investments`,
      email: explicitData.email || null,
      phone: explicitData.phone || null,
      budgetAed: Number(budgetAed) || 3500000,
      strategicIntent,
      preferredCorridor,
      platform,
    };
  }

  _generateDmReply(lead, riisTier) {
    if (riisTier === 1) {
      return `Thank you for reaching out, ${lead.name}. Given your institutional allocation criteria in ${lead.preferredCorridor}, I have reserved an off-market Executive Dossier ring-fenced under Dubai Law No. (8) of 2007 with 10-Year Golden Visa statutory eligibility under Res. 65/2022. You can review priority allocations directly or connect privately on WhatsApp: https://wa.me/971543871702`;
    }

    return `Hello ${lead.name} — thank you for connecting. I specialize in sovereign infrastructure corridors and audited net rental yield assets (6.1% – 8.3% post-Mollak). I have prepared our latest institutional intelligence memorandum for you at emanuelrendas.com/advisory.`;
  }
}

export const dmConversionAgent = new DmConversionAgent();
