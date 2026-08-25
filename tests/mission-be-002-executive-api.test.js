import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { routeApiRequest } from '../src/index.js';
import { supabase } from '../src/db/supabase-client.js';

describe('MISSION BE-002: Complete Executive API Suite', () => {
  test('1. GET /api/executive/status returns runtime status, uptime, memory, and active workflows', async () => {
    const correlationId = `corr_status_${Date.now()}`;
    const res = await routeApiRequest(
      '/api/executive/status',
      'GET',
      {},
      {},
      { 'X-Correlation-ID': correlationId }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['X-Correlation-ID'], correlationId);

    const body = res.body;
    assert.strictEqual(typeof body.uptime, 'number');
    assert.ok(body.uptime >= 0);
    assert.ok(['OPERATIONAL', 'ACTIVE', 'HEALTHY'].includes(body.runtimeStatus));
    assert.ok(body.memoryUsage);
    assert.strictEqual(typeof body.memoryUsage.rss, 'number');
    assert.strictEqual(typeof body.memoryUsage.heapUsed, 'number');
    assert.ok(body.activeWorkflows);
    assert.strictEqual(typeof body.activeWorkflows.runningTasks, 'number');
    assert.strictEqual(typeof body.activeWorkflows.totalQueueDepth, 'number');
    assert.ok(body.eventBusHealth);
    assert.strictEqual(body.eventBusHealth.status, 'HEALTHY');
  });

  test('2. GET /api/executive/connectors returns real connector health with strict missing_env_variable handling', async () => {
    const correlationId = `corr_conn_${Date.now()}`;
    const res = await routeApiRequest(
      '/api/executive/connectors',
      'GET',
      {},
      {},
      { 'X-Correlation-ID': correlationId }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['X-Correlation-ID'], correlationId);
    assert.strictEqual(res.body.success, true);

    const connectors = res.body.connectors;
    const required = ['supabase', 'smtp', 'whatsappCloud', 'hubspot', 'googleCalendar', 'n8n'];
    for (const key of required) {
      assert.ok(connectors[key], `Connector '${key}' must exist`);
      assert.ok(['CONNECTED', 'DISCONNECTED', 'AUTH_FAILED', 'ACTIVE', 'HTTP_ERROR'].includes(connectors[key].status));
      if (connectors[key].status === 'DISCONNECTED' && !connectors[key].endpointUrl) {
        assert.strictEqual(connectors[key].reason, 'missing_env_variable');
      }
    }
  });

  test('3. GET /api/executive/pipeline returns real deal pipeline, commissions, and tier breakdown', async () => {
    const correlationId = `corr_pipe_${Date.now()}`;
    const res = await routeApiRequest(
      '/api/executive/pipeline',
      'GET',
      {},
      {},
      { 'X-Correlation-ID': correlationId }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['X-Correlation-ID'], correlationId);
    assert.strictEqual(res.body.success, true);

    const body = res.body;
    assert.strictEqual(typeof body.totalPipelineRevenueAed, 'number');
    assert.ok(body.totalPipelineRevenueAed > 0);
    assert.strictEqual(typeof body.projectedCommissionsAed, 'number');
    assert.ok(body.projectedCommissionsAed > 0);
    assert.strictEqual(typeof body.activeDealsCount, 'number');
    assert.ok(body.stageBreakdown);
    assert.strictEqual(typeof body.stageBreakdown.newLeads, 'number');
    assert.strictEqual(typeof body.stageBreakdown.qualified, 'number');
    assert.ok(body.tierBreakdown);
    assert.strictEqual(typeof body.tierBreakdown.sovereignInstitutional, 'number');
    assert.ok(Array.isArray(body.recentDeals));
  });

  test('4. GET /api/executive/alerts returns system and operational alert feeds from Supabase/Sentinel', async () => {
    // Record a test alert in Supabase
    await supabase.recordAlert({
      severity: 'WARNING',
      component: 'QUEUE_ENGINE',
      message: 'High latency detected on dispatch queue',
      correlationId: 'corr_alert_001',
      resolved: false,
    });

    const correlationId = `corr_alerts_${Date.now()}`;
    const res = await routeApiRequest(
      '/api/executive/alerts',
      'GET',
      {},
      {},
      { 'X-Correlation-ID': correlationId }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['X-Correlation-ID'], correlationId);
    assert.strictEqual(res.body.success, true);

    const body = res.body;
    assert.ok(['HEALTHY', 'DEGRADED', 'CRITICAL'].includes(body.systemStatus));
    assert.strictEqual(typeof body.totalActiveAlerts, 'number');
    assert.strictEqual(typeof body.criticalCount, 'number');
    assert.strictEqual(typeof body.warningCount, 'number');
    assert.ok(Array.isArray(body.alerts));
  });

  test('5. GET /api/executive/kpis returns executive revenue KPIs and latency percentiles (p50, p95, p99)', async () => {
    const correlationId = `corr_kpis_${Date.now()}`;
    const res = await routeApiRequest(
      '/api/executive/kpis',
      'GET',
      {},
      {},
      { 'X-Correlation-ID': correlationId }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['X-Correlation-ID'], correlationId);
    assert.strictEqual(res.body.success, true);

    const body = res.body;
    assert.ok(body.kpis);
    assert.strictEqual(typeof body.kpis.totalRevenueAed, 'number');
    assert.strictEqual(typeof body.kpis.conversionRatePct, 'number');
    assert.strictEqual(typeof body.kpis.agentEfficiencyPct, 'number');
    assert.strictEqual(typeof body.kpis.autonomousCyclesCompleted, 'number');

    assert.ok(body.latencyPercentiles);
    assert.strictEqual(typeof body.latencyPercentiles.p50Ms, 'number');
    assert.strictEqual(typeof body.latencyPercentiles.p95Ms, 'number');
    assert.strictEqual(typeof body.latencyPercentiles.p99Ms, 'number');
    assert.ok(Array.isArray(body.agentUtilization));
  });

  test('6. POST /api/executive/chat processes executive mandate via JARVIS autonomous decision engine', async () => {
    const correlationId = `corr_chat_${Date.now()}`;
    const res = await routeApiRequest(
      '/api/executive/chat',
      'POST',
      {
        message: 'Analyze Dubai Hills Estate Golden Visa opportunities for ultra-high-net-worth family office',
        context: { priority: 'CRITICAL', investorTier: 'SOVEREIGN_INSTITUTIONAL' },
      },
      {},
      { 'X-Correlation-ID': correlationId }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['X-Correlation-ID'], correlationId);

    const body = res.body;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.sender, 'JARVIS');
    assert.strictEqual(typeof body.message, 'string');
    assert.ok(body.message.includes('JARVIS Executive Directive Processed'));
    assert.ok(body.reportId);
    assert.ok(['COMPLETED', 'COMPLETED_WITH_WARNINGS'].includes(body.status));
    assert.strictEqual(typeof body.priority, 'number');
    assert.ok(body.executiveDecision);
    assert.ok(body.planSummary);
    assert.ok(Array.isArray(body.agentContributions));
  });

  test('7. POST /api/executive/chat returns 400 Bad Request when message is missing or empty', async () => {
    const res = await routeApiRequest('/api/executive/chat', 'POST', { message: '' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Message is required for executive communication');
  });
});
