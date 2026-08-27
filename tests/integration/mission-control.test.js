/**
 * RAIOC OS - Mission Control & Fleet Telemetry Integration Test Suite
 * Validates Fleet Telemetry Heartbeat APIs, HITL Approval State Transitions,
 * Unauthenticated Access Rejections (401/403), Interaction Streams, and UI mounting.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { routeApiRequest } from '../../src/api/server.js';
import { agentEventBus } from '../../src/events/agent-event-bus.js';
import { supabase } from '../../src/db/supabase-client.js';

const VALID_SECRET = process.env.RAIOC_INTERNAL_SECRET || 'raioc_sovereign_auth_2026_x99';

describe('INTEGRATION: Executive Mission Control & Fleet Telemetry Gateways', () => {
  beforeEach(() => {
    if (supabase.isMock) {
      // Reset mock stores to initial clean state
      supabase.mockStore.agent_fleet_status = new Map();
      supabase.mockStore.executive_approvals = [];
    }
  });

  // --- Fleet Telemetry Tests ---

  test('1. GET /api/mission-control/fleet returns agent fleet matrix with metrics and statuses', async () => {
    const res = await routeApiRequest('/api/mission-control/fleet', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.fleet));
    assert.ok(res.body.fleet.length >= 5);

    // Verify key agents are present in the fleet roster
    const agentIds = res.body.fleet.map((a) => a.agentId);
    assert.ok(agentIds.includes('jarvis_executive_brain'));
    assert.ok(agentIds.includes('mark_lead_triage'));
    assert.ok(agentIds.includes('atlas_opal_calculator'));
    assert.ok(agentIds.includes('aida_flow_mixboard'));
    assert.ok(agentIds.includes('sentinel_devops_qa'));

    // Verify metric structures
    const jarvis = res.body.fleet.find((a) => a.agentId === 'jarvis_executive_brain');
    assert.ok(jarvis.metrics);
    assert.ok(jarvis.metrics.latencyMs !== undefined);
    assert.ok(jarvis.metrics.learningScore >= 90);
  });

  test('2. POST /api/mission-control/fleet/heartbeat rejects unauthenticated request (401)', async () => {
    const payload = {
      agentId: 'mark_lead_triage',
      status: 'PROCESSING',
      currentTask: 'Triaging inbound UHNW lead from Lisbon Family Office',
    };

    const res = await routeApiRequest('/api/mission-control/fleet/heartbeat', 'POST', payload, {}, {});
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error.includes('Unauthorized'));
  });

  test('3. POST /api/mission-control/fleet/heartbeat rejects invalid credentials (401)', async () => {
    const payload = {
      agentId: 'mark_lead_triage',
      status: 'PROCESSING',
      currentTask: 'Unauthorized attempt',
    };

    const res = await routeApiRequest('/api/mission-control/fleet/heartbeat', 'POST', payload, {}, {
      Authorization: 'Bearer invalid_secret_token_123',
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test('4. POST /api/mission-control/fleet/heartbeat registers live agent status and emits event with valid secret', async () => {
    let capturedEvent = null;
    const unsub = agentEventBus.subscribe('fleet:heartbeat', (evt) => {
      capturedEvent = evt;
    });

    const payload = {
      agentId: 'mark_lead_triage',
      status: 'PROCESSING',
      currentTask: 'Ingesting Portuguese NHR Lead: Gonçalo de Albuquerque (AED 15M)',
      metrics: {
        latencyMs: 14,
        tasksCompleted: 105,
        tasksFailed: 0,
        learningScore: 97.5,
        efficiencyIndex: 98,
      },
    };

    const res = await routeApiRequest('/api/mission-control/fleet/heartbeat', 'POST', payload, {}, {
      Authorization: `Bearer ${VALID_SECRET}`,
      'X-Correlation-ID': 'corr_test_hb_001',
    });

    unsub();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.agent.agentId, 'mark_lead_triage');
    assert.strictEqual(res.body.agent.status, 'PROCESSING');
    assert.strictEqual(res.body.agent.currentTask, 'Ingesting Portuguese NHR Lead: Gonçalo de Albuquerque (AED 15M)');

    // Event bus verification
    assert.ok(capturedEvent !== null);
    assert.strictEqual(capturedEvent.topic, 'fleet:heartbeat');
    assert.strictEqual(capturedEvent.payload.agentId, 'mark_lead_triage');

    // Verify persistence in subsequent GET /api/mission-control/fleet
    const getRes = await routeApiRequest('/api/mission-control/fleet', 'GET');
    const updatedAgent = getRes.body.fleet.find((a) => a.agentId === 'mark_lead_triage');
    assert.ok(updatedAgent);
    assert.strictEqual(updatedAgent.status, 'PROCESSING');
    assert.strictEqual(updatedAgent.currentTask, 'Ingesting Portuguese NHR Lead: Gonçalo de Albuquerque (AED 15M)');
  });

  // --- Executive Approval Gate Tests ---

  test('5. GET /api/mission-control/approvals returns pending executive actions', async () => {
    const res = await routeApiRequest('/api/mission-control/approvals', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.approvals));
    assert.ok(res.body.approvals.length >= 1);
    assert.ok(res.body.approvals.every((a) => a.status === 'PENDING'));
  });

  test('6. POST /api/mission-control/approvals/resolve rejects unauthenticated requests (401)', async () => {
    const payload = {
      approvalId: 'appr_palm_allocation_001',
      action: 'APPROVED',
    };

    const res = await routeApiRequest('/api/mission-control/approvals/resolve', 'POST', payload, {}, {});
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error.includes('Unauthorized'));
  });

  test('7. POST /api/mission-control/approvals/resolve transitions status to APPROVED with actor and timestamp', async () => {
    let capturedEvent = null;
    const unsub = agentEventBus.subscribe('approval:resolved', (evt) => {
      capturedEvent = evt;
    });

    const payload = {
      approvalId: 'appr_palm_allocation_001',
      action: 'APPROVED',
      actor: 'Emanuel Rendas (Principal Advisor)',
      note: 'Authorized for sovereign dispatch via WhatsApp and encrypted PDF email.',
    };

    const res = await routeApiRequest('/api/mission-control/approvals/resolve', 'POST', payload, {}, {
      'x-raioc-secret': VALID_SECRET,
      'X-Correlation-ID': 'corr_test_appr_resolve_001',
    });

    unsub();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.approval.id, 'appr_palm_allocation_001');
    assert.strictEqual(res.body.approval.status, 'APPROVED');
    assert.strictEqual(res.body.approval.actor, 'Emanuel Rendas (Principal Advisor)');
    assert.ok(res.body.approval.resolvedAt);

    // Event bus verification
    assert.ok(capturedEvent !== null);
    assert.strictEqual(capturedEvent.topic, 'approval:resolved');
    assert.strictEqual(capturedEvent.payload.status, 'APPROVED');
  });

  test('8. POST /api/mission-control/approvals/resolve transitions status to REJECTED with valid secret', async () => {
    const payload = {
      approvalId: 'appr_dld_greenlist_002',
      action: 'REJECTED',
      actor: 'Emanuel Rendas',
      note: 'Hold tranche release pending Escrow Law 8 audit verification.',
    };

    const res = await routeApiRequest('/api/mission-control/approvals/resolve', 'POST', payload, {}, {
      Authorization: `Bearer ${VALID_SECRET}`,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.approval.status, 'REJECTED');
  });

  // --- Interaction Stream Tests ---

  test('9. GET /api/mission-control/interactions returns last 15 ingestion records', async () => {
    const res = await routeApiRequest('/api/mission-control/interactions?limit=15', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.interactions));
    assert.ok(res.body.interactions.length > 0);
    assert.ok(res.body.interactions.length <= 15);

    const first = res.body.interactions[0];
    assert.ok(first.event_type);
    assert.ok(first.channel);
    assert.ok(first.summary);
  });

  // --- Executive Copilot Tests ---

  test('10. POST /api/ai/gemini-advisor responds to natural language executive directives', async () => {
    const payload = {
      prompt: 'Synthesize Portuguese NHR capital allocation strategy for Palm Jumeirah under Law 8 Escrow.',
      clientName: 'Emanuel Rendas',
    };

    const res = await routeApiRequest('/api/ai/gemini-advisor', 'POST', payload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.tool, 'gemini_executive_advisor');
    assert.ok(res.body.response);
    assert.ok(typeof res.body.response === 'string');
    assert.ok(res.body.response.length > 20);
  });

  // --- Mission Control UI Mount Tests ---

  test('11. GET /admin/mission-control and /mission-control renders Executive Mission Control UI', async () => {
    const resAdmin = await routeApiRequest('/admin/mission-control', 'GET');
    assert.strictEqual(resAdmin.status, 200);
    assert.ok(resAdmin.headers['Content-Type'].includes('text/html'));
    assert.ok(resAdmin.body.includes('RAIOC MISSION CONTROL'));
    assert.ok(resAdmin.body.includes('Component A: Autonomous Fleet Matrix'));
    assert.ok(resAdmin.body.includes('Component B: Executive Approval Gate'));
    assert.ok(resAdmin.body.includes('Component C: Ingestion Pulse'));
    assert.ok(resAdmin.body.includes('Component D: Executive Copilot'));

    const resShort = await routeApiRequest('/mission-control', 'GET');
    assert.strictEqual(resShort.status, 200);
    assert.ok(resShort.body.includes('RAIOC MISSION CONTROL'));
  });
});
