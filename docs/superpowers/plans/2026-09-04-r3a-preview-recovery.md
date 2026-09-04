# R3-A Preview Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve public preview pages and canonical health routes without eagerly constructing the Supabase client, while keeping data routes fail-closed when production credentials are absent.

**Architecture:** Replace the module-load singleton construction with a lazy proxy backed by one shared `SupabaseClient`. Imports remain compatible, but the strict-production constructor runs only when a database property or method is actually used. Add the versioned health alias to the unified router and telemetry handler.

**Tech Stack:** Node.js 24, ECMAScript modules, `node:test`, Vercel serverless entrypoint.

**Spec:** RAIOC Mother Chat decision `ER-R3-01`, subgate `R3-A`.

## Global Constraints

- Start from `b100163aae621f788e28b93f61cb2f8e6ff2046b`.
- Work only on `recovery/r3-isolated-corrections`.
- No merge to `main` and no production deployment.
- No live form submission, Supabase write, n8n call, or canary activation.
- Missing Supabase credentials must still fail closed for data routes.

---

### Task 1: Preview regression tests

**Files:**
- Create: `tests/preview-recovery-r3a.test.js`

**Interfaces:**
- Consumes: Vercel `handler(req, res)` from `api/index.js` in a fresh production process.
- Produces: behavioral regression coverage for static preview serving, versioned health, and missing-credential data access.

- [ ] **Step 1: Write a fresh-process test helper**

Use `spawnSync(process.execPath, ['--input-type=module', '--eval', script])`, set `NODE_ENV=production`, and remove all Supabase credential/fallback variables from the child environment.

- [ ] **Step 2: Prove the preview failure in RED**

Add tests asserting:

```js
assert.equal(runHandler('/contact').statusCode, 200);
assert.equal(runHandler('/api/v1/health').statusCode, 200);
assert.equal(runHandler('/api/v1/leads', 'POST', { name: 'Blocked', email: 'blocked@example.test' }).statusCode, 503);
```

Run:

```bash
node --test tests/preview-recovery-r3a.test.js
```

Expected before implementation: FAIL because importing `api/index.js` constructs `SupabaseClient` and throws `PersistenceError`.

### Task 2: Lazy Supabase singleton

**Files:**
- Modify: `src/db/supabase-client.js`
- Test: `tests/preview-recovery-r3a.test.js`

**Interfaces:**
- Produces: `getSupabaseClient()` and backward-compatible `supabase` proxy.
- Preserves: existing `SupabaseClient` constructor and strict production semantics.

- [ ] **Step 1: Replace eager singleton construction**

Implement one lazily-created shared client. The proxy must bind methods to the real instance and forward property writes so existing tests that assign `supabase.isMock` continue to work.

- [ ] **Step 2: Run the focused suite**

```bash
node --test tests/preview-recovery-r3a.test.js
```

Expected: `/contact` progresses to `200`; the versioned health assertion may remain RED until Task 3.

### Task 3: Canonical health alias

**Files:**
- Modify: `src/api/server.js`
- Modify: `src/api/routes/telemetry-routes.js`
- Test: `tests/preview-recovery-r3a.test.js`

**Interfaces:**
- Consumes: `/health`, `/api/health`, `/api/v1/health`.
- Produces: the same public health response contract for all three paths.

- [ ] **Step 1: Route the versioned health path**

Add `/api/v1/health` to the public health condition in the unified router and telemetry handler.

- [ ] **Step 2: Verify GREEN**

```bash
node --test tests/preview-recovery-r3a.test.js
```

Expected: all R3-A focused tests pass.

### Task 4: Regression verification and bounded commit

**Files:**
- Verify all changed files above.

- [ ] **Step 1: Run canonical verification**

```bash
npm run test:ci
npm test
npm run build
git diff --check
```

- [ ] **Step 2: Inspect generated changes**

If `npm run build` changes `src/site/site-pages.js`, verify whether it is a deterministic pre-existing generation delta. Do not include it in the R3-A commit unless required by the implementation.

- [ ] **Step 3: Commit the bounded change**

```bash
git add docs/superpowers/plans/2026-09-04-r3a-preview-recovery.md \
  tests/preview-recovery-r3a.test.js \
  src/db/supabase-client.js \
  src/api/server.js \
  src/api/routes/telemetry-routes.js
git commit -m "fix(preview): defer Supabase initialization"
```

- [ ] **Step 4: Stop before remote publication**

Return the verified local SHA to the Mother Chat. Remote branch publication and preview deployment remain separate controlled actions within R3-A.
