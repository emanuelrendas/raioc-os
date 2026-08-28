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

  // ─── MISSION-002 Invariant: /dashboard requires authentication ──────────────
  test('/dashboard returns 401 Unauthorized without auth credentials', async () => {
    let statusCode = null;
    let headersSet = {};
    let responseData = null;

    const req = {
      url: '/dashboard',
      method: 'GET',
      headers: {},
      query: {},
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

    assert.strictEqual(
      statusCode,
      401,
      '/dashboard must require authentication (401) — MISSION-002 invariant'
    );
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
