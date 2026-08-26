/**
 * RAIOC OS - Mission Control Executive Approvals API
 * Manages human-in-the-loop executive approval gates for high-value autonomous decisions.
 * 
 * Endpoints:
 * - GET  /api/mission-control/approvals
 * - POST /api/mission-control/approvals/resolve (Requires authorization)
 */

import { supabase } from '../../db/supabase-client.js';
import { authMiddleware, Roles } from '../../security/auth-middleware.js';
import { logger } from '../../logging/audit-logger.js';
import { agentEventBus } from '../../events/agent-event-bus.js';

export async function handleApprovalsRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  const cleanPath = url.split('?')[0].replace(/\/+$/, '');

  // 1. POST /api/v1/mission-control/approvals or /api/v1/mission-control/approvals/resolve
  if (method === 'POST' && (cleanPath.endsWith('/approvals') || cleanPath.endsWith('/approvals/resolve'))) {
    // Authenticate request using Bearer Token or RAIOC_INTERNAL_SECRET
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

    const approvalId = body.approvalId || body.id;
    if (!approvalId) {
      return {
        status: 400,
        body: { success: false, error: 'Missing required field: approvalId or id' },
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
    const actor = body.actor || 'Emanuel Rendas (Principal Advisor)';
    const resolutionNote = body.note || body.comments || `Action ${cleanAction} via Mission Control`;

    const resolvedRecord = await supabase.resolveApproval(approvalId, cleanAction, actor, {
      note: resolutionNote,
      resolvedAt: new Date().toISOString(),
      correlationId: headers['x-correlation-id'] || `corr_appr_${Date.now()}`,
    });

    agentEventBus.publish('approval:resolved', resolvedRecord, {
      sourceAgent: 'human_executive_gate',
      correlationId: headers['x-correlation-id'] || `corr_appr_${Date.now()}`,
    });

    logger.info('APPROVALS_GATE', `Executive Action resolved: ${approvalId} -> ${cleanAction} by ${actor}`);

    return {
      status: 200,
      body: {
        success: true,
        message: `Approval item ${approvalId} marked as ${cleanAction}`,
        approval: resolvedRecord,
        resolvedAt: new Date().toISOString(),
      },
    };
  }

  // 2. GET /api/mission-control/approvals
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
