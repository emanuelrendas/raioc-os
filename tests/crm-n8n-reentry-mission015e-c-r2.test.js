/**
 * MISSION-015E-C-R2: versioned CRM endpoint and WF-01 re-entry containment.
 */

import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseClient } from '../src/db/supabase-client.js';
import { handleCrmRequest, ingestCrmLead } from '../src/api/routes/crm-routes.js';

let originalFetch;
let unexpectedNetworkAttempts;

function hermeticFetch() {
  unexpectedNetworkAttempts++;
  throw new Error('NETWORK CALL ATTEMPTED: MISSION-015E-C-R2 MUST REMAIN HERMETIC');
}

before(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = hermeticFetch;
});

after(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  unexpectedNetworkAttempts = 0;
});

afterEach(() => {
  assert.equal(unexpectedNetworkAttempts, 0, 'an unmocked network call was attempted');
});

function payload(origin, overrides = {}) {
  return {
    id: `r2-${origin || 'normal'}-lead`,
    name: 'R2 CRM Synthetic Lead',
    email: 'r2-crm@example.test',
    phone: '+15555550116',
    country: 'Portugal',
    segment: 'PT_HNW',
    budget_aed: 15000000,
    notes: 'Synthetic hermetic fixture',
    ...(origin ? { origin } : {}),
    ...overrides,
  };
}

function makeDependencies() {
  const dbClient = new SupabaseClient({ useMock: true });
  const calls = { crm: [], n8n: [], cycles: [], events: [] };
  return {
    dbClient,
    calls,
    crmSyncClient: {
      syncLead: async (lead) => {
        calls.crm.push(lead);
        return { status: 'fake_crm_synced' };
      },
    },
    n8nWebhookClient: {
      enabled: true,
      triggerWorkflow: async (...args) => {
        calls.n8n.push(args);
        return { status: 'fake_n8n_forwarded' };
      },
    },
    runCycle: async (...args) => {
      calls.cycles.push(args);
      return { status: 'DISABLED' };
    },
    eventBus: {
      publish: (...args) => calls.events.push(args),
    },
  };
}

test('both CRM ingestion routes reach the same canonical ingestion contract', async () => {
  const v1 = makeDependencies();
  const compatibility = makeDependencies();

  const versioned = await handleCrmRequest(
    '/api/v1/crm/lead/ingest',
    'POST',
    payload(),
    {},
    { 'x-correlation-id': 'r2-versioned-route' },
    v1,
  );
  const alias = await handleCrmRequest(
    '/api/crm/lead/ingest',
    'POST',
    payload(),
    {},
    { 'x-correlation-id': 'r2-compatibility-route' },
    compatibility,
  );

  assert.equal(versioned.status, 200);
  assert.equal(alias.status, 200);
  assert.equal(versioned.body.status, 'INGESTED');
  assert.equal(alias.body.status, 'INGESTED');
  assert.equal(versioned.body.segment, 'PT_HNW');
  assert.equal(alias.body.segment, 'PT_HNW');
  assert.equal(v1.calls.crm.length, 1);
  assert.equal(compatibility.calls.crm.length, 1);
});

test('WF-01 provenance suppresses n8n re-forward and background run_cycle', async () => {
  const dependencies = makeDependencies();

  const result = await ingestCrmLead(payload('n8n-wf01'), {
    ...dependencies,
    correlationId: 'r2-wf01-origin',
    origin: 'n8n-wf01',
    triggerCycle: false,
    forwardToN8n: false,
  });

  assert.equal(result.status, 'INGESTED');
  assert.equal(dependencies.calls.crm.length, 1, 'CRM ingestion remains available for the active workflow path');
  assert.equal(dependencies.calls.n8n.length, 0, 'WF-01 origin must not re-forward to n8n');
  assert.equal(dependencies.calls.cycles.length, 0, 'WF-01 origin must not start another runtime cycle');
});

test('WF-01 provenance preserves missing customer contacts without fabricating identity', async () => {
  const dependencies = makeDependencies();

  await ingestCrmLead(payload('n8n-wf01', { email: '', phone: '' }), {
    ...dependencies,
    correlationId: 'r2-wf01-missing-contact',
    origin: 'n8n-wf01',
    triggerCycle: false,
    forwardToN8n: false,
  });

  assert.equal(dependencies.calls.crm.length, 1);
  assert.equal(dependencies.calls.crm[0].email, null);
  assert.equal(dependencies.calls.crm[0].phone, null);
  assert.equal(dependencies.calls.n8n.length, 0);
  assert.equal(dependencies.calls.cycles.length, 0);
});

test('normal CRM ingestion preserves its existing n8n forward and run_cycle behavior', async () => {
  const dependencies = makeDependencies();

  const result = await ingestCrmLead(payload(), {
    ...dependencies,
    correlationId: 'r2-normal-origin',
  });

  assert.equal(result.status, 'INGESTED');
  assert.equal(dependencies.calls.crm.length, 1);
  assert.equal(dependencies.calls.n8n.length, 1);
  assert.equal(dependencies.calls.cycles.length, 1);
});
