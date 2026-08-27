import { NextResponse } from 'next/server';
import { supabase } from '@/src/db/supabase-client.js';
import { enterpriseEventBus } from '@/src/core/event-bus.js';
import { voiceAi, VOICE_INTENTS } from '@/src/core/voice-ai.js';
import { logger } from '@/src/logging/audit-logger.js';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const rawHeaders: Record<string, string> = {};
    request.headers.forEach((val, key) => {
      rawHeaders[key] = val;
    });

    const body = await request.json().catch(() => ({}));
    const approvalId = body.approvalId || body.id || body.approval_id;

    if (!approvalId) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_APPROVAL_ID',
          message: 'Field approvalId, approval_id or id is required to make an executive decision',
        },
        { status: 400 }
      );
    }

    const rawDecision = String(body.decision || body.action || body.resolution || body.status || '').toUpperCase();
    if (!['APPROVE', 'APPROVED', 'REJECT', 'REJECTED'].includes(rawDecision)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_DECISION',
          message: 'Decision must be APPROVED or REJECTED',
        },
        { status: 400 }
      );
    }

    const cleanDecision = rawDecision.startsWith('APP') ? 'APPROVED' : 'REJECTED';
    const actor = body.actor || body.decided_by || body.decidedBy || 'Emanuel Rendas (Chief Executive Officer)';
    const note = body.note || body.comments || `1-Click Executive HITL ${cleanDecision} via Mission Control`;
    const correlationId = rawHeaders['x-correlation-id'] || body.correlation_id || `corr_hitl_${Date.now()}`;
    const traceparent = rawHeaders['traceparent'] || body.traceparent || `00-${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-01`;

    // 1. Resolve Approval Record in Supabase
    const resolvedRecord = await supabase.resolveApproval(approvalId, cleanDecision, actor, {
      note,
      metadata: body.metadata || {},
      correlationId,
      resolvedAt: new Date().toISOString(),
    });

    logger.info('HITL_DECISION', `Executive Decision recorded: [${approvalId}] -> ${cleanDecision} by ${actor}`);

    let dispatchedVoiceEvent = null;

    // 2. If APPROVED, Automatically Unblock & Discontinue Workflow Flow (e.g. AIDA Voice Outreach)
    if (cleanDecision === 'APPROVED') {
      // Find full record payload
      const allApprovals = await supabase.fetchApprovals('ALL');
      const approvalItem = allApprovals.find((a: { id: string }) => a.id === approvalId) || resolvedRecord;
      const payload = approvalItem.payload || {};

      const recipient = approvalItem.recipient || payload.recipient || payload.name || 'Private Sovereign Investor';
      const targetAsset = approvalItem.target_asset || approvalItem.targetAsset || payload.targetAsset || 'Como Residences in Palm Jumeirah';
      const budgetAed = Number(payload.budgetAed || payload.budget_aed || 25000000);
      const intent = (payload.intent || VOICE_INTENTS.INVESTOR_FOLLOWUP).toUpperCase();
      const channel = (payload.channel || 'WHATSAPP').toUpperCase();

      // Synthesize executive voice message
      const voiceOutput = await voiceAi.synthesize(intent, {
        recipient,
        targetAsset,
        budgetAed,
        channel,
        customScript: payload.script || body.script,
        correlationId,
      });

      // Dispatch CloudEvent v1.1
      const event = await enterpriseEventBus.publishEvent(
        'raioc.voice.outreach_dispatched.v1',
        'raioc://communication/voice/gateway',
        {
          intent,
          recipient,
          budgetAed,
          targetAsset,
          channel,
          script: voiceOutput.script,
          audioSha256: voiceOutput.audioSha256,
          audioDurationSeconds: voiceOutput.audioDurationSeconds,
          confidence: voiceOutput.confidence,
          provider: voiceOutput.provider,
          voiceId: 'AidaExecutiveDubaiWealthV1',
          approvalId: approvalId,
          approvedBy: actor,
          dispatchedAt: new Date().toISOString(),
        },
        {
          correlationId,
          traceparent,
          subject: `voice_${intent.toLowerCase()}_${recipient.replace(/\s+/g, '_')}`,
        }
      );

      dispatchedVoiceEvent = {
        eventId: event.id,
        type: event.type,
        traceparent: event.traceparent,
        correlationId: event.correlation_id,
        audioSha256: voiceOutput.audioSha256,
        durationSeconds: voiceOutput.audioDurationSeconds,
        script: voiceOutput.script,
      };

      // Persist interaction log
      await supabase.recordInteractionLog({
        channel: 'VOICE_DISPATCH',
        event_type: 'VOICE_OUTREACH_DISPATCHED',
        source_agent: 'AIDA',
        direction: 'OUTBOUND',
        summary: `Executive voice outreach autonomously dispatched for ${recipient} following CEO approval [${approvalId}]`,
        payload: {
          approvalId,
          actor,
          recipient,
          intent,
          budgetAed,
          targetAsset,
          audioSha256: voiceOutput.audioSha256,
        },
        correlation_id: correlationId,
        traceparent,
        status: 'SUCCESS',
        latency_ms: Date.now() - startTime,
      });
    } else {
      // Publish Approval Rejected Event
      await enterpriseEventBus.publishEvent(
        'raioc.approval.resolved.v1',
        'raioc://mission-control/approvals',
        {
          approvalId,
          decision: 'REJECTED',
          actor,
          note,
          resolvedAt: new Date().toISOString(),
        },
        { correlationId, traceparent }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Executive decision [${cleanDecision}] executed successfully for approval ${approvalId}`,
        decision: cleanDecision,
        approvalId,
        approval: resolvedRecord,
        dispatchedEvent: dispatchedVoiceEvent,
        actor,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('HITL_DECISION', 'Failed to process HITL approval decision', { error: error.message });
    return NextResponse.json(
      {
        success: false,
        error: 'APPROVAL_DECISION_ERROR',
        message: error.message || 'Failed to process approval decision',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
