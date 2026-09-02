/**
 * Vercel Serverless Entrypoint Tests
 * Updated in MISSION-004 to reflect frozen MISSION-002 security invariants:
 * - /api/test-email must return 404 (endpoint deleted)
 * - /dashboard must return 401 without auth credentials
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';

describe('Vercel Serverless Function Entrypoint Tests', () => {
  // ─── MISSION-002 Invariant: test-email endpoint is deleted ─────────────────
  test('/api/test-email returns 404 (endpoint deleted in MISSION-002)', async () => {
    let statusCode = null;
    let headersSet = {};
    let responseData = null;

    const req = {
      url: '/api/test-email?to=privateadvisory@emanuelrendas.com',
      method: 'GET',
      headers: {},
      query: { to: 'privateadvisory@emanuelrendas.com' },
      body: {},
    };

    const res = {
      status(code) { statusCode = code; return this; },
      setHeader(name, val) { headersSet[name] = val; return this; },
      json(data) { responseData = data; return this; },
      send(data) { responseData = data; return this; },
      end(data) { if (data !== undefined) responseData = data; return this; },
    };

    await handler(req, res);

    assert.strictEqual(statusCode, 404, '/api/test-email must be deleted — MISSION-002 invariant');
    // Response must be JSON error, not an SMTP diagnostic payload
    const parsed = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
    assert.ok(
      parsed && (parsed.error || parsed.success === false),
      'Deleted endpoint must return a JSON error body'
    );
  });

  // ─── MISSION-012-AUTH-FIX: /dashboard HTML shell is browser-loadable, but
  // the API paths behind it stay authenticated (MISSION-002 invariant retained
  // on the data path, which is what it protects). ─────────────────────────────
  const invoke = async (url, headers = {}) => {
    let statusCode = null;
    const headersSet = {};
    let responseData = null;

    const req = { url, method: 'GET', headers, query: {}, body: {} };
    const res = {
      status(code) { statusCode = code; return this; },
      setHeader(name, val) { headersSet[name] = val; return this; },
      json(data) { responseData = data; return this; },
      send(data) { responseData = data; return this; },
      end(data) { if (data !== undefined) responseData = data; return this; },
    };

    await handler(req, res);
    return { statusCode, headersSet, responseData };
  };

  test('/dashboard returns 200 HTML without auth credentials (browser-loadable shell)', async () => {
    const { statusCode, headersSet, responseData } = await invoke('/dashboard');

    assert.strictEqual(statusCode, 200, '/dashboard must be loadable by a normal browser');
    assert.match(String(headersSet['Content-Type']), /text\/html/);
    assert.match(String(responseData), /<!DOCTYPE html>/i);
  });

  test('/admin/mission-control returns 200 HTML without auth credentials (browser-loadable shell)', async () => {
    const { statusCode, headersSet, responseData } = await invoke('/admin/mission-control');

    assert.strictEqual(statusCode, 200, '/admin/mission-control must be loadable by a normal browser');
    assert.match(String(headersSet['Content-Type']), /text\/html/);
    assert.match(String(responseData), /<!DOCTYPE html>/i);
  });

  test('data APIs behind the dashboard remain 401 without auth credentials', async () => {
    for (const url of ['/api/dashboard/overview', '/api/executive/status', '/api/telemetry/status', '/api/chat']) {
      const { statusCode } = await invoke(url);
      assert.strictEqual(statusCode, 401, `${url} must still require authentication`);
    }
  });

  test('API paths on the dashboard subdomain remain 401 (not swallowed by the HTML shell)', async () => {
    const { statusCode } = await invoke('/api/dashboard/overview', { host: 'dashboard.emanuelrendas.com' });
    assert.strictEqual(statusCode, 401, 'dashboard-host /api/* must reach the authenticated API router');
  });

  // ─── MISSION-004: Public pages are served correctly ─────────────────────────
  test('GET / returns 200 with HTML content (index.html disk-first)', async () => {
    let statusCode = null;
    let responseData = null;

    const req = {
      url: '/',
      method: 'GET',
      headers: {},
      query: {},
      body: {},
    };

    const res = {
      status(code) { statusCode = code; return this; },
      setHeader() { return this; },
      json(data) { responseData = data; return this; },
      send(data) { responseData = data; return this; },
      end(data) { if (data !== undefined) responseData = data; return this; },
    };

    await handler(req, res);

    assert.strictEqual(statusCode, 200, 'GET / must return 200');
    assert.ok(
      typeof responseData === 'string' && responseData.includes('<!DOCTYPE html'),
      'GET / must return HTML'
    );
  });
});
