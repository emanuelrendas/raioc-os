/**
 * MISSION-016: Asset Path Confinement, Data Truthfulness & Lead Visibility
 *
 * Regression cover for three defects found by independent audit on 2026-09-05:
 *
 *  1. api/index.js served any file whose extension was in the mime map, resolved
 *     from the caller-controlled path with no confinement. '/../secret.txt' escaped
 *     the application root and '/src/config/secrets-manager.js' returned source code
 *     to an anonymous caller. Reproduced against the real handler before the fix.
 *
 *  2. supabase-client fell back to hardcoded demo records when interaction_logs or
 *     agent_fleet_status returned empty, with per-request timestamps, so a live
 *     dashboard showed fabricated client activity that always looked seconds old.
 *
 *  3. GET /api/crm/leads returned a hardcoded empty array outside mock mode, and
 *     handleInteractionsRequest was called with mismatched arguments so it answered
 *     405 to every request.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveAssetPath } from '../api/index.js';
import { SupabaseClient } from '../src/db/supabase-client.js';
import { handleCrmRequest } from '../src/api/routes/crm-routes.js';
import { handleInteractionsRequest } from '../src/api/mission-control/interactions.js';

describe('MISSION-016 #1: asset paths are confined to allowed roots', () => {
  test('traversal above the application root is refused', () => {
    const outside = path.join(os.tmpdir(), `mission016-${process.pid}.txt`);
    fs.writeFileSync(outside, 'SENTINEL_VALUE_MUST_NOT_BE_SERVED');
    try {
      assert.equal(resolveAssetPath('/../../../../../../..' + outside), null);
      assert.equal(resolveAssetPath('/../mission016-probe.txt'), null);
      assert.equal(resolveAssetPath('/assets/../../etc/hosts.txt'), null);
      assert.equal(resolveAssetPath('/assets/../package.json'), null);
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  test('application source code is not servable', () => {
    assert.equal(resolveAssetPath('/src/config/secrets-manager.js'), null);
    assert.equal(resolveAssetPath('/src/db/supabase-client.js'), null);
    assert.equal(resolveAssetPath('/api/index.js'), null);
    assert.equal(resolveAssetPath('/package.json'), null);
    assert.equal(resolveAssetPath('/vercel.json'), null);
    assert.equal(resolveAssetPath('/.env.example'), null);
  });

  test('legitimate site assets still resolve', () => {
    const css = resolveAssetPath('/assets/site.css');
    assert.ok(css, '/assets/site.css must resolve');
    assert.equal(css.contentType, 'text/css; charset=utf-8');

    const js = resolveAssetPath('/assets/site.js?v=20260823c');
    assert.ok(js, 'a versioned asset query string must not break resolution');
    assert.equal(js.contentType, 'application/javascript');

    for (const rootFile of ['/robots.txt', '/og.jpg', '/sitemap.xml']) {
      assert.ok(resolveAssetPath(rootFile), `${rootFile} must resolve`);
    }
  });

  test('undeclared media types and malformed paths are refused', () => {
    assert.equal(resolveAssetPath('/assets/site.exe'), null);
    assert.equal(resolveAssetPath('/assets/config.yaml'), null);
    assert.equal(resolveAssetPath(''), null);
    assert.equal(resolveAssetPath('/'), null);
    assert.equal(resolveAssetPath(null), null);
  });
});

describe('MISSION-016 #2: an empty table is reported as empty, never as demo data', () => {
  test('fetchInteractionLogs returns an empty array when the live query fails', async () => {
    const client = new SupabaseClient({
      supabaseUrl: 'http://127.0.0.1:1',
      supabaseKey: 'unreachable_key_for_test',
      isStrictProduction: false,
    });
    client.isMock = false;

    const logs = await client.fetchInteractionLogs(15);
    assert.ok(Array.isArray(logs));
    assert.equal(logs.length, 0, 'a failed query must not produce fabricated interactions');
  });

  test('no fabricated client identity reaches a live caller', async () => {
    const client = new SupabaseClient({
      supabaseUrl: 'http://127.0.0.1:1',
      supabaseKey: 'unreachable_key_for_test',
      isStrictProduction: false,
    });
    client.isMock = false;

    const serialized = JSON.stringify(await client.fetchInteractionLogs(15));
    for (const fabricated of ['Albuquerque', '+351912345678', 'OPAL_ROI_CALCULATED']) {
      assert.ok(!serialized.includes(fabricated), `demo record "${fabricated}" leaked into a live response`);
    }
  });

  test('fetchFleetStatus reports no agents rather than the seed roster', async () => {
    const client = new SupabaseClient({
      supabaseUrl: 'http://127.0.0.1:1',
      supabaseKey: 'unreachable_key_for_test',
      isStrictProduction: false,
    });
    client.isMock = false;

    const roster = await client.fetchFleetStatus();
    assert.ok(Array.isArray(roster));
    assert.equal(roster.length, 0, 'idle agents must not be reported as ACTIVE');
  });
});

describe('MISSION-016 #3: lead visibility and interaction stream', () => {
  const authHeaders = () => {
    process.env.RAIOC_INTERNAL_SECRET = process.env.RAIOC_INTERNAL_SECRET || 'mission016-test-secret';
    return { 'x-api-key': process.env.RAIOC_INTERNAL_SECRET };
  };

  test('GET /api/crm/leads refuses anonymous callers', async () => {
    const previous = process.env.RAIOC_INTERNAL_SECRET;
    process.env.RAIOC_INTERNAL_SECRET = 'mission016-test-secret';
    try {
      const res = await handleCrmRequest('/api/crm/leads', 'GET', {}, {}, {});
      assert.equal(res.status, 401, 'lead records must not be readable without credentials');
    } finally {
      if (previous === undefined) delete process.env.RAIOC_INTERNAL_SECRET;
      else process.env.RAIOC_INTERNAL_SECRET = previous;
    }
  });

  test('GET /api/crm/leads returns real rows with pagination metadata', async () => {
    const previous = process.env.RAIOC_INTERNAL_SECRET;
    const headers = authHeaders();
    try {
      const res = await handleCrmRequest('/api/crm/leads', 'GET', {}, { limit: 5 }, headers);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.leads), 'leads must be an array');
      assert.equal(typeof res.body.count, 'number');
      assert.equal(typeof res.body.limit, 'number');
      assert.equal(typeof res.body.offset, 'number');
    } finally {
      if (previous === undefined) delete process.env.RAIOC_INTERNAL_SECRET;
      else process.env.RAIOC_INTERNAL_SECRET = previous;
    }
  });

  test('fetchRecentLeads caps the page size and never returns a negative offset', async () => {
    const client = new SupabaseClient({ isMock: true });
    client.mockStore.leads = Array.from({ length: 500 }, (_, i) => ({ id: `lead-${i}`, source: 'website' }));

    const capped = await client.fetchRecentLeads({ limit: 9999, offset: -5 });
    assert.equal(capped.limit, 200, 'page size must be capped at 200');
    assert.equal(capped.offset, 0, 'a negative offset must clamp to zero');
    assert.equal(capped.count, 500);
    assert.equal(capped.leads.length, 200);
  });

  test('the interaction stream answers a GET instead of 405', async () => {
    const previous = process.env.RAIOC_INTERNAL_SECRET;
    const headers = authHeaders();
    try {
      const res = await handleInteractionsRequest('/api/mission-control/interactions', 'GET', {}, { limit: 5 }, headers);
      assert.notEqual(res.status, 405, 'a correctly-shaped GET must not be rejected as a bad method');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.interactions));
    } finally {
      if (previous === undefined) delete process.env.RAIOC_INTERNAL_SECRET;
      else process.env.RAIOC_INTERNAL_SECRET = previous;
    }
  });

  test('the interaction stream refuses anonymous callers', async () => {
    const previous = process.env.RAIOC_INTERNAL_SECRET;
    process.env.RAIOC_INTERNAL_SECRET = 'mission016-test-secret';
    try {
      const res = await handleInteractionsRequest('/api/mission-control/interactions', 'GET', {}, {}, {});
      assert.equal(res.status, 401, 'client communication history must not be public');
    } finally {
      if (previous === undefined) delete process.env.RAIOC_INTERNAL_SECRET;
      else process.env.RAIOC_INTERNAL_SECRET = previous;
    }
  });
});

describe('MISSION-016 #4: resolution does not depend on the working directory', () => {
  test('legitimate assets resolve from any cwd', () => {
    const original = process.cwd();
    try {
      const repoRoot = path.resolve(import.meta.dirname, '..');
      for (const cwd of [repoRoot, os.tmpdir(), path.parse(repoRoot).root]) {
        process.chdir(cwd);
        for (const asset of ['/assets/site.css', '/assets/site.js', '/robots.txt', '/og.jpg']) {
          assert.ok(
            resolveAssetPath(asset),
            `${asset} must resolve with cwd=${cwd}. On a host that runs the function from ` +
            'anywhere but the project root, a cwd-relative resolver returns null for every ' +
            'asset and the site loads with no stylesheet at all.'
          );
        }
      }
    } finally {
      process.chdir(original);
    }
  });

  test('confinement holds from a foreign cwd', () => {
    const original = process.cwd();
    try {
      process.chdir(os.tmpdir());
      for (const attack of [
        '/../secret.txt',
        '/src/config/secrets-manager.js',
        '/package.json',
        '/assets/../package.json',
        '/../../etc/hosts.txt',
      ]) {
        assert.equal(resolveAssetPath(attack), null, `${attack} must stay refused regardless of cwd`);
      }
    } finally {
      process.chdir(original);
    }
  });
});
