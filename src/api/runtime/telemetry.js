/**
 * RAIOC OS - Runtime Telemetry API Gateway (Sprint 2 Core)
 * Exposes live agent/tool runtime metrics and system health matrices,
 * cleanly separated from static configuration registries.
 * 
 * Endpoints:
 * - GET  /api/v1/runtime/telemetry/agents
 * - POST /api/v1/runtime/telemetry/agents (Heartbeat / status update)
 * - GET  /api/v1/runtime/telemetry/tools
 * - POST /api/v1/runtime/telemetry/tools (Health probe report)
 * - GET  /api/v1/runtime/health-matrix
 */

import { supabase } from '../../db/supabase-client.js';
import { authMiddleware } from '../../security/auth-middleware.js';
import { connectorHealthMatrix } from '../../monitoring/connector-health-matrix.js';
import { logger } from '../../logging/audit-logger.js';

export async function handleRuntimeTelemetryRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  // 1. GET / POST /api/v1/runtime/telemetry/agents
  if (url.includes('/runtime/telemetry/agents')) {
    if (method === 'GET') {
      if (query.agentId || query.agent_id) {
        const agent = await supabase.getAgentRuntimeTelemetry(query.agentId || query.agent_id);
        if (!agent) return { status: 404, body: { success: false, error: 'Agent telemetry not found' } };
        return { status: 200, body: { success: true, telemetry: agent } };
      }
      const telemetry = await supabase.fetchRuntimeAgentTelemetry();
      return { status: 200, body: { success: true, telemetry, count: telemetry.length } };
    }

    if (method === 'POST') {
      const auth = authMiddleware.authenticateRequest(headers);
      if (!auth.authenticated) {
        return { status: 401, body: { success: false, error: 'Unauthorized: Agent telemetry update requires authentication' } };
      }

      if (!body.agent_id && !body.agentId) {
        return { status: 400, body: { success: false, error: 'agent_id is required' } };
      }

      const recorded = await supabase.recordRuntimeAgentTelemetry(body);
      logger.info('RUNTIME_TELEMETRY', `Agent telemetry updated for ${recorded.agent_id} [${recorded.live_status}]`);
      return { status: 200, body: { success: true, telemetry: recorded } };
    }

    return { status: 405, body: { success: false, error: `Method ${method} not allowed` } };
  }

  // 2. GET / POST /api/v1/runtime/telemetry/tools
  if (url.includes('/runtime/telemetry/tools')) {
    if (method === 'GET') {
      if (query.toolId || query.tool_id) {
        const tool = await supabase.getToolRuntimeTelemetry(query.toolId || query.tool_id);
        if (!tool) return { status: 404, body: { success: false, error: 'Tool telemetry not found' } };
        return { status: 200, body: { success: true, telemetry: tool } };
      }
      const telemetry = await supabase.fetchRuntimeToolTelemetry();
      return { status: 200, body: { success: true, telemetry, count: telemetry.length } };
    }

    if (method === 'POST') {
      const auth = authMiddleware.authenticateRequest(headers);
      if (!auth.authenticated) {
        return { status: 401, body: { success: false, error: 'Unauthorized: Tool telemetry update requires authentication' } };
      }

      if (!body.tool_id && !body.toolId) {
        return { status: 400, body: { success: false, error: 'tool_id is required' } };
      }

      const recorded = await supabase.recordRuntimeToolTelemetry(body);
      logger.info('RUNTIME_TELEMETRY', `Tool telemetry updated for ${recorded.tool_id} [${recorded.live_health_status}]`);
      return { status: 200, body: { success: true, telemetry: recorded } };
    }

    return { status: 405, body: { success: false, error: `Method ${method} not allowed` } };
  }

  // 3. GET /api/v1/runtime/health-matrix
  if (url.includes('/runtime/health-matrix')) {
    if (method !== 'GET') {
      return { status: 405, body: { success: false, error: `Method ${method} not allowed` } };
    }

    const [agentTelemetry, toolTelemetry, systemMetrics, connectors] = await Promise.all([
      supabase.fetchRuntimeAgentTelemetry(),
      supabase.fetchRuntimeToolTelemetry(),
      supabase.fetchRuntimeSystemMetrics(1),
      connectorHealthMatrix.getMatrixStatus ? connectorHealthMatrix.getMatrixStatus() : {},
    ]);

    const activeAgents = agentTelemetry.filter((a) => a.live_status === 'ACTIVE' || a.live_status === 'PROCESSING' || a.live_status === 'IDLE').length;
    const healthyTools = toolTelemetry.filter((t) => t.live_health_status === 'HEALTHY').length;

    return {
      status: 200,
      body: {
        success: true,
        summary: {
          totalAgents: agentTelemetry.length,
          activeAgents,
          totalTools: toolTelemetry.length,
          healthyTools,
          overallHealth: healthyTools === toolTelemetry.length ? 'HEALTHY' : 'DEGRADED',
        },
        agents: agentTelemetry,
        tools: toolTelemetry,
        system: systemMetrics[0] || null,
        connectors,
        timestamp: new Date().toISOString(),
      },
    };
  }

  return { status: 404, body: { success: false, error: `Telemetry endpoint not found: ${url}` } };
}
