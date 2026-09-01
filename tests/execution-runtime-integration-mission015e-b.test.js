/**
 * MISSION-015E-B Verification Tests: Canonical Runtime Execution Integration
 *
 * These tests exercise real behaviour through the execution-authority layer and
 * the mock SupabaseClient, whose lead_executions / execution_effects stores
 * enforce the same UNIQUE constraints and compare-and-set semantics that
 * migration 005 enforces in PostgreSQL.
 *
 * Hermetic by construction: the client runs in mock mode, both outbound adapters
 * are disabled, and global fetch is replaced with a function that throws — so any
 * accidental network or production database call fails the suite loudly.
 */

process.env.N8N_ENABLED = 'false';
process.env.TELEGRAM_ENABLED = 'false';

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseClient } from '../src/db/supabase-client.js';
import { run_cycle } from '../src/core/run-cycle.js';
import {
  ACQUIRE_OUTCOME,
  EFFECT_STATUS,
  EFFECT_TYPES,
  EXECUTION_STATUS,
  EXECUTION_LEASE_MS,
  LEAD_RUN_CYCLE_WORKFLOW_KEY,
  acquireLeadExecution,
  classifyDispatchResult,
  completeLeadExecution,
  dispatchGuardedEffect,
} from '../src/core/execution-authority.js';

const LEAD_ID = '11111111-1111-1111-1111-111111111111';
const FORBIDDEN_LEAD_STATUSES = ['processing', 'completed', 'failed', 'pending', 'INGESTED'];

let originalFetch;

before(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('NETWORK CALL ATTEMPTED — unit tests must never reach a provider or a live database');
  };
});

after(() => {
  globalThis.fetch = originalFetch;
});

function makeDb() {
  const db = new SupabaseClient({ useMock: true });
  db.mockStore.leads.push({
    id: LEAD_ID,
    name: 'Sovereign Test Lead',
    email: 'sovereign@example.test',
    status: 'new',
    budget_band: '5M+',
    created_at: new Date().toISOString(),
  });
  return db;
}

/** Records every leads.status write attempted anywhere in a cycle. */
function spyOnLeadStatusWrites(db) {
  const writes = [];
  const original = db.updateLeadStatus.bind(db);
  db.updateLeadStatus = async (id, status) => {
    writes.push({ id, status });
    return original(id, status);
  };
  return writes;
}

async function claimFresh(db) {
  const acquisition = await acquireLeadExecution(db, LEAD_ID);
  assert.strictEqual(acquisition.outcome, ACQUIRE_OUTCOME.CLAIMED);
  return { execution: acquisition.execution, claimVersion: acquisition.claimVersion };
}

function expireLease(db) {
  const row = db.mockStore.lead_executions[0];
  row.lease_expires_at = new Date(Date.now() - 60_000).toISOString();
  return row;
}

// ─── Execution identity and claiming ───────────────────────────────────────────
describe('MISSION-015E-B: initial claim', () => {
  let db;
  beforeEach(() => { db = makeDb(); });

  test('1. initial claim succeeds exactly once and is recorded as attempt 1', async () => {
    const acquisition = await acquireLeadExecution(db, LEAD_ID);

    assert.strictEqual(acquisition.outcome, ACQUIRE_OUTCOME.CLAIMED);
    assert.strictEqual(acquisition.reason, 'INITIAL_CLAIM');
    assert.strictEqual(db.mockStore.lead_executions.length, 1);

    const row = db.mockStore.lead_executions[0];
    assert.strictEqual(row.lead_id, LEAD_ID);
    assert.strictEqual(row.workflow_key, LEAD_RUN_CYCLE_WORKFLOW_KEY);
    assert.strictEqual(row.status, EXECUTION_STATUS.RUNNING);
    assert.strictEqual(row.claim_version, 1);
    assert.strictEqual(row.attempt_count, 1, 'a successful claim is the first real attempt');
    assert.ok(row.lease_expires_at > new Date().toISOString(), 'claim must hold a future lease');
  });

  test('2. two concurrent workers race for the same lead: exactly one wins', async () => {
    const [a, b] = await Promise.all([
      acquireLeadExecution(db, LEAD_ID),
      acquireLeadExecution(db, LEAD_ID),
    ]);

    const claimed = [a, b].filter((r) => r.outcome === ACQUIRE_OUTCOME.CLAIMED);
    const skipped = [a, b].filter((r) => r.outcome === ACQUIRE_OUTCOME.SKIP);

    assert.strictEqual(claimed.length, 1, 'exactly one worker may own the execution');
    assert.strictEqual(skipped.length, 1);
    assert.strictEqual(skipped[0].reason, 'LOST_INITIAL_CLAIM_RACE');
    assert.strictEqual(db.mockStore.lead_executions.length, 1, 'never a second logical execution row');
  });

  test('4. an active lease held by another worker is not stealable', async () => {
    await claimFresh(db);
    const second = await acquireLeadExecution(db, LEAD_ID);

    assert.strictEqual(second.outcome, ACQUIRE_OUTCOME.SKIP);
    assert.strictEqual(second.reason, 'LEASE_HELD_BY_ANOTHER_WORKER');
    assert.strictEqual(db.mockStore.lead_executions.length, 1);
  });

  test('3. a COMPLETED execution is never replayed', async () => {
    const handle = await claimFresh(db);
    assert.ok(await completeLeadExecution(db, handle));

    const again = await acquireLeadExecution(db, LEAD_ID);
    assert.strictEqual(again.outcome, ACQUIRE_OUTCOME.SKIP);
    assert.strictEqual(again.reason, 'ALREADY_COMPLETED');
  });

  test('a FAILED execution is terminal and is not automatically retried', async () => {
    const handle = await claimFresh(db);
    await db.casUpdateLeadExecution(
      handle.execution.id,
      { status: EXECUTION_STATUS.RUNNING, claimVersion: handle.claimVersion },
      { status: EXECUTION_STATUS.FAILED, lease_expires_at: null }
    );

    const again = await acquireLeadExecution(db, LEAD_ID);
    assert.strictEqual(again.outcome, ACQUIRE_OUTCOME.SKIP);
    assert.strictEqual(again.reason, 'ALREADY_FAILED');
  });

  test('20. a workflow_version bump does not create a second logical execution', async () => {
    await claimFresh(db);
    expireLease(db);

    const redeployed = await acquireLeadExecution(db, LEAD_ID, { workflowVersion: '9.9.9' });

    assert.strictEqual(redeployed.outcome, ACQUIRE_OUTCOME.CLAIMED);
    assert.strictEqual(redeployed.reason, 'RECLAIMED');
    assert.strictEqual(db.mockStore.lead_executions.length, 1, 'still one logical execution');
    assert.strictEqual(db.mockStore.lead_executions[0].workflow_version, '9.9.9', 'version is recorded as evidence');
  });

  test('20b. a workflow_version bump does not reopen a COMPLETED execution', async () => {
    const handle = await claimFresh(db);
    await completeLeadExecution(db, handle);

    const redeployed = await acquireLeadExecution(db, LEAD_ID, { workflowVersion: '9.9.9' });
    assert.strictEqual(redeployed.outcome, ACQUIRE_OUTCOME.SKIP);
    assert.strictEqual(redeployed.reason, 'ALREADY_COMPLETED');
  });
});

// ─── Reclaim, fencing, retry accounting ────────────────────────────────────────
describe('MISSION-015E-B: reclaim and fencing', () => {
  let db;
  beforeEach(() => { db = makeDb(); });

  test('5. an expired lease is reclaimed on the same row, advancing both counters', async () => {
    await claimFresh(db);
    expireLease(db);

    const reclaim = await acquireLeadExecution(db, LEAD_ID);

    assert.strictEqual(reclaim.outcome, ACQUIRE_OUTCOME.CLAIMED);
    assert.strictEqual(reclaim.reason, 'RECLAIMED');
    assert.strictEqual(db.mockStore.lead_executions.length, 1, 'reclaim mutates the SAME row');

    const row = db.mockStore.lead_executions[0];
    assert.strictEqual(row.claim_version, 2, 'fencing token advances monotonically');
    assert.strictEqual(row.attempt_count, 2, 'retry accounting accumulates');
    assert.ok(row.lease_expires_at > new Date().toISOString(), 'reclaim installs a fresh lease');
  });

  test('6. two workers racing to reclaim the same expired lease: exactly one wins', async () => {
    await claimFresh(db);
    expireLease(db);

    const [a, b] = await Promise.all([
      acquireLeadExecution(db, LEAD_ID),
      acquireLeadExecution(db, LEAD_ID),
    ]);

    const claimed = [a, b].filter((r) => r.outcome === ACQUIRE_OUTCOME.CLAIMED);
    assert.strictEqual(claimed.length, 1, 'the compare-and-set must serialise reclaimers');
    assert.strictEqual(db.mockStore.lead_executions[0].claim_version, 2, 'only one increment lands');
    assert.strictEqual(db.mockStore.lead_executions[0].attempt_count, 2);
  });

  test('7. a stale claim_version cannot mark the execution COMPLETED', async () => {
    const staleHandle = await claimFresh(db);
    expireLease(db);
    const fresh = await acquireLeadExecution(db, LEAD_ID);
    assert.strictEqual(fresh.outcome, ACQUIRE_OUTCOME.CLAIMED);

    const completed = await completeLeadExecution(db, staleHandle);

    assert.strictEqual(completed, false, 'stale worker must get a zero-row result');
    assert.strictEqual(db.mockStore.lead_executions[0].status, EXECUTION_STATUS.RUNNING);
  });

  test('9. an execution whose attempts are exhausted terminates FAILED and stops looping', async () => {
    await claimFresh(db);
    const row = db.mockStore.lead_executions[0];
    row.attempt_count = row.max_attempts;
    row.lease_expires_at = new Date(Date.now() - 60_000).toISOString();

    const terminated = await acquireLeadExecution(db, LEAD_ID);
    assert.strictEqual(terminated.outcome, ACQUIRE_OUTCOME.TERMINATED);
    assert.strictEqual(terminated.reason, 'MAX_ATTEMPTS_EXHAUSTED');
    assert.strictEqual(row.status, EXECUTION_STATUS.FAILED);
    assert.strictEqual(row.attempt_count, row.max_attempts, 'attempts are never pushed past the bound');

    // And it stays terminal on every subsequent pass — no poison-pill loop.
    for (let i = 0; i < 3; i++) {
      const next = await acquireLeadExecution(db, LEAD_ID);
      assert.strictEqual(next.outcome, ACQUIRE_OUTCOME.SKIP);
      assert.strictEqual(next.reason, 'ALREADY_FAILED');
    }
    assert.strictEqual(db.mockStore.lead_executions.length, 1);
  });

  test('the lease deadline is derived from the named constant, not a scattered literal', async () => {
    const before = Date.now();
    await claimFresh(db);
    const lease = new Date(db.mockStore.lead_executions[0].lease_expires_at).getTime();

    assert.ok(lease - before >= EXECUTION_LEASE_MS - 1000);
    assert.ok(lease - before <= EXECUTION_LEASE_MS + 1000);
  });
});

// ─── External effect authority ─────────────────────────────────────────────────
describe('MISSION-015E-B: external effect authority', () => {
  let db;
  beforeEach(() => { db = makeDb(); });

  test('8. a stale worker cannot dispatch: the provider is never called', async () => {
    const staleHandle = await claimFresh(db);
    expireLease(db);
    await acquireLeadExecution(db, LEAD_ID); // a newer worker takes ownership

    let providerCalls = 0;
    const outcome = await dispatchGuardedEffect(db, staleHandle, EFFECT_TYPES.N8N_WEBHOOK, async () => {
      providerCalls++;
      return { success: true, status: 'SENT' };
    });

    assert.strictEqual(outcome.dispatched, false);
    assert.strictEqual(outcome.reason, 'OWNERSHIP_LOST');
    assert.strictEqual(providerCalls, 0, 'no packet may leave without proven authority');
    assert.strictEqual(db.mockStore.execution_effects.length, 0, 'no effect is reserved either');
  });

  test('11. two workers reserving the same effect: exactly one may dispatch', async () => {
    const handle = await claimFresh(db);
    let providerCalls = 0;
    const send = async () => { providerCalls++; return { success: true, status: 'SENT' }; };

    const [a, b] = await Promise.all([
      dispatchGuardedEffect(db, handle, EFFECT_TYPES.TELEGRAM_ALERT, send),
      dispatchGuardedEffect(db, handle, EFFECT_TYPES.TELEGRAM_ALERT, send),
    ]);

    const dispatched = [a, b].filter((r) => r.dispatched);
    assert.strictEqual(dispatched.length, 1, 'one reservation, one dispatch');
    assert.strictEqual(providerCalls, 1, 'the provider is contacted exactly once');
    assert.strictEqual(db.mockStore.execution_effects.length, 1);
  });

  test('15. an explicitly accepted send becomes DISPATCHED with a timestamp', async () => {
    const handle = await claimFresh(db);
    const outcome = await dispatchGuardedEffect(db, handle, EFFECT_TYPES.N8N_WEBHOOK, async () => ({
      success: true, status: 'SENT', httpStatus: 200,
    }));

    assert.strictEqual(outcome.dispatched, true);
    const effect = db.mockStore.execution_effects[0];
    assert.strictEqual(effect.status, EFFECT_STATUS.DISPATCHED);
    assert.ok(effect.dispatched_at, 'dispatched_at must be recorded');
    assert.strictEqual(effect.last_error, null);
  });

  test('16. an explicit provider rejection becomes FAILED', async () => {
    const handle = await claimFresh(db);
    await dispatchGuardedEffect(db, handle, EFFECT_TYPES.N8N_WEBHOOK, async () => ({
      success: false,
      status: 'FAILED',
      isTimeout: false,
      providerResponded: true,
      error: 'n8n webhook returned status 400: Bad Request',
    }));

    const effect = db.mockStore.execution_effects[0];
    assert.strictEqual(effect.status, EFFECT_STATUS.FAILED);
    assert.match(effect.last_error, /400/);
    assert.strictEqual(effect.dispatched_at, null);
  });

  test('17. a timeout becomes AMBIGUOUS, never FAILED', async () => {
    const handle = await claimFresh(db);
    await dispatchGuardedEffect(db, handle, EFFECT_TYPES.TELEGRAM_ALERT, async () => ({
      success: false, status: 'FAILED', isTimeout: true, error: 'timed out after 5000ms',
    }));

    const effect = db.mockStore.execution_effects[0];
    assert.strictEqual(effect.status, EFFECT_STATUS.AMBIGUOUS,
      'a timed-out request may still have been delivered');
  });

  test('17b. a transport failure with no provider response is AMBIGUOUS, not FAILED', async () => {
    const handle = await claimFresh(db);
    await dispatchGuardedEffect(db, handle, EFFECT_TYPES.TELEGRAM_ALERT, async () => ({
      success: false, status: 'FAILED', isTimeout: false, providerResponded: false,
      error: 'socket hang up',
    }));

    assert.strictEqual(db.mockStore.execution_effects[0].status, EFFECT_STATUS.AMBIGUOUS);
  });

  test('17c. an adapter that throws is AMBIGUOUS: a throw proves nothing about receipt', async () => {
    const handle = await claimFresh(db);
    await dispatchGuardedEffect(db, handle, EFFECT_TYPES.N8N_WEBHOOK, async () => {
      throw new Error('unexpected adapter explosion');
    });

    assert.strictEqual(db.mockStore.execution_effects[0].status, EFFECT_STATUS.AMBIGUOUS);
  });

  test('a deliberately un-sent effect is never recorded as DISPATCHED', () => {
    for (const status of ['simulated', 'compiled_for_n8n', 'DISCONNECTED']) {
      const classified = classifyDispatchResult({ success: true, status });
      assert.strictEqual(classified.status, EFFECT_STATUS.FAILED);
      assert.match(classified.error, /not_dispatched/);
    }
  });

  for (const [label, seeded] of [
    ['12. DISPATCHED', EFFECT_STATUS.DISPATCHED],
    ['13. AMBIGUOUS', EFFECT_STATUS.AMBIGUOUS],
    ['14. RESERVED', EFFECT_STATUS.RESERVED],
    ['FAILED', EFFECT_STATUS.FAILED],
  ]) {
    test(`${label}: an existing reservation is never automatically resent`, async () => {
      const handle = await claimFresh(db);
      const reservation = await db.reserveExecutionEffect(handle.execution.id, EFFECT_TYPES.N8N_WEBHOOK);
      await db.updateExecutionEffect(reservation.effect.id, { status: seeded });

      let providerCalls = 0;
      const outcome = await dispatchGuardedEffect(db, handle, EFFECT_TYPES.N8N_WEBHOOK, async () => {
        providerCalls++;
        return { success: true, status: 'SENT' };
      });

      assert.strictEqual(providerCalls, 0, `an existing ${seeded} effect must not be resent`);
      assert.strictEqual(outcome.dispatched, false);
      assert.strictEqual(outcome.reason, `ALREADY_RESERVED_${seeded}`);
      assert.strictEqual(db.mockStore.execution_effects.length, 1);
    });
  }

  test('the idempotency key is generated, stable, and never supplied by the runtime', async () => {
    const handle = await claimFresh(db);
    const reservation = await db.reserveExecutionEffect(handle.execution.id, EFFECT_TYPES.TELEGRAM_ALERT);

    assert.strictEqual(
      reservation.effect.idempotency_key,
      `${handle.execution.id}:${EFFECT_TYPES.TELEGRAM_ALERT}`
    );
  });
});

// ─── Fail-closed law ───────────────────────────────────────────────────────────
describe('MISSION-015E-B: fail-closed law', () => {
  test('10. a database failure during claim produces zero side effects', async () => {
    const db = makeDb();
    db.fetchLeadExecution = async () => { throw new Error('supabase unreachable'); };

    let leadStatusWrites = 0;
    db.updateLeadStatus = async () => { leadStatusWrites++; };

    const result = await run_cycle({ dbClient: db });

    assert.strictEqual(result.summary.leadsProcessed, 0, 'nothing may be processed');
    assert.strictEqual(result.summary.dispatches.n8n, 0);
    assert.strictEqual(result.summary.dispatches.telegram, 0);
    assert.strictEqual(db.mockStore.execution_effects.length, 0, 'no effect authority was taken');
    assert.strictEqual(leadStatusWrites, 0, 'and the lead was not touched');
    assert.strictEqual(result.summary.failures.processing, 1, 'the failure is surfaced, not swallowed');
  });

  test('a database failure during effect reservation prevents the dispatch', async () => {
    const db = makeDb();
    const handle = await claimFresh(db);
    db.reserveExecutionEffect = async () => { throw new Error('supabase unreachable'); };

    let providerCalls = 0;
    await assert.rejects(
      () => dispatchGuardedEffect(db, handle, EFFECT_TYPES.N8N_WEBHOOK, async () => {
        providerCalls++;
        return { success: true, status: 'SENT' };
      }),
      /supabase unreachable/
    );
    assert.strictEqual(providerCalls, 0, 'database uncertainty means no dispatch');
  });
});

// ─── Business-status separation ────────────────────────────────────────────────
describe('MISSION-015E-B: leads.status stays a business column', () => {
  test('18/19. a full successful cycle writes no execution state onto the lead', async () => {
    const db = makeDb();
    const writes = spyOnLeadStatusWrites(db);

    const result = await run_cycle({ dbClient: db });

    assert.strictEqual(result.summary.leadsProcessed, 1, 'the lead really was processed');
    assert.deepStrictEqual(writes, [], 'no leads.status write may occur at all');
    assert.strictEqual(db.mockStore.leads[0].status, 'new',
      'completing an execution is not a business qualification');
    assert.strictEqual(db.mockStore.lead_executions[0].status, EXECUTION_STATUS.COMPLETED);
  });

  test('18b. a failing cycle writes no execution state onto the lead either', async () => {
    const db = makeDb();
    const writes = spyOnLeadStatusWrites(db);
    db.saveExecutiveBrief = async () => { throw new Error('brief persistence exploded'); };

    const result = await run_cycle({ dbClient: db });

    assert.strictEqual(result.summary.failures.processing, 1);
    assert.deepStrictEqual(writes, [], 'a worker failure says nothing about the lead');
    assert.strictEqual(db.mockStore.leads[0].status, 'new');
    assert.strictEqual(db.mockStore.lead_executions[0].status, EXECUTION_STATUS.RUNNING,
      'the execution keeps its identity and remaining attempts');
  });

  test('18c. no forbidden execution value appears in lead discovery or lead writes', async () => {
    const db = makeDb();
    const writes = spyOnLeadStatusWrites(db);
    await run_cycle({ dbClient: db });

    for (const forbidden of FORBIDDEN_LEAD_STATUSES) {
      assert.ok(!writes.some((w) => w.status === forbidden), `must never write leads.status='${forbidden}'`);
      assert.notStrictEqual(db.mockStore.leads[0].status, forbidden);
    }
  });

  test('3b. a completed lead re-discovered in a later cycle is skipped without scoring or dispatch', async () => {
    const db = makeDb();
    await run_cycle({ dbClient: db });
    db.mockStore.execution_effects.length = 0; // any new effect below would be visible

    const second = await run_cycle({ dbClient: db });

    assert.strictEqual(second.summary.leadsProcessed, 0);
    assert.strictEqual(second.summary.leadsSkipped, 1);
    assert.strictEqual(second.summary.executiveBriefsGenerated, 0, 'no scoring work is redone');
    assert.strictEqual(db.mockStore.execution_effects.length, 0, 'and nothing is dispatched again');
    assert.strictEqual(db.mockStore.lead_executions.length, 1);
  });
});

// ─── The gate has to be load-bearing ───────────────────────────────────────────
describe('MISSION-015E-B: meaningful-gate check', () => {
  test('bypassing effect reservation reintroduces the duplicate send these tests forbid', async () => {
    const db = makeDb();
    const handle = await claimFresh(db);

    // Baseline: with the gate intact, a second attempt cannot reach the provider.
    let guardedCalls = 0;
    const send = async () => { guardedCalls++; return { success: true, status: 'SENT' }; };
    await dispatchGuardedEffect(db, handle, EFFECT_TYPES.N8N_WEBHOOK, send);
    await dispatchGuardedEffect(db, handle, EFFECT_TYPES.N8N_WEBHOOK, send);
    assert.strictEqual(guardedCalls, 1, 'the gate is what holds this to one send');

    // Now defeat the reservation constraint the way a regression would: make
    // every reservation succeed. The same sequence must now double-send, which
    // proves the assertion above is detecting the gate and not a coincidence.
    const bypassed = makeDb();
    const bypassedHandle = await claimFresh(bypassed);
    bypassed.reserveExecutionEffect = async (executionId, effectType) => ({
      reserved: true,
      conflict: false,
      effect: { id: `bypass_${Math.random()}`, execution_id: executionId, effect_type: effectType },
    });
    bypassed.updateExecutionEffect = async () => [];

    let bypassedCalls = 0;
    const send2 = async () => { bypassedCalls++; return { success: true, status: 'SENT' }; };
    await dispatchGuardedEffect(bypassed, bypassedHandle, EFFECT_TYPES.N8N_WEBHOOK, send2);
    await dispatchGuardedEffect(bypassed, bypassedHandle, EFFECT_TYPES.N8N_WEBHOOK, send2);

    assert.strictEqual(bypassedCalls, 2,
      'with reservation defeated the provider is contacted twice — the gate is load-bearing');
  });

  test('bypassing the claim gate reintroduces the double processing these tests forbid', async () => {
    const db = makeDb();

    // Intact: the second worker is refused.
    const [a, b] = await Promise.all([
      acquireLeadExecution(db, LEAD_ID),
      acquireLeadExecution(db, LEAD_ID),
    ]);
    assert.strictEqual([a, b].filter((r) => r.outcome === ACQUIRE_OUTCOME.CLAIMED).length, 1);

    // Defeated: uniqueness no longer resolves the race, and both workers proceed.
    const bypassed = makeDb();
    bypassed.insertLeadExecution = async (row) => ({
      claimed: true,
      conflict: false,
      execution: {
        id: `bypass_${Math.random()}`,
        lead_id: row.leadId,
        workflow_key: row.workflowKey,
        status: 'RUNNING',
        claim_version: 1,
        attempt_count: 1,
        max_attempts: 5,
      },
    });

    const [c, d] = await Promise.all([
      acquireLeadExecution(bypassed, LEAD_ID),
      acquireLeadExecution(bypassed, LEAD_ID),
    ]);
    assert.strictEqual(
      [c, d].filter((r) => r.outcome === ACQUIRE_OUTCOME.CLAIMED).length,
      2,
      'with uniqueness defeated both workers claim — the constraint is load-bearing'
    );
  });
});

// ─── Hermetic guarantee ────────────────────────────────────────────────────────
describe('MISSION-015E-B: no production access', () => {
  test('21. the suite runs against the mock client with network calls disabled', async () => {
    const db = makeDb();
    assert.strictEqual(db.isMock, true, 'tests must never use a live Supabase client');
    assert.throws(() => globalThis.fetch(), /NETWORK CALL ATTEMPTED/);

    const result = await run_cycle({ dbClient: db });
    assert.strictEqual(result.status, 'SUCCESS', 'a full cycle completes without touching the network');
  });
});
