/**
 * RAIOC OS - Enterprise Core Registry API Gateway (Phase 2)
 * Manages foundational Agent, Tool, and Automation Workflow Registries.
 * 
 * Endpoints:
 * - GET /api/core/agents: Query active agent registry with capability/status filters
 * - POST /api/core/agents: Register or update an autonomous agent
 * - GET /api/core/tools: Query tool status and operational health
 * - POST /api/core/tools: Register or update an enterprise tool
 * - GET /api/core/workflows: Query registered automation workflows
 * - POST /api/core/workflows: Register or update a workflow definition
 */

import { supabase } from '../../db/supabase-client.js';
import { authMiddleware } from '../../security/auth-middleware.js';
import { logger } from '../../logging/audit-logger.js';

export async function handleRegistryRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  const cleanUrl = url.split('?')[0].replace(/\/$/, '');

  // 1. Agent Registry Endpoints (/api/core/agents, /api/core/agents/:id)
  if (cleanUrl === '/api/core/agents' || cleanUrl.startsWith('/api/core/agents/')) {
    if (method === 'GET') {
      const agentId = cleanUrl.replace(/^\/api\/core\/agents\/?/, '').split('/')[0];
      if (agentId) {
        const agent = await supabase.getCoreAgent(agentId);
        if (!agent) {
          return { status: 404, body: { success: false, error: `Agent ${agentId} not found in core registry` } };
        }
        return { status: 200, body: { success: true, agent } };
      }

      const agents = await supabase.fetchCoreAgents(query);
      return {
        status: 200,
        body: {
          success: true,
          count: agents.length,
          agents,
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (method === 'POST' || method === 'PUT') {
      const auth = authMiddleware.authenticateRequest(headers);
      if (!auth.authenticated) {
        logger.warn('CORE_REGISTRY', 'Unauthorized attempt to upsert agent in registry');
        return { status: 401, body: { success: false, error: auth.error || 'Unauthorized' } };
      }

      if (!body.name || !body.role) {
        return { status: 400, body: { success: false, error: 'Agent name and role are required' } };
      }

      const agent = await supabase.upsertCoreAgent(body);
      logger.info('CORE_REGISTRY', `Agent upserted: ${agent.id} (${agent.name})`);
      return { status: 200, body: { success: true, agent } };
    }

    if (method === 'DELETE') {
      const auth = authMiddleware.authenticateRequest(headers);
      if (!auth.authenticated) {
        return { status: 401, body: { success: false, error: auth.error || 'Unauthorized' } };
      }
      const agentId = cleanUrl.replace(/^\/api\/core\/agents\/?/, '').split('/')[0];
      const deleted = await supabase.deleteCoreAgent(agentId);
      return { status: 200, body: { success: deleted, deletedId: agentId } };
    }
  }

  // 2. Tool Registry Endpoints (/api/core/tools, /api/core/tools/:id)
  if (cleanUrl === '/api/core/tools' || cleanUrl.startsWith('/api/core/tools/')) {
    if (method === 'GET') {
      const toolId = cleanUrl.replace(/^\/api\/core\/tools\/?/, '').split('/')[0];
      if (toolId) {
        const tool = await supabase.getCoreTool(toolId);
        if (!tool) {
          return { status: 404, body: { success: false, error: `Tool ${toolId} not found in registry` } };
        }
        return { status: 200, body: { success: true, tool } };
      }

      const tools = await supabase.fetchCoreTools(query);
      return {
        status: 200,
        body: {
          success: true,
          count: tools.length,
          tools,
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (method === 'POST' || method === 'PUT') {
      const auth = authMiddleware.authenticateRequest(headers);
      if (!auth.authenticated) {
        return { status: 401, body: { success: false, error: auth.error || 'Unauthorized' } };
      }

      if (!body.name || !body.category) {
        return { status: 400, body: { success: false, error: 'Tool name and category are required' } };
      }

      const tool = await supabase.upsertCoreTool(body);
      logger.info('CORE_REGISTRY', `Tool registered: ${tool.id} [${tool.category}]`);
      return { status: 200, body: { success: true, tool } };
    }
  }

  // 3. Workflow Registry Endpoints (/api/core/workflows, /api/core/workflows/:id)
  if (cleanUrl === '/api/core/workflows' || cleanUrl.startsWith('/api/core/workflows/')) {
    if (method === 'GET') {
      const wfId = cleanUrl.replace(/^\/api\/core\/workflows\/?/, '').split('/')[0];
      if (wfId) {
        const workflow = await supabase.getCoreWorkflow(wfId);
        if (!workflow) {
          return { status: 404, body: { success: false, error: `Workflow ${wfId} not found in registry` } };
        }
        return { status: 200, body: { success: true, workflow } };
      }

      const workflows = await supabase.fetchCoreWorkflows(query);
      return {
        status: 200,
        body: {
          success: true,
          count: workflows.length,
          workflows,
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (method === 'POST' || method === 'PUT') {
      const auth = authMiddleware.authenticateRequest(headers);
      if (!auth.authenticated) {
        return { status: 401, body: { success: false, error: auth.error || 'Unauthorized' } };
      }

      if (!body.name || !body.orchestrator) {
        return { status: 400, body: { success: false, error: 'Workflow name and orchestrator are required' } };
      }

      const workflow = await supabase.upsertCoreWorkflow(body);
      logger.info('CORE_REGISTRY', `Workflow registered: ${workflow.id} [orchestrator: ${workflow.orchestrator}]`);
      return { status: 200, body: { success: true, workflow } };
    }
  }

  return {
    status: 404,
    body: {
      success: false,
      error: `Unknown registry endpoint: ${url}`,
      availableEndpoints: ['/api/core/agents', '/api/core/tools', '/api/core/workflows'],
    },
  };
}
