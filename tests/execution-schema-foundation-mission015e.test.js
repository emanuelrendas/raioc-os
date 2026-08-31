/**
 * MISSION-015E-A Verification Tests: Canonical Execution Schema Foundation
 *
 * Static verification of migration 005. These tests do not require a database:
 * they assert the migration's declared shape and, critically, that it is
 * ADDITIVE — it must not alter, drop or backfill anything that already exists.
 *
 * The behavioural guarantees (uniqueness, fencing, retry bounds, effect
 * authority, FK delete behaviour, RLS posture) were verified by executing this
 * migration against a disposable PostgreSQL 16 instance; see the PR body.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MIGRATION = '005_lead_execution_schema_foundation.sql';
const DIRS = ['src/db/migrations', 'src/database/migrations'];

const sql = fs.readFileSync(path.join(ROOT, DIRS[0], MIGRATION), 'utf8');

describe('MISSION-015E-A: migration 005 is present and mirrored', () => {
  for (const dir of DIRS) {
    test(`${dir}/${MIGRATION} exists`, () => {
      assert.ok(fs.existsSync(path.join(ROOT, dir, MIGRATION)), `${dir}/${MIGRATION} must exist`);
    });
  }

  test('both migration directories carry identical content apart from the self-referential path header', () => {
    const [a, b] = DIRS.map((d) => fs.readFileSync(path.join(ROOT, d, MIGRATION), 'utf8'));
    const strip = (s) => s.replace(/^-- File: .*$/m, '-- File: <path>');
    assert.strictEqual(strip(a), strip(b));
  });
});

describe('MISSION-015E-A: lead_executions declares the approved architecture', () => {
  test('creates public.lead_executions', () => {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.lead_executions/);
  });

  for (const column of [
    'id', 'lead_id', 'workflow_key', 'workflow_version', 'status',
    'claim_version', 'lease_expires_at', 'attempt_count', 'max_attempts',
    'created_at', 'updated_at',
  ]) {
    test(`declares column ${column}`, () => {
      assert.match(sql, new RegExp(`^\\s+${column}\\s`, 'm'), `lead_executions must declare ${column}`);
    });
  }

  test('logical identity is (lead_id, workflow_key) — workflow_version is excluded', () => {
    assert.match(sql, /UNIQUE \(lead_id, workflow_key\)/);
    assert.doesNotMatch(sql, /UNIQUE \([^)]*workflow_version/);
  });

  test('execution states are exactly RUNNING / COMPLETED / FAILED', () => {
    assert.match(sql, /CHECK \(status IN \('RUNNING', 'COMPLETED', 'FAILED'\)\)/);
  });

  test('claim_version, attempt_count and max_attempts are bounded', () => {
    assert.match(sql, /CHECK \(claim_version > 0\)/);
    assert.match(sql, /CHECK \(attempt_count >= 0\)/);
    assert.match(sql, /CHECK \(max_attempts > 0\)/);
    assert.match(sql, /CHECK \(attempt_count <= max_attempts\)/);
  });

  test('lead_id references public.leads', () => {
    assert.match(sql, /lead_id UUID NOT NULL REFERENCES public\.leads\(id\)/);
  });
});

describe('MISSION-015E-A: execution_effects declares the approved architecture', () => {
  test('creates public.execution_effects', () => {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.execution_effects/);
  });

  for (const column of [
    'id', 'execution_id', 'effect_type', 'status', 'idempotency_key',
    'created_at', 'dispatched_at', 'last_error',
  ]) {
    test(`declares column ${column}`, () => {
      assert.match(sql, new RegExp(`^\\s+${column}\\s`, 'm'), `execution_effects must declare ${column}`);
    });
  }

  test('logical uniqueness is (execution_id, effect_type)', () => {
    assert.match(sql, /UNIQUE \(execution_id, effect_type\)/);
  });

  test('effect states cover RESERVED / DISPATCHED / FAILED / AMBIGUOUS', () => {
    assert.match(sql, /CHECK \(status IN \('RESERVED', 'DISPATCHED', 'FAILED', 'AMBIGUOUS'\)\)/);
  });

  test('idempotency_key is generated in-database, so it cannot drift or be mis-supplied', () => {
    assert.match(sql, /idempotency_key TEXT GENERATED ALWAYS AS \(execution_id::text \|\| ':' \|\| effect_type\) STORED/);
  });
});

describe('MISSION-015E-A: security posture is preserved', () => {
  test('RLS is enabled on both new tables', () => {
    assert.match(sql, /ALTER TABLE public\.lead_executions ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /ALTER TABLE public\.execution_effects ENABLE ROW LEVEL SECURITY/);
  });

  test('no policy grants browser-facing roles access to these internal tables', () => {
    const executable = sql.replace(/^\s*--.*$/gm, '');
    assert.doesNotMatch(executable, /CREATE POLICY/i);
    assert.doesNotMatch(executable, /\b(anon|authenticated)\b/);
  });
});

describe('MISSION-015E-A: the migration is additive', () => {
  test('no ON DELETE CASCADE — execution history is not silently destroyed', () => {
    assert.doesNotMatch(sql, /ON DELETE CASCADE/i);
  });

  test('does not modify any pre-existing table', () => {
    const alters = [...sql.matchAll(/ALTER TABLE (?:IF EXISTS )?(\S+)/gi)].map((m) => m[1]);
    const allowed = new Set(['public.lead_executions', 'public.execution_effects']);
    for (const target of alters) {
      assert.ok(allowed.has(target), `migration must not ALTER pre-existing table ${target}`);
    }
  });

  test('performs no DROP TABLE, TRUNCATE, DELETE, UPDATE or backfill INSERT', () => {
    assert.doesNotMatch(sql, /DROP TABLE/i);
    assert.doesNotMatch(sql, /TRUNCATE/i);
    assert.doesNotMatch(sql, /^\s*DELETE FROM/im);
    assert.doesNotMatch(sql, /^\s*UPDATE\s+public\./im);
    assert.doesNotMatch(sql, /^\s*INSERT INTO/im);
  });

  test('does not touch leads.status, lead_events or interaction_logs', () => {
    assert.doesNotMatch(sql, /ALTER TABLE[^\n]*public\.leads/i);
    assert.doesNotMatch(sql, /ALTER TABLE[^\n]*lead_events/i);
    assert.doesNotMatch(sql, /ALTER TABLE[^\n]*interaction_logs/i);
    for (const forbidden of ['processing', 'completed', 'failed']) {
      assert.ok(
        !new RegExp(`leads[^\\n]*'${forbidden}'`, 'i').test(sql),
        `leads.status must never carry the execution value '${forbidden}'`
      );
    }
  });

  test('creates no phantom tables', () => {
    const created = [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\S+)/gi)].map((m) => m[1]);
    assert.deepStrictEqual(created, ['public.lead_executions', 'public.execution_effects']);
    for (const phantom of [
      'dispatch_queue', 'communications', 'audit_log',
      'executive_briefs', 'workflow_runs', 'executions',
    ]) {
      assert.doesNotMatch(sql, new RegExp(`CREATE TABLE[^\\n]*\\b${phantom}\\b`, 'i'));
    }
  });
});
