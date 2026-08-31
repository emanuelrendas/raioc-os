import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { run_cycle } from '../src/core/run-cycle.js';
import { SupabaseClient } from '../src/db/supabase-client.js';

/**
 * MISSION-015B — fail-closed lead processing safety gate.
 *
 * run_cycle processes a lead as one straight-line sequence inside a single try
 * block, with no branching between the steps:
 *
 *   1. updateLeadStatus(...)   <- the gate
 *   2. analyze / memorandum / brief
 *   3. saveExecutiveBrief      <- observable on the db client
 *   4. dispatchN8nEvent        <- module-level import
 *   5. sendTelegramAlert       <- module-level import
 *   6. enqueueDispatch x3      <- observable on the db client
 *
 * dispatchN8nEvent and sendTelegramAlert are module-level imports and cannot be
 * spied on without module mocking. They do not need to be: saveExecutiveBrief
 * runs strictly before both, and nothing between them can branch. If
 * saveExecutiveBrief was never called then control provably never reached
 * either adapter. The db-level spies are therefore a sound proof for the whole
 * side-effect set, and enqueueDispatch is asserted directly on top of that.
 *
 * These tests never assert that storage accepts 'processing', 'completed' or
 * 'failed', and never read metadata off a lead. Seed rows use 'new', which
 * production does allow.
 */

/** Sentinel meaning "use the real mock implementation for this lead". */
const DELEGATE = Symbol('delegate');

/**
 * Builds a mock client instrumented with call spies.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.initialStatusResult] - receives the lead id and, when
 *   it returns anything other than undefined, replaces the result of the FIRST
 *   updateLeadStatus call for that lead. Keyed on call order rather than on a
 *   status string, so the test states no expectation about which status values
 *   storage accepts.
 * @returns {{db: SupabaseClient, calls: Object}}
 */
function instrumentedClient({ initialStatusResult } = {}) {
  const db = new SupabaseClient({ useMock: true });
  const calls = {
    statusWrites: [],
    saveExecutiveBrief: [],
    enqueueDispatch: [],
  };

  const realUpdateLeadStatus = db.updateLeadStatus.bind(db);
  const seenLeads = new Set();
  db.updateLeadStatus = async (id, status, ...rest) => {
    const isInitial = !seenLeads.has(id);
    seenLeads.add(id);
    calls.statusWrites.push({ id, status });
    if (isInitial && initialStatusResult) {
      const simulated = initialStatusResult(id);
      // DELEGATE lets a test override some leads and leave others untouched;
      // it is a sentinel because `undefined` is itself a result under test.
      if (simulated !== DELEGATE) return simulated;
    }
    return realUpdateLeadStatus(id, status, ...rest);
  };

  const realSaveExecutiveBrief = db.saveExecutiveBrief.bind(db);
  db.saveExecutiveBrief = async (brief) => {
    calls.saveExecutiveBrief.push(brief?.lead_id ?? brief?.leadId ?? null);
    return realSaveExecutiveBrief(brief);
  };

  const realEnqueueDispatch = db.enqueueDispatch.bind(db);
  db.enqueueDispatch = async (item) => {
    calls.enqueueDispatch.push(item?.type ?? null);
    return realEnqueueDispatch(item);
  };

  return { db, calls };
}

function seedLead(db, id) {
  db.mockStore.leads.push({
    id,
    name: 'Sarah Connor',
    company: 'Cyberdyne Systems',
    email: 'sarah@cyberdyne.com',
    phone: '+14155550199',
    company_size: '500+',
    ai_maturity: 'in_production',
    timeline: 'immediate',
    data_stack: 'modern cloud',
    status: 'new',
    created_at: new Date().toISOString(),
  });
}

/** Asserts that nothing externally visible happened for any lead. */
function assertNoExternalSideEffects(result, calls) {
  assert.deepStrictEqual(calls.saveExecutiveBrief, [], 'saveExecutiveBrief must not run');
  assert.deepStrictEqual(calls.enqueueDispatch, [], 'enqueueDispatch must not run');
  assert.strictEqual(result.summary.dispatches.n8n, 0, 'no n8n dispatch');
  assert.strictEqual(result.summary.dispatches.telegram, 0, 'no telegram alert');
  assert.strictEqual(result.summary.dispatches.whatsapp, 0, 'no whatsapp enqueue');
  assert.strictEqual(result.summary.dispatches.email, 0, 'no email enqueue');
  assert.strictEqual(result.summary.dispatches.crm, 0, 'no crm enqueue');
  assert.strictEqual(result.summary.executiveBriefsGenerated, 0, 'no brief generated');
}

describe('MISSION-015B: fail-closed lead processing safety gate', () => {
  test('initial status persists: processing continues through to dispatch', async () => {
    const { db, calls } = instrumentedClient();
    seedLead(db, 'lead_ok_001');

    const result = await run_cycle({ dbClient: db });

    assert.strictEqual(result.summary.leadsProcessed, 1);
    assert.strictEqual(result.summary.executiveBriefsGenerated, 1);
    assert.deepStrictEqual(calls.saveExecutiveBrief, ['lead_ok_001']);
    assert.ok(calls.enqueueDispatch.length >= 1, 'dispatches were enqueued');
    assert.strictEqual(result.summary.dispatches.n8n, 1);
    assert.strictEqual(result.summary.dispatches.telegram, 1);
    assert.strictEqual(result.summary.failures.processing, 0);
  });

  test('initial status write returns null: aborts before any side effect', async () => {
    const { db, calls } = instrumentedClient({ initialStatusResult: () => null });
    seedLead(db, 'lead_null_001');

    const result = await run_cycle({ dbClient: db });

    assertNoExternalSideEffects(result, calls);
    assert.strictEqual(result.summary.leadsProcessed, 0);
    assert.strictEqual(result.summary.failures.processing, 1);
  });

  test('initial status write returns undefined: aborts before any side effect', async () => {
    const { db, calls } = instrumentedClient({ initialStatusResult: () => undefined });
    seedLead(db, 'lead_undef_001');

    const result = await run_cycle({ dbClient: db });

    assertNoExternalSideEffects(result, calls);
    assert.strictEqual(result.summary.leadsProcessed, 0);
    assert.strictEqual(result.summary.failures.processing, 1);
  });

  test('initial status write matches zero rows ([]): aborts before any side effect', async () => {
    // PostgREST returns 200 with an empty array when the filter matched nothing.
    // [] is truthy, so this is the case a plain falsy check would wave through.
    const { db, calls } = instrumentedClient({ initialStatusResult: () => [] });
    seedLead(db, 'lead_empty_001');

    const result = await run_cycle({ dbClient: db });

    assertNoExternalSideEffects(result, calls);
    assert.strictEqual(result.summary.leadsProcessed, 0);
    assert.strictEqual(result.summary.failures.processing, 1);
  });

  test('a row-returning write ([{...}]) is accepted as persisted', async () => {
    const { db, calls } = instrumentedClient({
      initialStatusResult: () => [{ id: 'lead_arr_001', status: 'new' }],
    });
    seedLead(db, 'lead_arr_001');

    const result = await run_cycle({ dbClient: db });

    assert.strictEqual(result.summary.leadsProcessed, 1);
    assert.deepStrictEqual(calls.saveExecutiveBrief, ['lead_arr_001']);
  });

  test('failed state transition cannot produce a successful leadsProcessed count', async () => {
    const { db } = instrumentedClient({ initialStatusResult: () => null });
    seedLead(db, 'lead_count_001');
    seedLead(db, 'lead_count_002');
    seedLead(db, 'lead_count_003');

    const result = await run_cycle({ dbClient: db });

    assert.strictEqual(result.summary.leadsProcessed, 0, 'no lead may count as processed');
    assert.strictEqual(result.summary.failures.processing, 3, 'every failure is surfaced');
    assert.notStrictEqual(
      result.summary.failures.processing,
      0,
      'the cycle must not report a clean run'
    );
  });

  test('one lead failing persistence does not block a healthy lead in the same batch', async () => {
    const { db, calls } = instrumentedClient({
      initialStatusResult: (id) => (id === 'lead_bad_001' ? null : DELEGATE),
    });
    seedLead(db, 'lead_bad_001');
    seedLead(db, 'lead_good_001');

    const result = await run_cycle({ dbClient: db });

    assert.strictEqual(result.summary.leadsProcessed, 1, 'only the healthy lead counts');
    assert.strictEqual(result.summary.failures.processing, 1);
    assert.deepStrictEqual(
      calls.saveExecutiveBrief,
      ['lead_good_001'],
      'no brief for the aborted lead'
    );
    assert.ok(calls.enqueueDispatch.length >= 1, 'the healthy lead still dispatched');
  });

  test('aborted lead performs no follow-up status writes', async () => {
    const { db, calls } = instrumentedClient({ initialStatusResult: () => null });
    seedLead(db, 'lead_single_001');

    await run_cycle({ dbClient: db });

    // Exactly one attempt: the initial transition. The gate must not fall through
    // to the catch block and attempt a second, equally doomed write.
    assert.strictEqual(calls.statusWrites.length, 1, 'no second status write attempted');
    assert.strictEqual(calls.statusWrites[0].id, 'lead_single_001');
  });
});
