/**
 * RAIOC OS - SENTINEL Observability & HITL Mission Control E2E Integration Test Suite
 * 
 * Tests:
 * 1. Realtime Fleet Telemetry, Pipeline Aggregation & Approvals Count (/api/v1/mission-control/v1-state)
 * 2. SENTINEL Circuit Breaker Engine: Automated Probing, Trip on Degradation (>=5% Error / >2000ms Latency) & Recovery
 * 3. 1-Click HITL Decision Console: Immediate Unblocking & Autonomous AIDA Voice Dispatch upon CEO Approval (/api/v1/approvals/decide)
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { handleMissionControlV1State } from '../../src/api/v1/mission-control/v1-state.js';
import { handleApprovalsRequest } from '../../src/api/mission-control/approvals.js';
import { sentinelMeshMonitor, CIRCUIT_STATES, MESH_STATUS } from '../../src/core/sentinel-mesh-monitor.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';
import { supabase } from '../../src/db/supabase-client.js';

// Helper mock response factory
function createMockResponse() {
  let statusCode = 200;
  let headers = {};
  let body = null;

  const res = {
    writeHead(status, hdrs) {
      statusCode = status;
      if (hdrs) headers = { ...headers, ...hdrs };
      return res;
    },
    setHeader(name, val) {
      headers[name] = val;
      return res;
    },
    end(data) {
      if (data) {
        try {
          body = JSON.parse(data);
        } catch {
          body = data;
        }
      }
      return res;
    },
    _get() {
      return { status: statusCode, headers, body };
    },
  };
  return res;
}

test('MISSION CONTROL V1-STATE: Realtime Fleet Telemetry, Pipeline Aggregation & Approvals Count', async () => {
  // Ensure Circuit Breaker is in healthy closed state
  await sentinelMeshMonitor.resetCircuitBreaker();

  // Create a pending approval to guarantee non-zero pending queue
  const testApprovalId = `appr_mc_test_${Date.now()}`;
  await supabase.createApproval({
    id: testApprovalId,
    title: 'High-Value Mandate Triage - Al-Futtaim Family Office',
    agent: 'MARK (Lead Triage Specialist)',
    category: 'HIGH_VALUE_MANDATE',
    priority: 'CRITICAL',
    status: 'PENDING',
    recipient: 'Al-Futtaim Family Office',
    targetAsset: 'One Zaabeel Penthouse',
    payload: {
      budgetAed: 35000000,
      intent: 'INVESTOR_FOLLOWUP',
      channel: 'WHATSAPP',
    },
  });

  const stateRes = await handleMissionControlV1State(
    '/api/v1/mission-control/v1-state',
    'GET',
    {},
    { masked: 'false' },
    { 'x-correlation-id': `corr_mc_test_${Date.now()}` }
  );

  assert.strictEqual(stateRes.status, 200);
  assert.strictEqual(stateRes.body.success, true);

  const {
    fleetHealth,
    circuitBreakerState,
    totalPipelineAed,
    activeLeadsCount,
    averageLatencyMs,
    pendingApprovalsCount,
    pendingApprovals,
    agentFleet,
    crmPipeline,
    healthBar,
    infrastructure,
  } = stateRes.body;

  // 1. Validate Fleet Health Matrix
  assert.strictEqual(fleetHealth, 'HEALTHY');
  assert.strictEqual(circuitBreakerState, CIRCUIT_STATES.CLOSED);
  assert.ok(Array.isArray(agentFleet), 'agentFleet must be an array');
  assert.ok(agentFleet.length >= 6, 'Must contain sovereign agent fleet');

  const agentNames = agentFleet.map((a) => `${a.id || ''} ${a.name || ''}`.toUpperCase());
  assert.ok(agentNames.some((n) => n.includes('MARK')), 'MARK must be in agent fleet');
  assert.ok(agentNames.some((n) => n.includes('AIDA')), 'AIDA must be in agent fleet');
  assert.ok(agentNames.some((n) => n.includes('ATLAS')), 'ATLAS must be in agent fleet');
  assert.ok(agentNames.some((n) => n.includes('LEX')), 'LEX must be in agent fleet');
  assert.ok(agentNames.some((n) => n.includes('SENTINEL')), 'SENTINEL must be in agent fleet');
  assert.ok(agentNames.some((n) => n.includes('JARVIS')), 'JARVIS must be in agent fleet');

  // 2. Validate Realtime Pipeline Aggregates
  assert.strictEqual(typeof totalPipelineAed, 'number');
  assert.ok(totalPipelineAed >= 0, 'Total pipeline AED must be non-negative');
  assert.strictEqual(typeof activeLeadsCount, 'number');
  assert.ok(activeLeadsCount >= 0, 'Active leads count must be non-negative');
  assert.ok(Array.isArray(crmPipeline.stages), 'CRM Pipeline must contain stages');

  // 3. Validate Latency & Approvals
  assert.strictEqual(typeof averageLatencyMs, 'number');
  assert.ok(averageLatencyMs >= 0 && averageLatencyMs <= 2000, 'Average latency must be realistic and healthy');
  assert.strictEqual(typeof pendingApprovalsCount, 'number');
  assert.ok(pendingApprovalsCount >= 1, 'Must count at least 1 pending approval');
  assert.ok(Array.isArray(pendingApprovals), 'pendingApprovals must be an array');
  assert.strictEqual(pendingApprovalsCount, pendingApprovals.length);

  // 4. Validate Infrastructure & Sentinel Mesh
  assert.strictEqual(infrastructure.supabase.status, 'CONNECTED');
  assert.strictEqual(infrastructure.eventBus.status, 'ACTIVE');
  assert.strictEqual(infrastructure.sentinelMesh.circuitBreakerState, CIRCUIT_STATES.CLOSED);
});

test('SENTINEL CIRCUIT BREAKER: Automated Probing & Trip on Simulated Degradation (>=5% Errors / >2000ms Latency)', async () => {
  // 1. Verify Initial Healthy State
  const initialProbe = await sentinelMeshMonitor.checkFleetHealth();
  assert.strictEqual(initialProbe.circuitBreakerState, CIRCUIT_STATES.CLOSED);
  assert.strictEqual(initialProbe.status, MESH_STATUS.HEALTHY);

  // 2. Simulate Synthetic Degradation (8.5% Error Rate & 2450ms Latency)
  const degradedProbe = await sentinelMeshMonitor.simulateDegradation({
    errorRate: 0.085,
    latencyMs: 2450,
    reason: 'Simulated LLM Gateway Latency Spike & Provider Errors',
  });

  assert.strictEqual(degradedProbe.circuitBreakerState, CIRCUIT_STATES.OPEN);
  assert.strictEqual(degradedProbe.status, MESH_STATUS.CRITICAL);
  assert.ok(degradedProbe.tripReason.includes('Error Rate 8.5%'), 'Trip reason must include error rate detail');
  assert.ok(degradedProbe.tripReason.includes('Latency 2450ms'), 'Trip reason must include latency detail');

  // 3. Verify that CloudEvent raioc.system.circuit_breaker.tripped.v1 was Published
  const events = enterpriseEventBus.getEventHistory(10);
  const tripEvent = events.find((e) => e.type === 'raioc.system.circuit_breaker.tripped.v1');
  assert.ok(tripEvent, 'Event raioc.system.circuit_breaker.tripped.v1 must be published');
  assert.strictEqual(tripEvent.data.circuitBreakerState, CIRCUIT_STATES.OPEN);
  assert.strictEqual(tripEvent.data.errorRate, 0.085);
  assert.strictEqual(tripEvent.data.avgLatencyMs, 2450);

  // 4. Verify that Mission Control State Reflects Degraded Status
  const degradedStateRes = await handleMissionControlV1State('/api/v1/mission-control/v1-state', 'GET');
  assert.strictEqual(degradedStateRes.status, 200);
  assert.strictEqual(degradedStateRes.body.circuitBreakerState, CIRCUIT_STATES.OPEN);
  assert.strictEqual(degradedStateRes.body.fleetHealth, 'DEGRADED');

  // 5. Test Circuit Breaker Reset & Recovery
  const resetResult = await sentinelMeshMonitor.resetCircuitBreaker();
  assert.strictEqual(resetResult.success, true);
  assert.strictEqual(resetResult.circuitBreakerState, CIRCUIT_STATES.CLOSED);
  assert.strictEqual(resetResult.status, MESH_STATUS.HEALTHY);

  // 6. Verify Reset CloudEvent raioc.system.circuit_breaker.reset.v1
  const recoveryEvents = enterpriseEventBus.getEventHistory(5);
  const resetEvent = recoveryEvents.find((e) => e.type === 'raioc.system.circuit_breaker.reset.v1');
  assert.ok(resetEvent, 'Event raioc.system.circuit_breaker.reset.v1 must be published upon recovery');
});

test('1-CLICK HITL DECISION CONSOLE: Immediate Unblocking & AIDA Voice Dispatch upon Executive Approval', async () => {
  const approvalId = `appr_hitl_ceo_${Date.now()}`;
  const recipient = 'Sheikh Mansoor Al-Nahyan';
  const targetAsset = 'The Palm Crown Presidential Seafront Villa';
  const budgetAed = 55000000;

  // 1. Create Pending High-Value Mandate Approval
  await supabase.createApproval({
    id: approvalId,
    title: `Exclusive Mandate Approval - ${recipient}`,
    agent: 'MARK (Lead Triage Specialist)',
    category: 'HIGH_VALUE_MANDATE',
    priority: 'CRITICAL',
    status: 'PENDING',
    recipient,
    targetAsset,
    payload: {
      intent: 'INVESTOR_FOLLOWUP',
      recipient,
      targetAsset,
      budgetAed,
      channel: 'WHATSAPP',
      script: `Good afternoon Sheikh Mansoor. Following review of your mandate for ${targetAsset}, we have secured allocation terms fully escrow-backed under Law No. 8 of 2007.`,
    },
  });

  // 2. CEO Executes 1-Click Approval via /api/v1/approvals/decide
  const decideRes = await handleApprovalsRequest(
    '/api/v1/approvals/decide',
    'POST',
    {
      approvalId,
      decision: 'APPROVED',
      actor: 'Emanuel Rendas (Chief Executive Officer)',
      note: 'Authorized for immediate sovereign voice communication and exclusive memorandum dispatch.',
    },
    {},
    {
      'x-correlation-id': `corr_hitl_exec_${Date.now()}`,
      'traceparent': '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    }
  );

  assert.strictEqual(decideRes.status, 200);
  assert.strictEqual(decideRes.body.success, true);
  assert.strictEqual(decideRes.body.decision, 'APPROVED');
  assert.strictEqual(decideRes.body.approvalId, approvalId);
  assert.strictEqual(decideRes.body.approval.status, 'APPROVED');

  // 3. Validate Autonomous AIDA Voice Dispatch Event
  assert.ok(decideRes.body.dispatchedEvent, 'dispatchedEvent must be returned in response');
  assert.strictEqual(decideRes.body.dispatchedEvent.type, 'raioc.voice.outreach_dispatched.v1');
  assert.ok(decideRes.body.dispatchedEvent.audioSha256, 'Audio SHA-256 hash must be generated');
  assert.ok(decideRes.body.dispatchedEvent.durationSeconds > 0, 'Audio duration must be greater than 0');

  // 4. Verify Event Bus v1.1 Audit Record
  const busEvents = enterpriseEventBus.getEventHistory(10);
  const voiceEvent = busEvents.find((e) => e.type === 'raioc.voice.outreach_dispatched.v1' && e.data?.approvalId === approvalId);
  assert.ok(voiceEvent, 'Event raioc.voice.outreach_dispatched.v1 must exist on enterprise event bus');
  assert.strictEqual(voiceEvent.data.recipient, recipient);
  assert.strictEqual(voiceEvent.data.budgetAed, budgetAed);
  assert.strictEqual(voiceEvent.data.approvedBy, 'Emanuel Rendas (Chief Executive Officer)');

  // 5. Test Rejection Flow on a Second Approval Item
  const rejectApprovalId = `appr_hitl_reject_${Date.now()}`;
  await supabase.createApproval({
    id: rejectApprovalId,
    title: 'Unverified Cold Lead Dispatch - Anonymous',
    agent: 'MARK (Lead Triage Specialist)',
    category: 'GENERAL_DISPATCH',
    priority: 'MEDIUM',
    status: 'PENDING',
    recipient: 'Anonymous Lead',
  });

  const rejectRes = await handleApprovalsRequest(
    '/api/v1/approvals/decide',
    'POST',
    {
      approval_id: rejectApprovalId,
      decision: 'REJECTED',
      decided_by: 'Emanuel Rendas',
      note: 'Rejected due to insufficient proof of funds documentation.',
    }
  );

  assert.strictEqual(rejectRes.status, 200);
  assert.strictEqual(rejectRes.body.decision, 'REJECTED');
  assert.strictEqual(rejectRes.body.approval.status, 'REJECTED');
  assert.strictEqual(rejectRes.body.dispatchedEvent, null, 'No voice dispatch on rejected approval');
});

test('MISSION CONTROL V2 UI INTERACTION: 1-Click Button Payload (approval_id, decision: APPROVED, decided_by: Emanuel Rendas)', async () => {
  const uiApprovalId = `appr_ui_click_${Date.now()}`;
  const investorName = 'Dr. Heinrich Schmidt';
  const targetAsset = 'Palm Jebel Ali Frond Mansion';

  await supabase.createApproval({
    id: uiApprovalId,
    title: `VIP Mandate - ${investorName}`,
    agent: 'MARK (Lead Triage Specialist)',
    category: 'HIGH_VALUE_MANDATE',
    priority: 'CRITICAL',
    status: 'PENDING',
    recipient: investorName,
    targetAsset,
    payload: {
      intent: 'INVESTOR_FOLLOWUP',
      recipient: investorName,
      targetAsset,
      budgetAed: 48000000,
      channel: 'WHATSAPP',
      country: 'Germany',
      diraScore: 98,
    },
  });

  // Simulate exact UI button click payload
  const buttonClickRes = await handleApprovalsRequest(
    '/api/v1/approvals/decide',
    'POST',
    {
      approval_id: uiApprovalId,
      decision: 'APPROVED',
      decided_by: 'Emanuel Rendas',
    },
    {},
    {
      'Authorization': 'Bearer raioc_sovereign_auth_2026_x99',
      'X-RAIOC-Secret': 'raioc_sovereign_auth_2026_x99',
      'x-correlation-id': `corr_btn_click_${Date.now()}`,
    }
  );

  assert.strictEqual(buttonClickRes.status, 200);
  assert.strictEqual(buttonClickRes.body.success, true);
  assert.strictEqual(buttonClickRes.body.decision, 'APPROVED');
  assert.strictEqual(buttonClickRes.body.approvalId, uiApprovalId);
  assert.ok(buttonClickRes.body.dispatchedEvent, 'Must dispatch voice outreach to AIDA');
  assert.strictEqual(buttonClickRes.body.dispatchedEvent.type, 'raioc.voice.outreach_dispatched.v1');
});
