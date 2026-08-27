/**
 * RAIOC OS - Mission Control Executive Approvals API
 * Manages human-in-the-loop executive approval gates for high-value autonomous decisions.
 * 
 * Endpoints:
 * - GET  /api/v1/mission-control/approvals (or /api/mission-control/approvals)
 * - POST /api/v1/mission-control/approvals/resolve (Requires authorization)
 * - POST /api/v1/approvals/decide (1-Click CEO Decision & AIDA continuous dispatch)
 */

import { supabase } from '../../db/supabase-client.js';
import { enterpriseEventBus } from '../../core/event-bus.js';
import { voiceAi, VOICE_INTENTS } from '../../core/voice-ai.js';
import { authMiddleware, Roles } from '../../security/auth-middleware.js';
import { logger } from '../../logging/audit-logger.js';
import { agentEventBus } from '../../events/agent-event-bus.js';
import { formatVipPostApprovalDispatch } from '../../services/vip-dispatch-service.js';

export async function handleApprovalsRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  const cleanPath = url.split('?')[0].replace(/\/+$/, '');

  // 1. POST /api/v1/approvals/decide or /api/approvals/decide or /api/v1/mission-control/approvals/resolve
  if (method === 'POST' && (cleanPath.endsWith('/decide') || cleanPath.endsWith('/approvals') || cleanPath.endsWith('/approvals/resolve'))) {
    // Authenticate request using Bearer Token or RAIOC_INTERNAL_SECRET if resolve endpoint, else allow executive session
    if (cleanPath.endsWith('/resolve')) {
      const auth = authMiddleware.authenticateRequest(headers, [Roles.ADMIN]);
      if (!auth.authenticated) {
        logger.warn('APPROVALS_GATE', 'Rejected unauthenticated approval resolution attempt', { error: auth.error });
        return {
          status: 401,
          body: {
            success: false,
            error: 'Unauthorized: RAIOC_INTERNAL_SECRET or valid Bearer token is required for executive approval resolution',
            details: auth.error,
          },
        };
      }
    }

    const approvalId = body.approvalId || body.id || body.approval_id;
    if (!approvalId) {
      return {
        status: 400,
        body: { success: false, error: 'Missing required field: approvalId, approval_id or id' },
      };
    }

    const rawAction = (body.resolution || body.action || body.status || body.decision || '').toUpperCase();
    if (!['APPROVE', 'APPROVED', 'REJECT', 'REJECTED'].includes(rawAction)) {
      return {
        status: 400,
        body: { success: false, error: 'Invalid action. Must be APPROVED or REJECTED' },
      };
    }

    const cleanAction = rawAction.startsWith('APP') ? 'APPROVED' : 'REJECTED';
    const actor = body.actor || body.approvedBy || body.approved_by || body.decided_by || body.decidedBy || 'Emanuel Rendas';
    const resolutionNote = body.note || body.comments || `Action ${cleanAction} via Mission Control`;
    const correlationId = headers['x-correlation-id'] || body.correlation_id || `corr_appr_${Date.now()}`;
    const traceparent = headers['traceparent'] || body.traceparent;

    const resolvedRecord = await supabase.resolveApproval(approvalId, cleanAction, actor, {
      note: resolutionNote,
      resolvedAt: new Date().toISOString(),
      correlationId,
    });

    agentEventBus.publish('approval:resolved', resolvedRecord, {
      sourceAgent: 'human_executive_gate',
      correlationId,
    });

    let dispatchedVoiceEvent = null;
    let dispatchedVipEvent = null;

    // Trigger AIDA Voice Outreach and VIP Dispatch on APPROVED decision
    if (cleanAction === 'APPROVED') {
      const allApprovals = await supabase.fetchApprovals('ALL');
      const approvalItem = allApprovals.find((a) => a.id === approvalId) || resolvedRecord;
      const payload = approvalItem.payload || {};

      const recipient = approvalItem.recipient || payload.recipient || payload.name || 'Private Sovereign Investor';
      const targetAsset = approvalItem.target_asset || approvalItem.targetAsset || payload.targetAsset || 'Como Residences in Palm Jumeirah';
      const budgetAed = Number(payload.budgetAed || payload.budget_aed || 25000000);
      const intent = (payload.intent || VOICE_INTENTS.INVESTOR_FOLLOWUP).toUpperCase();
      const channel = (payload.channel || 'WHATSAPP').toUpperCase();

      const voiceOutput = await voiceAi.synthesize(intent, {
        recipient,
        targetAsset,
        budgetAed,
        channel,
        customScript: payload.script || body.script,
        correlationId,
      });

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
          approvalId,
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

      // Format and emit VIP post-approval dispatch CloudEvent
      const vipFormatted = formatVipPostApprovalDispatch({
        mandateId: payload.mandateId || payload.mandate_id || approvalItem.mandate_id || `MND-${approvalId.substring(0, 8)}`,
        investorName: recipient,
        corridorKey: payload.corridorKey || payload.corridor || 'PALM_JEBEL_ALI',
        corridorName: payload.corridorName || 'Palm Jebel Ali Sovereign Corridor',
        allocationAed: budgetAed,
        ownershipVehicle: payload.ownershipVehicle || 'SPV_DIFC_ADGM',
        briefId: payload.briefId || `PIB-${Date.now()}`,
        documentSha256: payload.documentSha256 || payload.sha256 || voiceOutput.audioSha256,
        locale: payload.locale || 'en',
      });

      const vipEvent = await enterpriseEventBus.publishEvent(
        'raioc.communication.vip.dispatched.v1',
        'raioc://communication/vip/dispatcher',
        {
          approvalId,
          mandateId: vipFormatted.mandateId,
          investorName: recipient,
          allocationAed: budgetAed,
          messageSha256: vipFormatted.messageSha256,
          messageText: vipFormatted.messageText,
          subject: vipFormatted.subject,
          timezones: vipFormatted.timezones,
          locale: vipFormatted.locale,
          approvedBy: actor,
          dispatchedAt: new Date().toISOString(),
        },
        {
          correlationId,
          traceparent,
          subject: `vip_dispatch_${recipient.replace(/\s+/g, '_')}`,
        }
      );

      dispatchedVipEvent = {
        eventId: vipEvent.id,
        type: vipEvent.type,
        messageSha256: vipFormatted.messageSha256,
        timezones: vipFormatted.timezones,
        locale: vipFormatted.locale,
      };

      await supabase.recordInteractionLog({
        channel: 'VOICE_DISPATCH',
        event_type: 'VOICE_OUTREACH_DISPATCHED',
        source_agent: 'AIDA',
        direction: 'OUTBOUND',
        summary: `Executive voice & VIP outreach autonomously dispatched for ${recipient} following CEO approval [${approvalId}]`,
        payload: {
          approvalId,
          actor,
          recipient,
          intent,
          budgetAed,
          targetAsset,
          audioSha256: voiceOutput.audioSha256,
          vipMessageSha256: vipFormatted.messageSha256,
        },
        correlation_id: correlationId,
        traceparent,
        status: 'SUCCESS',
      });
    }

    logger.info('APPROVALS_GATE', `Executive Action resolved: ${approvalId} -> ${cleanAction} by ${actor}`);

    return {
      status: 200,
      body: {
        success: true,
        message: `Approval item ${approvalId} marked as ${cleanAction}`,
        decision: cleanAction,
        approvalId,
        approval: resolvedRecord,
        dispatchedEvent: dispatchedVoiceEvent,
        vipDispatch: dispatchedVipEvent,
        actor,
        resolvedAt: new Date().toISOString(),
      },
    };
  }

  // 2. GET /api/mission-control/approvals or /api/v1/mission-control/approvals
  if (cleanPath === '/api/mission-control/approvals' || cleanPath.endsWith('/approvals')) {
    if (method !== 'GET') {
      return {
        status: 405,
        body: { success: false, error: `Method ${method} not allowed on approvals list` },
      };
    }

    const statusFilter = (query.status || 'PENDING').toUpperCase();
    const approvals = await supabase.fetchApprovals(statusFilter);

    return {
      status: 200,
      body: {
        success: true,
        statusFilter,
        approvals,
        count: approvals.length,
        timestamp: new Date().toISOString(),
      },
    };
  }

  return {
    status: 404,
    body: { success: false, error: `Approvals endpoint not found: ${url}` },
  };
}
