/**
 * MISSION-015E-C-R2: WF-01's synchronous, signed canary boundary.
 *
 * These tests have no provider credentials and replace fetch globally. Every
 * provider response below is a local fixture; any unplanned fetch fails loudly.
 */

import { after, afterEach, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { N8nAdapter, N8N_WF01_CALLER_TIMEOUT_MS } from '../src/adapters/n8n-adapter.js';
import { verifyWf01Boundary } from '../scripts/verify-wf01-boundary.mjs';
import { SupabaseClient } from '../src/db/supabase-client.js';
import {
  EFFECT_STATUS,
  EFFECT_TYPES,
  acquireLeadExecution,
  dispatchGuardedEffect,
} from '../src/core/execution-authority.js';

const WORKFLOW_PATH = new URL('../workflows/n8n/wf_01_lead_triage_master.json', import.meta.url);
const SYNTHETIC_LEAD_ID = '00000000-0000-4000-8000-000000000015';

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

function readWorkflow() {
  return JSON.parse(readFileSync(WORKFLOW_PATH, 'utf8'));
}

function nodeByName(workflow, name) {
  return workflow.nodes.find((node) => node.name === name);
}

function connectionsFrom(workflow, nodeName, outputIndex = 0) {
  return (workflow.connections[nodeName]?.main?.[outputIndex] || []).map((connection) => connection.node);
}

function makeAuditClient() {
  return { recordAuditLog: async () => undefined };
}

function makeExecutionDb() {
  const db = new SupabaseClient({ useMock: true });
  db.mockStore.leads.push({
    id: SYNTHETIC_LEAD_ID,
    name: 'R2 Synthetic Lead',
    email: 'r2-synthetic@example.test',
    phone: '+15555550115',
    status: 'new',
    consent_status: 'unknown',
    created_at: new Date().toISOString(),
  });
  return db;
}

test('WF-01 waits for a terminal response instead of acknowledging receipt', () => {
  const workflow = readWorkflow();
  const webhook = nodeByName(workflow, '1. Inbound Lead Webhook');

  assert.equal(webhook.parameters.responseMode, 'responseNode');
  assert.ok(
    workflow.nodes.some((node) => node.type === 'n8n-nodes-base.respondToWebhook'),
    'the workflow must include the terminal response node selected by responseMode',
  );
});

test('WF-01 normalizes missing contacts to null and never embeds synthetic contacts', () => {
  const normalizer = nodeByName(readWorkflow(), '2. Verify & Normalize Signed Event');

  assert.match(normalizer.parameters.jsCode, /email\s*=\s*.*\?\s*.*:\s*null/s);
  assert.match(normalizer.parameters.jsCode, /phone\s*=\s*.*\?\s*.*:\s*null/s);
  assert.doesNotMatch(normalizer.parameters.jsCode, /\+971501234567|privateadvisory@emanuelrendas\.com/);
});

test('WF-01 requires real DIRA and RIIS scores before an active path can qualify', () => {
  const workflow = readWorkflow();
  const scoreValidator = nodeByName(workflow, '5. Validate DIRA and RIIS Scores');
  const qualificationFilter = nodeByName(workflow, '6. Valid DIRA/RIIS Qualification Filter');

  assert.ok(scoreValidator, 'DIRA and RIIS validity must be computed before routing');
  assert.match(scoreValidator.parameters.jsCode, /Number\.isFinite\(diraScore\)/);
  assert.match(scoreValidator.parameters.jsCode, /Number\.isFinite\(riisScore\)/);
  assert.equal(qualificationFilter.parameters.conditions.boolean[0].value1, '={{ $json.boundary.allowExternalFanout === true }}');
});

test('exact canary mode routes only to the synchronous boundary response, never downstream fan-out', () => {
  const workflow = readWorkflow();
  const modeGate = nodeByName(workflow, '3. Runtime Mode Gate');
  const canaryOrRejectedRoute = connectionsFrom(workflow, modeGate.name, 1);

  assert.deepEqual(canaryOrRejectedRoute, ['10. Build Boundary Response']);
  assert.equal(connectionsFrom(workflow, '10. Build Boundary Response')[0], '11. Respond to Boundary');
  const containedNodes = new Set([
    ...connectionsFrom(workflow, '10. Build Boundary Response'),
    ...connectionsFrom(workflow, '11. Respond to Boundary'),
  ]);
  assert.equal(containedNodes.has('7. Sync to Sovereign CRM'), false);
  assert.equal(containedNodes.has('8. Telegram Executive Alert'), false);
  assert.equal(containedNodes.has('9. Publish to Event Bus v1.1'), false);
});

test('the boundary verifier accepts the canonical workflow without network access', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-wf01-boundary.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('the boundary verifier rejects acknowledgement, synthetic contact, and canary fan-out regressions', () => {
  const workflow = structuredClone(readWorkflow());
  nodeByName(workflow, '1. Inbound Lead Webhook').parameters.responseMode = 'onReceived';
  nodeByName(workflow, '2. Verify & Normalize Signed Event').parameters.jsCode += "\nconst forbidden = '+971501234567';";
  workflow.connections['3. Runtime Mode Gate'].main[1] = [
    { node: '7. Sync to Sovereign CRM', type: 'main', index: 0 },
  ];

  const result = verifyWf01Boundary(workflow);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((violation) => violation.includes('acknowledge')));
  assert.ok(result.violations.some((violation) => violation.includes('synthetic customer contact')));
  assert.ok(result.violations.some((violation) => violation.includes('can reach provider fan-out')));
});

test('the boundary verifier rejects missing and malformed runtime-mode fail-open regressions', () => {
  const workflow = structuredClone(readWorkflow());
  const normalizer = nodeByName(workflow, '2. Verify & Normalize Signed Event');
  normalizer.parameters.jsCode = normalizer.parameters.jsCode
    .replace("runtimeMode === 'active'", "runtimeMode === 'untrusted'")
    .replace('RUNTIME_MODE_INVALID', 'MODE_ACCEPTED');

  const result = verifyWf01Boundary(workflow);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((violation) => violation.includes('missing, malformed, or unknown runtime mode')));
});

test('the caller timeout exceeds WF-01\'s 15-second MARK bound while remaining below the execution lease', () => {
  assert.equal(N8N_WF01_CALLER_TIMEOUT_MS, 20_000);
  assert.equal(new N8nAdapter({ enabled: false }).timeoutMs, N8N_WF01_CALLER_TIMEOUT_MS);
  assert.ok(N8N_WF01_CALLER_TIMEOUT_MS > 15_000);
  assert.ok(N8N_WF01_CALLER_TIMEOUT_MS < 120_000);
});

test('a synchronous provider success carries the signed runtime mode context', async () => {
  const previousFetch = globalThis.fetch;
  let sent;
  let signature;
  globalThis.fetch = async (_url, request) => {
    sent = JSON.parse(request.body);
    signature = request.headers['X-N8N-Signature'];
    return new Response(JSON.stringify({ completed: true, mode: 'canary' }), { status: 200 });
  };

  try {
    const adapter = new N8nAdapter({
      webhookUrl: 'https://n8n.invalid/raioc-r2-test',
      webhookSecret: 'r2-test-secret',
      enabled: true,
      auditClient: makeAuditClient(),
    });
    const result = await adapter.dispatchEvent('QUALIFIED_LEAD', {
      runtime: { mode: 'canary' },
      lead: { id: SYNTHETIC_LEAD_ID },
    });

    assert.equal(result.status, 'SENT');
    assert.deepEqual(sent.runtime, { mode: 'canary' });
    assert.equal(
      signature,
      `sha256=${createHmac('sha256', 'r2-test-secret').update(JSON.stringify(sent)).digest('hex')}`,
      'the signature must cover the emitted runtime context',
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('an explicit n8n rejection is failed, while timeout uncertainty remains AMBIGUOUS', async () => {
  const db = makeExecutionDb();
  const acquisition = await acquireLeadExecution(db, SYNTHETIC_LEAD_ID);
  const handle = { execution: acquisition.execution, claimVersion: acquisition.claimVersion };

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'rejected' }), {
    status: 422,
    statusText: 'Unprocessable Entity',
  });

  try {
    const rejectingAdapter = new N8nAdapter({
      webhookUrl: 'https://n8n.invalid/raioc-r2-rejection',
      webhookSecret: 'r2-test-secret',
      enabled: true,
      auditClient: makeAuditClient(),
    });
    const rejected = await dispatchGuardedEffect(
      db,
      handle,
      EFFECT_TYPES.N8N_WEBHOOK,
      () => rejectingAdapter.dispatchEvent('QUALIFIED_LEAD', { runtime: { mode: 'canary' } }),
    );
    assert.equal(rejected.effectStatus, EFFECT_STATUS.FAILED);
    assert.equal(rejected.result.providerResponded, true);
  } finally {
    globalThis.fetch = previousFetch;
  }

  const secondDb = makeExecutionDb();
  const secondAcquisition = await acquireLeadExecution(secondDb, SYNTHETIC_LEAD_ID);
  const secondHandle = { execution: secondAcquisition.execution, claimVersion: secondAcquisition.claimVersion };
  const timeoutAdapter = new N8nAdapter({
    webhookUrl: 'https://n8n.invalid/raioc-r2-timeout',
    webhookSecret: 'r2-test-secret',
    enabled: true,
    auditClient: makeAuditClient(),
  });

  globalThis.fetch = async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  };
  try {
    const timedOut = await dispatchGuardedEffect(
      secondDb,
      secondHandle,
      EFFECT_TYPES.N8N_WEBHOOK,
      () => timeoutAdapter.dispatchEvent('QUALIFIED_LEAD', { runtime: { mode: 'canary' } }),
    );
    assert.equal(timedOut.effectStatus, EFFECT_STATUS.AMBIGUOUS);
    assert.equal(timedOut.dispatched, false);
    assert.equal(timedOut.result.providerResponded, false);
    assert.equal(secondDb.mockStore.execution_effects[0].status, EFFECT_STATUS.AMBIGUOUS);
  } finally {
    globalThis.fetch = hermeticFetch;
  }
});
