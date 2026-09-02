# RAIOC Progress Reporter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one canonical, credential-safe CLI reporter in `raioc-os` so authorized agents can send meaningful mission progress to the production n8n Progress Bridge without direct GitHub/Obsidian writes or manual PowerShell webhook construction.

**Architecture:** Add a separate Progress Bridge client at `src/integrations/n8n/progress-reporter.js`; do not modify the existing HMAC/event-bus `n8n-webhook-client.js`. A small CLI at `scripts/report-progress.js` parses explicit mission arguments, calls the reporter, and always treats reporting outages as non-blocking. Tests use Node 20's built-in `node:test` and injected/mocked fetch/sleep functions so CI remains credential-free and hermetic.

**Tech Stack:** Node.js 20, ECMAScript modules, built-in `fetch`, `node:test`, `node:assert/strict`, npm scripts, n8n production webhook.

**Spec:** `docs/superpowers/specs/2026-09-02-raioc-progress-reporter-design.md`

## Global Constraints

- Report only meaningful events: `started`, `progress`, `blocked`, `completed`.
- Mission ID is always explicit; never infer it from repository, branch, path, filenames, or conversation state.
- Authorized v1 agents are exactly: `Codex`, `Claude`, `Jules`, `Antigravity`.
- `completed` requires `progress = 100`.
- `progress` must be an integer from `0` through `100`.
- Read the bridge secret only from `RAIOC_PROGRESS_SECRET` at runtime; never accept it as a CLI argument.
- Default endpoint may be `https://privateadvisory.app.n8n.cloud/webhook/raioc-progress`; `RAIOC_PROGRESS_URL` may override it.
- Use the exact request header `x-raioc-signature` and direct mission payload already accepted by the production Progress Bridge.
- Maximum transport attempts: 3; retry delays: 1000 ms, then 2000 ms.
- Reporting failure is non-blocking and must not stop the engineering mission.
- Never print, return, persist, or commit the secret or authorization header value.
- Do not modify `src/integrations/n8n/n8n-webhook-client.js`.
- Do not change runtime execution authority, effect fencing, Supabase operational semantics, live provider fan-out, or the RAIOC runtime canary HOLD.
- Do not add dependencies; Node 20 already provides `fetch`.
- Keep automated tests credential-free and hermetic.
- Add the reporter test to `test:ci` because `.github/workflows/ci.yml` executes `npm run test:ci` on every push/PR to `main`.
- Full `npm test` is not the release gate for this change because the repository documents pre-existing suites excluded from CI; use the focused reporter test plus `npm run test:ci`.
- Execute implementation on an isolated feature branch/worktree rather than editing `main` directly.

---

## File Structure

- `src/integrations/n8n/progress-reporter.js` — owns validation, event→status mapping, payload construction, request dispatch, bounded retries, and secret-safe structured results.
- `scripts/report-progress.js` — owns CLI argument parsing and user/agent-facing output; contains no webhook implementation logic.
- `tests/progress-reporter.test.js` — hermetic contract, validation, transport, retry, secret-redaction, CLI, and configuration tests.
- `package.json` — adds `progress` command and appends `tests/progress-reporter.test.js` to `test:ci`.
- `.env.example` — documents only the non-secret endpoint and secret placeholder.
- `AGENTS.md` — Codex phase-1 operating instructions for meaningful-event reporting and explicit mission IDs.

---

### Task 1: Core Progress Contract and Local Validation

**Files:**
- Create: `src/integrations/n8n/progress-reporter.js`
- Create: `tests/progress-reporter.test.js`

**Interfaces:**
- Produces: `AUTHORIZED_AGENTS: ReadonlySet<string>`
- Produces: `EVENT_STATUS: Readonly<Record<string, string>>`
- Produces: `DEFAULT_PROGRESS_URL: string`
- Produces: `validateProgressInput(input, secret): { valid: boolean, errors: string[] }`
- Produces: `buildProgressPayload(input): { mission: string, agent: string, progress: number, status: string, current_task: string }`
- Later tasks consume these exact exports.

- [ ] **Step 1: Write the first failing contract tests**

Create `tests/progress-reporter.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTHORIZED_AGENTS,
  EVENT_STATUS,
  buildProgressPayload,
  validateProgressInput,
} from '../src/integrations/n8n/progress-reporter.js';

const SECRET = 'test-progress-secret-never-print';

function validInput(overrides = {}) {
  return {
    mission: 'MISSION-API-TEST',
    agent: 'Codex',
    event: 'progress',
    progress: 55,
    task: 'Implementing execution fencing',
    ...overrides,
  };
}

test('v1 allowlist and event mapping are exact', () => {
  assert.deepEqual([...AUTHORIZED_AGENTS], ['Codex', 'Claude', 'Jules', 'Antigravity']);
  assert.deepEqual(EVENT_STATUS, {
    started: 'active',
    progress: 'active',
    blocked: 'blocked',
    completed: 'completed',
  });
});

test('buildProgressPayload maps the CLI event to the existing bridge payload', () => {
  assert.deepEqual(buildProgressPayload(validInput()), {
    mission: 'MISSION-API-TEST',
    agent: 'Codex',
    progress: 55,
    status: 'active',
    current_task: 'Implementing execution fencing',
  });
});

test('all four approved event types validate', () => {
  for (const [event, progress] of [
    ['started', 0],
    ['progress', 55],
    ['blocked', 55],
    ['completed', 100],
  ]) {
    const result = validateProgressInput(validInput({ event, progress }), SECRET);
    assert.equal(result.valid, true, `${event}: ${result.errors.join(', ')}`);
  }
});

test('validation rejects invalid mission, agent, event, progress, task, and completion semantics', () => {
  const cases = [
    [validInput({ mission: '' }), 'mission is required'],
    [validInput({ agent: '' }), 'agent is required'],
    [validInput({ agent: 'UnknownAgent' }), 'agent must be one of: Codex, Claude, Jules, Antigravity'],
    [validInput({ event: 'heartbeat' }), 'event must be one of: started, progress, blocked, completed'],
    [validInput({ progress: -1 }), 'progress must be an integer from 0 through 100'],
    [validInput({ progress: 101 }), 'progress must be an integer from 0 through 100'],
    [validInput({ progress: 50.5 }), 'progress must be an integer from 0 through 100'],
    [validInput({ task: '   ' }), 'task is required'],
    [validInput({ event: 'completed', progress: 99 }), 'completed requires progress = 100'],
  ];

  for (const [input, expectedError] of cases) {
    const result = validateProgressInput(input, SECRET);
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes(expectedError), JSON.stringify(result));
  }
});

test('missing secret is rejected without echoing any secret value', () => {
  const result = validateProgressInput(validInput(), '');
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('RAIOC_PROGRESS_SECRET is not configured'));
  assert.equal(JSON.stringify(result).includes(SECRET), false);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the module does not exist**

Run:

```powershell
node --test tests/progress-reporter.test.js
```

Expected: FAIL with an import/module-not-found error for `src/integrations/n8n/progress-reporter.js`.

- [ ] **Step 3: Implement the minimal contract and validation layer**

Create `src/integrations/n8n/progress-reporter.js` with:

```js
export const AUTHORIZED_AGENTS = new Set(['Codex', 'Claude', 'Jules', 'Antigravity']);

export const EVENT_STATUS = Object.freeze({
  started: 'active',
  progress: 'active',
  blocked: 'blocked',
  completed: 'completed',
});

export const DEFAULT_PROGRESS_URL = 'https://privateadvisory.app.n8n.cloud/webhook/raioc-progress';

export function validateProgressInput(input = {}, secret = '') {
  const errors = [];
  const mission = typeof input.mission === 'string' ? input.mission.trim() : '';
  const agent = typeof input.agent === 'string' ? input.agent.trim() : '';
  const event = typeof input.event === 'string' ? input.event.trim() : '';
  const task = typeof input.task === 'string' ? input.task.trim() : '';

  if (!mission) errors.push('mission is required');
  if (!agent) {
    errors.push('agent is required');
  } else if (!AUTHORIZED_AGENTS.has(agent)) {
    errors.push('agent must be one of: Codex, Claude, Jules, Antigravity');
  }

  if (!Object.hasOwn(EVENT_STATUS, event)) {
    errors.push('event must be one of: started, progress, blocked, completed');
  }

  if (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100) {
    errors.push('progress must be an integer from 0 through 100');
  }

  if (!task) errors.push('task is required');
  if (event === 'completed' && input.progress !== 100) {
    errors.push('completed requires progress = 100');
  }
  if (!secret) errors.push('RAIOC_PROGRESS_SECRET is not configured');

  return { valid: errors.length === 0, errors };
}

export function buildProgressPayload(input) {
  return {
    mission: input.mission.trim(),
    agent: input.agent.trim(),
    progress: input.progress,
    status: EVENT_STATUS[input.event.trim()],
    current_task: input.task.trim(),
  };
}
```

- [ ] **Step 4: Run the focused test and confirm the contract passes**

Run:

```powershell
node --test tests/progress-reporter.test.js
```

Expected: PASS for all Task 1 tests.

- [ ] **Step 5: Commit Task 1**

```powershell
git add src/integrations/n8n/progress-reporter.js tests/progress-reporter.test.js
git commit -m "feat: add Progress Bridge reporting contract"
```

---

### Task 2: Secret-Safe Transport and Bounded Retry Behavior

**Files:**
- Modify: `src/integrations/n8n/progress-reporter.js`
- Modify: `tests/progress-reporter.test.js`

**Interfaces:**
- Consumes: `validateProgressInput`, `buildProgressPayload`, `DEFAULT_PROGRESS_URL` from Task 1.
- Produces: `reportProgress(input, options): Promise<ProgressResult>`.
- `options` supports `secret`, `url`, `fetchImpl`, `sleepImpl`, `maxAttempts`, `retryDelaysMs` for hermetic testing; production defaults read from environment/global runtime.
- Success result: `{ ok: true, mission, event, progress, bridge_status, attempts }`.
- Validation failure: `{ ok: false, non_blocking: true, reason: 'validation_failed', errors, attempts: 0 }`.
- Exhausted transport failure: `{ ok: false, non_blocking: true, reason: 'progress_bridge_unavailable', mission, event, progress, attempts }`.

- [ ] **Step 1: Add failing transport and retry tests**

Append to `tests/progress-reporter.test.js`:

```js
import { reportProgress } from '../src/integrations/n8n/progress-reporter.js';

test('reportProgress sends the exact production bridge method, headers, and body', async () => {
  const calls = [];
  const fetchImpl = async (url, request) => {
    calls.push({ url, request });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const result = await reportProgress(validInput(), {
    secret: SECRET,
    url: 'https://bridge.invalid/raioc-progress',
    fetchImpl,
    sleepImpl: async () => undefined,
  });

  assert.equal(result.ok, true);
  assert.equal(result.bridge_status, 200);
  assert.equal(result.attempts, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://bridge.invalid/raioc-progress');
  assert.equal(calls[0].request.method, 'POST');
  assert.equal(calls[0].request.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].request.headers['x-raioc-signature'], SECRET);
  assert.deepEqual(JSON.parse(calls[0].request.body), {
    mission: 'MISSION-API-TEST',
    agent: 'Codex',
    progress: 55,
    status: 'active',
    current_task: 'Implementing execution fencing',
  });
  assert.equal(JSON.stringify(result).includes(SECRET), false);
});

test('validation failure performs zero network calls and is non-blocking', async () => {
  let calls = 0;
  const result = await reportProgress(validInput({ mission: '' }), {
    secret: SECRET,
    fetchImpl: async () => {
      calls += 1;
      throw new Error('must not run');
    },
    sleepImpl: async () => undefined,
  });

  assert.equal(calls, 0);
  assert.deepEqual(result, {
    ok: false,
    non_blocking: true,
    reason: 'validation_failed',
    errors: ['mission is required'],
    attempts: 0,
  });
});

test('missing secret performs zero network calls and never returns a secret value', async () => {
  let calls = 0;
  const result = await reportProgress(validInput(), {
    secret: '',
    fetchImpl: async () => {
      calls += 1;
      throw new Error('must not run');
    },
    sleepImpl: async () => undefined,
  });

  assert.equal(calls, 0);
  assert.equal(result.ok, false);
  assert.equal(result.non_blocking, true);
  assert.equal(result.reason, 'validation_failed');
  assert.equal(JSON.stringify(result).includes(SECRET), false);
});

test('transient failure retries and succeeds on the second attempt', async () => {
  let attempts = 0;
  const delays = [];
  const result = await reportProgress(validInput(), {
    secret: SECRET,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary network failure');
      return new Response('{}', { status: 200 });
    },
    sleepImpl: async (ms) => delays.push(ms),
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
  assert.deepEqual(delays, [1000]);
});

test('three transport failures return a non-blocking result with bounded backoff', async () => {
  let attempts = 0;
  const delays = [];
  const result = await reportProgress(validInput(), {
    secret: SECRET,
    fetchImpl: async () => {
      attempts += 1;
      throw new Error(`failure ${attempts}`);
    },
    sleepImpl: async (ms) => delays.push(ms),
  });

  assert.deepEqual(result, {
    ok: false,
    non_blocking: true,
    reason: 'progress_bridge_unavailable',
    mission: 'MISSION-API-TEST',
    event: 'progress',
    progress: 55,
    attempts: 3,
  });
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [1000, 2000]);
  assert.equal(JSON.stringify(result).includes(SECRET), false);
});

test('non-2xx HTTP responses are retried without exposing response bodies or secrets', async () => {
  let attempts = 0;
  const result = await reportProgress(validInput(), {
    secret: SECRET,
    fetchImpl: async () => {
      attempts += 1;
      return new Response(`server body containing ${SECRET}`, { status: 503 });
    },
    sleepImpl: async () => undefined,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'progress_bridge_unavailable');
  assert.equal(result.attempts, 3);
  assert.equal(JSON.stringify(result).includes(SECRET), false);
});
```

- [ ] **Step 2: Run the focused test and confirm the new tests fail because `reportProgress` is not exported**

```powershell
node --test tests/progress-reporter.test.js
```

Expected: FAIL indicating `reportProgress` is missing/not exported.

- [ ] **Step 3: Implement `reportProgress` with injected test seams and production defaults**

Append to `src/integrations/n8n/progress-reporter.js`:

```js
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function reportProgress(input, options = {}) {
  const secret = options.secret ?? process.env.RAIOC_PROGRESS_SECRET ?? '';
  const url = options.url ?? process.env.RAIOC_PROGRESS_URL ?? DEFAULT_PROGRESS_URL;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep;
  const maxAttempts = options.maxAttempts ?? 3;
  const retryDelaysMs = options.retryDelaysMs ?? [1000, 2000];

  const validation = validateProgressInput(input, secret);
  if (!validation.valid) {
    return {
      ok: false,
      non_blocking: true,
      reason: 'validation_failed',
      errors: validation.errors,
      attempts: 0,
    };
  }

  const payload = buildProgressPayload(input);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-raioc-signature': secret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`bridge_http_${response.status}`);
      }

      return {
        ok: true,
        mission: payload.mission,
        event: input.event.trim(),
        progress: payload.progress,
        bridge_status: response.status,
        attempts: attempt,
      };
    } catch {
      if (attempt < maxAttempts) {
        const delay = retryDelaysMs[attempt - 1] ?? retryDelaysMs.at(-1) ?? 0;
        await sleepImpl(delay);
      }
    }
  }

  return {
    ok: false,
    non_blocking: true,
    reason: 'progress_bridge_unavailable',
    mission: payload.mission,
    event: input.event.trim(),
    progress: payload.progress,
    attempts: maxAttempts,
  };
}
```

- [ ] **Step 4: Run the focused tests**

```powershell
node --test tests/progress-reporter.test.js
```

Expected: PASS; no real network call occurs because every transport test injects `fetchImpl`.

- [ ] **Step 5: Verify the existing general n8n client is untouched**

```powershell
git diff -- src/integrations/n8n/n8n-webhook-client.js
```

Expected: no output.

- [ ] **Step 6: Commit Task 2**

```powershell
git add src/integrations/n8n/progress-reporter.js tests/progress-reporter.test.js
git commit -m "feat: add resilient Progress Bridge transport"
```

---

### Task 3: CLI Wrapper, npm Command, Environment Documentation, and CI Inclusion

**Files:**
- Create: `scripts/report-progress.js`
- Modify: `tests/progress-reporter.test.js`
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `reportProgress(input, options)` from Task 2.
- Produces: `parseCliArgs(argv): ProgressInput`.
- Produces: `runCli({ argv, reporter, log, warn }): Promise<ProgressResult>`.
- Produces npm command: `npm run progress -- --mission ... --agent ... --event ... --progress ... --task ...`.
- CLI never accepts a secret flag and does not implement HTTP directly.

- [ ] **Step 1: Add failing CLI/configuration tests**

Append these imports to `tests/progress-reporter.test.js`:

```js
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseCliArgs, runCli } from '../scripts/report-progress.js';
```

Append these tests:

```js
test('parseCliArgs produces the canonical explicit input', () => {
  assert.deepEqual(parseCliArgs([
    '--mission', 'MISSION-API-TEST',
    '--agent', 'Codex',
    '--event', 'progress',
    '--progress', '80',
    '--task', 'Codex canary through canonical Progress Reporter',
  ]), {
    mission: 'MISSION-API-TEST',
    agent: 'Codex',
    event: 'progress',
    progress: 80,
    task: 'Codex canary through canonical Progress Reporter',
  });
});

test('parseCliArgs rejects unknown flags, including any attempt to pass a secret', () => {
  assert.throws(() => parseCliArgs(['--secret', 'never-allow-this']), /unknown flag: --secret/);
  assert.throws(() => parseCliArgs(['--mission']), /missing value for --mission/);
});

test('runCli delegates to the reporter and keeps a reporting failure non-blocking', async () => {
  const warnings = [];
  const result = await runCli({
    argv: [
      '--mission', 'MISSION-API-TEST',
      '--agent', 'Codex',
      '--event', 'progress',
      '--progress', '80',
      '--task', 'Canary',
    ],
    reporter: async (input) => ({
      ok: false,
      non_blocking: true,
      reason: 'progress_bridge_unavailable',
      mission: input.mission,
      event: input.event,
      progress: input.progress,
      attempts: 3,
    }),
    log: () => undefined,
    warn: (message) => warnings.push(message),
  });

  assert.equal(result.non_blocking, true);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /progress_bridge_unavailable/);
});

test('package scripts expose progress and CI includes the hermetic reporter test', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.progress, 'node scripts/report-progress.js');
  assert.match(pkg.scripts['test:ci'], /tests\/progress-reporter\.test\.js/);
});

test('.env.example documents only Progress Bridge placeholders', () => {
  const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(envExample, /RAIOC_PROGRESS_URL=https:\/\/privateadvisory\.app\.n8n\.cloud\/webhook\/raioc-progress/);
  assert.match(envExample, /RAIOC_PROGRESS_SECRET=your_progress_bridge_secret_here/);
});

test('the real CLI with no secret exits normally and performs no live report', () => {
  const result = spawnSync(process.execPath, [
    'scripts/report-progress.js',
    '--mission', 'MISSION-API-TEST',
    '--agent', 'Codex',
    '--event', 'progress',
    '--progress', '80',
    '--task', 'Hermetic CLI test',
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: { ...process.env, RAIOC_PROGRESS_SECRET: '' },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stderr, /validation_failed/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /x-raioc-signature/);
});
```

- [ ] **Step 2: Run the focused tests and confirm CLI/configuration tests fail**

```powershell
node --test tests/progress-reporter.test.js
```

Expected: FAIL because `scripts/report-progress.js`, the `progress` npm script, CI inclusion, and environment placeholders do not exist yet.

- [ ] **Step 3: Implement the CLI wrapper**

Create `scripts/report-progress.js`:

```js
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { reportProgress } from '../src/integrations/n8n/progress-reporter.js';

const VALUE_FLAGS = new Set(['--mission', '--agent', '--event', '--progress', '--task']);

export function parseCliArgs(argv) {
  const values = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!VALUE_FLAGS.has(flag)) {
      throw new Error(`unknown flag: ${flag}`);
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for ${flag}`);
    }

    values[flag.slice(2)] = value;
    index += 1;
  }

  return {
    mission: values.mission,
    agent: values.agent,
    event: values.event,
    progress: values.progress === undefined ? undefined : Number(values.progress),
    task: values.task,
  };
}

export async function runCli({
  argv = process.argv.slice(2),
  reporter = reportProgress,
  log = console.log,
  warn = console.warn,
} = {}) {
  let input;
  try {
    input = parseCliArgs(argv);
  } catch (error) {
    const result = {
      ok: false,
      non_blocking: true,
      reason: 'cli_validation_failed',
      errors: [error.message],
      attempts: 0,
    };
    warn(JSON.stringify(result));
    return result;
  }

  const result = await reporter(input);
  const output = JSON.stringify(result);
  if (result.ok) log(output);
  else warn(output);
  return result;
}

const currentFile = resolve(fileURLToPath(import.meta.url));
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (currentFile === invokedFile) {
  await runCli();
}
```

Important: do not set a non-zero exit code for reporting/validation failure; the CLI result itself carries `ok: false` and `non_blocking: true` so an unavailable bridge cannot stop the engineering mission.

- [ ] **Step 4: Update npm scripts**

In `package.json`, add:

```json
"progress": "node scripts/report-progress.js"
```

and append `tests/progress-reporter.test.js` to the existing `test:ci` command, yielding:

```json
"test:ci": "node --test tests/vercel-entrypoint.test.js tests/frontend-source-of-truth-mission4.test.js tests/schema-provenance-mission3.test.js tests/security-mission2-hardening.test.js tests/execution-schema-foundation-mission015e.test.js tests/execution-runtime-integration-mission015e-b.test.js tests/runtime-execution-safety-mission015e-b-r1.test.js tests/n8n-boundary-mission015e-c-r2.test.js tests/crm-n8n-reentry-mission015e-c-r2.test.js tests/progress-reporter.test.js"
```

Do not add dependencies and do not modify `package-lock.json`.

- [ ] **Step 5: Add Progress Bridge environment placeholders**

Append to `.env.example`:

```env

# ------------------------------------------------------------------------------
# 10. RAIOC PROGRESS BRIDGE (AI mission progress → n8n → Obsidian)
# ------------------------------------------------------------------------------
RAIOC_PROGRESS_URL=https://privateadvisory.app.n8n.cloud/webhook/raioc-progress
RAIOC_PROGRESS_SECRET=your_progress_bridge_secret_here
```

Do not add a real secret. `.gitignore` already excludes `.env`, `.env.local`, `.env.*.local`, and `.env*`; leave `.gitignore` unchanged.

- [ ] **Step 6: Run focused tests**

```powershell
node --test tests/progress-reporter.test.js
```

Expected: PASS.

- [ ] **Step 7: Run the CLI without a secret to confirm the non-blocking local failure path**

```powershell
$env:RAIOC_PROGRESS_SECRET = ""
npm.cmd run progress -- --mission MISSION-API-TEST --agent Codex --event progress --progress 80 --task "Local no-secret verification"
```

Expected: JSON warning containing `"ok":false`, `"non_blocking":true`, and `"reason":"validation_failed"`; no network request and no secret output.

- [ ] **Step 8: Commit Task 3**

```powershell
git add scripts/report-progress.js tests/progress-reporter.test.js package.json .env.example
git commit -m "feat: add canonical progress reporting CLI"
```

---

### Task 4: Codex Phase-1 Operating Instructions

**Files:**
- Create: `AGENTS.md`

**Interfaces:**
- Consumes: npm `progress` command from Task 3.
- Produces: repository-local Codex behavioral contract for when and how to invoke the reporter.
- This task does not add a second transport implementation.

- [ ] **Step 1: Create the Codex instructions**

Create root `AGENTS.md` with exactly this scope:

```md
# RAIOC Agent Instructions

## Mission progress reporting

When Codex is working on an explicitly assigned RAIOC mission, use the canonical Progress Reporter only on meaningful events:

- work starts
- a meaningful progress milestone is reached
- work becomes blocked
- work is completed

The mission ID must be supplied explicitly by the mission/task context. Never infer or guess a mission ID from repository names, branch names, paths, filenames, or conversation state.

Canonical command:

```text
npm run progress -- --mission MISSION-XYZ --agent Codex --event progress --progress 55 --task "Current meaningful task"
```

Allowed events are `started`, `progress`, `blocked`, and `completed`. `completed` requires `--progress 100`.

Do not:

- call the n8n Progress Bridge webhook directly
- write mission progress directly to GitHub or Obsidian
- pass `RAIOC_PROGRESS_SECRET` as a command-line argument
- print or inspect the value of `RAIOC_PROGRESS_SECRET`
- emit heartbeat or per-subtask progress noise
- treat a progress report as production/canary execution authorization

If the reporter returns `ok: false`, surface the warning and continue the engineering task. Progress reporting is non-blocking.

The RAIOC runtime live-canary HOLD remains separate from mission progress reporting.
```

- [ ] **Step 2: Verify the instruction file contains the required guardrails**

Run:

```powershell
Select-String -Path AGENTS.md -Pattern "explicitly assigned","Never infer","npm run progress","Do not","non-blocking","live-canary HOLD"
```

Expected: all six concepts match at least one line.

- [ ] **Step 3: Verify the instructions contain no direct production webhook URL and no secret value**

```powershell
Select-String -Path AGENTS.md -Pattern "privateadvisory.app.n8n.cloud/webhook/raioc-progress","x-raioc-signature"
```

Expected: no matches. Codex should know only the canonical CLI, not the transport details.

- [ ] **Step 4: Commit Task 4**

```powershell
git add AGENTS.md
git commit -m "docs: teach Codex canonical progress reporting"
```

---

### Task 5: Credential-Free Release Gate

**Files:**
- Verify only; no expected source changes.

**Interfaces:**
- Consumes all implementation from Tasks 1–4.
- Produces evidence that the feature is safe to canary against production n8n.

- [ ] **Step 1: Install from the frozen lockfile in the isolated worktree**

```powershell
npm.cmd ci
```

Expected: install succeeds without changing `package-lock.json`.

- [ ] **Step 2: Run the focused Progress Reporter suite**

```powershell
node --test tests/progress-reporter.test.js
```

Expected: PASS, with no external network dependency.

- [ ] **Step 3: Run the repository build gate**

```powershell
npm.cmd run build
```

Expected: exit code 0.

- [ ] **Step 4: Run the same credential-free CI suite GitHub Actions uses**

```powershell
npm.cmd run test:ci
```

Expected: PASS, including `tests/progress-reporter.test.js`.

- [ ] **Step 5: Confirm no secret-bearing local files are tracked**

```powershell
git ls-files .env .env.local .env.test.local
git status --short
```

Expected: first command prints nothing; second command shows only intentional implementation changes, or nothing if all prior tasks were committed.

- [ ] **Step 6: Confirm the existing n8n HMAC/event-bus client remained untouched**

Compare the feature branch against its implementation base:

```powershell
git diff main...HEAD -- src/integrations/n8n/n8n-webhook-client.js
```

Expected: no output.

- [ ] **Step 7: Confirm no source file contains the real progress secret**

Do not search for the secret value. Instead verify only the environment-variable name and placeholder are present:

```powershell
git grep -n "RAIOC_PROGRESS_SECRET"
```

Expected matches are limited to source/docs/tests that reference the variable name or the literal placeholder `your_progress_bridge_secret_here`; no real secret value is committed.

- [ ] **Step 8: Commit any verification-only documentation correction if one was required**

If Steps 1–7 require no file changes, do not create an empty commit. If a small documentation correction was necessary, commit only that correction with:

```powershell
git add <the-corrected-document>
git commit -m "docs: correct Progress Reporter verification guidance"
```

---

### Task 6: Live Codex Canary Through the Production Progress Bridge

**Files:**
- Runtime validation only in `raioc-os`.
- External state expected to change: `emanuelrendas/raioc-obsidian-vault2/04 - MISSIONS/ACTIVE/MISSION-API-TEST.md` through n8n.

**Interfaces:**
- Consumes: canonical CLI from Task 3, Codex instructions from Task 4, already-production-verified n8n Progress Bridge.
- Produces: live evidence `Codex → canonical reporter → n8n → GitHub vault → local Obsidian`.
- Uses existing explicit canary mission: `MISSION-API-TEST`.

- [ ] **Step 1: Human operator loads the already-authorized bridge secret into the current shell without committing or printing it**

If the PowerShell session still contains the previously generated `$raiocSecret`, run:

```powershell
$env:RAIOC_PROGRESS_SECRET = $raiocSecret
```

Otherwise, the human operator must retrieve the authorized secret from secure storage and set `RAIOC_PROGRESS_SECRET` out-of-band. Do not paste the secret into chat, Git, command arguments, screenshots, or the implementation plan.

Set the non-secret URL explicitly for the canary:

```powershell
$env:RAIOC_PROGRESS_URL = "https://privateadvisory.app.n8n.cloud/webhook/raioc-progress"
```

- [ ] **Step 2: Run the live Codex canary through the canonical CLI**

From the `raioc-os` worktree:

```powershell
npm.cmd run progress -- --mission MISSION-API-TEST --agent Codex --event progress --progress 80 --task "Codex canary through canonical Progress Reporter"
```

Expected stdout: JSON containing at least:

```json
{
  "ok": true,
  "mission": "MISSION-API-TEST",
  "event": "progress",
  "progress": 80,
  "bridge_status": 200,
  "attempts": 1
}
```

The output must not contain `RAIOC_PROGRESS_SECRET`, `x-raioc-signature`, or the secret value.

- [ ] **Step 3: Verify the n8n production execution succeeded**

Open the production execution for `RAIOC Progress Bridge v1.2 — Production` (or the current canonical production name) and confirm the successful route is:

```text
Webhook
→ RAIOC Configuration
→ Validate Progress Event
→ Is Event Valid? = true
→ Get Mission File
→ Update RAIOC Frontmatter
→ Is Mission Ready? = true
→ Update Mission File
→ Respond Success
```

Expected: GitHub update returns HTTP 200; no validation/error branch executes.

- [ ] **Step 4: Verify the canonical vault file through GitHub evidence**

Check:

```text
emanuelrendas/raioc-obsidian-vault2
04 - MISSIONS/ACTIVE/MISSION-API-TEST.md
```

Expected frontmatter contains:

```yaml
raioc_progress: 80
raioc_status: active
raioc_agent: "Codex"
raioc_current_task: "Codex canary through canonical Progress Reporter"
```

and a fresh `raioc_last_updated` timestamp from the canary execution.

- [ ] **Step 5: Pull the vault into Tiago's local Obsidian workspace**

```powershell
Set-Location "C:\Users\diore\Documents\RAIOC V2"
git pull
```

Expected: fast-forward (or already up to date if another authorized sync occurred) containing the mission frontmatter update.

- [ ] **Step 6: Verify the local Obsidian mission state**

```powershell
Get-Content "04 - MISSIONS\ACTIVE\MISSION-API-TEST.md" | Select-String "raioc_progress","raioc_status","raioc_agent","raioc_current_task","raioc_last_updated"
```

Expected: the same `80 / active / Codex / Codex canary through canonical Progress Reporter` values visible in GitHub.

- [ ] **Step 7: Clear the process-scoped secret when the canary is complete**

```powershell
Remove-Item Env:RAIOC_PROGRESS_SECRET -ErrorAction SilentlyContinue
```

Expected: the implementation remains functional, but future reports require an authorized environment to provide the secret again.

- [ ] **Step 8: Record final implementation evidence in the feature branch/PR description, not by modifying runtime authority**

Record:

- focused reporter tests passed
- `npm run build` passed
- `npm run test:ci` passed
- live canonical CLI returned HTTP 200
- `MISSION-API-TEST.md` received `raioc_progress: 80`
- local Obsidian pull verified the same state
- existing `n8n-webhook-client.js` remained unchanged
- RAIOC runtime live-canary remains HOLD

Do not use this result to release the separate RAIOC runtime canary gate.

---

## Final Self-Review Checklist for the Implementer

Before requesting review/merge, verify all of the following:

- [ ] Spec decisions are implemented exactly: meaningful events only, explicit mission, environment secret, non-blocking failure, one shared reporter.
- [ ] No automatic mission detection exists anywhere in the new code.
- [ ] `AUTHORIZED_AGENTS` is exactly `Codex`, `Claude`, `Jules`, `Antigravity`.
- [ ] `EVENT_STATUS` maps `started/progress → active`, `blocked → blocked`, `completed → completed`.
- [ ] `completed` with any progress other than 100 is locally rejected.
- [ ] Missing secret causes zero network requests.
- [ ] All tests inject/mock transport; CI never calls production n8n.
- [ ] Request header is exactly `x-raioc-signature`.
- [ ] Payload remains exactly `mission`, `agent`, `progress`, `status`, `current_task`.
- [ ] Retry count is bounded at 3 with 1000 ms and 2000 ms waits.
- [ ] Returned errors/results contain no raw HTTP body, request headers, or secret.
- [ ] CLI has no `--secret` flag.
- [ ] CLI failure remains non-blocking.
- [ ] `package-lock.json` is unchanged because no dependency was added.
- [ ] `tests/progress-reporter.test.js` is included in `test:ci`.
- [ ] Existing `src/integrations/n8n/n8n-webhook-client.js` is unchanged.
- [ ] No direct GitHub/Obsidian progress-write logic was introduced.
- [ ] No RAIOC runtime/canary execution authority code was changed.
- [ ] Codex canary reaches production n8n, GitHub vault, and local Obsidian.

## Implementation Completion Boundary

Phase 1 is complete only after Task 6 passes. Claude, Jules, and Antigravity environment-specific activation remains follow-on work; they must reuse the same reporter and must not fork the transport implementation.
