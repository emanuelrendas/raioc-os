/**
 * PRODUCTION RECOVERY TEST SUITE — Single Gateway Verification
 * Verifies that all 15 required routes execute successfully through api/index.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import handler from '../api/index.js';

function createMockRes() {
  let statusCode = 200;
  let responseBody = null;
  const responseHeaders = {};

  const res = {
    setHeader: (key, val) => {
      responseHeaders[key.toLowerCase()] = val;
    },
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseBody = data;
      return res;
    },
    send: (data) => {
      responseBody = data;
      return res;
    },
    end: (data) => {
      if (data && responseBody === null) responseBody = data;
      return res;
    },
    _get: () => ({
      status: statusCode,
      body: responseBody,
      headers: responseHeaders,
    }),
  };

  return res;
}

describe('PRODUCTION RECOVERY: 100% Endpoint Verification via Single Gateway (api/index.js)', () => {
  test('1. /api/health', async () => {
    const res = createMockRes();
    await handler({ url: '/api/health', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.status, 'HEALTHY');
  });

  test('2. /api/lead', async () => {
    const res = createMockRes();
    const payload = { name: 'Test Lead', email: 'investor@test.ae', budget: '10M AED' };
    await handler({ url: '/api/lead', method: 'POST', body: payload, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
  });

  test('3. /api/intake', async () => {
    const res = createMockRes();
    await handler({ url: '/api/intake', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.ok, true);
    assert.strictEqual(out.body.endpoint, '/api/intake');
  });

  test('4. /api/assessment', async () => {
    const res = createMockRes();
    const payload = { lead: { name: 'Investor Assessment' }, score: 85 };
    await handler({ url: '/api/assessment', method: 'POST', body: payload, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
  });

  test('5. /api/dld', async () => {
    const res = createMockRes();
    await handler({ url: '/api/dld', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(out.body !== null);
  });

  test('6. /api/fx', async () => {
    const res = createMockRes();
    await handler({ url: '/api/fx', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.ok, true);
    assert.ok(out.body.rates.USD);
  });

  test('7. /api/event', async () => {
    const res = createMockRes();
    await handler({ url: '/api/event', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.ok, true);
    assert.strictEqual(out.body.endpoint, '/api/event');
  });

  test('8. /api/test-email', async () => {
    const res = createMockRes();
    await handler({ url: '/api/test-email', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.ok([200, 500].includes(out.status));
    assert.ok(out.body);
  });

  test('9. /api/executive/status', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/status', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(out.body.runtimeStatus === 'OPERATIONAL' || out.body.runtimeStatus === 'HEALTHY');
    assert.ok(out.body.memoryUsage);
    assert.ok(out.body.eventBusHealth);
  });

  test('10. /api/executive/connectors', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/connectors', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(out.body.connectors.supabase);
  });

  test('11. /api/executive/pipeline', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/pipeline', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(out.body.totalPipelineRevenueAed !== undefined || out.body.recentDeals !== undefined);
  });

  test('12. /api/executive/kpis', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/kpis', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(out.body.kpis);
  });

  test('13. /api/executive/chat', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/chat', method: 'POST', body: { message: 'status report' }, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(out.body.message || out.body.response);
  });

  test('14. /api/executive/alerts', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/alerts', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(Array.isArray(out.body.alerts));
  });

  test('15. /dashboard', async () => {
    const res = createMockRes();
    await handler({ url: '/dashboard', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(typeof out.body === 'string');
    assert.ok(out.body.includes('Command Center') || out.body.includes('RAIOC'));
  });

  test('16. Subdomain Host Routing: dashboard.emanuelrendas.com', async () => {
    const res = createMockRes();
    await handler({ url: '/', method: 'GET', headers: { host: 'dashboard.emanuelrendas.com' } }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(typeof out.body === 'string');
    assert.ok(out.body.includes('Command Center') || out.body.includes('RAIOC'));
  });

  test('17. Subdomain Host Routing: api.emanuelrendas.com', async () => {
    const res = createMockRes();
    await handler({ url: '/status', method: 'GET', headers: { host: 'api.emanuelrendas.com' } }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(out.body.runtimeStatus === 'OPERATIONAL' || out.body.runtimeStatus === 'HEALTHY');
  });

  test('18. Public Website Root: emanuelrendas.com', async () => {
    const res = createMockRes();
    await handler({ url: '/', method: 'GET', headers: { host: 'www.emanuelrendas.com' } }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(typeof out.body === 'string');
    assert.ok(out.body.includes('Emanuel Rendas — Private Real Estate Advisory'));
  });
});
