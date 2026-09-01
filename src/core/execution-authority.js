/**
 * RAIOC OS - Canonical Execution Authority (ADR-015D / MISSION-015E-B)
 *
 * The runtime side of the execution foundation created by migration 005.
 *
 * Ownership, restated so it is not lost at a call site:
 *   leads             -> CRM / business lifecycle ONLY. Never an execution lock.
 *   lead_executions   -> who is allowed to run a workflow for a lead, right now.
 *   execution_effects -> who is allowed to attempt one external effect, once.
 *   providers         -> delivery mechanisms. Never the source of execution truth.
 *
 * Discovering a lead confers nothing. Only a database claim confers authority,
 * and every path that cannot prove authority refuses to dispatch.
 */

import { logger } from '../logging/audit-logger.js';

/**
 * Canonical workflow identity for the per-lead work performed by run_cycle:
 * DIRA/RIIS scoring, memorandum generation, executive brief, and the
 * qualified-lead notifications that follow. Derived from the runtime component
 * that owns that responsibility (src/core/run-cycle.js), scoped to one lead.
 *
 * This string is the logical identity half of UNIQUE (lead_id, workflow_key).
 * It MUST stay stable across ordinary deployments — changing it would make every
 * already-processed lead look unprocessed.
 */
export const LEAD_RUN_CYCLE_WORKFLOW_KEY = 'lead_run_cycle';

/**
 * Evidence of which implementation executed. Bump when the per-lead pipeline
 * changes materially. A new version NEVER creates a second logical execution and
 * never re-authorizes an already COMPLETED one — it is recorded, not obeyed.
 */
export const LEAD_RUN_CYCLE_WORKFLOW_VERSION =
  process.env.RAIOC_WORKFLOW_VERSION || '1.0.0';

/**
 * How long a claim stays authoritative before another worker may reclaim it.
 *
 * Sized against the real worst case of one lead's processing: the n8n webhook
 * (5s timeout) plus the Telegram call (5s timeout) plus roughly half a dozen
 * Supabase round trips, i.e. on the order of 12s, before serverless cold-start
 * overhead. 120s leaves roughly an order of magnitude of headroom, so a healthy
 * but slow worker is not reclaimed out from under itself, while a genuinely dead
 * worker blocks progress for at most two minutes.
 *
 * This is a starting operational value, not a measured constant. Tune it from
 * observed cycle latency once 015E-B has run in production.
 */
export const EXECUTION_LEASE_MS = 120_000;

/** Externally-visible effects that this runtime dispatches directly, per lead. */
export const EFFECT_TYPES = Object.freeze({
  N8N_WEBHOOK: 'n8n_webhook',
  TELEGRAM_ALERT: 'telegram_alert',
});

export const EXECUTION_STATUS = Object.freeze({
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

export const EFFECT_STATUS = Object.freeze({
  RESERVED: 'RESERVED',
  DISPATCHED: 'DISPATCHED',
  FAILED: 'FAILED',
  AMBIGUOUS: 'AMBIGUOUS',
});

/** Outcomes of an attempt to acquire execution authority for a lead. */
export const ACQUIRE_OUTCOME = Object.freeze({
  CLAIMED: 'CLAIMED',
  SKIP: 'SKIP',
  TERMINATED: 'TERMINATED',
});

function leaseDeadline(now = Date.now()) {
  return new Date(now + EXECUTION_LEASE_MS).toISOString();
}

/**
 * Truncates provider error text before it reaches the ledger. Keeps the useful
 * prefix and avoids persisting whatever a provider happened to echo back.
 */
function safeErrorText(message) {
  if (!message) return null;
  return String(message).slice(0, 500);
}

/**
 * Acquires execution authority for one lead, or explains why it was refused.
 *
 * @returns {Promise<{outcome: string, reason: string, execution?: Object, claimVersion?: number}>}
 *          outcome CLAIMED carries the handle the caller must pass to every
 *          subsequent authority-bearing call.
 */
export async function acquireLeadExecution(db, leadId, options = {}) {
  const workflowKey = options.workflowKey || LEAD_RUN_CYCLE_WORKFLOW_KEY;
  const workflowVersion = options.workflowVersion || LEAD_RUN_CYCLE_WORKFLOW_VERSION;

  // Any failure below throws out of this function. That is deliberate: the
  // caller must never interpret a database problem as "free to proceed".
  const existing = await db.fetchLeadExecution(leadId, workflowKey);

  if (!existing) {
    // No logical execution yet. The UNIQUE (lead_id, workflow_key) constraint is
    // what decides the race between workers — not this read, which is only a
    // fast path. A successful claim is the first real attempt, so it is written
    // as attempt 1 even though the column defaults to 0.
    const result = await db.insertLeadExecution({
      leadId,
      workflowKey,
      workflowVersion,
      claimVersion: 1,
      attemptCount: 1,
      leaseExpiresAt: leaseDeadline(),
    });

    if (result.claimed) {
      return {
        outcome: ACQUIRE_OUTCOME.CLAIMED,
        reason: 'INITIAL_CLAIM',
        execution: result.execution,
        claimVersion: result.execution.claim_version,
      };
    }

    // Another worker inserted first. It owns the execution; we do not.
    return { outcome: ACQUIRE_OUTCOME.SKIP, reason: 'LOST_INITIAL_CLAIM_RACE' };
  }

  if (existing.status === EXECUTION_STATUS.COMPLETED) {
    // Terminal success. A workflow_version bump does not reopen this.
    return { outcome: ACQUIRE_OUTCOME.SKIP, reason: 'ALREADY_COMPLETED' };
  }

  if (existing.status === EXECUTION_STATUS.FAILED) {
    // Terminal failure. Replay needs an explicit reconciliation policy that does
    // not exist yet, so automatic processing stops here.
    return { outcome: ACQUIRE_OUTCOME.SKIP, reason: 'ALREADY_FAILED' };
  }

  const nowIso = new Date().toISOString();
  const leaseHeld = existing.lease_expires_at && existing.lease_expires_at >= nowIso;
  if (leaseHeld) {
    return { outcome: ACQUIRE_OUTCOME.SKIP, reason: 'LEASE_HELD_BY_ANOTHER_WORKER' };
  }

  if (existing.attempt_count >= existing.max_attempts) {
    // The lease is gone and the attempt budget is spent. Close it out rather than
    // leaving a row that every future cycle re-examines forever.
    const terminated = await db.casUpdateLeadExecution(
      existing.id,
      { status: EXECUTION_STATUS.RUNNING, claimVersion: existing.claim_version },
      { status: EXECUTION_STATUS.FAILED, lease_expires_at: null }
    );
    return {
      outcome: ACQUIRE_OUTCOME.TERMINATED,
      reason: terminated.length === 1 ? 'MAX_ATTEMPTS_EXHAUSTED' : 'MAX_ATTEMPTS_EXHAUSTED_BY_OTHER_WORKER',
    };
  }

  // Expired lease with attempts remaining: reclaim the SAME logical row. The
  // conditional update is the claim; a second worker racing us gets zero rows.
  const reclaimed = await db.casUpdateLeadExecution(
    existing.id,
    {
      status: EXECUTION_STATUS.RUNNING,
      claimVersion: existing.claim_version,
      leaseExpiredBefore: nowIso,
      attemptCountBelow: existing.max_attempts,
    },
    {
      claim_version: existing.claim_version + 1,
      attempt_count: existing.attempt_count + 1,
      workflow_version: workflowVersion,
      lease_expires_at: leaseDeadline(),
    }
  );

  if (reclaimed.length !== 1) {
    return { outcome: ACQUIRE_OUTCOME.SKIP, reason: 'LOST_RECLAIM_RACE' };
  }

  return {
    outcome: ACQUIRE_OUTCOME.CLAIMED,
    reason: 'RECLAIMED',
    execution: reclaimed[0],
    claimVersion: reclaimed[0].claim_version,
  };
}

/**
 * Re-asserts ownership and pushes the lease deadline out. Returns false when the
 * claim has been taken over — the caller must then stop, not continue best-effort.
 */
export async function renewExecutionLease(db, handle) {
  const rows = await db.casUpdateLeadExecution(
    handle.execution.id,
    { status: EXECUTION_STATUS.RUNNING, claimVersion: handle.claimVersion },
    { lease_expires_at: leaseDeadline() }
  );
  return rows.length === 1;
}

/** Terminal success, conditional on still owning the claim. */
export async function completeLeadExecution(db, handle) {
  const rows = await db.casUpdateLeadExecution(
    handle.execution.id,
    { status: EXECUTION_STATUS.RUNNING, claimVersion: handle.claimVersion },
    { status: EXECUTION_STATUS.COMPLETED, lease_expires_at: null }
  );
  return rows.length === 1;
}

/** Terminal failure, conditional on still owning the claim. */
export async function failLeadExecution(db, handle) {
  const rows = await db.casUpdateLeadExecution(
    handle.execution.id,
    { status: EXECUTION_STATUS.RUNNING, claimVersion: handle.claimVersion },
    { status: EXECUTION_STATUS.FAILED, lease_expires_at: null }
  );
  return rows.length === 1;
}

/**
 * Records a failed attempt that still has budget left. The execution stays
 * RUNNING and keeps its identity; it becomes reclaimable when the lease lapses.
 * The lease is deliberately NOT cleared here — this worker may still have
 * in-flight I/O, and letting another worker start immediately would widen the
 * duplicate-effect window rather than narrow it.
 */
export async function concludeFailedAttempt(db, handle) {
  const execution = handle.execution;
  if (execution.attempt_count >= execution.max_attempts) {
    const terminal = await failLeadExecution(db, handle);
    return { terminal: true, applied: terminal };
  }
  return { terminal: false, applied: true };
}

/**
 * Maps an adapter result onto an effect state.
 *
 * The bias is deliberate and one-directional: FAILED is claimed only when the
 * provider demonstrably answered and no delivery happened. Anything else that is
 * not an explicit success is AMBIGUOUS, because a timeout or a dropped socket
 * may still have delivered.
 */
export function classifyDispatchResult(result) {
  if (!result || typeof result !== 'object') {
    return { status: EFFECT_STATUS.AMBIGUOUS, error: 'adapter returned no result' };
  }

  if (result.status === 'SENT') {
    return { status: EFFECT_STATUS.DISPATCHED, error: null };
  }

  // The adapter deliberately did not contact the provider (disabled, or no
  // credentials). Nothing was delivered, so this must not be recorded as a
  // dispatch; FAILED is the state that asserts "no delivery occurred".
  if (result.status === 'simulated' || result.status === 'compiled_for_n8n' || result.status === 'DISCONNECTED') {
    return {
      status: EFFECT_STATUS.FAILED,
      error: `not_dispatched: adapter reported ${result.status}; no external send was attempted`,
    };
  }

  if (result.isTimeout) {
    return {
      status: EFFECT_STATUS.AMBIGUOUS,
      error: safeErrorText(result.error) || 'provider timed out; receipt unknown',
    };
  }

  // providerResponded is set by the adapter once response headers arrived, so a
  // rejection at that point proves the provider answered and refused.
  if (result.providerResponded === true) {
    return { status: EFFECT_STATUS.FAILED, error: safeErrorText(result.error) };
  }

  return {
    status: EFFECT_STATUS.AMBIGUOUS,
    error: safeErrorText(result.error) || 'transport failure; receipt unknown',
  };
}

/**
 * The only sanctioned path to an externally-visible effect.
 *
 * Order matters and is the whole point:
 *   1. prove we still own the execution      -> otherwise refuse
 *   2. reserve the effect in the database    -> otherwise refuse
 *   3. only then talk to the provider
 *   4. record what became of it
 *
 * Steps 1 and 2 throw on database trouble; the throw propagates and nothing is
 * dispatched. There is no branch in which an effect is attempted without durable
 * authority behind it.
 *
 * @param {Function} dispatchFn - performs the actual send; receives the reserved
 *                                effect row (its idempotency_key is available for
 *                                providers with verified support).
 */
export async function dispatchGuardedEffect(db, handle, effectType, dispatchFn) {
  const stillOwned = await renewExecutionLease(db, handle);
  if (!stillOwned) {
    logger.warn('EXECUTION_AUTHORITY', `Ownership lost before ${effectType}; refusing to dispatch`, {
      executionId: handle.execution.id,
      claimVersion: handle.claimVersion,
    });
    return { dispatched: false, reason: 'OWNERSHIP_LOST', effectStatus: null };
  }

  const reservation = await db.reserveExecutionEffect(handle.execution.id, effectType);

  if (!reservation.reserved) {
    // Somebody already holds authority for this effect. Phase 015E-B is
    // at-most-once by default: no state of an existing reservation authorizes a
    // second automatic send.
    const existing = await db.fetchExecutionEffect(handle.execution.id, effectType);
    const existingStatus = existing?.status || 'UNKNOWN';
    logger.info('EXECUTION_AUTHORITY', `Effect ${effectType} already reserved (${existingStatus}); not resending`, {
      executionId: handle.execution.id,
    });
    return {
      dispatched: false,
      reason: `ALREADY_RESERVED_${existingStatus}`,
      effectStatus: existingStatus,
    };
  }

  const effect = reservation.effect;

  let result;
  try {
    result = await dispatchFn(effect);
  } catch (err) {
    // A throw tells us nothing about whether the packet left the process.
    result = { success: false, error: err.message, isTimeout: false };
  }

  const classified = classifyDispatchResult(result);
  const patch = { status: classified.status, last_error: classified.error };
  if (classified.status === EFFECT_STATUS.DISPATCHED) {
    patch.dispatched_at = new Date().toISOString();
    patch.last_error = null;
  }

  // If this write fails the send has already happened and the ledger is now
  // behind reality. The row stays RESERVED, which is exactly the conservative
  // state: no automatic resend will follow. See KNOWN LIMITATIONS.
  await db.updateExecutionEffect(effect.id, patch);

  return {
    dispatched: classified.status === EFFECT_STATUS.DISPATCHED,
    reason: classified.status,
    effectStatus: classified.status,
    result,
  };
}
