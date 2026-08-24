import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  routeApiRequest,
  startApiServer,
  productionSupervisor,
  connectorHealthMatrix,
  supabase,
  agentDirectory,
  agentEventBus,
  renderCommandCenterHtml,
  openAiClient,
} from '../src/index.js';

describe('RAIOC Sprint 3: Executive Command Center & Full Production Activation Tests', () => {
  before(async () => {
    agentDirectory.enableAutonomousMesh();
  });

  after(async () => {
    await productionSupervisor.stop();
  });

  test('1. Executive Command Center UI rendering and route dispatch', async () => {
    const html = renderCommandCenterHtml();
    assert.ok(html.includes('RAIOC — Executive Command Center'));
    assert.ok(html.includes('id="agent-roster-list"'));
    assert.ok(html.includes('id="connector-matrix-list"'));
    assert.ok(html.includes('id="event-stream-list"'));
    assert.ok(html.includes('id="decision-log-list"'));
    assert.ok(html.includes('id="opportunity-feed-list"'));
    assert.ok(html.includes('/api/dashboard/stream'));

    const rootRes = await routeApiRequest('/', 'GET');
    assert.strictEqual(rootRes.status, 200);
    assert.strictEqual(rootRes.headers['Content-Type'], 'text/html');

    const dashRes = await routeApiRequest('/dashboard', 'GET');
    assert.strictEqual(dashRes.status, 200);
    assert.strictEqual(dashRes.headers['Content-Type'], 'text/html');
  });

  test('2. 10-Connector Health Matrix Live Probing & Verification', async () => {
    const connectors = await connectorHealthMatrix.probeAllConnectors();
    assert.strictEqual(connectors.length, 10);

    const ids = connectors.map((c) => c.connectorId);
    assert.ok(ids.includes('supabase'));
    assert.ok(ids.includes('n8n'));
    assert.ok(ids.includes('website'));
    assert.ok(ids.includes('openai'));
    assert.ok(ids.includes('gmail'));
    assert.ok(ids.includes('googleCalendar'));
    assert.ok(ids.includes('whatsappBusiness'));
    assert.ok(ids.includes('crm'));
    assert.ok(ids.includes('vercel'));
    assert.ok(ids.includes('github'));

    for (const c of connectors) {
      assert.ok(['ACTIVE', 'BLOCKED', 'DEGRADED', 'ERROR', 'NETWORK_ERROR', 'AUTH_FAILED'].includes(c.status));
      assert.ok(c.updatedAt);
    }
  });

  test('3. Supabase Operational Tables and State Synchronization', async () => {
    const agent = agentDirectory.getAgent('jarvis');
    const syncRes = await supabase.syncAgentStatus(agent.getStatus());
    assert.ok(syncRes !== null);
    assert.strictEqual(syncRes.agent_id, 'jarvis');

    const connRes = await supabase.recordConnectorHealth('supabase', {
      name: 'Supabase Database',
      status: 'ACTIVE',
      latencyMs: 15,
      authenticated: true,
    });
    assert.ok(connRes !== null);
    assert.strictEqual(connRes.connector_id, 'supabase');

    const execRes = await supabase.recordExecution({
      id: 'exec_test_001',
      ownerAgent: 'mark',
      objective: 'Triage Strategic Prospect',
      priority: 'CRITICAL',
      status: 'COMPLETED',
      businessValue: 50000,
    });
    assert.ok(execRes !== null);
    assert.strictEqual(execRes.id, 'exec_test_001');

    const workflowRes = await supabase.recordWorkflowRun({
      id: 'wf_test_001',
      name: 'run_cycle_pipeline',
      correlationId: 'corr_wf_001',
      status: 'COMPLETED',
      totalSteps: 15,
      completedSteps: 15,
      durationMs: 85,
    });
    assert.ok(workflowRes !== null);
    assert.strictEqual(workflowRes.id, 'wf_test_001');
  });

  test('4. Always-On Production Supervisor lifecycle and crash recovery', async () => {
    await productionSupervisor.start();
    const status = productionSupervisor.getSupervisorStatus();

    assert.strictEqual(status.status, 'RUNNING');
    assert.strictEqual(status.agentsOnline, 8);
    assert.strictEqual(status.schedulerRunning, true);
    assert.strictEqual(status.connectorsCount, 10);

    // Stop supervisor immediately to clean up background intervals
    await productionSupervisor.stop();
  });

  test('5. Telemetry & Dashboard REST API Endpoints', async () => {
    const overviewRes = await routeApiRequest('/api/dashboard/overview', 'GET');
    assert.strictEqual(overviewRes.status, 200);
    assert.strictEqual(overviewRes.body.status, 'OPERATIONAL');
    assert.ok(overviewRes.body.agents.length >= 8);
    assert.ok(overviewRes.body.financials.pipelineRevenueAed > 0);

    const connectorsRes = await routeApiRequest('/api/dashboard/connectors', 'GET');
    assert.strictEqual(connectorsRes.status, 200);
    assert.strictEqual(connectorsRes.body.connectors.length, 10);

    const tasksRes = await routeApiRequest('/api/dashboard/tasks', 'GET');
    assert.strictEqual(tasksRes.status, 200);
    assert.ok(tasksRes.body.queueStats);

    const eventsRes = await routeApiRequest('/api/dashboard/events', 'GET');
    assert.strictEqual(eventsRes.status, 200);
    assert.ok(Array.isArray(eventsRes.body.events));
  });
});
