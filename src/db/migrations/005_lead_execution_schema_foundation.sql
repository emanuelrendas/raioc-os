-- ============================================================================
-- RAIOC OS - Supabase Database Migration 005
-- File: src/db/migrations/005_lead_execution_schema_foundation.sql
-- Description: MISSION-015E-A / ADR-015D. Canonical execution schema foundation.
--              Creates public.lead_executions (workflow execution identity,
--              distributed claiming, leases, fencing, retry accounting) and
--              public.execution_effects (per-effect authority, reservation and
--              delivery state for externally-visible side effects).
--
-- SCOPE: ADDITIVE ONLY. Creates two new tables, one trigger function and two
--        triggers. It does not alter, drop, backfill or re-key any existing
--        table. It does not touch public.leads (including the leads.status
--        check constraint), public.lead_events or public.interaction_logs.
--
-- OWNERSHIP (ADR-015D):
--   leads             -> CRM / business lifecycle ONLY. Never an execution lock.
--   lead_executions   -> workflow execution identity and claiming authority.
--   execution_effects -> authority to attempt one externally-visible effect.
--   External providers-> delivery mechanisms only, never execution truth.
--
-- MIGRATION-HISTORY DRIFT NOTICE:
--        Repository migrations 001-004 are NOT verified as applied to the live
--        database. Verified against live on 2026-08-31: the public schema
--        contains zero functions, so update_updated_at_column() (declared in
--        001) and enforce_append_only_audit() (declared in 004) do not exist
--        live; live RLS is enabled with zero policies rather than the explicit
--        service_role policies 004 declares; and public.leads -- which is live
--        with 1256 rows -- is not created by any repository migration at all.
--        This migration therefore depends on NOTHING that 001-004 create. Its
--        only precondition is that public.leads exists with a uuid primary key,
--        which is verified live.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Shared updated_at maintenance function (self-contained; see drift notice)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.raioc_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 1. lead_executions
--    ONE row is the logical execution of ONE workflow for ONE lead.
--    Logical identity is (lead_id, workflow_key). workflow_version records
--    which implementation ran; it is evidence, never re-execution authority,
--    and so is deliberately NOT part of the uniqueness key.
--    Retries and lease reclaims mutate this SAME row: claim_version fences
--    stale workers, attempt_count accumulates, max_attempts terminates poison
--    loops, and a COMPLETED row blocks normal automatic re-execution.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id),
    workflow_key TEXT NOT NULL,
    workflow_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    claim_version INTEGER NOT NULL DEFAULT 1,
    lease_expires_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT lead_executions_lead_workflow_unique
        UNIQUE (lead_id, workflow_key),
    CONSTRAINT lead_executions_status_valid
        CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    CONSTRAINT lead_executions_claim_version_positive
        CHECK (claim_version > 0),
    CONSTRAINT lead_executions_attempt_count_non_negative
        CHECK (attempt_count >= 0),
    CONSTRAINT lead_executions_max_attempts_positive
        CHECK (max_attempts > 0),
    CONSTRAINT lead_executions_attempt_count_within_max
        CHECK (attempt_count <= max_attempts)
);

COMMENT ON TABLE public.lead_executions IS
    'ADR-015D: canonical workflow execution identity for a lead. One logical row per (lead_id, workflow_key); retries and lease reclaims mutate that same row. leads.status is CRM lifecycle only and is never an execution lock.';
COMMENT ON COLUMN public.lead_executions.workflow_version IS
    'Evidence of which workflow implementation executed. Deliberately excluded from the uniqueness key: a version bump must never silently authorize automatic reprocessing of an already COMPLETED execution.';
COMMENT ON COLUMN public.lead_executions.claim_version IS
    'Monotonic fencing token. Increases on each successful claim/reclaim so a worker whose lease expired cannot commit results over a newer claimant.';
COMMENT ON COLUMN public.lead_executions.lease_expires_at IS
    'When the current claim stops being authoritative. NULL means no claim is currently held (never claimed, or terminal).';
COMMENT ON COLUMN public.lead_executions.max_attempts IS
    'Per-row poison-loop terminator. Default 5 is a starting value chosen for this foundation mission, not a measured figure; it is per-row so a workflow can override it.';

CREATE INDEX IF NOT EXISTS idx_lead_executions_status
    ON public.lead_executions(status);
CREATE INDEX IF NOT EXISTS idx_lead_executions_lease_expires_at
    ON public.lead_executions(lease_expires_at);

DROP TRIGGER IF EXISTS trg_lead_executions_updated_at ON public.lead_executions;
CREATE TRIGGER trg_lead_executions_updated_at
    BEFORE UPDATE ON public.lead_executions
    FOR EACH ROW EXECUTE FUNCTION public.raioc_set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. execution_effects
--    ONE row is the authority and delivery state for ONE external effect
--    belonging to ONE execution. Reconciliation of an ambiguous effect mutates
--    this SAME row; a second attempt never becomes a second row.
--
--    AMBIGUOUS exists because a worker can crash after a non-idempotent
--    provider has received the request but before success was recorded. Such a
--    row MUST NOT be treated as automatically safe to resend.
--
--    Delivery guarantee (ADR-015D):
--      provider with VERIFIED native idempotency -> effectively-once target
--      provider without verified idempotency     -> at-most-once automatic,
--                                                   ambiguity needs reconciliation
--    Exactly-once delivery is NOT claimed.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.execution_effects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES public.lead_executions(id),
    effect_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RESERVED',
    idempotency_key TEXT GENERATED ALWAYS AS (execution_id::text || ':' || effect_type) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    dispatched_at TIMESTAMPTZ,
    last_error TEXT,

    CONSTRAINT execution_effects_execution_effect_unique
        UNIQUE (execution_id, effect_type),
    CONSTRAINT execution_effects_status_valid
        CHECK (status IN ('RESERVED', 'DISPATCHED', 'FAILED', 'AMBIGUOUS'))
);

COMMENT ON TABLE public.execution_effects IS
    'ADR-015D: per-effect authority and delivery state for one externally-visible effect of one execution. Providers are delivery mechanisms only; this table is the source of truth for whether an effect was authorized and what became of it.';
COMMENT ON COLUMN public.execution_effects.idempotency_key IS
    'Deterministic and stable by construction: derived in-database from (execution_id, effect_type), so it cannot drift, cannot be mis-supplied by a caller, and is identical across every retry of the same logical effect. Its uniqueness is already guaranteed by execution_effects_execution_effect_unique, so no separate unique constraint is added.';
COMMENT ON COLUMN public.execution_effects.status IS
    'RESERVED: authorized, not yet dispatched. DISPATCHED: provider accepted. FAILED: provider rejected, safe to reconsider. AMBIGUOUS: receipt unknown after a crash mid-dispatch -- never auto-resend for a provider without verified idempotency.';

CREATE INDEX IF NOT EXISTS idx_execution_effects_status
    ON public.execution_effects(status);

-- ----------------------------------------------------------------------------
-- 3. Row-Level Security
--    Matches the pattern verified live on every existing public table: RLS
--    enabled with no policies, so anon/authenticated are denied by default and
--    only the service role (which carries BYPASSRLS) reaches these rows. These
--    tables are internal operational infrastructure and must never become
--    browser-readable merely because they exist.
-- ----------------------------------------------------------------------------
ALTER TABLE public.lead_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_effects ENABLE ROW LEVEL SECURITY;
