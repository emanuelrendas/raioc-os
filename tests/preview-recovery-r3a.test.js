/**
 * Recovery Gate R3-A: preview routes must not construct the persistence
 * client until a request actually crosses a database boundary.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const RESULT_PREFIX = 'R3A_RESULT:';

function strictProductionEnv() {
  const env = { ...process.env, NODE_ENV: 'production', VERCEL: '1' };
  for (const key of [
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_MOCK_FALLBACK',
  ]) {
    delete env[key];
  }

  return env;
}

function runChild(script) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: new URL('..', import.meta.url),
    env: strictProductionEnv(),
    encoding: 'utf8',
    timeout: 10_000,
  });

  return result;
}

function runPreviewRequest(url, method = 'GET', body = {}) {
  const request = JSON.stringify({ url, method, body });
  const result = runChild(`
    const request = ${request};
    const { default: handler } = await import('./api/index.js');
    let statusCode = null;
    let responseBody = null;
    const headers = {};
    const response = {
      status(code) { statusCode = code; return this; },
      setHeader(name, value) { headers[name] = value; return this; },
      json(value) { responseBody = value; return this; },
      send(value) { responseBody = value; return this; },
      end(value) { if (value !== undefined) responseBody = value; return this; },
    };
    await handler({
      url: request.url,
      method: request.method,
      body: request.body,
      query: {},
      headers: {},
    }, response);
    console.log('${RESULT_PREFIX}' + JSON.stringify({ statusCode, responseBody, headers }));
  `);

  assert.equal(
    result.status,
    0,
    `preview request ${method} ${url} crashed before returning a response:\n${result.stderr || result.stdout}`,
  );

  const resultLine = result.stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith(RESULT_PREFIX));
  assert.ok(resultLine, `preview request ${method} ${url} returned no structured result`);
  return JSON.parse(resultLine.slice(RESULT_PREFIX.length));
}

describe('Recovery Gate R3-A: lazy preview persistence boundary', () => {
  test('a public contact page renders without constructing an unconfigured production Supabase client', () => {
    const result = runPreviewRequest('/contact');

    assert.equal(result.statusCode, 200);
    assert.match(result.responseBody, /<!DOCTYPE html/i);
  });

  test('the canonical versioned health route is public without Supabase credentials', () => {
    const result = runPreviewRequest('/api/v1/health');

    assert.equal(result.statusCode, 200);
    assert.equal(result.responseBody.status, 'HEALTHY');
  });

  test('a data route remains fail-closed when production Supabase credentials are absent', () => {
    const result = runPreviewRequest(
      '/api/v1/leads',
      'POST',
      { name: 'Blocked Preview Lead', email: 'blocked-preview@example.test' },
    );

    assert.equal(result.statusCode, 503);
    assert.equal(result.responseBody.stored, false);
    assert.equal(
      result.responseBody.error,
      'Lead storage is not configured. Your brief was not saved.',
    );
  });

  test('the lazy shared client still fails closed on first persistence access', () => {
    const result = runChild(`
      const { supabase } = await import('./src/db/supabase-client.js');
      try {
        void supabase.isMock;
      } catch (error) {
        console.log('${RESULT_PREFIX}' + JSON.stringify({
          name: error.name,
          operation: error.operation,
        }));
      }
    `);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const resultLine = result.stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith(RESULT_PREFIX));
    assert.ok(resultLine, 'first persistence access did not fail closed');
    assert.deepEqual(JSON.parse(resultLine.slice(RESULT_PREFIX.length)), {
      name: 'PersistenceError',
      operation: 'init',
    });
  });
});
