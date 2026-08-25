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

  test('4. Validates N8N_WEBHOOK_URL and marks n8n as CONNECTED when webhook responds with HTTP 200 to health check', async () => {
    const originalFetch = globalThis.fetch;
    const originalN8n = process.env.N8N_WEBHOOK_URL;
    const originalSecret = process.env.N8N_WEBHOOK_SECRET;

    process.env.N8N_WEBHOOK_URL = 'https://n8n.emanuelrendas.com/webhook/raioc-event-bus';
    process.env.N8N_WEBHOOK_SECRET = 'raioc_n8n_test_secret';

    let probedMethod = '';
    let probedUrl = '';
    let probeHeaders = {};

    globalThis.fetch = async (url, opts) => {
      probedUrl = url;
      probedMethod = opts.method;
      probeHeaders = opts.headers || {};
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ status: 'HEALTHY', message: 'Webhook active' }),
      };
    };

    try {
      const res = await routeApiRequest('/api/executive/connectors', 'GET');
      assert.strictEqual(res.status, 200);

      const n8n = res.body.connectors.n8n;
      assert.strictEqual(n8n.status, 'CONNECTED');
      assert.strictEqual(n8n.authenticated, true);
      assert.strictEqual(n8n.endpointUrl, 'https://n8n.emanuelrendas.com/webhook/raioc-event-bus');
      assert.strictEqual(typeof n8n.latencyMs, 'number');
      assert.strictEqual(probedUrl, 'https://n8n.emanuelrendas.com/webhook/raioc-event-bus');
      assert.strictEqual(probedMethod, 'POST');
      assert.ok(probeHeaders['X-N8N-Signature']);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalN8n) process.env.N8N_WEBHOOK_URL = originalN8n;
      else delete process.env.N8N_WEBHOOK_URL;

      if (originalSecret) process.env.N8N_WEBHOOK_SECRET = originalSecret;
      else delete process.env.N8N_WEBHOOK_SECRET;
    }
  });

  test('5. n8n health check falls back to HEAD probe if POST probe fails and marks CONNECTED on success', async () => {
    const originalFetch = globalThis.fetch;
    const originalN8n = process.env.N8N_WEBHOOK_URL;

    process.env.N8N_WEBHOOK_URL = 'https://n8n.emanuelrendas.com/webhook/raioc-event-bus';

    let callCount = 0;
    globalThis.fetch = async (url, opts) => {
      callCount++;
      if (opts.method === 'POST') {
        throw new Error('POST method not allowed on this webhook');
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
      };
    };

    try {
      const res = await routeApiRequest('/api/executive/connectors', 'GET');
      assert.strictEqual(res.status, 200);

      const n8n = res.body.connectors.n8n;
      assert.strictEqual(n8n.status, 'CONNECTED');
      assert.strictEqual(n8n.authenticated, true);
      assert.strictEqual(callCount, 2); // 1 POST then 1 HEAD fallback
    } finally {
      globalThis.fetch = originalFetch;
      if (originalN8n) process.env.N8N_WEBHOOK_URL = originalN8n;
      else delete process.env.N8N_WEBHOOK_URL;
    }
  });
});
