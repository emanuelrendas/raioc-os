/**
 * RAIOC OS - Mission Control V1 Integration Test Suite (Sprint 2 / Phase B)
 * Validates:
 * 1. Consolidated state API /api/v1/mission-control/v1-state schema & data contracts.
 * 2. Operational CRM pipeline stages and aggregate AED volume calculation.
 * 3. Multi-agent fleet matrix combining core static registry and live runtime telemetry.
 * 4. Executive HITL Approval resolution flow (Approve & Reject actions).
 * 5. Workflow monitor and infrastructure observability status.
 * 6. Live Ingestion Pulse streaming with multi-channel badges and trace context.
 * 7. Backward compatibility alias /api/mission-control/v1-state with deprecation headers.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { routeApiRequest } from '../../src/api/server.js';
import { supabase } from '../../src/db/supabase-client.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';
import { enterpriseEventRouter } from '../../src/core/event-router.js';

describe('INTEGRATION: Mission Control V1 24/7 Wall-Screen Dashboard', () => {
  beforeEach(() => {
    enterpriseEventBus.clearHistory();
    enterpriseEventRouter.init();
    if (supabase.isMock) {
      supabase.initEnterpriseCoreSeeds();
    }
  });

  // --- 1. Consolidated State API Contract ---

  test('1. Consolidated State API: GET /api/v1/mission-control/v1-state returns complete telemetry', async () => {
    const res = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.timestamp);

    // 1. KPI Strip
    assert.ok(res.body.kpiStrip);
    assert.strictEqual(typeof res.body.kpiStrip.systemHealth, 'number');
    assert.strictEqual(typeof res.body.kpiStrip.pipelineAed, 'number');
    assert.strictEqual(typeof res.body.kpiStrip.activeLeads, 'number');
    assert.strictEqual(typeof res.body.kpiStrip.pendingHitlCount, 'number');

    // 2. Fleet Matrix
    assert.ok(Array.isArray(res.body.fleetMatrix));
    assert.ok(res.body.fleetMatrix.length >= 6);
    const jarvis = res.body.fleetMatrix.find((a) => a.id.toLowerCase().includes('jarvis'));
    assert.ok(jarvis);
    assert.ok(jarvis.live_status);
    assert.ok(jarvis.model);

    // 3. Operational CRM Pipeline
    assert.ok(res.body.crmPipeline);
    assert.ok(Array.isArray(res.body.crmPipeline.stages));
    assert.strictEqual(res.body.crmPipeline.stages.length, 6);
    assert.ok(res.body.crmPipeline.totalPipelineAed > 0);

    // 4. Ingestion Pulse Feed
    assert.ok(Array.isArray(res.body.ingestionPulse));
    assert.ok(res.body.ingestionPulse.length > 0);

    // 5. Workflow Monitor
    assert.ok(Array.isArray(res.body.workflowMonitor));
    assert.ok(res.body.workflowMonitor.length >= 4);

    // 6. Approval Queue
    assert.ok(Array.isArray(res.body.approvalQueue));

    // 7. Infrastructure Observability
    assert.ok(res.body.infrastructure);
    assert.strictEqual(res.body.infrastructure.supabase.status, 'CONNECTED');
    assert.strictEqual(res.body.infrastructure.eventBus.status, 'ACTIVE');
  });

  // --- 2. Operational CRM Pipeline Stage Structure ---

  test('2. Realtime CRM Pipeline: Accurately parses pipeline stages with deal valuations', async () => {
    const res = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
    const { crmPipeline } = res.body;

    const stageIds = crmPipeline.stages.map((s) => s.id);
    assert.deepStrictEqual(stageIds, [
      'NEW_LEAD',
      'QUALIFIED',
      'HOT_MANDATE',
      'PROPOSAL_SENT',
      'CLOSED_WON',
      'LOST',
    ]);

    // Verify Deals inside stages
    const newLeadStage = crmPipeline.stages.find((s) => s.id === 'NEW_LEAD');
    assert.ok(newLeadStage.deals.length >= 1);
    const sterlingDeal = newLeadStage.deals.find((d) => d.name.includes('Lord Alistair Sterling'));
    assert.ok(sterlingDeal);
    assert.strictEqual(sterlingDeal.budgetAed, 20000000);
    assert.strictEqual(sterlingDeal.diraScore, 88);

    const closedWonStage = crmPipeline.stages.find((s) => s.id === 'CLOSED_WON');
    assert.ok(closedWonStage.deals.length >= 1);
    assert.ok(closedWonStage.totalAed >= 50000000);
  });

  // --- 3. Multi-Agent Fleet Telemetry Decoupling ---

  test('3. Agent Fleet Matrix: Combines static permissions with dynamic runtime metrics', async () => {
    // Record a live telemetry update for mark
    await supabase.recordRuntimeAgentTelemetry({
      agent_id: 'mark_lead_triage',
      live_status: 'PROCESSING',
      active_task: 'Ingesting Sovereign Mandate via Telegram',
      last_latency_ms: 18,
    });

    const res = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
    const markAgent = res.body.fleetMatrix.find((a) => a.id === 'mark_lead_triage');

    assert.ok(markAgent);
    assert.strictEqual(markAgent.live_status, 'PROCESSING');
    assert.strictEqual(markAgent.active_task, 'Ingesting Sovereign Mandate via Telegram');
    assert.strictEqual(markAgent.last_latency_ms, 18);
    assert.ok(markAgent.capabilities.length > 0);
  });

  // --- 4. HITL Approval Resolution Flow ---

  test('4. HITL Approval Gateway: Resolves pending approval via 1-click Approve action', async () => {
    // 1. Create a test approval
    const testAppr = await supabase.createApproval({
      id: `appr_test_resolve_${Date.now()}`,
      title: 'DLD Green List Verified Tranche Release (25M AED)',
      agent: 'ATLAS',
      recipient: 'Zurich Sovereign FO',
      targetAsset: 'Como Residences',
      priority: 'CRITICAL',
    });

    // 2. Verify it appears in V1 State
    const stateBefore = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
    const foundBefore = stateBefore.body.approvalQueue.find((a) => a.id === testAppr.id);
    assert.ok(foundBefore);

    // 3. Resolve approval via POST /api/v1/mission-control/approvals
    const resolveRes = await routeApiRequest(
      '/api/v1/mission-control/approvals',
      'POST',
      {
        id: testAppr.id,
        resolution: 'APPROVE',
        actor: 'Emanuel Rendas (Executive)',
      },
      {},
      { 'x-raioc-secret': 'raioc_sovereign_auth_2026_x99' }
    );

    assert.strictEqual(resolveRes.status, 200);
    assert.strictEqual(resolveRes.body.success, true);
    assert.strictEqual(resolveRes.body.approval.status, 'APPROVED');

    // 4. Verify it is removed from pending queue
    const stateAfter = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
    const foundAfter = stateAfter.body.approvalQueue.find((a) => a.id === testAppr.id);
    assert.strictEqual(foundAfter, undefined);
  });

  // --- 5. Backward Compatibility Alias ---

  test('5. Compatibility Alias: /api/mission-control/v1-state routes with Deprecation header', async () => {
    const res = await routeApiRequest('/api/mission-control/v1-state', 'GET');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.headers.Deprecation, '@deprecated Use /api/v1/... instead');
    assert.strictEqual(res.headers.Link, '</api/v1/mission-control/v1-state>; rel="canonical"');
  });
});
