/**
 * RAIOC OS - Policy Event Router & Multi-Agent Dispatcher (Sprint 2 / Phase 7)
 * Listens on Enterprise Event Bus v1.1 for incoming channel events, performs policy routing,
 * dispatches to specialist agents (MARK, ATLAS, JARVIS), records runtime telemetry,
 * and maintains immutable audit logs with cryptographic hash chaining.
 */

import { enterpriseEventBus } from './event-bus.js';
import { supabase } from '../db/supabase-client.js';
import { logger } from '../logging/audit-logger.js';

export class EnterpriseEventRouter {
  constructor() {
    this.initialized = false;
    this.unsubscribers = [];
  }

  /**
   * Initializes event router and registers channel policy listeners
   */
  init() {
    this.destroy();
    this.initialized = true;

    // 1. Subscribe to Telegram Webhook Ingestion Events
    const unsubTelegram = enterpriseEventBus.subscribe(
      'raioc.channel.telegram.message.v1',
      async (data, ctx) => {
        await this.handleTelegramMessageEvent(data, ctx);
      }
    );
    this.unsubscribers.push(unsubTelegram);

    logger.info('EVENT_ROUTER', 'Enterprise Event Router initialized with CloudEvent v1.1 policy listeners');
  }

  /**
   * Processes a normalized Telegram message CloudEvent
   * @param {Object} data 
   * @param {Object} ctx 
   */
  async handleTelegramMessageEvent(data, ctx) {
    const startTime = Date.now();
    const text = (data.text || data.caption || '').trim();
    const lower = text.toLowerCase();
    const username = data.from?.username || data.from?.first_name || 'telegram_user';
    const chatId = data.chat?.id || 'unknown';

    let routedAgent = 'JARVIS';
    let targetEventType = 'raioc.executive.inquiry.received.v1';
    let leadDetails = null;

    // 1. Policy Evaluation
    // Policy A: Inbound Investment / Lead / Golden Visa Mandates -> Route to MARK
    const isInvestment =
      lower.includes('invest') ||
      lower.includes('budget') ||
      lower.includes('aed') ||
      lower.includes('million') ||
      lower.includes('golden visa') ||
      lower.includes('palm jumeirah') ||
      lower.includes('off-plan') ||
      lower.includes('penthouse') ||
      lower.includes('como residences') ||
      lower.includes('property') ||
      lower.includes('buy');

    // Policy B: Yield Calculations / ROI / Financial Modeling -> Route to ATLAS
    const isValuation =
      lower.startsWith('/roi') ||
      lower.startsWith('/calc') ||
      lower.includes('rental yield') ||
      lower.includes('sqft price') ||
      lower.includes('valuation') ||
      lower.includes('escrow calculation');

    if (isValuation) {
      routedAgent = 'ATLAS';
      targetEventType = 'raioc.market.valuation.requested.v1';
    } else if (isInvestment) {
      routedAgent = 'MARK';
      targetEventType = 'raioc.investor.lead.ingested.v1';

      // Parse estimated budget if provided
      let budgetAed = 5000000;
      const matchAed = text.match(/(\d+[\d,.]*)\s*(m|million|aed|dirhams)/i);
      if (matchAed) {
        const num = parseFloat(matchAed[1].replace(/,/g, ''));
        budgetAed = matchAed[2].toLowerCase().startsWith('m') ? num * 1000000 : num;
      }

      leadDetails = {
        investorName: `${data.from?.first_name || ''} ${data.from?.last_name || ''}`.trim() || `@${username}`,
        username,
        chatId,
        budgetAed,
        channel: 'TELEGRAM',
        intent: text,
      };

      // If High-Value Mandate (>= 10M AED) -> Create Pending Executive HITL Approval
      if (budgetAed >= 10000000 || lower.includes('como residences') || lower.includes('penthouse')) {
        await supabase.createApproval({
          id: `appr_tg_${Date.now()}`,
          title: `High-Value Allocation Request via Telegram (${budgetAed.toLocaleString()} AED)`,
          agent: 'MARK (Lead Triage Specialist)',
          category: 'HIGH_VALUE_DISPATCH',
          priority: 'CRITICAL',
          recipient: leadDetails.investorName,
          targetAsset: 'Prime Freehold Asset Allocation',
          payload: {
            sourceChannel: 'TELEGRAM',
            chatId,
            username,
            budgetAed,
            rawMessage: text,
            goldenVisaEligible: budgetAed >= 2000000,
          },
        });
      }
    } else {
      routedAgent = 'JARVIS';
      targetEventType = 'raioc.executive.inquiry.received.v1';
    }

    const elapsedMs = Date.now() - startTime;

    // 2. Update Runtime Tool Telemetry for 'telegram_bot'
    const existingToolTelemetry = (await supabase.getToolRuntimeTelemetry('telegram_bot')) || {};
    await supabase.recordRuntimeToolTelemetry({
      tool_id: 'telegram_bot',
      live_health_status: 'HEALTHY',
      current_latency_ms: elapsedMs,
      total_calls_today: (existingToolTelemetry.total_calls_today || 0) + 1,
      quota_remaining: Math.max(0, (existingToolTelemetry.quota_remaining || 100000) - 1),
    });

    // 3. Update Runtime Agent Telemetry for Routed Agent
    const existingAgentTelemetry = (await supabase.getAgentRuntimeTelemetry(routedAgent.toLowerCase())) || {};
    await supabase.recordRuntimeAgentTelemetry({
      agent_id: routedAgent.toLowerCase(),
      live_status: 'PROCESSING',
      active_task: `Processing Telegram directive from @${username}: ${text.substring(0, 40)}...`,
      last_latency_ms: elapsedMs,
    });

    // 4. Record Immutable Interaction Log with Cryptographic Hash Chaining
    await supabase.recordInteractionLog({
      channel: 'TELEGRAM',
      event_type: 'TELEGRAM_MESSAGE_INGESTED',
      source_agent: routedAgent,
      direction: 'INBOUND',
      correlation_id: ctx.correlationId,
      traceparent: ctx.traceparent,
      summary: `Telegram Ingestion [@${username} / Chat ${chatId}]: "${text.substring(0, 50)}..." -> Routed to ${routedAgent}`,
      payload: {
        chatId,
        username,
        text,
        routedAgent,
        targetEventType,
        leadDetails,
      },
      status: 'SUCCESS',
      latency_ms: elapsedMs,
    });

    // 5. Emit Downstream Domain Event into Event Bus
    await enterpriseEventBus.publishEvent(
      targetEventType,
      `raioc://router/telegram/${routedAgent.toLowerCase()}`,
      {
        messageId: data.message_id,
        chatId,
        username,
        text,
        routedAgent,
        leadDetails,
      },
      {
        correlationId: ctx.correlationId,
        causationId: ctx.eventId,
        traceparent: ctx.traceparent,
      }
    );

    logger.info('EVENT_ROUTER', `Routed Telegram message to [${routedAgent}] via ${targetEventType}`, {
      correlationId: ctx.correlationId,
      routedAgent,
    });
  }

  /**
   * Cleans up listeners
   */
  destroy() {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.initialized = false;
  }
}

export const enterpriseEventRouter = new EnterpriseEventRouter();
// Automatically initialize router
enterpriseEventRouter.init();
