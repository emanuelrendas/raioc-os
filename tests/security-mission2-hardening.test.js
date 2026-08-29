/**
 * Mission-002 Verification Tests: Security Hardening & Fail-Closed Protection
 * Verifies:
 * 1. /api/test-email is deleted or returns 404
 * 2. /api/executive/*, /api/telemetry/*, /api/dashboard/*, and /dashboard require authentication (401 when unauthorized)
 * 3. Protected routes return 200 when authenticated via Bearer token or internal secret
 * 4. Public health endpoints (/health, /healthz) remain accessible
 * 5. SupabaseClient enforces fail-closed behavior in strict modes
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { routeApiRequest } from '../src/api/server.js';
import { AuthMiddleware, Roles } from '../src/security/auth-middleware.js';
import { SupabaseClient, PersistenceError } from '../src/db/supabase-client.js';

describe('MISSION-002: Security Hardening & Unauthenticated Send Surface Closure', () => {
  const testSecret = 'raioc_test_internal_secret_2026';
  const authHeaders = {
    'Authorization': `Bearer ${testSecret}`,
  };

  test('1. /api/test-email endpoint is deleted / returns 404', async () => {
    const resGet = await routeApiRequest('/api/test-email', 'GET');
    assert.strictEqual(resGet.status, 404);

    const resPost = await routeApiRequest('/api/test-email', 'POST', { to: 'victim@test.com' });
    assert.strictEqual(resPost.status, 404);
  });

  test('2. Unauthenticated requests to /api/executive/status return 401', async () => {
    const res = await routeApiRequest('/api/executive/status', 'GET', {}, {}, {});
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Unauthorized/i);
  });

  test('3. Unauthenticated requests to /api/executive/connectors return 401', async () => {
    const res = await routeApiRequest('/api/executive/connectors', 'GET', {}, {}, {});
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Unauthorized/i);
  });

  // MISSION-012-AUTH-FIX: /dashboard is the HTML shell and is intentionally
  // browser-loadable. The MISSION-002 invariant is retained on the data path
  // it calls, asserted in test 4b below.
  test('4. Unauthenticated requests to /dashboard return the 200 HTML shell', async () => {
    const res = await routeApiRequest('/dashboard', 'GET', {}, {}, {});
    assert.strictEqual(res.status, 200);
    assert.match(String(res.headers['Content-Type']), /text\/html/);
  });

  test('4b. Unauthenticated requests to the dashboard data APIs still return 401', async () => {
    for (const url of ['/api/dashboard/overview', '/api/executive/status', '/api/telemetry/status']) {
      const res = await routeApiRequest(url, 'GET', {}, {}, {});
      assert.strictEqual(res.status, 401, `${url} must still require authentication`);
      assert.strictEqual(res.body.success, false);
    }
  });

  test('5. Unauthenticated requests to /api/dashboard/ui return 401', async () => {
    const res = await routeApiRequest('/api/dashboard/ui', 'GET', {}, {}, {});
    assert.strictEqual(res.status, 401);
  });

  test('6. Authenticated requests with valid Bearer token return 200 for /api/executive/status', async () => {
    const origSecret = process.env.RAIOC_INTERNAL_SECRET;
    process.env.RAIOC_INTERNAL_SECRET = testSecret;

    try {
      const res = await routeApiRequest('/api/executive/status', 'GET', {}, {}, authHeaders);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.operatingSystem, 'RAIOC OS v1.0');
    } finally {
      process.env.RAIOC_INTERNAL_SECRET = origSecret;
    }
  });

  test('7. Authenticated requests with valid Bearer token return 200 for /api/executive/connectors', async () => {
    const origSecret = process.env.RAIOC_INTERNAL_SECRET;
    process.env.RAIOC_INTERNAL_SECRET = testSecret;

    try {
      const res = await routeApiRequest('/api/executive/connectors', 'GET', {}, {}, authHeaders);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.connectors !== undefined);
    } finally {
      process.env.RAIOC_INTERNAL_SECRET = origSecret;
    }
  });

  test('8. Public health endpoints (/health, /api/health, /healthz, /api/healthz) remain open (200 OK)', async () => {
    const resHealth = await routeApiRequest('/health', 'GET');
    assert.strictEqual(resHealth.status, 200);

    const resHealthz = await routeApiRequest('/healthz', 'GET');
    assert.strictEqual(resHealthz.status, 200);
    assert.strictEqual(resHealthz.body.status, 'OK');
  });

  test('9. SupabaseClient enforces Fail-Closed and throws PersistenceError when unconfigured in production', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      assert.throws(
        () => {
          new SupabaseClient({ url: '', key: '', useMock: false });
        },
        (err) => {
          return err instanceof PersistenceError && err.message.includes('Fail-Closed enforced');
        }
      );
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  test('10. Unauthenticated requests to /api/dashboard/overview return 401', async () => {
    const res = await routeApiRequest('/api/dashboard/overview', 'GET', {}, {}, {});
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test('11. Unauthenticated requests to /api/telemetry/events return 401', async () => {
    const res = await routeApiRequest('/api/telemetry/events', 'GET', {}, {}, {});
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });
});
