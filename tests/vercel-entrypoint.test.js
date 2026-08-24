import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';

describe('Vercel Serverless Function Entrypoint Tests', () => {
  test('handles /api/test-email request through Vercel serverless handler with full diagnostics', async () => {
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
      status(code) {
        statusCode = code;
        return this;
      },
      setHeader(name, val) {
        headersSet[name] = val;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
      send(data) {
        responseData = data;
        return this;
      },
    };

    await handler(req, res);

    assert.ok([200, 500].includes(statusCode));
    assert.ok(responseData.smtpDiagnostics);
    assert.strictEqual(responseData.recipient, 'privateadvisory@emanuelrendas.com');
  });

  test('handles /dashboard request returning HTML UI through Vercel serverless handler', async () => {
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
      status(code) {
        statusCode = code;
        return this;
      },
      setHeader(name, val) {
        headersSet[name] = val;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
      send(data) {
        responseData = data;
        return this;
      },
    };

    await handler(req, res);

    assert.strictEqual(statusCode, 200);
    assert.ok(typeof responseData === 'string');
    assert.ok(responseData.includes('RAIOC — Executive Command Center'));
  });
});
