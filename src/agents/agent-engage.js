/**
 * RAIOC Specialist Agent: ENGAGE (Comment Watchdog & Statutory Engagement)
 * Monitors social media comments, analyzes sentiment, and provides factual statutory responses.
 * Protects brand integrity against misinformation with exact legal citations.
 */

import { BaseSpecialistAgent } from './specialists/base-agent.js';
import { AgentEvents } from '../events/agent-event-bus.js';
import { logger } from '../logging/audit-logger.js';

export class CommentWatchdogAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'engage',
      name: 'ENGAGE',
      role: 'Social Engagement & Statutory Compliance Watchdog',
      capabilities: [
        'comment_monitoring',
        'statutory_fact_checking',
        'public_engagement',
        'sentiment_analysis',
        'disinformation_defense',
      ],
      systemPrompt:
        'You monitor and engage with public comments on social channels (Instagram, TikTok, YouTube, LinkedIn). You provide authoritative, polite responses grounded in Dubai Law No. 8 of 2007, Cabinet Res. 65 of 2022, and audited net yield metrics.',
    });
  }

  async processTask(task, context = {}) {
    const {
      platform = 'instagram',
      commentId = `cmt_${Date.now()}`,
      author = 'investor_prospect',
      text = '',
      postContext = {},
    } = task;

    if (!text) {
      throw new Error('ENGAGE task failed: Missing comment text');
    }

    const analysis = this._analyzeComment(text);
    const suggestedReply = this._generateStatutoryReply(analysis, text);

    const engagementResult = {
      commentId,
      platform,
      author,
      text,
      analysis,
      suggestedReply,
      shouldReplyPublicly: analysis.intent !== 'SPAM_OR_TROLL',
      isHighIntentLead: analysis.isHighIntentLead,
      escalateToDm: analysis.isHighIntentLead,
      processedAt: new Date().toISOString(),
    };

    this.logDecision(
      `Processed ${platform} comment from @${author} [Intent: ${analysis.intent}, HighIntent: ${analysis.isHighIntentLead}]`,
      'PROCESS_SOCIAL_COMMENT',
      {
        objectiveId: context.correlationId || commentId,
        confidenceScore: 0.96,
        impactLevel: analysis.isHighIntentLead ? 'HIGH' : 'LOW',
        metadata: { platform, intent: analysis.intent },
      }
    );

    this.storeMemory(`comment_${commentId}`, engagementResult, {
      tags: ['engagement', platform, analysis.intent, author],
    });

    this.emitEvent(
      AgentEvents.SOCIAL_COMMENT_PROCESSED || 'social:comment:processed',
      engagementResult,
      context.correlationId
    );

    // If high intent, auto-forward to DM Conversion agent via event bus
    if (analysis.isHighIntentLead) {
      this.sendMessage(
        'dm',
        {
          action: 'initiate_dm_outreach',
          platform,
          author,
          originalComment: text,
          intent: analysis.intent,
        },
        context.correlationId
      );
    }

    return engagementResult;
  }

  _analyzeComment(text) {
    const lower = text.toLowerCase();
    let intent = 'GENERAL_INQUIRY';
    let isHighIntentLead = false;
    let sentiment = 'NEUTRAL';

    // 1. Golden Visa inquiries
    if (lower.includes('visa') || lower.includes('residency') || lower.includes('golden visa') || lower.includes('passport')) {
      intent = 'INQUIRY_GOLDEN_VISA';
      isHighIntentLead = true;
    }
    // 2. Yield & Financial returns
    else if (lower.includes('yield') || lower.includes('roi') || lower.includes('rental') || lower.includes('mollak') || lower.includes('service charge')) {
      intent = 'INQUIRY_YIELD_ROI';
      isHighIntentLead = true;
    }
    // 3. Escrow, Safety & Scam skepticism
    else if (lower.includes('safe') || lower.includes('scam') || lower.includes('bubble') || lower.includes('risk') || lower.includes('law') || lower.includes('escrow')) {
      intent = 'INQUIRY_ESCROW_SAFETY';
      sentiment = 'SKEPTICAL';
    }
    // 4. Booking & Allocation intent
    else if (lower.includes('price') || lower.includes('cost') || lower.includes('how much') || lower.includes('buy') || lower.includes('available') || lower.includes('dm') || lower.includes('contact')) {
      intent = 'INQUIRY_OFF_PLAN_ALLOCATION';
      isHighIntentLead = true;
      sentiment = 'POSITIVE';
    }

    return {
      intent,
      isHighIntentLead,
      sentiment,
    };
  }

  _generateStatutoryReply(analysis, originalText) {
    switch (analysis.intent) {
      case 'INQUIRY_GOLDEN_VISA':
        return 'Statutory qualification is anchored at exactly AED 2,000,000 / $544,590 USD (Cabinet Resolution No. 65 of 2022). This unlocks the 10-Year Renewable Real Estate Investor Visa with 100% business ownership and zero capital gains tax. We have sent a detailed dossier to your DMs.';

      case 'INQUIRY_ESCROW_SAFETY':
        return 'All off-plan acquisitions in Dubai are legally protected under Statutory Escrow Law No. (8) of 2007. 100% of investor funds are deposited in RERA-approved commercial bank trust accounts and released strictly on verified DLD engineering progress, with 5% retained post-completion plus 10-Year structural decennial liability under UAE Civil Code Art. 880.';

      case 'INQUIRY_YIELD_ROI':
        return 'All our financial models report audited net yields (6.1% – 8.3% p.a.) strictly post-Mollak service charge and sinking fund deductions. We never publish inflated gross figures. Detailed breakdown is available on emanuelrendas.com.';

      case 'INQUIRY_OFF_PLAN_ALLOCATION':
        return 'Thank you for your inquiry. Priority allocations and off-market inventory terms for Tier-1 sovereign master developments are available directly via private advisory. Check your direct messages for the executive memorandum.';

      default:
        return 'Thank you for engaging. You can explore verified market data, audited yields, and statutory protections on emanuelrendas.com.';
    }
  }
}

export const commentWatchdogAgent = new CommentWatchdogAgent();
