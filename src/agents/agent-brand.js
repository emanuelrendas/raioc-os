/**
 * RAIOC Specialist Agent: BRAND (Institutional Content Strategy & Creative Director)
 * Generates institutional-grade scripts, social hooks, and macro-infrastructure theses.
 * Grounded in statutory accuracy (IKL v2026.Q3.1) and sovereign wealth catalysts.
 */

import { BaseSpecialistAgent } from './specialists/base-agent.js';
import { AgentEvents } from '../events/agent-event-bus.js';
import { logger } from '../logging/audit-logger.js';
import { handleOpalRoi, handleMixboardBoard, handleFlowTeaser } from '../api/routes/ai-tools-routes.js';

export class BrandContentAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'brand',
      name: 'BRAND',
      role: 'Institutional Content Strategy & Brand Specialist',
      capabilities: [
        'content_generation',
        'thesis_hooks',
        'script_writing',
        'multimodal_storyboarding',
        'macro_editorial',
        'opal_roi_modeling',
        'mixboard_moodboards',
        'flow_video_hooks',
      ],
      systemPrompt:
        'You are the Chief Brand & Content Strategist for Emanuel Rendas Private Real Estate Advisory. You create high-impact, institutional scripts and hooks focused on UAE sovereign megaprojects, Golden Visa statutory law (Res 65/2022), and audited net yields.',
    });

    this.macroTheses = {
      'dubai-south': {
        title: 'Dubai South / DWC Aerotropolis Expansion',
        catalyst: '$35B Al Maktoum Airport Megahub (260M Passengers)',
        corridor: 'Emaar South / Aviation City',
        entryTicketAed: 'AED 3,200,000',
        entryTicketUsd: '$871,200 USD',
        netYield: '7.8% Net p.a. (Audited post-Mollak)',
        appreciation: '+45% 5-Year Capital Appreciation',
        lawAnchor: 'Dubai Law No. (8) of 2007 (100% Escrow + 5% Retention)',
        hook: 'Why sovereign capital is quietly accumulating 15 minutes from the world’s largest airport before the $35B expansion goes live.',
      },
      'palm-jebel-ali': {
        title: 'Palm Jebel Ali Waterfront Expansion',
        catalyst: '110km Pristine Coastline & 80+ Luxury Resort Hotels',
        corridor: 'Palm Jebel Ali Fronds & Crown',
        entryTicketAed: 'AED 18,500,000',
        entryTicketUsd: '$5,036,500 USD',
        netYield: '6.8% Net p.a. (Audited post-Mollak)',
        appreciation: '+65% 5-Year Generational Waterfront Surge',
        lawAnchor: 'Dubai Law No. (8) of 2007 & Decennial Structural Warranty (Art. 880)',
        hook: 'How doubling Dubai’s coastline creates the definitive generational wealth preservation vehicle for global family offices.',
      },
      saadiyat: {
        title: 'Saadiyat Cultural District (Abu Dhabi)',
        catalyst: 'Louvre Abu Dhabi, Guggenheim, Zayed National Museum',
        corridor: 'Saadiyat Lagoons & Cultural Promenade',
        entryTicketAed: 'AED 6,800,000',
        entryTicketUsd: '$1,851,300 USD',
        netYield: '7.1% Net p.a. (ADGM Framework)',
        appreciation: '+38% 5-Year Sovereign Capital Shielding',
        lawAnchor: 'Abu Dhabi Law No. 3 of 2015 & ADGM Statutory Escrow Protection',
        hook: 'The world’s highest density of global cultural institutions: Why sovereign wealth allocators choose Saadiyat over London and Geneva.',
      },
      'al-marjan': {
        title: 'Al Marjan Island Integrated Resort Enclave',
        catalyst: '$3.9B Wynn Integrated Gaming Resort',
        corridor: 'Al Marjan Island Enclave (RAK)',
        entryTicketAed: 'AED 2,400,000',
        entryTicketUsd: '$653,400 USD',
        netYield: '9.2% Net p.a. (Hospitality Cash Yield)',
        appreciation: '+55% Post-Gaming License Value Surge',
        lawAnchor: 'RAK Municipality Law No. 2 of 2018 Statutory Escrow Guarantee',
        hook: 'The Arabian Gulf’s first regulated gaming enclave: Capturing 9.2% audited net cash yields ahead of the 2027 Wynn opening.',
      },
    };
  }

  setupAutonomousHandlers() {
    this.subscribeEvent(AgentEvents.MARKET_ANALYZED, async (event) => {
      try {
        const payload = event.payload || {};
        logger.info('BRAND', `Autonomous content synthesis triggered from MARKET_ANALYZED event`);
        await this.executeTask(
          {
            format: 'video_script',
            topic: payload.corridor || 'dubai-south',
          },
          { correlationId: event.metadata?.correlationId }
        );
      } catch (err) {
        logger.error('BRAND', `Autonomous content synthesis failed: ${err.message}`);
      }
    });
  }

  /**
   * Generates institutional content package
   */
  async processTask(task, context = {}) {
    const {
      topic = 'dubai-south',
      format = 'video_script', // 'video_script', 'linkedin_thought_leadership', 'instagram_carousel', 'macro_editorial'
      targetAudience = 'UHNW_FAMILY_OFFICE',
    } = task;

    const thesis = this.macroTheses[topic] || this.macroTheses['dubai-south'];

    // Generate enriched assets through AI tools
    let opalEnrichment = null;
    let mixboardEnrichment = null;
    let flowEnrichment = null;

    try {
      const priceNum = parseInt((thesis.entryTicketAed || '3200000').replace(/[^0-9]/g, ''), 10) || 3200000;
      const opalRes = await handleOpalRoi({ purchasePriceAed: priceNum });
      opalEnrichment = opalRes?.body || null;

      const mixboardRes = await handleMixboardBoard({ budgetAed: priceNum, strategicFocus: topic });
      mixboardEnrichment = mixboardRes?.body || null;

      const flowRes = await handleFlowTeaser({ budgetAed: priceNum, projectName: thesis.title });
      flowEnrichment = flowRes?.body || null;
    } catch (enrichErr) {
      logger.warn('BRAND', `AI tools enrichment notice: ${enrichErr.message}`);
    }

    const contentPackage = {
      id: `content_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      topic,
      title: thesis.title,
      format,
      targetAudience,
      catalyst: thesis.catalyst,
      statutoryAnchors: {
        goldenVisa: 'AED 2,000,000 / $544,590 USD (Cabinet Res. 65/2022)',
        escrowProtection: thesis.lawAnchor,
        auditedNetYield: thesis.netYield,
        capitalAppreciation: thesis.appreciation,
      },
      aiTools: {
        opalRoi: opalEnrichment,
        mixboard: mixboardEnrichment,
        flowTeaser: flowEnrichment,
      },
      hook: thesis.hook,
      script: this._generateScriptByFormat(format, thesis),
      callToAction: {
        web: 'https://www.emanuelrendas.com',
        whatsappDirect: `https://wa.me/971543871702?text=${encodeURIComponent('Hello Emanuel — I reviewed your macro thesis on ' + thesis.title + ' and would like to discuss allocation terms.')}`,
      },
      createdAt: new Date().toISOString(),
    };

    this.logDecision(
      `Synthesized ${format} institutional content for corridor '${topic}'`,
      'GENERATE_BRAND_CONTENT',
      {
        objectiveId: context.correlationId || 'brand_synthesis',
        confidenceScore: 0.98,
        impactLevel: 'HIGH',
        metadata: { topic, format, catalyst: thesis.catalyst },
      }
    );

    this.storeMemory(`brand_content_${contentPackage.id}`, contentPackage, {
      tags: ['content', 'branding', topic, format],
    });

    this.emitEvent(
      AgentEvents.SOCIAL_CONTENT_GENERATED || 'social:content:generated',
      contentPackage,
      context.correlationId
    );

    return contentPackage;
  }

  _generateScriptByFormat(format, thesis) {
    if (format === 'video_script') {
      return {
        duration: '45-60 Seconds',
        scenes: [
          {
            timing: '0:00 - 0:05',
            visual: 'Aerial cinematic 4K flythrough of masterplan and infrastructure groundworks',
            voiceoverHook: thesis.hook,
          },
          {
            timing: '0:05 - 0:20',
            visual: 'On-screen graphic breakdown of $35B capital injection and sovereign backing',
            voiceoverBody: `The core thesis is state infrastructure preceding private liquidity. In ${thesis.corridor}, entry tickets start at ${thesis.entryTicketAed} (${thesis.entryTicketUsd}) with an audited net rental yield of ${thesis.netYield} post-Mollak service charge deductions.`,
          },
          {
            timing: '0:20 - 0:38',
            visual: 'Statutory Shield breakdown with Law (8) of 2007 and 10-Year Golden Visa badges',
            voiceoverStatutory: `Every dirham is protected under ${thesis.lawAnchor}. Investors qualifying at or above AED 2,000,000 immediately secure the statutory 10-Year UAE Golden Visa under Cabinet Resolution 65 of 2022.`,
          },
          {
            timing: '0:38 - 0:50',
            visual: 'Emanuel Rendas Private Advisory bespoke signature card with WhatsApp CTA',
            voiceoverCta: 'Request private allocation dossiers at emanuelrendas.com or connect via WhatsApp for off-market inventory.',
          },
        ],
      };
    }

    if (format === 'linkedin_thought_leadership') {
      return {
        headline: `${thesis.title}: Asymmetrical Risk-Adjusted Compounding in the UAE Sovereign Corridor`,
        body: `When institutional capital evaluates emerging real estate markets, infrastructure timing is the primary alpha driver.\n\nKey Strategic Pillars:\n1. Sovereign Catalyst: ${thesis.catalyst}\n2. Capital Entry: ${thesis.entryTicketAed} (${thesis.entryTicketUsd})\n3. Audited Yield: ${thesis.netYield} net of all RERA Mollak service fees\n4. Legal Guarantee: 100% Escrow ring-fencing under ${thesis.lawAnchor}\n\nUnder Cabinet Res. 65/2022, purchases over AED 2M lock in the statutory 10-Year Renewable Golden Visa.\n\nRead our institutional memorandum: emanuelrendas.com`,
      };
    }

    // Default Instagram Carousel / Editorial
    return {
      slides: [
        { slide: 1, text: thesis.hook },
        { slide: 2, text: `The Sovereign Catalyst: ${thesis.catalyst}` },
        { slide: 3, text: `Financial Model: Entry ${thesis.entryTicketAed} | ${thesis.netYield} Net Yield` },
        { slide: 4, text: `Statutory Protection: ${thesis.lawAnchor} & 10-Yr Golden Visa (Res. 65/2022)` },
        { slide: 5, text: `Private Advisory Allocation: emanuelrendas.com` },
      ],
    };
  }
}

export const brandContentAgent = new BrandContentAgent();
