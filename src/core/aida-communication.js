/**
 * RAIOC OS - AIDA Communication Layer (Sprint 3 / Phase 9)
 * Orchestrates high-touch voice notes, investor objection responses, and premium outreach.
 * Enforces HITL compliance rules for high-value allocations and sensitive dispatches.
 */

import { supabase } from '../db/supabase-client.js';
import { enterpriseEventBus } from './event-bus.js';
import { voiceAi, VOICE_INTENTS, OBJECTION_CATEGORIES } from './voice-ai.js';
import { logger } from '../logging/audit-logger.js';

export const MESSAGE_TYPES = {
  VOICE_NOTE: 'VOICE_NOTE',
  SCRIPT: 'SCRIPT',
  FOLLOWUP_PROMPT: 'FOLLOWUP_PROMPT',
  OBJECTION_RESPONSE: 'OBJECTION_RESPONSE',
};

export class AidaCommunicationEngine {
  /**
   * Processes an inbound voice communication request
   * @param {Object} data - { intent, messageType, recipient, investorId, channel, context, script, objectionCategory, budgetAed, isExternallySensitive }
   * @param {Object} ctx - { correlationId, causationId, traceparent, eventId }
   * @returns {Promise<Object>}
   */
  async processVoiceRequest(data = {}, ctx = {}) {
    const startTime = Date.now();
    const intent = data.intent || VOICE_INTENTS.INVESTOR_FOLLOWUP;
    const messageType = data.messageType || this.inferMessageType(intent);
    const channel = (data.channel || 'WHATSAPP').toUpperCase();
    const correlationId = ctx.correlationId || data.correlationId || `corr_aida_voice_${Date.now()}`;
    const traceparent = ctx.traceparent || data.traceparent;

    // 1. Fetch Investor Profile if investorId provided
    let investor = null;
    if (data.investorId) {
      investor = await supabase.getInvestor(data.investorId);
    }

    const recipient = data.recipient || investor?.name || 'Private Sovereign Investor';
    const budgetAed = Number(data.budgetAed || investor?.budget_aed || 15000000);
    const targetAsset = data.targetAsset || investor?.target_asset || 'Como Residences in Palm Jumeirah';

    // 2. Synthesize Executive Voice Output
    const voiceOutput = await voiceAi.synthesize(intent, {
      recipient,
      investor,
      targetAsset,
      budgetAed,
      objectionCategory: data.objectionCategory || OBJECTION_CATEGORIES.TRUST,
      channel,
      customScript: data.script,
      correlationId,
    });

    // 3. Evaluate HITL Approval Policy
    // Mandatory approval if:
    // - Allocation budget >= 10M AED
    // - Low voice confidence (< 0.75)
    // - Explicitly marked sensitive
    // - Critical objection response on high-value asset
    const isHighValue = budgetAed >= 10000000;
    const isLowConfidence = voiceOutput.confidence < 0.75;
    const isSensitive = data.isExternallySensitive === true || data.sensitive === true;
    const requiresApproval = isHighValue || isLowConfidence || isSensitive;

    let approvalRecord = null;
    if (requiresApproval) {
      approvalRecord = await supabase.createApproval({
        id: `appr_voice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: `AIDA Voice Synthesis Approval: ${intent} for ${recipient}`,
        agent: 'AIDA (Client Relations & Voice AI Specialist)',
        category: 'VOICE_BROADCAST',
        status: 'PENDING',
        priority: isHighValue ? 'CRITICAL' : 'HIGH',
        recipient,
        targetAsset,
        payload: {
          intent,
          messageType,
          channel,
          script: voiceOutput.script,
          audioDurationSeconds: voiceOutput.audioDurationSeconds,
          audioSha256: voiceOutput.audioSha256,
          confidence: voiceOutput.confidence,
          investorId: investor?.id || null,
          budgetAed,
          requiresApproval,
          reason: isHighValue ? 'HIGH_VALUE_MANDATE (>= 10M AED)' : isLowConfidence ? 'LOW_CONFIDENCE (< 0.75)' : 'SENSITIVE_DISPATCH',
        },
      });

      logger.info('AIDA_COMMS', `Created Pending HITL Voice Approval [${approvalRecord.id}] for ${recipient}`, {
        approvalId: approvalRecord.id,
        intent,
      });
    }

    // 4. Emit CloudEvent v1.1 raioc.communication.voice.synthesized.v1
    const synthesizedEvent = await enterpriseEventBus.publishEvent(
      'raioc.communication.voice.synthesized.v1',
      'raioc://aida/voice/engine',
      {
        intent,
        messageType,
        recipient,
        investorId: investor?.id || null,
        channel,
        script: voiceOutput.script,
        audioSha256: voiceOutput.audioSha256,
        audioDurationSeconds: voiceOutput.audioDurationSeconds,
        confidence: voiceOutput.confidence,
        provider: voiceOutput.provider,
        triageStatus: requiresApproval ? 'APPROVAL_REQUIRED' : 'APPROVED',
        approvalId: approvalRecord?.id || null,
      },
      {
        correlationId,
        causationId: ctx.causationId || ctx.eventId,
        traceparent,
      }
    );

    const durationMs = Date.now() - startTime;
    logger.info('AIDA_COMMS', `Processed Voice Request for ${recipient} (${voiceOutput.audioDurationSeconds}s) in ${durationMs}ms`, {
      correlationId,
      triageStatus: requiresApproval ? 'APPROVAL_REQUIRED' : 'APPROVED',
    });

    return {
      success: true,
      voiceOutput,
      triageStatus: requiresApproval ? 'APPROVAL_REQUIRED' : 'APPROVED',
      approvalId: approvalRecord?.id || null,
      eventId: synthesizedEvent.id,
      traceparent,
      correlationId,
      processingTimeMs: durationMs,
    };
  }

  /**
   * Helper to infer message type from intent
   */
  inferMessageType(intent) {
    if (intent === VOICE_INTENTS.OBJECTION_HANDLING) return MESSAGE_TYPES.OBJECTION_RESPONSE;
    if (intent === VOICE_INTENTS.CALL_SUPPORT) return MESSAGE_TYPES.SCRIPT;
    if (intent === VOICE_INTENTS.INVESTOR_FOLLOWUP) return MESSAGE_TYPES.FOLLOWUP_PROMPT;
    return MESSAGE_TYPES.VOICE_NOTE;
  }
}

export const aidaCommunication = new AidaCommunicationEngine();
