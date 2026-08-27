/**
 * RAIOC OS - Enterprise Core & Registry Foundation Integration Test Suite
 * Validates Agent Registry, Tool Registry, Workflow Registry, Knowledge Graph CRUD,
 * Relational Graph Traversals, and Endpoint Security Enforcements.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { routeApiRequest } from '../../src/api/server.js';
import { supabase } from '../../src/db/supabase-client.js';

const VALID_SECRET = process.env.RAIOC_INTERNAL_SECRET || 'raioc_sovereign_auth_2026_x99';

describe('INTEGRATION: Enterprise Core Registries & Knowledge Graph', () => {
  beforeEach(() => {
    if (supabase.isMock) {
      supabase.initEnterpriseCoreSeeds();
    }
  });

  // --- 1. Agent Registry Tests ---

  test('1. GET /api/core/agents returns seeded autonomous agent roster', async () => {
    const res = await routeApiRequest('/api/core/agents', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.agents));
    assert.ok(res.body.agents.length >= 6);

    const ids = res.body.agents.map((a) => a.id);
    assert.ok(ids.includes('jarvis_executive_brain'));
    assert.ok(ids.includes('mark_lead_triage'));
    assert.ok(ids.includes('atlas_opal_calculator'));
    assert.ok(ids.includes('aida_flow_mixboard'));
    assert.ok(ids.includes('lex_compliance_legal'));
    assert.ok(ids.includes('sentinel_devops_qa'));
  });

  test('2. GET /api/core/agents with capability and model filters', async () => {
    const resCap = await routeApiRequest('/api/core/agents?capability=dira_scoring', 'GET');
    assert.strictEqual(resCap.status, 200);
    assert.ok(resCap.body.agents.some((a) => a.id === 'mark_lead_triage'));

    const resModel = await routeApiRequest('/api/core/agents?model=gemini-3.6-flash', 'GET');
    assert.strictEqual(resModel.status, 200);
    assert.ok(resModel.body.agents.length >= 6);
  });

  test('3. POST /api/core/agents rejects unauthenticated requests (401)', async () => {
    const newAgent = {
      id: 'orion_satellite_intelligence',
      name: 'ORION',
      role: 'Satellite Earth Observation & Construction Milestone Specialist',
    };
    const res = await routeApiRequest('/api/core/agents', 'POST', newAgent, {}, {});
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test('4. POST /api/core/agents registers a new specialist agent with valid auth', async () => {
    const newAgent = {
      id: 'orion_satellite_intelligence',
      name: 'ORION',
      role: 'Satellite Earth Observation & Construction Milestone Specialist',
      model: 'gemini-3.6-flash',
      capabilities: ['satellite_imagery_analysis', 'dld_project_inspection', 'escrow_milestone_audit'],
      permissions: ['read:satellite', 'audit:construction'],
      cost_budget: { monthly_limit_usd: 350, current_spend_usd: 0, currency: 'USD' },
      version: '1.0.0',
      owner: 'CTO',
      status: 'ACTIVE',
    };

    const res = await routeApiRequest('/api/core/agents', 'POST', newAgent, {}, {
      Authorization: `Bearer ${VALID_SECRET}`,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.agent.id, 'orion_satellite_intelligence');
    assert.strictEqual(res.body.agent.name, 'ORION');

    // Verify GET by ID
    const getRes = await routeApiRequest('/api/core/agents/orion_satellite_intelligence', 'GET');
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.agent.id, 'orion_satellite_intelligence');
  });

  // --- 2. Tool Registry Tests ---

  test('5. GET /api/core/tools returns registered enterprise tools', async () => {
    const res = await routeApiRequest('/api/core/tools', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.tools));
    assert.ok(res.body.tools.length >= 8);

    const ids = res.body.tools.map((t) => t.id);
    assert.ok(ids.includes('gemini_api'));
    assert.ok(ids.includes('supabase_database'));
    assert.ok(ids.includes('vercel_gateway'));
    assert.ok(ids.includes('n8n_orchestration'));
    assert.ok(ids.includes('opal_engine'));
    assert.ok(ids.includes('flow_engine'));
    assert.ok(ids.includes('mixboard_engine'));
    assert.ok(ids.includes('youtube_data_api'));
  });

  test('6. GET /api/core/tools with category filter', async () => {
    const res = await routeApiRequest('/api/core/tools?category=MULTIMEDIA', 'GET');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.tools.length >= 2);
    assert.ok(res.body.tools.every((t) => t.category === 'MULTIMEDIA'));
  });

  test('7. POST /api/core/tools upserts a new tool with quota limits', async () => {
    const newTool = {
      id: 'dld_rest_connector',
      name: 'Dubai Land Department Smart Data REST Connector',
      category: 'DATABASE',
      health_status: 'HEALTHY',
      latency_ms: 22,
      quota_limits: { rate_limit_per_min: 100, daily_quota: 5000 },
      dependencies: ['supabase_database'],
    };

    const res = await routeApiRequest('/api/core/tools', 'POST', newTool, {}, {
      'x-raioc-secret': VALID_SECRET,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.tool.id, 'dld_rest_connector');
    assert.strictEqual(res.body.tool.health_status, 'HEALTHY');
  });

  // --- 3. Workflow Registry Tests ---

  test('8. GET /api/core/workflows returns registered workflows', async () => {
    const res = await routeApiRequest('/api/core/workflows', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.workflows));
    assert.ok(res.body.workflows.length >= 4);

    const ids = res.body.workflows.map((w) => w.id);
    assert.ok(ids.includes('wf_google_tools_orchestration'));
    assert.ok(ids.includes('wf_lead_ingestion_triage'));
    assert.ok(ids.includes('wf_outbound_dispatch'));
    assert.ok(ids.includes('wf_golden_visa_audit'));
  });

  test('9. POST /api/core/workflows registers automation workflow definition', async () => {
    const newWf = {
      id: 'wf_sovereign_tax_arbitrage',
      name: 'Portugal NHR & Spain Wealth Tax Autonomous Hedge Pipeline',
      orchestrator: 'n8n',
      trigger_type: 'WEBHOOK',
      input_schema: { type: 'object', properties: { investorOrigin: { type: 'string' } } },
      output_schema: { type: 'object', properties: { statutoryShieldId: { type: 'string' } } },
      owner: 'CTO',
      is_active: true,
      version: '1.0.0',
    };

    const res = await routeApiRequest('/api/core/workflows', 'POST', newWf, {}, {
      Authorization: `Bearer ${VALID_SECRET}`,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.workflow.id, 'wf_sovereign_tax_arbitrage');
  });

  // --- 4. Knowledge Graph Tests ---

  test('10. GET /api/core/knowledge/graph returns initial knowledge graph topology', async () => {
    const res = await routeApiRequest('/api/core/knowledge/graph', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.graph.nodes));
    assert.ok(Array.isArray(res.body.graph.edges));
    assert.ok(res.body.graph.nodes.length >= 6);
    assert.ok(res.body.graph.edges.length >= 4);

    const nodeIds = res.body.graph.nodes.map((n) => n.id);
    assert.ok(nodeIds.includes('node_uae_law8_escrow'));
    assert.ok(nodeIds.includes('node_golden_visa_res65_2022'));
    assert.ok(nodeIds.includes('node_palm_jumeirah'));
    assert.ok(nodeIds.includes('node_como_residences'));
  });

  test('11. POST /api/core/knowledge/node inserts entity node and validates schema', async () => {
    // Missing schema rejection
    const invalidNode = { label: 'Incomplete Node' };
    const rejectRes = await routeApiRequest('/api/core/knowledge/node', 'POST', invalidNode, {}, {
      Authorization: `Bearer ${VALID_SECRET}`,
    });
    assert.strictEqual(rejectRes.status, 400);

    // Valid node insertion
    const validNode = {
      id: 'node_dubai_creek_harbour',
      entity_type: 'MARKET_ZONE',
      label: 'Dubai Creek Harbour Prime Freehold District',
      properties: { avg_yield_pct: 7.2, developer: 'Emaar', waterfront: true },
    };

    const res = await routeApiRequest('/api/core/knowledge/node', 'POST', validNode, {}, {
      Authorization: `Bearer ${VALID_SECRET}`,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.node.id, 'node_dubai_creek_harbour');
    assert.strictEqual(res.body.node.entity_type, 'MARKET_ZONE');
  });

  test('12. POST /api/core/knowledge/edge creates relationship and enables graph traversal', async () => {
    const newEdge = {
      id: 'edge_valia_located_creek',
      source_node_id: 'node_como_residences',
      target_node_id: 'node_dubai_creek_harbour',
      relationship_type: 'CROSS_PORTFOLIO_HEDGE',
      metadata: { strategicWeight: 0.85 },
    };

    const res = await routeApiRequest('/api/core/knowledge/edge', 'POST', newEdge, {}, {
      'x-raioc-secret': VALID_SECRET,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.edge.id, 'edge_valia_located_creek');
    assert.strictEqual(res.body.edge.relationship_type, 'CROSS_PORTFOLIO_HEDGE');

    // Contextual subgraph traversal query
    const traverseRes = await routeApiRequest('/api/core/knowledge/graph?nodeId=node_como_residences', 'GET');
    assert.strictEqual(traverseRes.status, 200);
    assert.ok(traverseRes.body.graph.nodes.some((n) => n.id === 'node_como_residences'));
    assert.ok(traverseRes.body.graph.edges.some((e) => e.id === 'edge_valia_located_creek'));
  });
});

