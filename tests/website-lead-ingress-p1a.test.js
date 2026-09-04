/**
 * MISSION P1-A — Canonical Website Lead Ingress Reconciliation
 *
 * Recovers the proven public-website lead-ingress contract from
 * dld-update-website (donor, ref 815e0469043a04f5229bc056b540b6a96ce0dd6a)
 * into raioc-os so raioc-os becomes the single source of truth for public
 * lead persistence.
 *
 * Hermetic: no live Supabase, n8n, Telegram, WhatsApp, email, Dubai Pulse
 * or Vercel network calls. global.fetch is mocked in every test that
 * needs it; process.env and global.fetch are restored after each test.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { handleLeadSubmission } from '../src/api/routes/lead-routes.js';
import { __resetRateLimit } from '../src/api/rate-limit.js';
import { routeApiRequest } from '../src/api/server.js';

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_ENV = { ...process.env };

const MOCK_URL = 'https://p1a-mock.supabase.co';
const MOCK_KEY = 'p1a-mock-service-role-key';

function setConfiguredEnv() {
  process.env.SUPABASE_URL = MOCK_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = MOCK_KEY;
}

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

beforeEach(() => {
  restoreEnv();
  __resetRateLimit();
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  restoreEnv();
  __resetRateLimit();
});

const VALID_PAYLOAD = { name: 'Test Investor', email: 'Test.Investor@Example.com' };

describe('MISSION P1-A: Canonical Website Lead Ingress', () => {

  test('T1 — valid new lead persists exact canonical fields and returns 200/stored/new', async () => {
    setConfiguredEnv();
    const calls = [];
    global.fetch = async (url, opts) => {
      calls.push({ url: String(url), opts });
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify([{ id: 'lead-001' }]),
      };
    };

    const res = await handleLeadSubmission(VALID_PAYLOAD, { headers: { 'x-forwarded-for': '10.0.0.1' } });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.stored, true);
    assert.strictEqual(res.body.id, 'lead-001');
    assert.strictEqual(res.body.lead_id, 'lead-001');
    assert.strictEqual(res.body.returning, false);
    assert.ok(typeof res.body.whatsapp_url === 'string' && res.body.whatsapp_url.startsWith('https://wa.me/'));

    assert.strictEqual(calls.length, 1, 'exactly one write call expected');
    assert.ok(calls[0].url.includes('/rest/v1/leads'));
    assert.strictEqual(calls[0].opts.method, 'POST');

    const row = JSON.parse(calls[0].opts.body);
    assert.strictEqual(row.name, 'Test Investor');
    assert.strictEqual(row.email, 'test.investor@example.com', 'email must be lowercased before persistence');
    assert.strictEqual(row.source, 'website');
    assert.strictEqual(row.origin, 'website');
    assert.strictEqual(row.relationship_type, 'website_organic');
    assert.strictEqual(row.consent_status, 'opted_in');
    assert.strictEqual(row.status, 'new');
    assert.ok(typeof row.created_at === 'string' && !Number.isNaN(Date.parse(row.created_at)));

    // Forbidden generated fields must never appear on a new insert.
    assert.strictEqual(row.riis_score, undefined);
    assert.strictEqual(row.dira_risk, undefined);
    assert.strictEqual(row.metadata, undefined);
  });

  test('T2 — accepted field aliases (including nested attribution) map onto canonical columns', async () => {
    setConfiguredEnv();
    let captured = null;
    global.fetch = async (url, opts) => {
      captured = JSON.parse(opts.body);
      return { ok: true, status: 201, text: async () => JSON.stringify([{ id: 'lead-002' }]) };
    };

    const res = await handleLeadSubmission({
      name: 'Alias Tester',
      email: 'alias@example.com',
      phone: '+971500000000',
      location: 'Dubai Marina',
      mandate_description: 'Looking for off-plan yield',
      objective: 'capital_appreciation',
      budget: '5-10M',
      attribution: {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'q3-launch',
        referrer_url: 'https://google.com/search',
      },
    }, { headers: { 'x-forwarded-for': '10.0.0.2' } });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(captured.mobile, '+971500000000');
    assert.strictEqual(captured.address, 'Dubai Marina');
    assert.strictEqual(captured.notes, 'Looking for off-plan yield');
    assert.strictEqual(captured.investment_objective, 'capital_appreciation');
    assert.strictEqual(captured.budget_band, '5-10M');
    assert.strictEqual(captured.utm_source, 'google');
    assert.strictEqual(captured.utm_medium, 'cpc');
    assert.strictEqual(captured.utm_campaign, 'q3-launch');
    assert.strictEqual(captured.referrer_url, 'https://google.com/search');
  });

  test('T3 — validation: missing name, missing email, malformed email, invalid body all return 400', async () => {
    setConfiguredEnv();
    global.fetch = async () => { throw new Error('fetch must not be called on a validation failure'); };

    const missingName = await handleLeadSubmission({ email: 'a@b.com' }, {});
    assert.strictEqual(missingName.status, 400);

    const missingEmail = await handleLeadSubmission({ name: 'A' }, {});
    assert.strictEqual(missingEmail.status, 400);

    const badEmail = await handleLeadSubmission({ name: 'A', email: 'not-an-email' }, {});
    assert.strictEqual(badEmail.status, 400);

    const invalidBody = await handleLeadSubmission(null, {});
    assert.strictEqual(invalidBody.status, 400);

    const invalidBody2 = await handleLeadSubmission('not-json-and-not-object{{{', {});
    assert.strictEqual(invalidBody2.status, 400);
  });

  test('T4 — missing Supabase configuration returns 503 and makes zero fetch calls', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    let fetchCalls = 0;
    global.fetch = async () => { fetchCalls++; return { ok: true, status: 200, text: async () => '[]' }; };

    const res = await handleLeadSubmission(VALID_PAYLOAD, {});
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.ok, false);
    assert.strictEqual(res.body.stored, false);
    assert.strictEqual(fetchCalls, 0);
  });

  test('T5 — duplicate (returning) lead: 409/23505 triggers PATCH, never overwrites identity/consent/status fields', async () => {
    setConfiguredEnv();
    const calls = [];
    global.fetch = async (url, opts) => {
      calls.push({ url: String(url), method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
      if (opts.method === 'POST') {
        return { ok: false, status: 409, text: async () => JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "leads_lower_email_key"' }) };
      }
      if (opts.method === 'PATCH') {
        return { ok: true, status: 200, text: async () => JSON.stringify([{ id: 'lead-existing-001' }]) };
      }
      throw new Error(`unexpected method ${opts.method}`);
    };

    const res = await handleLeadSubmission(VALID_PAYLOAD, {});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.stored, true);
    assert.strictEqual(res.body.returning, true);
    assert.strictEqual(res.body.id, 'lead-existing-001');

    const patchCall = calls.find(c => c.method === 'PATCH');
    assert.ok(patchCall, 'a PATCH must have been issued for the duplicate');
    assert.strictEqual(patchCall.body.id, undefined, 'PATCH must never carry id');
    assert.strictEqual(patchCall.body.email, undefined, 'PATCH must never carry email');
    assert.strictEqual(patchCall.body.created_at, undefined, 'PATCH must never carry created_at');
    assert.strictEqual(patchCall.body.consent_status, undefined, 'PATCH must never carry consent_status');
    assert.strictEqual(patchCall.body.status, undefined, 'PATCH must never carry status (ADR-015D: leads.status is CRM/business-lifecycle authority)');
  });

  test('T6 — duplicate update fallback: PATCH failure still resolves a deterministic id via lookup, no provider effects', async () => {
    setConfiguredEnv();
    const calls = [];
    global.fetch = async (url, opts) => {
      const method = opts.method || 'GET';
      calls.push({ url: String(url), method });
      if (method === 'POST') {
        return { ok: false, status: 409, text: async () => '23505 duplicate' };
      }
      if (method === 'PATCH') {
        return { ok: false, status: 500, text: async () => 'patch failed' };
      }
      // fallback GET lookup
      return { ok: true, status: 200, text: async () => JSON.stringify([{ id: 'lead-lookup-001' }]) };
    };

    const res = await handleLeadSubmission(VALID_PAYLOAD, {});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.returning, true);
    assert.strictEqual(res.body.id, 'lead-lookup-001');

    const methods = calls.map(c => c.method);
    assert.deepStrictEqual(methods, ['POST', 'PATCH', 'GET']);
  });

  test('T7 — non-duplicate DB error returns 502 without leaking schema/constraint details', async () => {
    setConfiguredEnv();
    global.fetch = async (url, opts) => {
      if (opts.method === 'POST') {
        return { ok: false, status: 500, text: async () => 'column "budget_band_typo" of relation "leads" does not exist; constraint leads_check_xyz violated' };
      }
      throw new Error('only POST expected in this scenario');
    };

    const res = await handleLeadSubmission(VALID_PAYLOAD, {});
    assert.strictEqual(res.status, 502);
    assert.strictEqual(res.body.ok, false);
    assert.strictEqual(res.body.stored, false);
    const serialized = JSON.stringify(res.body);
    assert.ok(!serialized.includes('budget_band_typo'));
    assert.ok(!serialized.includes('constraint leads_check_xyz'));
    assert.ok(!serialized.includes('relation "leads"'));
  });

  test('T8 — rate limiting: 10 accepted per client key per window, 11th is 429 with Retry-After', async () => {
    setConfiguredEnv();
    let n = 0;
    global.fetch = async () => {
      n++;
      return { ok: true, status: 201, text: async () => JSON.stringify([{ id: `lead-rl-${n}` }]) };
    };

    const headers = { 'x-forwarded-for': '203.0.113.9' };
    for (let i = 0; i < 10; i++) {
      const res = await handleLeadSubmission({ name: `Rate Test ${i}`, email: `rate${i}@example.com` }, { headers });
      assert.strictEqual(res.status, 200, `attempt ${i + 1} should be accepted`);
    }

    const eleventh = await handleLeadSubmission({ name: 'Rate Test 11', email: 'rate11@example.com' }, { headers });
    assert.strictEqual(eleventh.status, 429);
    assert.ok(eleventh.headers['Retry-After'], 'Retry-After header must be present on 429');
  });

  test('T9 — runtime OFF independence: ingress persistence works regardless of RAIOC_RUNTIME_EXECUTION_MODE', async () => {
    setConfiguredEnv();
    process.env.RAIOC_RUNTIME_EXECUTION_MODE = 'off';

    let wrote = false;
    global.fetch = async (url, opts) => {
      if (opts.method === 'POST') { wrote = true; return { ok: true, status: 201, text: async () => JSON.stringify([{ id: 'lead-runtime-off' }]) }; }
      throw new Error('unexpected call');
    };

    const res = await handleLeadSubmission({ name: 'Runtime Off', email: 'runtime-off@example.com' }, {});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.stored, true);
    assert.ok(wrote, 'the mocked database write must still occur with runtime execution OFF');
  });

  test('T10 — zero side-effect boundary: canonical ingress files import none of the forbidden RAIOC execution surfaces', () => {
    // Static/import boundary assertion. Deliberately scoped to actual module
    // specifiers (the real dependency edge), not prose — this file's own
    // header comments legitimately *discuss* assessment-routes/run-cycle/etc.
    // by name to explain why they were removed, and a plain substring scan
    // would false-positive on that documentation.
    const FORBIDDEN = [
      'assessment-routes',
      'run-cycle',
      'n8n',
      'dira',
      'riis',
      'telegram',
      'enqueuedispatch',
      'executive-brief',
      'memorandum',
      'agent-event-bus',
    ];

    const files = [
      'src/api/routes/lead-routes.js',
      'src/api/lead-upsert.js',
      'src/api/rate-limit.js',
    ];

    const IMPORT_RE = /^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

    for (const rel of files) {
      const abs = path.resolve(rel);
      assert.ok(fs.existsSync(abs), `${rel} must exist`);
      const source = fs.readFileSync(abs, 'utf8');

      const specifiers = [...source.matchAll(IMPORT_RE)].map(m => m[1].toLowerCase());
      // Zero imports (self-contained, e.g. lead-upsert.js / rate-limit.js
      // using only the global fetch) is a valid, even stronger boundary.

      for (const specifier of specifiers) {
        for (const forbidden of FORBIDDEN) {
          assert.ok(
            !specifier.includes(forbidden),
            `${rel} imports "${specifier}", which touches forbidden surface "${forbidden}"`,
          );
        }
      }
    }
  });

  test('T11 — router propagation: routeApiRequest forwards inbound headers so rate limiting sees the real client', async () => {
    setConfiguredEnv();
    let n = 0;
    global.fetch = async () => {
      n++;
      return { ok: true, status: 201, text: async () => JSON.stringify([{ id: `lead-router-${n}` }]) };
    };

    const headers = { 'x-forwarded-for': '198.51.100.7' };

    for (let i = 0; i < 10; i++) {
      const res = await routeApiRequest('/api/lead', 'POST', { name: `Router Test ${i}`, email: `router${i}@example.com` }, {}, headers);
      assert.strictEqual(res.status, 200, `router attempt ${i + 1} should be accepted`);
    }

    const eleventh = await routeApiRequest('/api/lead', 'POST', { name: 'Router Test 11', email: 'router11@example.com' }, {}, headers);
    assert.strictEqual(eleventh.status, 429, 'the router must propagate headers into handleLeadSubmission for rate limiting to engage');
  });

  test('T12 — database timeout is bounded with no retry and a subsequent explicit submission succeeds', async () => {
    setConfiguredEnv();

    const calls = [];

    global.fetch = async (url, opts = {}) => {
      calls.push({
        url: String(url),
        method: opts.method || 'GET',
        signal: opts.signal,
      });

      if (calls.length === 1) {
        assert.ok(opts.signal, 'timeout attempt must receive an abort signal');
        assert.ok(
          opts.signal instanceof AbortSignal,
          'timeout attempt signal must be an AbortSignal',
        );

        throw new DOMException(
          'The operation was aborted due to timeout',
          'TimeoutError',
        );
      }

      if (calls.length === 2) {
        return {
          ok: true,
          status: 201,
          text: async () => JSON.stringify([{ id: 'lead-timeout-recovery-001' }]),
        };
      }

      throw new Error(`unexpected fetch call ${calls.length}`);
    };

    const timedOut = await handleLeadSubmission(
      VALID_PAYLOAD,
      { headers: { 'x-forwarded-for': '10.0.0.12' } },
    );

    assert.strictEqual(timedOut.status, 502);
    assert.strictEqual(timedOut.body.ok, false);
    assert.strictEqual(timedOut.body.stored, false);
    assert.strictEqual(calls.length, 1, 'timeout must not trigger an automatic retry');
    assert.strictEqual(calls[0].method, 'POST');
    assert.ok(calls[0].url.includes('/rest/v1/leads'));

    const recovered = await handleLeadSubmission(
      VALID_PAYLOAD,
      { headers: { 'x-forwarded-for': '10.0.0.12' } },
    );

    assert.strictEqual(recovered.status, 200);
    assert.strictEqual(recovered.body.ok, true);
    assert.strictEqual(recovered.body.stored, true);
    assert.strictEqual(recovered.body.returning, false);
    assert.strictEqual(recovered.body.id, 'lead-timeout-recovery-001');

    assert.strictEqual(calls.length, 2, 'exactly two explicit mocked database calls expected');
    assert.deepStrictEqual(
      calls.map(call => call.method),
      ['POST', 'POST'],
      'timeout and explicit recovery must each perform exactly one POST',
    );

    assert.ok(
      calls.every(call => call.url.includes('/rest/v1/leads')),
      'all mocked fetches must remain inside the lead persistence boundary',
    );
  });
});
