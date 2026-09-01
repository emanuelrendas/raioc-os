/**
 * MISSION-015E-B-R1: production safety gates around the ADR-015D runtime.
 *
 * These identifiers are synthetic test UUIDs. They are never production lead
 * identifiers and the suite uses the in-memory Supabase client only.
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseClient } from '../src/db/supabase-client.js';
import { run_cycle } from '../src/core/run-cycle.js';

const SELECTED_LEAD_ID = '00000000-0000-4000-8000-000000000001';
const BACKLOG_LEAD_ID = '00000000-0000-4000-8000-000000000002';
const OTHER_BACKLOG_LEAD_ID = '00000000-0000-4000-8000-000000000003';
const ENV_KEYS = ['RAIOC_RUNTIME_EXECUTION_MODE', 'RAIOC_CANARY_LEAD_IDS'];

let originalFetch;

before(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('NETWORK CALL ATTEMPTED: runtime safety tests must remain hermetic');
  };
});

after(() => {
  globalThis.fetch = originalFetch;
});

function makeLead(id, consentStatus = 'unknown', status = 'new') {
  return {
    id,
    name: 'Synthetic Test Lead',
    email: 'synthetic@example.test',
    phone: '+15555550100',
    status,
    consent_status: consentStatus,
    created_at: new Date().toISOString(),
  };
}

function makeDb(...leads) {
  const db = new SupabaseClient({ useMock: true });
  db.mockStore.leads.push(...leads);
  return db;
}

function observeRuntimeCalls(db) {
  const calls = { claims: [], discoveries: [], queueWrites: 0 };
  const fetchLeadExecution = db.fetchLeadExecution.bind(db);
  const fetchPendingLeads = db.fetchPendingLeads.bind(db);
  const enqueueDispatch = db.enqueueDispatch.bind(db);

  db.fetchLeadExecution = async (...args) => {
    calls.claims.push(args[0]);
    return fetchLeadExecution(...args);
  };
  db.fetchPendingLeads = async (...args) => {
    calls.discoveries.push(args);
    return fetchPendingLeads(...args);
  };
  db.enqueueDispatch = async (...args) => {
    calls.queueWrites++;
    return enqueueDispatch(...args);
  };

  return calls;
}

async function withRuntimeEnvironment(values, action) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of ENV_KEYS) {
      if (values[key] === undefined) delete process.env[key];
      else process.env[key] = values[key];
    }
    return await action();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('missing runtime mode is OFF, before any discovery or execution claim', async () => {
  await withRuntimeEnvironment({}, async () => {
    const db = makeDb(makeLead(BACKLOG_LEAD_ID));
    const calls = observeRuntimeCalls(db);

    const result = await run_cycle({ dbClient: db });

    assert.equal(result.status, 'DISABLED');
    assert.equal(result.summary.runtimeExecution.mode, 'off');
    assert.equal(calls.discoveries.length, 0);
    assert.deepEqual(calls.claims, []);
  });
});

test('OFF mode creates no claims, provider effects, or dispatch queue writes', async () => {
  await withRuntimeEnvironment({ RAIOC_RUNTIME_EXECUTION_MODE: 'off' }, async () => {
    const db = makeDb(makeLead(BACKLOG_LEAD_ID, 'opted_in'));
    const calls = observeRuntimeCalls(db);

    const result = await run_cycle({ dbClient: db });

    assert.equal(result.status, 'DISABLED');
    assert.deepEqual(calls.claims, []);
    assert.equal(db.mockStore.execution_effects.length, 0);
    assert.equal(calls.queueWrites, 0);
    assert.equal(db.mockStore.dispatch_queue.length, 0);
  });
});

test('an unknown runtime mode behaves as OFF', async () => {
  await withRuntimeEnvironment({ RAIOC_RUNTIME_EXECUTION_MODE: 'ACTIVE' }, async () => {
    const db = makeDb(makeLead(BACKLOG_LEAD_ID));
    const calls = observeRuntimeCalls(db);

    const result = await run_cycle({ dbClient: db });

    assert.equal(result.status, 'DISABLED');
    assert.equal(result.summary.runtimeExecution.mode, 'off');
    assert.equal(result.summary.runtimeExecution.reason, 'RUNTIME_MODE_INVALID');
    assert.deepEqual(calls.claims, []);
  });
});

test('an empty canary allowlist fails closed without a claim', async () => {
  await withRuntimeEnvironment({
    RAIOC_RUNTIME_EXECUTION_MODE: 'canary',
    RAIOC_CANARY_LEAD_IDS: '',
  }, async () => {
    const db = makeDb(makeLead(BACKLOG_LEAD_ID));
    const calls = observeRuntimeCalls(db);

    const result = await run_cycle({ dbClient: db });

    assert.equal(result.status, 'DISABLED');
    assert.equal(result.summary.runtimeExecution.reason, 'CANARY_LEAD_IDS_EMPTY');
    assert.equal(calls.discoveries.length, 0);
    assert.deepEqual(calls.claims, []);
  });
});

test('a canary allowlist never makes an unrelated backlog lead claimable', async () => {
  await withRuntimeEnvironment({
    RAIOC_RUNTIME_EXECUTION_MODE: 'canary',
    RAIOC_CANARY_LEAD_IDS: SELECTED_LEAD_ID,
  }, async () => {
    const db = makeDb(makeLead(BACKLOG_LEAD_ID));
    const calls = observeRuntimeCalls(db);

    const result = await run_cycle({ dbClient: db });

    assert.equal(result.status, 'SUCCESS');
    assert.deepEqual(calls.claims, []);
    assert.equal(db.mockStore.lead_executions.length, 0);
  });
});

test('a matching canary lead is eligible while every historical backlog lead remains unclaimed', async () => {
  await withRuntimeEnvironment({
    RAIOC_RUNTIME_EXECUTION_MODE: 'canary',
    RAIOC_CANARY_LEAD_IDS: SELECTED_LEAD_ID,
  }, async () => {
    const db = makeDb(
      makeLead(BACKLOG_LEAD_ID),
      makeLead(SELECTED_LEAD_ID),
      makeLead(OTHER_BACKLOG_LEAD_ID),
    );
    const calls = observeRuntimeCalls(db);

    const result = await run_cycle({ dbClient: db });

    assert.equal(result.status, 'SUCCESS');
    assert.deepEqual(calls.discoveries[0][1], { leadIds: [SELECTED_LEAD_ID] });
    assert.deepEqual(calls.claims, [SELECTED_LEAD_ID]);
    assert.equal(db.mockStore.lead_executions.length, 1);
    assert.equal(db.mockStore.lead_executions[0].lead_id, SELECTED_LEAD_ID);
    assert.deepEqual(
      db.mockStore.execution_effects.map((effect) => effect.effect_type).sort(),
      ['n8n_webhook', 'telegram_alert'],
    );
  });
});

test('a malformed canary allowlist is explicitly disabled and cannot broaden discovery', async () => {
  await withRuntimeEnvironment({
    RAIOC_RUNTIME_EXECUTION_MODE: 'canary',
    RAIOC_CANARY_LEAD_IDS: `${SELECTED_LEAD_ID},not-a-uuid`,
  }, async () => {
    const db = makeDb(makeLead(BACKLOG_LEAD_ID), makeLead(SELECTED_LEAD_ID));
    const calls = observeRuntimeCalls(db);

    const result = await run_cycle({ dbClient: db });

    assert.equal(result.status, 'DISABLED');
    assert.equal(result.summary.runtimeExecution.reason, 'CANARY_LEAD_IDS_INVALID');
    assert.equal(calls.discoveries.length, 0);
    assert.deepEqual(calls.claims, []);
  });
});

test('ACTIVE retains normal status=new discovery and existing batch behavior', async () => {
  await withRuntimeEnvironment({ RAIOC_RUNTIME_EXECUTION_MODE: 'active' }, async () => {
    const db = makeDb(
      makeLead(BACKLOG_LEAD_ID),
      makeLead(SELECTED_LEAD_ID, 'unknown', 'qualified'),
    );
    const calls = observeRuntimeCalls(db);

    const result = await run_cycle({ dbClient: db, batchSize: 1 });

    assert.equal(result.status, 'SUCCESS');
    assert.deepEqual(calls.claims, [BACKLOG_LEAD_ID]);
    assert.equal(result.summary.leadsProcessed, 1);
  });
});

test('unknown consent blocks WhatsApp and email enqueueing but preserves internal effects', async () => {
  await withRuntimeEnvironment({ RAIOC_RUNTIME_EXECUTION_MODE: 'active' }, async () => {
    const db = makeDb(makeLead(SELECTED_LEAD_ID, 'unknown'));

    const result = await run_cycle({ dbClient: db });

    assert.equal(result.summary.dispatches.whatsapp, 0);
    assert.equal(result.summary.dispatches.email, 0);
    assert.deepEqual(result.summary.skippedByConsent, { whatsapp: 1, email: 1 });
    assert.equal(db.mockStore.dispatch_queue.some((task) => task.type === 'whatsapp'), false);
    assert.equal(db.mockStore.dispatch_queue.some((task) => task.type === 'email'), false);
    assert.deepEqual(
      db.mockStore.execution_effects.map((effect) => effect.effect_type).sort(),
      ['n8n_webhook', 'telegram_alert'],
    );
    assert.equal(db.mockStore.leads[0].consent_status, 'unknown');
  });
});

test('opted-in consent preserves the existing WhatsApp and email enqueue path', async () => {
  await withRuntimeEnvironment({ RAIOC_RUNTIME_EXECUTION_MODE: 'active' }, async () => {
    const db = makeDb(makeLead(SELECTED_LEAD_ID, 'opted_in'));

    const result = await run_cycle({ dbClient: db });

    assert.equal(result.summary.dispatches.whatsapp, 1);
    assert.equal(result.summary.dispatches.email, 1);
    assert.deepEqual(result.summary.skippedByConsent, { whatsapp: 0, email: 0 });
    assert.equal(db.mockStore.dispatch_queue.some((task) => task.type === 'whatsapp'), true);
    assert.equal(db.mockStore.dispatch_queue.some((task) => task.type === 'email'), true);
    assert.equal(db.mockStore.leads[0].consent_status, 'opted_in');
  });
});
