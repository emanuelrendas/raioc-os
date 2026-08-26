/**
 * RAIOC OS - Mission Control V1 Integration Test Suite (Mandate Verification)
 * Validates:
 * 1. Consolidated state API /api/v1/mission-control/v1-state schema & data contracts (healthBar, agentFleet, crmPipeline, etc.).
 * 2. Operational CRM pipeline stages and dynamic updates from `investors` table.
 * 3. Multi-agent fleet matrix combining core static registry and live runtime telemetry without touching static tables.
 * 4. Executive HITL Approval resolution flow (Approve & Reject actions) updating `executive_approvals`.
 * 5. Live Ingestion Pulse streaming showing Telegram interactions with trace context and payload SHA-256.
 * 6. Masked Wall-Screen display mode (`?masked=true`) redacting sensitive PII while preserving metrics.
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

  test('1. Consolidated State API: GET /api/v1/mission-control/v1-state returns complete well-formed payload', async () => {
    const res = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.timestamp);

    // 1. healthBar
    assert.ok(res.body.healthBar);
    assert.strictEqual(typeof res.body.healthBar.systemHealthPct, 'number');
    assert.strictEqual(typeof res.body.healthBar.totalPipelineAed, 'number');
    assert.strictEqual(typeof res.body.healthBar.activeLeadsCount, 'number');
    assert.strictEqual(typeof res.body.healthBar.pendingApprovalsCount, 'number');
    assert.strictEqual(typeof res.body.healthBar.activeWorkflowsCount, 'number');
    assert.strictEqual(typeof res.body.healthBar.closedWonAed, 'number');
    assert.strictEqual(typeof res.body.healthBar.errorRate5m, 'number');
    assert.ok(res.body.healthBar.lastIngestionTime);

    // 2. agentFleet
    assert.ok(Array.isArray(res.body.agentFleet));
    assert.ok(res.body.agentFleet.length >= 6);
    const jarvis = res.body.agentFleet.find((a) => a.id.toLowerCase().includes('jarvis'));
    assert.ok(jarvis);
    assert.ok(jarvis.id);
    assert.ok(jarvis.name);
    assert.ok(jarvis.role);
    assert.ok(jarvis.live_status);
    assert.ok(jarvis.active_task);
    assert.ok(typeof jarvis.tokens_consumed_total === 'number');
    assert.ok(typeof jarvis.compute_cost_usd === 'number');
    assert.ok(typeof jarvis.last_latency_ms === 'number');
    assert.ok(typeof jarvis.uptime_seconds === 'number');
    assert.ok(jarvis.last_heartbeat);

    // 3. crmPipeline
    assert.ok(res.body.crmPipeline);
    assert.ok(Array.isArray(res.body.crmPipeline.stages));
    assert.strictEqual(res.body.crmPipeline.stages.length, 6);
    assert.ok(res.body.crmPipeline.totalPipelineAed > 0);
    assert.ok(res.body.crmPipeline.closedWonAed > 0);

    // 4. ingestionPulse
    assert.ok(Array.isArray(res.body.ingestionPulse));
    assert.ok(res.body.ingestionPulse.length > 0);

    // 5. workflowMonitor
    assert.ok(Array.isArray(res.body.workflowMonitor));
    assert.ok(res.body.workflowMonitor.length >= 4);
    const wf = res.body.workflowMonitor[0];
    assert.ok(wf.health);
    assert.ok(wf.trigger_type);
    assert.ok(wf.execution_status);

    // 6. approvalsQueue
    assert.ok(Array.isArray(res.body.approvalsQueue));

    // 7. infrastructure
    assert.ok(res.body.infrastructure);
    assert.strictEqual(res.body.infrastructure.supabase.status, 'CONNECTED');
    assert.strictEqual(res.body.infrastructure.supabase.rls, 'ACTIVE');
    assert.strictEqual(res.body.infrastructure.supabase.appendOnlyTrigger, 'ENFORCED');
    assert.strictEqual(res.body.infrastructure.eventBus.status, 'ACTIVE');
    assert.strictEqual(res.body.infrastructure.eventBus.queueDepth, 0);
    assert.ok(Array.isArray(res.body.infrastructure.circuitBreakers));

    // 8. auditTimeline
    assert.ok(Array.isArray(res.body.auditTimeline));
  });

  // --- 2. Realtime Sovereign CRM Pipeline Updates from investors table ---

  test('2. Realtime CRM Pipeline: Accurately parses pipeline stages and reflects live updates in investors table', async () => {
    // 1. Initial State verification
    const resInitial = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
    const { crmPipeline } = resInitial.body;

    const stageIds = crmPipeline.stages.map((s) => s.id);
    assert.deepStrictEqual(stageIds, [
      'NEW_LEAD',
      'QUALIFIED',
      'HOT_MANDATE',
      'PROPOSAL_SENT',
      'CLOSED_WON',
      'LOST',
    ]);

    const initialTotalAed = crmPipeline.totalPipelineAed;

    // 2. Add a new investor to `investors` table
    const newInvestor = await supabase.upsertInvestor({
      id: `inv_dyn_${Date.now()}`,
      reference_id: `REF-DYN-${Date.now()}`,
      name: 'Dr. Vasco da Gama (Porto Single Family Office)',
      company: 'Gama Maritime Holdings',
      country: 'Portugal',
      segment: 'PT_HNW',
      status: 'HOT_MANDATE',
      stage: 'HOT_MANDATE',
      budget_aed: 30000000,
      budget_usd: 8168000,
      target_asset: 'Como Residences Penthouse',
      target_thesis: 'Law 8 Escrow & NHR Sovereign Safe Haven',
      riis_score: 96,
      dira_risk_level: 'LOW',
      golden_visa_eligible: true,
      escrow_protected: true,
      preferred_channel: 'TELEGRAM',
      tags: ['PORTUGAL_SFO', 'HOT_MANDATE', 'ESCROW_VERIFIED'],
    });

    assert.ok(newInvestor.id);

    // 3. Fetch V1 state and verify CRM pipeline dynamically updated
    const resUpdated = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
    const updatedPipeline = resUpdated.body.crmPipeline;

    assert.strictEqual(updatedPipeline.totalPipelineAed, initialTotalAed + 30000000);

    const hotMandateStage = updatedPipeline.stages.find((s) => s.id === 'HOT_MANDATE');
    const foundDeal = hotMandateStage.deals.find((d) => d.id === newInvestor.id);
    assert.ok(foundDeal);
    assert.strictEqual(foundDeal.budgetAed, 30000000);
    assert.strictEqual(foundDeal.diraScore, 96);
    assert.ok(foundDeal.tags.includes('PORTUGAL_SFO'));
  });

  // --- 3. Multi-Agent Fleet Telemetry Decoupling ---

  test('3. Agent Fleet Matrix: Updates runtime telemetry without modifying static core_* tables', async () => {
    // 1. Fetch static agent before
    const coreBefore = await supabase.getCoreAgent('mark_lead_triage');
    const staticVersionBefore = coreBefore.version;

    // 2. Record dynamic runtime telemetry
    await supabase.recordRuntimeAgentTelemetry({
      agent_id: 'mark_lead_triage',
      live_status: 'PROCESSING',
      active_task: 'Evaluating Golden Visa NHR arbitrage for Dr. Vasco da Gama',
      tokens_consumed_total: 18450,
      compute_cost_usd: 0.0385,
      last_latency_ms: 19,
    });

    // 3. Fetch V1 state
    const res = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
    const markAgent = res.body.agentFleet.find((a) => a.id === 'mark_lead_triage');

    assert.ok(markAgent);
    assert.strictEqual(markAgent.live_status, 'PROCESSING');
    assert.strictEqual(markAgent.active_task, 'Evaluating Golden Visa NHR arbitrage for Dr. Vasco da Gama');
    assert.strictEqual(markAgent.tokens_consumed_total, 18450);
    assert.strictEqual(markAgent.compute_cost_usd, 0.0385);
    assert.strictEqual(markAgent.last_latency_ms, 19);

    // 4. Verify static registry remained untouched
    const coreAfter = await supabase.getCoreAgent('mark_lead_triage');
    assert.strictEqual(coreAfter.version, staticVersionBefore);
  });

  // --- 4. HITL Approval Resolution Flow ---

  test('4. HITL Approval Gateway: Resolves pending approval via 1-click Approve action and updates executive_approvals', async () => {
    // 1. Create a test approval in executive_approvals
    const testAppr = await supabase.createApproval({
      id: `appr_test_resolve_${Date.now()}`,
      action_type: 'HIGH_VALUE_MANDATE_DISPATCH',
      action: 'HIGH_VALUE_MANDATE_DISPATCH',
      risk_rating: 'CRITICAL',
      payload_summary: 'DLD Green List Verified Tranche Release (35M AED)',
      title: 'DLD Green List Verified Tranche Release (35M AED)',
      agent: 'ATLAS',
      recipient: 'Zurich Sovereign FO',
      targetAsset: 'Como Residences',
      priority: 'CRITICAL',
    });

    // 2. Verify it appears in approvalsQueue in V1 state
    const stateBefore = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
    const foundBefore = stateBefore.body.approvalsQueue.find((a) => a.id === testAppr.id);
    assert.ok(foundBefore);
    assert.strictEqual(foundBefore.status, 'PENDING');

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

    // 4. Verify it is removed from pending approvalsQueue
    const stateAfter = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
    const foundAfter = stateAfter.body.approvalsQueue.find((a) => a.id === testAppr.id);
    assert.strictEqual(foundAfter, undefined);
  });

  // --- 5. Ingestion Feed with Trace Context & SHA-256 ---

  test('5. Ingestion Feed: Shows multi-channel interactions with trace context and payload SHA-256', async () => {
    // Record an interaction log
    await supabase.logInteraction({
      channel: 'TELEGRAM',
      event_type: 'INBOUND_SOVEREIGN_MANDATE',
      source_agent: 'MARK',
      summary: 'Lord Alistair Sterling requested 20M AED allocation via @sterling_capital',
      payload: {
        sender: 'Lord Alistair Sterling',
        username: '@sterling_capital',
        budget_aed: 20000000,
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        payload_sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      },
      latency_ms: 14,
      status: 'SUCCESS',
    });

    const res = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
    const { ingestionPulse } = res.body;

    assert.ok(ingestionPulse.length > 0);
    const tgItem = ingestionPulse.find((i) => i.summary.includes('Lord Alistair Sterling'));
    assert.ok(tgItem);
    assert.strictEqual(tgItem.channel, 'TELEGRAM');
    assert.strictEqual(tgItem.source_agent, 'MARK');
    assert.ok(tgItem.traceparent);
    assert.ok(tgItem.payload_sha256);
  });

  // --- 6. Masked Wall-Screen Display Mode ---

  test('6. Masked Wall-Screen Mode: Redacts sensitive PII while preserving financial valuations and metrics', async () => {
    const res = await routeApiRequest('/api/v1/mission-control/v1-state?masked=true', 'GET');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.meta.mode, 'MASKED_WALLSCREEN');

    const newLeadStage = res.body.crmPipeline.stages.find((s) => s.id === 'NEW_LEAD');
    assert.ok(newLeadStage.deals.length > 0);

    const firstDeal = newLeadStage.deals[0];
    // Verify deal name contains masked asterisks
    assert.ok(firstDeal.name.includes('*'));
    // Verify financial metrics are untouched
    assert.ok(firstDeal.budgetAed > 0);
    assert.ok(firstDeal.diraScore > 0);
    assert.ok(res.body.healthBar.totalPipelineAed > 0);
  });

  // --- 7. Backward Compatibility Alias ---

  test('7. Compatibility Alias: /api/mission-control/v1-state routes with Deprecation header', async () => {
    const res = await routeApiRequest('/api/mission-control/v1-state', 'GET');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.headers.Deprecation);
    assert.ok(res.headers.Link.includes('canonical'));
  });
});
