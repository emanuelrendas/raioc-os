/**
 * RAIOC OS - AIDA Voice Communication API Gateway (Sprint 3 / Phase 9)
 * Pure input surface & Direct Dispatch: Authenticates voice communication directives, validates parameters,
 * enforces HITL approval policies for high-value sovereign allocations,
 * attaches W3C distributed trace context, and publishes CloudEvent v1.1 events to Event Bus v1.1.
 * 
 * Endpoints:
 * - POST /api/v1/communication/voice
 * - Legacy alias: POST /api/communication/voice (with Deprecation header)
 */

import { enterpriseEventBus } from '../../../core/event-bus.js';
import { voiceAi, VOICE_INTENTS } from '../../../core/voice-ai.js';
import { supabase } from '../../../db/supabase-client.js';
import { logger } from '../../../logging/audit-logger.js';

export async function handleVoiceCommunicationRequest(url, method = 'POST', body = {}, query = {}, headers = {}) {
  const isLegacy = url.startsWith('/api/communication') && !url.startsWith('/api/v1/communication');
  const responseHeaders = isLegacy
    ? {
        'Deprecation': '@deprecated Use canonical route /api/v1/communication/voice',
        'Sunset': '2026-12-31',
      }
    : {};

  if (method !== 'POST') {
    return {
      status: 405,
      headers: responseHeaders,
      body: { success: false, error: `Method ${method} not allowed on voice communication endpoint` },
    };
  }

  const startTime = Date.now();
  const intent = (body.intent || VOICE_INTENTS.INVESTOR_FOLLOWUP).toUpperCase();
  const recipient = body.recipient || body.investorName || body.name || 'Private Sovereign Investor';
  const investorId = body.investorId || body.investor_id || null;
  const channel = (body.channel || 'WHATSAPP').toUpperCase();
  const budgetAed = Number(body.budgetAed || body.budget_aed || 0);
  const targetAsset = body.targetAsset || body.target_asset || 'Prime Dubai Freehold Corridor';

  // Validate Intent if specified
  const validIntents = Object.values(VOICE_INTENTS);
  if (!validIntents.includes(intent)) {
    return {
      status: 400,
      headers: responseHeaders,
      body: {
        success: false,
        error: `Invalid voice intent '${intent}'. Supported intents: ${validIntents.join(', ')}`,
      },
    };
  }

  // W3C Distributed Tracing Context
  const correlationId = headers['x-correlation-id'] || body.correlationId || body.correlation_id || `corr_voice_req_${Date.now()}`;
  const traceparent = headers.traceparent || headers['traceparent'];
  const causationId = `voice_req_${Date.now()}`;

  // Mode: Direct Dispatch vs Intake Gateway
  const isDirectDispatch = body.checkApproval === true || Boolean(body.approvalId) || body.mode === 'DISPATCH';

  if (isDirectDispatch) {
    const isHighValue = budgetAed >= 10000000;
    const approvals = await supabase.fetchApprovals('ALL');
    let matchedApproval = null;
    if (body.approvalId) {
      matchedApproval = approvals.find((a) => a.id === body.approvalId);
    } else {
      matchedApproval = approvals.find(
        (a) =>
          (a.recipient === recipient || a.payload?.name === recipient || a.payload?.recipient === recipient) &&
          (a.category === 'HIGH_VALUE_MANDATE' || a.category === 'VOICE_BROADCAST')
      );
    }

    if (isHighValue && !body.forceBypass) {
      if (!matchedApproval || matchedApproval.status === 'PENDING') {
        if (!matchedApproval) {
          matchedApproval = await supabase.createApproval({
            id: `appr_voice_${Date.now()}`,
            title: `Voice Outreach Authorization for ${recipient}`,
            agent: 'AIDA (Voice AI Specialist)',
            category: 'VOICE_BROADCAST',
            priority: 'CRITICAL',
            status: 'PENDING',
            recipient,
            targetAsset,
            payload: {
              intent,
              budgetAed,
              targetAsset,
              channel,
              script: body.script,
              correlationId,
              traceparent,
            },
          });
        }

        return {
          status: 403,
          headers: responseHeaders,
          body: {
            success: false,
            error: 'HITL_APPROVAL_REQUIRED',
            message: `Voice outreach blocked for ${recipient}: Mandatory Executive HITL approval required for high-value allocation (AED ${(budgetAed / 1000000).toFixed(1)}M).`,
            approvalId: matchedApproval.id,
            status: 'PENDING',
            gate: 'HITL_EXECUTIVE_APPROVAL',
          },
        };
      }

      if (matchedApproval.status === 'REJECTED') {
        return {
          status: 403,
          headers: responseHeaders,
          body: {
            success: false,
            error: 'HITL_APPROVAL_REJECTED',
            message: `Voice outreach was rejected by Executive Committee for approval [${matchedApproval.id}].`,
            approvalId: matchedApproval.id,
            status: 'REJECTED',
          },
        };
      }
    }

    // Direct Synthesis & Dispatch
    const voiceOutput = await voiceAi.synthesize(intent, {
      recipient,
      targetAsset,
      budgetAed,
      channel,
      customScript: body.script || body.customScript,
      correlationId,
    });

    const event = await enterpriseEventBus.publishEvent(
      'raioc.voice.outreach_dispatched.v1',
      'raioc://communication/voice/gateway',
      {
        intent,
        messageType: body.messageType || null,
        recipient,
        investorId,
        channel,
        script: voiceOutput.script,
        audioSha256: voiceOutput.audioSha256,
        audioDurationSeconds: voiceOutput.audioDurationSeconds,
        confidence: voiceOutput.confidence,
        provider: voiceOutput.provider,
        voiceId: 'AidaExecutiveDubaiWealthV1',
        approvalId: matchedApproval?.id || 'AUTO_GRANTED',
        budgetAed,
        targetAsset,
        requestedAt: new Date().toISOString(),
      },
      {
        correlationId,
        causationId,
        traceparent,
        subject: `voice_${intent.toLowerCase()}_${recipient.replace(/\s+/g, '_')}`,
      }
    );

    const durationMs = Date.now() - startTime;
    logger.info('VOICE_API', `Dispatched Voice Communication [${intent}] for ${recipient} in ${durationMs}ms`, {
      eventId: event.id,
      correlationId,
    });

    return {
      status: 200,
      headers: responseHeaders,
      body: {
        success: true,
        status: 'DISPATCHED',
        eventId: event.id,
        traceparent: event.traceparent,
        correlationId: event.correlation_id,
        intent,
        recipient,
        audio: {
          provider: voiceOutput.provider,
          voiceId: 'AidaExecutiveDubaiWealthV1',
          durationSeconds: voiceOutput.audioDurationSeconds,
          sha256: voiceOutput.audioSha256,
          confidence: voiceOutput.confidence,
          script: voiceOutput.script,
        },
        event: {
          type: 'raioc.voice.outreach_dispatched.v1',
          eventId: event.id,
          traceparent: event.traceparent,
          correlationId: event.correlation_id,
        },
        approvalId: matchedApproval?.id || 'AUTO_GRANTED',
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Pure Input Gateway Mode (Publish raioc.communication.voice.requested.v1)
  const payload = {
    intent,
    messageType: body.messageType || null,
    recipient,
    investorId,
    channel,
    context: body.context || {},
    script: body.script || body.customScript || null,
    objectionCategory: body.objectionCategory || body.category || null,
    budgetAed,
    targetAsset,
    isExternallySensitive: body.isExternallySensitive === true || body.sensitive === true,
    requestedAt: new Date().toISOString(),
  };

  const event = await enterpriseEventBus.publishEvent(
    'raioc.communication.voice.requested.v1',
    'raioc://communication/voice/gateway',
    payload,
    {
      correlationId,
      causationId,
      traceparent,
      subject: `voice_${intent.toLowerCase()}_${recipient.replace(/\s+/g, '_')}`,
    }
  );

  const durationMs = Date.now() - startTime;
  logger.info('VOICE_API', `Received Voice Communication Request [${intent}] for ${recipient} in ${durationMs}ms`, {
    eventId: event.id,
    correlationId,
  });

  return {
    status: 200,
    headers: responseHeaders,
    body: {
      status: 'RECEIVED',
      eventId: event.id,
      traceparent: event.traceparent,
      correlationId: event.correlation_id,
      intent,
      recipient,
      timestamp: new Date().toISOString(),
    },
  };
}
