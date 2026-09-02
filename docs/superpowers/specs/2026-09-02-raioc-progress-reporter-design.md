# RAIOC Progress Reporter — Design Specification

**Date:** 2026-09-02  
**Status:** Approved design; implementation pending  
**Repository:** `emanuelrendas/raioc-os`

## 1. Purpose

Create one canonical Progress Reporter inside `raioc-os` that authorized AI agents can use to report meaningful RAIOC mission progress through the already-production-verified n8n Progress Bridge.

The reporter exists to remove manual PowerShell webhook calls from the normal workflow while preserving the current ecosystem boundaries:

- `raioc-os` remains the operational/code/runtime center.
- `raioc-obsidian-vault2` remains the canonical missions, governance, and knowledge vault.
- n8n remains the controlled write bridge into the Obsidian mission state.
- Progress reporting does **not** grant runtime execution authority and does not change the existing RAIOC live-canary HOLD.

## 2. Approved Product Decisions

### 2.1 Reporting cadence

Agents report only on meaningful mission events:

- `started`
- major `progress` milestone
- `blocked`
- `completed`

The system must not generate periodic heartbeat updates or per-subtask noise.

### 2.2 Mission identification

Mission ID is always explicit.

The reporter must never infer or guess the current mission from:

- repository names
- filenames
- working directories
- conversation context
- branch names
- agent state

### 2.3 Secret management

Each authorized environment receives the Progress Bridge secret as:

`RAIOC_PROGRESS_SECRET`

The secret must:

- live only in the runtime environment or secure secret manager for that environment
- never be committed to Git
- never be supplied as a CLI argument
- never be printed in logs, stdout, stderr, errors, or structured reporter results

The non-secret endpoint may be provided as:

`RAIOC_PROGRESS_URL`

If absent, the reporter may default to:

`https://privateadvisory.app.n8n.cloud/webhook/raioc-progress`

There is no default secret.

### 2.4 Failure policy

Progress reporting is non-blocking.

If n8n or GitHub is temporarily unavailable:

1. Retry automatically a small number of times.
2. Surface a clear warning.
3. Return a structured non-blocking failure result.
4. Do not stop the agent's actual engineering work.

## 3. Architecture

### 3.1 Canonical flow

```text
Codex / Claude / Jules / Antigravity
                ↓
       scripts/report-progress.js
                ↓
         strict validation
                ↓
 src/integrations/n8n/progress-reporter.js
                ↓
 RAIOC_PROGRESS_SECRET from environment
                ↓
 POST /webhook/raioc-progress
                ↓
               n8n
                ↓
     raioc-obsidian-vault2
```

### 3.2 Repository placement

Use the existing `src/integrations/n8n` integration boundary.

```text
raioc-os/
├─ src/
│  └─ integrations/
│     └─ n8n/
│        ├─ n8n-webhook-client.js       # existing; unchanged
│        └─ progress-reporter.js         # new
├─ scripts/
│  └─ report-progress.js                 # new CLI wrapper
├─ tests/
│  └─ progress-reporter.test.js          # new
├─ .env.example                          # add non-secret placeholders
└─ package.json                          # add npm progress script
```

The existing `n8n-webhook-client.js` must remain untouched by this feature. It uses a separate HMAC/event-bus contract and serves a different runtime concern.

The Progress Reporter is a separate n8n client because the production Progress Bridge currently expects:

- header: `x-raioc-signature`
- direct mission payload

Mixing the two authentication/payload protocols would create unnecessary coupling and regression risk.

## 4. CLI Contract

The canonical invocation is:

```text
npm run progress -- --mission MISSION-XYZ --agent Codex --event progress --progress 55 --task "Implementing execution fencing"
```

Required fields:

- `mission`
- `agent`
- `event`
- `progress`
- `task`

Allowed agents for v1:

- `Codex`
- `Claude`
- `Jules`
- `Antigravity`

Allowed events:

- `started`
- `progress`
- `blocked`
- `completed`

## 5. Event-to-Status Mapping

Mapping is deterministic:

```text
started   → active
progress  → active
blocked   → blocked
completed → completed
```

The reporter sends the payload shape already accepted by the production n8n Progress Bridge:

```json
{
  "mission": "MISSION-015E-C-R2",
  "agent": "Codex",
  "progress": 55,
  "status": "active",
  "current_task": "Implementing execution fencing"
}
```

The CLI-level `event` value is used by the reporter to derive `status`; `event` does not need to be added to the existing n8n payload contract unless a later bridge version explicitly adopts it.

## 6. Validation Rules

The reporter must reject locally before any network request when:

- `mission` is missing or empty
- `agent` is missing or not in the authorized v1 allowlist
- `event` is missing or not one of the four supported values
- `progress` is not an integer from `0` through `100`
- `task` is missing or empty
- `RAIOC_PROGRESS_SECRET` is missing

Additional semantic rule:

- `completed` requires `progress = 100`

No mission identifier is inferred as a fallback.

## 7. Transport and Retry Behavior

### 7.1 HTTP request

The reporter sends:

```text
POST <RAIOC_PROGRESS_URL>
Content-Type: application/json
x-raioc-signature: <RAIOC_PROGRESS_SECRET>
```

The secret is read immediately before transport from the runtime environment and is never echoed.

### 7.2 Retry policy

Initial implementation:

- maximum attempts: 3
- backoff: approximately 1 second before retry 2, then approximately 2 seconds before retry 3
- HTTP/network failures may be retried
- local validation failures are not retried

The retry implementation must remain bounded; reporting must never become an unbounded loop.

### 7.3 Result model

Success should return a structured result conceptually equivalent to:

```json
{
  "ok": true,
  "mission": "MISSION-015E-C-R2",
  "event": "progress",
  "progress": 55,
  "bridge_status": 200
}
```

After bounded retries fail, return a non-blocking result conceptually equivalent to:

```json
{
  "ok": false,
  "non_blocking": true,
  "reason": "progress bridge unavailable"
}
```

No returned object may contain the secret or authorization header.

## 8. Environment Configuration

Add only placeholders to `.env.example`:

```env
# RAIOC Progress Bridge
RAIOC_PROGRESS_URL=https://privateadvisory.app.n8n.cloud/webhook/raioc-progress
RAIOC_PROGRESS_SECRET=your_progress_bridge_secret_here
```

Real values remain environment-specific and outside Git.

The repository already ignores `.env`, `.env.local`, and `.env.*.local`; implementation must preserve that boundary.

## 9. Agent Operating Rule

Each authorized agent receives the same behavioral contract:

> When working on an explicitly assigned RAIOC mission, use the canonical RAIOC Progress Reporter only when work starts, a meaningful milestone is reached, work becomes blocked, or work is completed. Always provide the explicit mission ID. Never infer or guess a mission ID. Do not call the n8n Progress Bridge directly and do not write mission progress directly to GitHub or Obsidian. If reporting fails, continue the engineering task and surface the reporter warning.

The reporter is the shared mechanism; agent-specific instructions must not duplicate webhook implementation logic.

## 10. Security and Authority Boundaries

Progress reporting is metadata synchronization, not execution authorization.

A report such as:

`MISSION-X — 70% complete`

must never be interpreted as authorization for:

- live outbound provider effects
- runtime canary activation
- production backlog processing
- n8n workflow fan-out
- Supabase mutation outside the Progress Bridge's existing scope

The existing RAIOC live-canary HOLD remains unchanged.

The feature must not modify:

- runtime execution authority
- effect fencing
- Supabase operational semantics
- existing general-purpose n8n event-bus authentication
- the production Progress Bridge workflow contract beyond sending the payload it already accepts

## 11. Testing Strategy

The new test file should use Node's existing `node:test` stack and mock or replace `globalThis.fetch` so normal test runs remain hermetic.

Required coverage:

### Valid events

- valid `started` report
- valid `progress` report
- valid `blocked` report
- valid `completed` report

### Validation

- `completed` with progress below 100 rejected
- progress below 0 rejected
- progress above 100 rejected
- non-integer progress rejected
- missing mission rejected
- missing agent rejected
- unknown agent rejected
- missing event rejected
- unknown event rejected
- missing task rejected

### Secret handling

- missing `RAIOC_PROGRESS_SECRET` causes no network call
- secret is not included in reporter success results
- secret is not included in reporter failure results
- secret is not exposed in thrown/returned validation messages

### Transport

- request uses `POST`
- request uses `Content-Type: application/json`
- request uses the exact `x-raioc-signature` header
- body matches the existing Progress Bridge payload contract
- event-to-status mapping is correct

### Resilience

- transient network failure triggers bounded retries
- eventual successful retry returns success
- repeated failure returns `non_blocking: true`
- no unplanned network request is permitted during automated tests

## 12. Rollout Plan

### Phase 1 — Codex canary

1. Implement reporter, CLI, validation, environment placeholders, npm script, and tests.
2. Configure `RAIOC_PROGRESS_SECRET` securely in the Codex/local environment.
3. Use an explicit canary mission ID.
4. Send a real `started` or `progress` report through the canonical CLI.
5. Verify n8n execution success.
6. Verify GitHub mission frontmatter update.
7. Pull `raioc-obsidian-vault2` and verify the same update appears in Obsidian.

### Phase 2 — Claude

Configure the same environment contract and use the same reporter. No new webhook implementation is permitted.

### Phase 3 — Jules and Antigravity

Configure the same environment contract and verify each environment can invoke the canonical reporter with an explicit mission ID.

## 13. Acceptance Criteria

The feature is complete when all of the following are true:

1. `npm run progress -- ...` can report a valid event to the production Progress Bridge.
2. The CLI requires an explicit mission ID.
3. Only the approved v1 agents and event types are accepted.
4. Completed events require progress 100.
5. The secret is sourced only from `RAIOC_PROGRESS_SECRET` and is never logged or committed.
6. Transport uses `x-raioc-signature` and the already-supported mission payload.
7. Network failures retry only within the bounded retry policy.
8. Final reporting failure is non-blocking to the engineering task.
9. Automated tests are hermetic and cover validation, transport, retries, and secret non-disclosure.
10. Existing `n8n-webhook-client.js` behavior is unchanged.
11. A live Codex canary reaches n8n, GitHub, and then Obsidian successfully.
12. The RAIOC runtime live-canary HOLD remains untouched.

## 14. Explicit Non-Goals

This version does not:

- create a persistent agent daemon
- infer active missions automatically
- create scheduled/heartbeat reporting
- redesign the n8n Progress Bridge
- merge the Obsidian vault into `raioc-os`
- authorize runtime production/canary activity
- give agents direct GitHub mission-write access for progress reporting
- give agents direct Obsidian-write access
- implement separate webhook clients for each agent

## 15. Follow-on Work

After the Codex canary is proven, follow-on work may add environment-specific setup/instruction files for Claude, Jules, and Antigravity. Those integrations must continue using the same reporter and payload contract rather than forking implementation logic.
