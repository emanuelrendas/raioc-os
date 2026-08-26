/**
 * RAIOC OS - Policy Event Router & Multi-Agent Dispatcher (Sprint 2 / Phase 7 & 8 & MARK Vision)
 * Listens on Enterprise Event Bus v1.1 for incoming channel events (Telegram, WhatsApp, Document Intake),
 * performs policy routing, dispatches to specialist agents (MARK, ATLAS, JARVIS),
 * records runtime telemetry, and maintains immutable audit logs with cryptographic hash chaining.
 */

import { enterpriseEventBus } from './event-bus.js';
import { supabase } from '../db/supabase-client.js';
import { logger } from '../logging/audit-logger.js';
import { documentVision } from './document-vision.js';
import { markTriage } from './mark-triage.js';
import { aidaCommunication } from './aida-communication.js';

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

    // 1. Subscribe to Telegram Webhook Ingestion Events (Phase 7)
    const unsubTelegram = enterpriseEventBus.subscribe(
      'raioc.channel.telegram.message.v1',
      async (data, ctx) => {
        await this.handleTelegramMessageEvent(data, ctx);
      }
    );
    this.unsubscribers.push(unsubTelegram);

    // 2. Subscribe to WhatsApp Cloud API Ingestion Events (Phase 8)
    const unsubWhatsApp = enterpriseEventBus.subscribe(
      'raioc.channel.whatsapp.message.v1',
      async (data, ctx) => {
        await this.handleWhatsAppMessageEvent(data, ctx);
      }
    );
    this.unsubscribers.push(unsubWhatsApp);

    // 3. Subscribe to Multimodal Document Intake Events (MARK Vision)
    const unsubDocument = enterpriseEventBus.subscribe(
      'raioc.document.intake.uploaded.v1',
      async (data, ctx) => {
        await this.handleDocumentIntakeEvent(data, ctx);
      }
    );
    this.unsubscribers.push(unsubDocument);

    // 4. Subscribe to AIDA Voice AI Communication Events (Sprint 3)
    const unsubVoice = enterpriseEventBus.subscribe(
      'raioc.communication.voice.requested.v1',
      async (data, ctx) => {
        await this.handleVoiceCommunicationEvent(data, ctx);
      }
    );
    this.unsubscribers.push(unsubVoice);

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
      lower.includes('palm jebel ali') ||
      lower.includes('off-plan') ||
      lower.includes('penthouse') ||
      lower.includes('como residences') ||
      lower.includes('property') ||
      lower.includes('buy') ||
      lower.includes('mandate') ||
      lower.includes('allocation');

    // Policy B: Yield Calculations / ROI / Financial Modeling -> Route to ATLAS
    const isValuation =
      lower.startsWith('/roi') ||
      lower.startsWith('/calc') ||
      lower.includes('rental yield') ||
      lower.includes('net yield') ||
      lower.includes('sqft price') ||
      lower.includes('valuation') ||
      lower.includes('mollak') ||
      lower.includes('escrow calculation') ||
      lower.includes('opal');

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
   * Processes a normalized WhatsApp Cloud API message CloudEvent (Phase 8)
   * @param {Object} data 
   * @param {Object} ctx 
   */
  async handleWhatsAppMessageEvent(data, ctx) {
    const startTime = Date.now();
    const text = (data.text || '').trim();
    const lower = text.toLowerCase();
    const senderPhone = data.sender_phone || 'unknown';
    const profileName = data.profile_name || senderPhone;
    const messageId = data.message_id || `wa_${Date.now()}`;

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
      lower.includes('palm jebel ali') ||
      lower.includes('off-plan') ||
      lower.includes('penthouse') ||
      lower.includes('como residences') ||
      lower.includes('property') ||
      lower.includes('buy') ||
      lower.includes('mandate') ||
      lower.includes('allocation');

    // Policy B: Yield Calculations / ROI / Financial Modeling -> Route to ATLAS
    const isValuation =
      lower.startsWith('/roi') ||
      lower.startsWith('/calc') ||
      lower.includes('rental yield') ||
      lower.includes('net yield') ||
      lower.includes('sqft price') ||
      lower.includes('valuation') ||
      lower.includes('mollak') ||
      lower.includes('escrow calculation') ||
      lower.includes('opal') ||
      lower.includes('gross yield');

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
        investorName: profileName,
        phone: senderPhone,
        whatsapp: senderPhone,
        budgetAed,
        channel: 'WHATSAPP',
        intent: text,
      };

      // If High-Value Mandate (>= 10M AED) -> Create Pending Executive HITL Approval
      if (budgetAed >= 10000000 || lower.includes('como residences') || lower.includes('penthouse')) {
        await supabase.createApproval({
          id: `appr_wa_${Date.now()}`,
          title: `High-Value Allocation Request via WhatsApp (${budgetAed.toLocaleString()} AED)`,
          agent: 'MARK (Lead Triage Specialist)',
          category: 'HIGH_VALUE_DISPATCH',
          priority: 'CRITICAL',
          recipient: profileName,
          targetAsset: 'Prime Freehold Asset Allocation',
          payload: {
            sourceChannel: 'WHATSAPP',
            senderPhone,
            profileName,
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

    // 2. Update Runtime Tool Telemetry for 'whatsapp_cloud_api'
    const existingToolTelemetry = (await supabase.getToolRuntimeTelemetry('whatsapp_cloud_api')) || {};
    await supabase.recordRuntimeToolTelemetry({
      tool_id: 'whatsapp_cloud_api',
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
      active_task: `Processing WhatsApp directive from ${profileName}: ${text.substring(0, 40)}...`,
      last_latency_ms: elapsedMs,
    });

    // 4. Record Immutable Interaction Log with Cryptographic Hash Chaining
    await supabase.recordInteractionLog({
      channel: 'WHATSAPP',
      event_type: 'WHATSAPP_MESSAGE_INGESTED',
      source_agent: routedAgent,
      direction: 'INBOUND',
      correlation_id: ctx.correlationId,
      traceparent: ctx.traceparent,
      summary: `WhatsApp Ingestion [${profileName} / ${senderPhone}]: "${text.substring(0, 50)}..." -> Routed to ${routedAgent}`,
      payload: {
        sender: profileName,
        name: profileName,
        senderPhone,
        profileName,
        text,
        routedAgent,
        targetEventType,
        leadDetails,
        messageId,
      },
      status: 'SUCCESS',
      latency_ms: elapsedMs,
    });

    // 5. Emit Downstream Domain Event into Event Bus
    await enterpriseEventBus.publishEvent(
      targetEventType,
      `raioc://router/whatsapp/${routedAgent.toLowerCase()}`,
      {
        messageId,
        senderPhone,
        profileName,
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

    logger.info('EVENT_ROUTER', `Routed WhatsApp message to [${routedAgent}] via ${targetEventType}`, {
      correlationId: ctx.correlationId,
      routedAgent,
    });
  }

  /**
   * Processes a Multimodal Document Intake CloudEvent (MARK OCR Vision Upgrade)
   * @param {Object} data 
   * @param {Object} ctx 
   */
  async handleDocumentIntakeEvent(data, ctx) {
    const startTime = Date.now();
    logger.info('EVENT_ROUTER', `Processing Document Intake Event [${data.documentType || 'SCAN'}] for Investor ${data.investorId || 'Inbound'}...`);

    // 1. Multimodal OCR & Vision Intelligence Extraction
    const extracted = await documentVision.extract({
      documentType: data.documentType,
      fileBase64: data.fileBase64,
      mimeType: data.mimeType,
      fileName: data.fileName,
      textContent: data.textContent,
      correlationId: ctx.correlationId,
    });

    // 2. MARK Triage Evaluation & Investor CRM Updates
    const triageResult = await markTriage.evaluateDocumentTriage(extracted, data.investorId, {
      correlationId: ctx.correlationId,
      causationId: ctx.eventId,
      traceparent: ctx.traceparent,
    });

    const elapsedMs = Date.now() - startTime;

    // 3. Update Runtime Tool Telemetry for 'mark_ocr_vision'
    const existingToolTelemetry = (await supabase.getToolRuntimeTelemetry('mark_ocr_vision')) || {};
    await supabase.recordRuntimeToolTelemetry({
      tool_id: 'mark_ocr_vision',
      live_health_status: 'HEALTHY',
      current_latency_ms: elapsedMs,
      total_calls_today: (existingToolTelemetry.total_calls_today || 0) + 1,
      quota_remaining: Math.max(0, (existingToolTelemetry.quota_remaining || 25000) - 1),
    });

    // 4. Update Runtime Agent Telemetry for 'mark_lead_triage'
    await supabase.recordRuntimeAgentTelemetry({
      agent_id: 'mark_lead_triage',
      live_status: 'IDLE',
      active_task: `Completed OCR analysis of ${extracted.documentClass} for ${data.investorId || 'Inbound'}`,
      last_latency_ms: elapsedMs,
    });
    await supabase.recordRuntimeAgentTelemetry({
      agent_id: 'mark',
      live_status: 'IDLE',
      active_task: `Completed OCR analysis of ${extracted.documentClass} for ${data.investorId || 'Inbound'}`,
      last_latency_ms: elapsedMs,
    });

    // 5. Record Immutable Interaction Log (Sanitized - NEVER store raw base64)
    await supabase.recordInteractionLog({
      investor_id: data.investorId || null,
      channel: 'DOCUMENT_OCR',
      event_type: 'DOCUMENT_INTAKE_PROCESSED',
      source_agent: 'MARK',
      direction: 'INBOUND',
      correlation_id: ctx.correlationId,
      traceparent: ctx.traceparent,
      summary: `MARK OCR Vision: Processed ${extracted.documentClass} [Confidence: ${(extracted.confidence * 100).toFixed(0)}%] for Investor ${data.investorId || 'Inbound'}`,
      payload: {
        documentClass: extracted.documentClass,
        fileSha256: data.fileSha256,
        fileName: data.fileName,
        confidence: extracted.confidence,
        requiresManualReview: extracted.requiresManualReview,
        triageResult: {
          status: triageResult.triageStatus,
          diraScoreDelta: triageResult.diraScoreDelta,
          updatedStage: triageResult.updatedStage,
          approvalId: triageResult.approvalId,
        },
      },
      status: 'SUCCESS',
      latency_ms: elapsedMs,
    });

    logger.info('EVENT_ROUTER', `MARK OCR Vision processed ${extracted.documentClass} in ${elapsedMs}ms`, {
      correlationId: ctx.correlationId,
      confidence: extracted.confidence,
      triageStatus: triageResult.triageStatus,
    });
  }

  /**
   * Processes a Voice Communication CloudEvent (AIDA Voice AI Upgrade)
   * @param {Object} data 
   * @param {Object} ctx 
   */
  async handleVoiceCommunicationEvent(data, ctx) {
    const startTime = Date.now();
    logger.info('EVENT_ROUTER', `Processing Voice Communication Event [${data.intent}] for ${data.recipient || 'Investor'}...`);

    // 1. Process Voice Request via AIDA Communication Engine
    const result = await aidaCommunication.processVoiceRequest(data, {
      correlationId: ctx.correlationId,
      causationId: ctx.eventId,
      traceparent: ctx.traceparent,
    });

    const elapsedMs = Date.now() - startTime;
    const voiceOutput = result.voiceOutput || {};

    // 2. Update Runtime Tool Telemetry for 'aida_voice_ai'
    const existingToolTelemetry = (await supabase.getToolRuntimeTelemetry('aida_voice_ai')) || {};
    await supabase.recordRuntimeToolTelemetry({
      tool_id: 'aida_voice_ai',
      live_health_status: 'HEALTHY',
      current_latency_ms: elapsedMs,
      total_calls_today: (existingToolTelemetry.total_calls_today || 0) + 1,
      quota_remaining: Math.max(0, (existingToolTelemetry.quota_remaining || 10000) - 1),
    });

    // 3. Update Runtime Agent Telemetry for 'aida'
    await supabase.recordRuntimeAgentTelemetry({
      agent_id: 'aida',
      live_status: 'IDLE',
      active_task: `Synthesized executive voice note (${voiceOutput.audioDurationSeconds || 30}s) for ${data.recipient || 'Investor'}`,
      last_latency_ms: elapsedMs,
    });

    // 4. Record Immutable Interaction Log (Sanitized - NEVER store raw audio base64)
    await supabase.recordInteractionLog({
      investor_id: data.investorId || null,
      channel: 'VOICE_DISPATCH',
      event_type: 'VOICE_SYNTHESIS_COMPLETED',
      source_agent: 'AIDA',
      direction: 'OUTBOUND',
      correlation_id: ctx.correlationId,
      traceparent: ctx.traceparent,
      summary: `AIDA Voice AI: Synthesized ${data.intent} for ${data.recipient || 'Investor'} (${voiceOutput.audioDurationSeconds || 30}s spoken) via ${data.channel || 'WHATSAPP'}`,
      payload: {
        intent: data.intent,
        messageType: data.messageType,
        recipient: data.recipient,
        targetAsset: data.targetAsset,
        audioSha256: voiceOutput.audioSha256,
        audioDurationSeconds: voiceOutput.audioDurationSeconds,
        confidence: voiceOutput.confidence,
        provider: voiceOutput.provider,
        triageStatus: result.triageStatus,
        approvalId: result.approvalId,
        channel: data.channel || 'WHATSAPP',
      },
      status: 'SUCCESS',
      latency_ms: elapsedMs,
    });

    logger.info('EVENT_ROUTER', `AIDA Voice AI synthesized ${data.intent} for ${data.recipient} in ${elapsedMs}ms`, {
      correlationId: ctx.correlationId,
      audioDurationSeconds: voiceOutput.audioDurationSeconds,
      triageStatus: result.triageStatus,
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
