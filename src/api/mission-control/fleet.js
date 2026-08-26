/**
 * RAIOC OS - Mission Control Fleet Telemetry API
 * Manages autonomous agent fleet health, pulse metrics, and real-time heartbeat ingestion.
 * 
 * Endpoints:
 * - GET  /api/mission-control/fleet
 * - POST /api/mission-control/fleet/heartbeat (Requires authorization)
 */

import { supabase } from '../../db/supabase-client.js';
import { authMiddleware, Roles } from '../../security/auth-middleware.js';
import { logger } from '../../logging/audit-logger.js';
import { agentEventBus, AgentEvents } from '../../events/agent-event-bus.js';

export async function handleFleetRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  const cleanPath = url.split('?')[0].replace(/\/+$/, '');

  // 1. POST /api/mission-control/fleet/heartbeat
  if (cleanPath === '/api/mission-control/fleet/heartbeat' || cleanPath.endsWith('/fleet/heartbeat')) {
    if (method !== 'POST') {
      return {
        status: 405,
        body: { success: false, error: `Method ${method} not allowed on fleet heartbeat` },
      };
    }

    // Authenticate request using Bearer Token or RAIOC_INTERNAL_SECRET
    const auth = authMiddleware.authenticateRequest(headers, [Roles.ADMIN, Roles.AGENT]);
    if (!auth.authenticated) {
      logger.warn('FLEET_TELEMETRY', 'Rejected unauthenticated agent heartbeat attempt', { error: auth.error });
      return {
        status: 401,
        body: {
          success: false,
          error: 'Unauthorized: RAIOC_INTERNAL_SECRET or valid Bearer token is required for agent heartbeat registration',
          details: auth.error,
        },
      };
    }

    const agentId = body.agentId || body.agent_id || body.id;
    if (!agentId) {
      return {
        status: 400,
        body: { success: false, error: 'Missing required field: agentId' },
      };
    }

    const status = (body.status || 'IDLE').toUpperCase();
    const validStatuses = ['IDLE', 'PROCESSING', 'ALERT', 'OFFLINE'];
    const cleanStatus = validStatuses.includes(status) ? status : 'IDLE';

    const heartbeatRecord = await supabase.recordFleetHeartbeat({
      agentId,
      name: body.name || body.agentName,
      role: body.role,
      status: cleanStatus,
      currentTask: body.currentTask || body.activeTask || body.task || null,
      metrics: body.metrics || {
        latencyMs: body.latencyMs || 0,
        tasksCompleted: body.tasksCompleted || 0,
        tasksFailed: body.tasksFailed || 0,
        learningScore: body.learningScore || 95.0,
        efficiencyIndex: body.efficiencyIndex || 95,
      },
    });

    agentEventBus.publish('fleet:heartbeat', heartbeatRecord, {
      sourceAgent: agentId,
      correlationId: headers['x-correlation-id'] || `corr_hb_${Date.now()}`,
    });

    logger.info('FLEET_TELEMETRY', `Registered heartbeat for agent ${agentId} [status: ${cleanStatus}]`);

    return {
      status: 200,
      body: {
        success: true,
        message: 'Agent heartbeat successfully registered',
        agent: heartbeatRecord,
        registeredAt: new Date().toISOString(),
      },
    };
  }

  // 2. GET /api/mission-control/fleet
  if (cleanPath === '/api/mission-control/fleet' || cleanPath.endsWith('/fleet')) {
    if (method !== 'GET') {
      return {
        status: 405,
        body: { success: false, error: `Method ${method} not allowed on fleet status` },
      };
    }

    const fleet = await supabase.fetchFleetStatus();

    return {
      status: 200,
      body: {
        success: true,
        fleet,
        totalAgents: fleet.length,
        activeAgents: fleet.filter((a) => a.status === 'PROCESSING' || a.status === 'IDLE').length,
        alertAgents: fleet.filter((a) => a.status === 'ALERT').length,
        offlineAgents: fleet.filter((a) => a.status === 'OFFLINE').length,
        timestamp: new Date().toISOString(),
      },
    };
  }

  return {
    status: 404,
    body: { success: false, error: `Fleet endpoint not found: ${url}` },
  };
}
