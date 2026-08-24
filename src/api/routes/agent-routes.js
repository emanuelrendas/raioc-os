/**
 * RAIOC API - Shared Agent API Routes
 * Allows authorized services & subagents to execute tools across Gmail, Calendar, WhatsApp, CRM, and IKL.
 */

import { agentRuntime } from '../../agents/agent-runtime.js';
import { AgentAction, AgentContext } from '../../agents/agent-action-interface.js';
import { authMiddleware, Roles } from '../../security/auth-middleware.js';
import { toolRegistry } from '../../agents/tool-registry.js';
import { secretsManager } from '../../config/secrets-manager.js';

export async function handleAgentRequest(path, method = 'POST', body = {}, headers = {}) {
  const normalized = path.replace(/^\/api\/agents\/?/, '');

  // 1. List Available Tools (Public / Agent inspection)
  if (normalized === 'tools' || normalized === '') {
    return {
      status: 200,
      body: {
        tools: toolRegistry.listTools(),
        count: toolRegistry.tools.size,
      },
    };
  }

  // 2. Execute Single Action or Plan (Requires Service Authentication)
  if (normalized === 'execute') {
    const auth = authMiddleware.authenticateRequest(headers, [Roles.ADMIN, Roles.AGENT]);
    if (!auth.authenticated) {
      return { status: 401, body: { error: auth.error } };
    }

    const context = new AgentContext({
      correlationId: headers['x-correlation-id'] || headers['X-Correlation-ID'],
      callerId: headers['x-caller-id'] || 'service_client',
    });

    if (Array.isArray(body.actions)) {
      const planResults = await agentRuntime.executePlan(body.actions, context);
      return { status: 200, body: planResults };
    }

    if (!body.toolName) {
      return { status: 400, body: { error: "Missing required 'toolName' field" } };
    }

    const action = new AgentAction(body.toolName, body.parameters || {}, {
      idempotencyKey: body.idempotencyKey,
    });

    const result = await agentRuntime.executeAction(action, context);
    return { status: result.status === 'SUCCESS' ? 200 : 500, body: result };
  }

  // 3. System Environment Status (Sanitized)
  if (normalized === 'environment' || normalized === 'status') {
    const auth = authMiddleware.authenticateRequest(headers, [Roles.ADMIN]);
    if (!auth.authenticated) {
      return { status: 401, body: { error: auth.error } };
    }

    return {
      status: 200,
      body: secretsManager.getDiagnostics(),
    };
  }

  return { status: 404, body: { error: `Unknown agent endpoint: ${path}` } };
}
