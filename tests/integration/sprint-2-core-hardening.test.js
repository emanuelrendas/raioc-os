/**
 * RAIOC OS - Sprint 2 Core Hardening Integration Test Suite
 * Validates:
 * 1. Append-Only Immutability & Trigger Execution (Strict rejection of UPDATE/DELETE on audit tables)
 * 2. Cryptographic SHA256 Payload Hashing & Hash Chaining
 * 3. Runtime Telemetry Decoupling (High-frequency metrics without modifying registry configs)
 * 4. Distributed W3C Trace Context (traceparent, causation_id, correlation_id) Propagation
 * 5. Hardened Recovery Engine & Dead-Letter Queue (DLQ) Reclamation
 * 6. Multi-Tier Cognitive Provider Router with Dynamic Circuit Breakers & Graceful Fallback
 * 7. Canonical /api/v1/* API Versioning & Backward Compatibility Alias Headers
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { routeApiRequest } from '../../src/api/server.js';
import { supabase } from '../../src/db/supabase-client.js';
import { enterpriseEventBus, EnterpriseEventBus } from '../../src/core/event-bus.js';
import { recoveryEngine, CircuitBreaker, CircuitState } from '../../src/core/recovery-engine.js';
import { cognitiveRouter } from '../../src/core/cognitive-router.js';

const VALID_SECRET = process.env.RAIOC_INTERNAL_SECRET || 'raioc_sovereign_auth_2026_x99';

describe('INTEGRATION: Sprint 2 Core Hardening & Architecture Verification', () => {
  beforeEach(() => {
    enterpriseEventBus.clear();
    if (supabase.isMock) {
      supabase.initEnterpriseCoreSeeds();
    }
  });

  // --- 1. Append-Only Immutability Verification ---

  test('1. Append-Only Immutability: Rejects UPDATE and DELETE operations on audit tables', async () => {
    // 1. Assert rejection on interaction_logs
    await assert.rejects(
      async () => {
        await supabase.updateInteractionLog('log_inbound_001', { summary: 'Tampered summary' });
      },
      /FATAL: UPDATE or DELETE operations are strictly prohibited on immutable audit tables/
    );

    await assert.rejects(
      async () => {
        await supabase.deleteInteractionLog('log_inbound_001');
      },
      /FATAL: UPDATE or DELETE operations are strictly prohibited on immutable audit tables/
    );

    // 2. Assert deletion rejection on enterprise_events
    await assert.rejects(
      async () => {
        await supabase.deleteEnterpriseEvent('evt_genesis_001');
      },
      /FATAL: UPDATE or DELETE operations are strictly prohibited on immutable audit tables/
    );
  });

  // --- 2. Cryptographic SHA-256 Hashing & Hash Chaining ---

  test('2. Cryptographic SHA256 Hashing & Hash Chaining across consecutive CloudEvents', async () => {
    const event1 = await enterpriseEventBus.publishEvent(
      'lead.ingested',
      'raioc://agents/mark',
      { leadId: 'lead_hnw_1001', budgetAed: 15000000 },
      { correlationId: 'corr_test_chain_01' }
    );

    assert.strictEqual(event1.specversion, '1.1');
    assert.ok(event1.payload_sha256);
    assert.strictEqual(event1.payload_sha256.length, 64);
    assert.strictEqual(event1.prev_event_hash, null); // Genesis in this bus instance

    const event2 = await enterpriseEventBus.publishEvent(
      'assessment.scored',
      'raioc://agents/mark',
      { leadId: 'lead_hnw_1001', diraScore: 84, riisLevel: 'LOW_RISK' },
      { correlationId: 'corr_test_chain_01', causationId: event1.id }
    );

    assert.ok(event2.payload_sha256);
    assert.strictEqual(event2.payload_sha256.length, 64);
    // Verifies cryptographic chaining: event2 references non-null prev_event_hash
    assert.ok(event2.prev_event_hash);
    assert.strictEqual(event2.prev_event_hash.length, 64);
  });

  // --- 3. Runtime Telemetry Decoupling ---

  test('3. Runtime Telemetry Decoupling: Updates live agent/tool telemetry without modifying core registries', async () => {
    // 1. Update runtime agent telemetry via API
    const heartbeatPayload = {
      agent_id: 'jarvis_executive_brain',
      live_status: 'PROCESSING',
      active_task: 'Simulating multi-tier cognitive sovereign allocation loop',
      tokens_consumed_total: 45000,
      compute_cost_usd: 0.1250,
      error_rate_5m: 0.00,
      last_latency_ms: 8,
    };

    const updateRes = await routeApiRequest(
      '/api/v1/runtime/telemetry/agents',
      'POST',
      heartbeatPayload,
      {},
      { Authorization: `Bearer ${VALID_SECRET}` }
    );

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.success, true);
    assert.strictEqual(updateRes.body.telemetry.live_status, 'PROCESSING');

    // 2. Verify static Core Agent Registry was NOT mutated
    const coreAgent = await supabase.getCoreAgent('jarvis_executive_brain');
    assert.strictEqual(coreAgent.status, 'ACTIVE'); // Configuration remains clean and static

    // 3. Verify tool runtime telemetry update
    const toolUpdate = await routeApiRequest(
      '/api/v1/runtime/telemetry/tools',
      'POST',
      { tool_id: 'gemini_api', live_health_status: 'HEALTHY', current_latency_ms: 18, total_calls_today: 512 },
      {},
      { 'x-raioc-secret': VALID_SECRET }
    );

    assert.strictEqual(toolUpdate.status, 200);
    assert.strictEqual(toolUpdate.body.telemetry.total_calls_today, 512);

    // 4. Verify Health Matrix aggregation
    const matrixRes = await routeApiRequest('/api/v1/runtime/health-matrix', 'GET');
    assert.strictEqual(matrixRes.status, 200);
    assert.strictEqual(matrixRes.body.success, true);
    assert.ok(matrixRes.body.summary.totalAgents >= 6);
    assert.ok(matrixRes.body.summary.totalTools >= 8);
  });

  // --- 4. Distributed Trace Context Propagation ---

  test('4. Distributed W3C Trace Context (traceparent, causation_id, correlation_id) propagation', async () => {
    let capturedContext = null;

    enterpriseEventBus.subscribe('workflow.step.completed', (data, ctx) => {
      capturedContext = ctx;
    });

    const customTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const customCorrelation = 'corr_custom_trace_999';
    const parentEventId = 'evt_parent_dispatch_001';

    await enterpriseEventBus.publishEvent(
      'workflow.step.completed',
      'raioc://agents/atlas',
      { step: 'DLD_VALUATION', yieldEstimated: 8.1 },
      {
        traceparent: customTraceparent,
        correlationId: customCorrelation,
        causationId: parentEventId,
      }
    );

    assert.ok(capturedContext);
    assert.strictEqual(capturedContext.traceparent, customTraceparent);
    assert.strictEqual(capturedContext.correlationId, customCorrelation);
    assert.strictEqual(capturedContext.causationId, parentEventId);
  });

  // --- 5. Hardened Recovery Engine & Dead-Letter Queue (DLQ) ---

  test('5. Recovery Engine reclaims stuck processing events and moves exhausted retries to DLQ', async () => {
    // 1. Simulate a stuck event with retry_count = 0
    const stuckEvent1 = await supabase.recordEnterpriseEvent({
      id: 'evt_stuck_recoverable_001',
      event_type: 'outbound.dispatch.requested',
      source: 'raioc://agents/aida',
      data: { recipient: 'investor@sovereign.ae' },
      status: 'PROCESSING',
      retry_count: 0,
      created_at: new Date(Date.now() - 600000).toISOString(), // 10 mins ago
    });

    // 2. Simulate a stuck event with retry_count = 3 (exhausted)
    const stuckEvent2 = await supabase.recordEnterpriseEvent({
      id: 'evt_stuck_exhausted_002',
      event_type: 'dld.smart.sync',
      source: 'raioc://connectors/dld',
      data: { partition: '2026-08' },
      status: 'PROCESSING',
      retry_count: 3,
      created_at: new Date(Date.now() - 600000).toISOString(), // 10 mins ago
    });

    // 3. Trigger Recovery Engine Reclamation
    const reclaimReport = await recoveryEngine.reclaimStuckProcessingEvents(300); // 5 min threshold

    assert.strictEqual(reclaimReport.success, true);
    assert.ok(reclaimReport.reclaimedCount >= 1);
    assert.ok(reclaimReport.deadLetterCount >= 1);

    // Verify stuckEvent1 was re-emitted and retry count incremented
    const recheckedEvt1 = supabase.mockStore.enterprise_events.find((e) => e.id === 'evt_stuck_recoverable_001');
    assert.strictEqual(recheckedEvt1.status, 'EMITTED');
    assert.strictEqual(recheckedEvt1.retry_count, 1);

    // Verify stuckEvent2 was routed to DEAD_LETTER (DLQ)
    const recheckedEvt2 = supabase.mockStore.enterprise_events.find((e) => e.id === 'evt_stuck_exhausted_002');
    assert.strictEqual(recheckedEvt2.status, 'DEAD_LETTER');
    assert.ok(recheckedEvt2.dlq_reason.includes('Exceeded max retry threshold'));
  });

  // --- 6. Multi-Tier Cognitive Provider Router & Dynamic Circuit Breaker ---

  test('6. Cognitive Router executes tiered failover and circuit breaker isolation', async () => {
    // 1. Standard prompt execution
    const res = await cognitiveRouter.dispatch('Evaluate Palm Jumeirah Como Residences escrow guarantees under Law 8 of 2007');
    assert.ok(res.text);
    assert.ok(res.provider);

    // 2. Force secondary provider (Vertex AI)
    const vertexRes = await cognitiveRouter.dispatch('Synthesize Portuguese NHR wealth shielding thesis', {
      forceProvider: 'vertex',
    });
    assert.strictEqual(vertexRes.provider, 'vertex_ai_enterprise');

    // 3. Force offline deterministic fallback
    const fallbackRes = await cognitiveRouter.dispatch('Portugal NHR wealth structuring and statutory tax exemptions', {
      forceProvider: 'fallback',
    });
    assert.strictEqual(fallbackRes.provider, 'deterministic_sovereign_fallback');
    assert.ok(fallbackRes.text.includes('Portugal NHR'));
    assert.strictEqual(fallbackRes.fallback, true);

    // 4. Test Circuit Breaker failure tripping
    const testBreaker = new CircuitBreaker('test_external_service', { failureThreshold: 2, resetTimeoutMs: 100 });
    assert.strictEqual(testBreaker.state, CircuitState.CLOSED);

    // Failure 1
    await assert.rejects(
      async () => {
        await testBreaker.execute(async () => {
          throw new Error('Upstream timeout');
        });
      },
      /Upstream timeout/
    );
    assert.strictEqual(testBreaker.state, CircuitState.CLOSED);

    // Failure 2 (Trips to OPEN)
    await assert.rejects(
      async () => {
        await testBreaker.execute(async () => {
          throw new Error('Upstream 503 Outage');
        });
      },
      /Upstream 503 Outage/
    );
    assert.strictEqual(testBreaker.state, CircuitState.OPEN);

    // Subsequent calls fast-fail immediately without invoking actionFn
    let executedInner = false;
    await assert.rejects(
      async () => {
        await testBreaker.execute(async () => {
          executedInner = true;
          return 'ok';
        });
      },
      /CircuitBreaker \[test_external_service\] is OPEN/
    );
    assert.strictEqual(executedInner, false);
  });

  // --- 7. Canonical /api/v1/* Versioning & Compatibility Alias Routing ---

  test('7. API Versioning: Canonical /api/v1/* routes and backward compatibility alias headers', async () => {
    // 1. Canonical /api/v1/core/agents
    const v1Res = await routeApiRequest('/api/v1/core/agents', 'GET');
    assert.strictEqual(v1Res.status, 200);
    assert.strictEqual(v1Res.body.success, true);
    assert.strictEqual(v1Res.headers.Deprecation, undefined); // Canonical route has no deprecation

    // 2. Legacy /api/core/agents alias with Deprecation header
    const legacyRes = await routeApiRequest('/api/core/agents', 'GET');
    assert.strictEqual(legacyRes.status, 200);
    assert.strictEqual(legacyRes.body.success, true);
    assert.ok(legacyRes.headers.Deprecation);
    assert.strictEqual(legacyRes.headers.Deprecation, '@deprecated Use /api/v1/... instead');
    assert.ok(legacyRes.headers.Link.includes('/api/v1/core/agents'));

    // 3. ADR API: GET /api/v1/memory/adr and GET /api/v1/memory/adr/ADR-001
    const adrListRes = await routeApiRequest('/api/v1/memory/adr', 'GET');
    assert.strictEqual(adrListRes.status, 200);
    assert.strictEqual(adrListRes.body.success, true);
    assert.ok(adrListRes.body.adrs.length >= 6);

    const adrSingleRes = await routeApiRequest('/api/v1/memory/adr/ADR-001', 'GET');
    assert.strictEqual(adrSingleRes.status, 200);
    assert.strictEqual(adrSingleRes.body.adr.adr_id, 'ADR-001');
    assert.strictEqual(adrSingleRes.body.adr.status, 'ACCEPTED');

    // 4. Cognitive API: POST /api/v1/cognitive/dispatch
    const cogApiRes = await routeApiRequest(
      '/api/v1/cognitive/dispatch',
      'POST',
      { prompt: 'Assess DIRA scoring parameters for Como Residences' },
      {},
      { Authorization: `Bearer ${VALID_SECRET}` }
    );
    assert.strictEqual(cogApiRes.status, 200);
    assert.strictEqual(cogApiRes.body.success, true);
    assert.ok(cogApiRes.body.text);
  });
});
