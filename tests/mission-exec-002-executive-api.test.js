import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { routeApiRequest } from '../src/index.js';

describe('MISSION ID: EXEC-002 — Production Executive API Endpoints', () => {
  test('1. GET /api/executive/status returns real production telemetry, uptime, memory, and event bus health', async () => {
    const correlationId = `corr_exec_status_${Date.now()}`;
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
    // 1. Uptime
    assert.strictEqual(typeof body.uptime, 'number');
    assert.ok(body.uptime >= 0);

    // 2. Runtime status
    assert.ok(['OPERATIONAL', 'ACTIVE', 'HEALTHY'].includes(body.runtimeStatus));

    // 3. Memory usage
    assert.ok(body.memoryUsage);
    assert.strictEqual(typeof body.memoryUsage.rss, 'number');
    assert.strictEqual(typeof body.memoryUsage.heapTotal, 'number');
    assert.strictEqual(typeof body.memoryUsage.heapUsed, 'number');
    assert.ok(body.memoryUsage.heapUsed > 0);

    // 4. Active workflows
    assert.ok(body.activeWorkflows);
    assert.strictEqual(typeof body.activeWorkflows.runningTasks, 'number');
    assert.strictEqual(typeof body.activeWorkflows.pendingTasks, 'number');
    assert.strictEqual(typeof body.activeWorkflows.totalQueueDepth, 'number');

    // 5. Event bus health
    assert.ok(body.eventBusHealth);
    assert.strictEqual(body.eventBusHealth.status, 'HEALTHY');
    assert.strictEqual(typeof body.eventBusHealth.totalEventsLogged, 'number');
    assert.strictEqual(typeof body.eventBusHealth.registeredListeners, 'number');
  });

  test('2. GET /api/executive/connectors returns real connector states with strict missing_env_variable handling', async () => {
    const correlationId = `corr_exec_conn_${Date.now()}`;
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
    assert.ok(connectors, 'connectors object must be defined');

    // Verify all 6 required connectors are present
    const requiredConnectors = ['supabase', 'smtp', 'whatsappCloud', 'hubspot', 'googleCalendar', 'n8n'];
    for (const key of requiredConnectors) {
      assert.ok(connectors[key], `Connector '${key}' must be present in response`);
      const conn = connectors[key];
      assert.ok(
        ['CONNECTED', 'DISCONNECTED', 'AUTH_FAILED', 'ACTIVE', 'HTTP_ERROR'].includes(conn.status),
        `Connector '${key}' returned unexpected status: ${conn.status}`
      );

      // If disconnected due to missing credentials, verify reason
      if (conn.status === 'DISCONNECTED' && !conn.endpointUrl) {
        assert.strictEqual(conn.reason, 'missing_env_variable');
      }
    }
  });

  test('3. Connector probe handles active vs missing environment variables dynamically', async () => {
    // Test with temporary mock env var for n8n
    const originalN8n = process.env.N8N_WEBHOOK_URL;
    process.env.N8N_WEBHOOK_URL = '';

    const res = await routeApiRequest('/api/executive/connectors', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.connectors.n8n.status, 'DISCONNECTED');
    assert.strictEqual(res.body.connectors.n8n.reason, 'missing_env_variable');

    // Restore
    if (originalN8n) {
      process.env.N8N_WEBHOOK_URL = originalN8n;
    } else {
      delete process.env.N8N_WEBHOOK_URL;
    }
  });
});
