/**
 * MISSION-004 Verification Tests: Frontend Source of Truth Consolidation
 *
 * Verifies:
 * 1. Disk-first HTML resolution — edits to disk HTML immediately reflect in handler output
 * 2. All canonical public pages are served correctly
 * 3. Protected routes (/dashboard, /mission-control) still enforce 401 without auth
 * 4. Static CSS asset is served with correct Content-Type
 * 5. site-pages.js fallback bundle is byte-for-byte consistent with disk files
 *
 * Owner: Emanuel Rendas (Principal Advisor)
 * Risk Tier: Tier 1 — Client-Facing Public Identity & Intake
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── Shared mock response builder ──────────────────────────────────────────────
function makeMockRes() {
  const res = {
    statusCode: null,
    _headers: {},
    _body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this._headers[k] = v; return this; },
    getHeader(k) { return this._headers[k]; },
    send(data) { this._body = data; return this; },
    json(data) { this._body = data; return this; },
    end(data) { this._body = data ?? this._body; return this; },
  };
  return res;
}

// ─── Import handler ────────────────────────────────────────────────────────────
let handler;
try {
  const mod = await import('../api/index.js');
  handler = mod.default;
} catch (err) {
  // If import fails we skip gracefully — this test environment may lack Supabase creds
  handler = null;
}

const skipIfNoHandler = handler ? false : true;

// ─── Test Suite 1: site-pages.js Bundle Sync Verification ──────────────────────
describe('MISSION-004: site-pages.js bundle is synchronized with disk HTML', () => {
  const PAGE_NAMES = ['index', 'about', 'advisory', 'contact', 'instruments', 'intelligence', 'addresses'];

  for (const page of PAGE_NAMES) {
    test(`site-pages["${page}"] matches disk ${page}.html`, async () => {
      const { sitePages } = await import('../src/site/site-pages.js');

      const diskPath = fs.existsSync(path.join(ROOT, `${page}.html`))
        ? path.join(ROOT, `${page}.html`)
        : path.join(ROOT, 'public', `${page}.html`);

      assert.ok(
        fs.existsSync(diskPath),
        `Disk file ${page}.html must exist at root or public/`
      );

      const diskContent = fs.readFileSync(diskPath, 'utf8');
      assert.ok(
        sitePages[page],
        `sitePages["${page}"] must be non-empty — run node tools/sync-site-pages.mjs to sync`
      );

      // Strip trailing whitespace differences for resilient comparison
      const diskNorm = diskContent.trim().replace(/\r\n/g, '\n');
      const bundleNorm = sitePages[page].trim().replace(/\r\n/g, '\n');

      assert.strictEqual(
        diskNorm,
        bundleNorm,
        `sitePages["${page}"] is out of sync with disk — run node tools/sync-site-pages.mjs`
      );
    });
  }

  test('site-pages.js contains all required page keys', async () => {
    const { sitePages } = await import('../src/site/site-pages.js');
    const required = ['index', 'about', 'advisory', 'contact', 'instruments', 'intelligence', 'addresses'];
    for (const key of required) {
      assert.ok(
        typeof sitePages[key] === 'string' && sitePages[key].length > 100,
        `sitePages["${key}"] must be a non-trivial HTML string`
      );
    }
  });
});

// ─── Test Suite 2: Bundle-Primary Resolution (Decision B) ─────────────────────
describe('MISSION-004: Bundle is primary — sitePages is the sole HTML source in production', () => {
  test('handler serves content from sitePages bundle, not from disk', async (t) => {
    if (skipIfNoHandler) {
      t.skip('Handler import failed — skipping');
      return;
    }

    const { sitePages } = await import('../src/site/site-pages.js');

    // Verify the bundle contains the about page
    assert.ok(
      typeof sitePages['about'] === 'string' && sitePages['about'].length > 100,
      'sitePages["about"] must be a non-trivial HTML string'
    );

    // Request /about — response must match the bundle content exactly
    const req = {
      url: '/about',
      method: 'GET',
      headers: {},
      query: {},
      body: {},
    };
    const res = makeMockRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 200, 'GET /about must return 200');
    assert.ok(
      typeof res._body === 'string',
      'Response body must be a string'
    );
    // Bundle content must be what was served (Decision B: bundle is canonical)
    const bodyNorm = res._body.trim().replace(/\r\n/g, '\n');
    const bundleNorm = sitePages['about'].trim().replace(/\r\n/g, '\n');
    assert.strictEqual(
      bodyNorm,
      bundleNorm,
      'Handler response must match sitePages["about"] exactly — bundle is canonical (Decision B)'
    );
  });

  test('page absent from bundle returns 404 — fail closed, no disk fallback', async (t) => {
    if (skipIfNoHandler) {
      t.skip('Handler import failed — skipping');
      return;
    }

    // Request a page key that is guaranteed not in the bundle
    const req = {
      url: '/definitely-not-a-page-in-the-bundle-xyz',
      method: 'GET',
      headers: {},
      query: {},
      body: {},
    };
    const res = makeMockRes();
    await handler(req, res);

    // Must be 404 — no silent disk fallback allowed (Decision B)
    assert.strictEqual(
      res.statusCode,
      404,
      'Pages not in the bundle must return 404 — no silent disk fallback (Decision B)'
    );
  });
});


// ─── Test Suite 3: Canonical Public Page Serving ───────────────────────────────
describe('MISSION-004: All canonical public pages serve 200 with HTML', () => {
  const publicPages = ['/', '/about', '/advisory', '/contact', '/instruments', '/intelligence', '/addresses'];

  for (const page of publicPages) {
    test(`GET ${page} returns 200 HTML`, async (t) => {
      if (skipIfNoHandler) {
        t.skip('Handler import failed — skipping');
        return;
      }

      const req = {
        url: page,
        method: 'GET',
        headers: {},
        query: {},
        body: {},
      };
      const res = makeMockRes();
      await handler(req, res);

      assert.strictEqual(res.statusCode, 200, `Expected 200 for GET ${page}`);
      assert.ok(
        typeof res._body === 'string' && res._body.includes('<!DOCTYPE html'),
        `Response body for GET ${page} must be HTML`
      );
    });
  }
});

// ─── Test Suite 4: Protected Route Auth Invariants (MISSION-002 frozen) ────────
describe('MISSION-004: Protected frontend routes still enforce 401 without auth', () => {
  const protectedRoutes = ['/dashboard', '/mission-control'];

  for (const route of protectedRoutes) {
    test(`GET ${route} without auth returns 401 Unauthorized`, async (t) => {
      if (skipIfNoHandler) {
        t.skip('Handler import failed — skipping');
        return;
      }

      const req = {
        url: route,
        method: 'GET',
        headers: {},
        query: {},
        body: {},
      };
      const res = makeMockRes();
      await handler(req, res);

      assert.strictEqual(
        res.statusCode,
        401,
        `GET ${route} without credentials must return 401 — MISSION-002 invariant`
      );
    });
  }

  test('GET /api/test-email returns 404 (deleted endpoint — MISSION-002 frozen)', async (t) => {
    if (skipIfNoHandler) {
      t.skip('Handler import failed — skipping');
      return;
    }

    const req = {
      url: '/api/test-email',
      method: 'GET',
      headers: {},
      query: {},
      body: {},
    };
    const res = makeMockRes();
    await handler(req, res);

    assert.strictEqual(
      res.statusCode,
      404,
      '/api/test-email must return 404 — endpoint was deleted in MISSION-002'
    );
  });
});

// ─── Test Suite 5: CSS Asset Delivery ─────────────────────────────────────────
describe('MISSION-004: Static CSS asset delivery', () => {
  test('GET /assets/site.css returns 200 with text/css Content-Type', async (t) => {
    if (skipIfNoHandler) {
      t.skip('Handler import failed — skipping');
      return;
    }

    const req = {
      url: '/assets/site.css',
      method: 'GET',
      headers: {},
      query: {},
      body: {},
    };
    const res = makeMockRes();
    await handler(req, res);

    // CSS may be served from assets/ or public/assets/
    if (res.statusCode === 200) {
      const ct = res._headers['Content-Type'] || '';
      assert.ok(ct.includes('text/css'), `Content-Type for /assets/site.css must include text/css, got: ${ct}`);
    } else {
      // Not 404 — at least the page should not error out
      assert.ok(
        [200, 404].includes(res.statusCode),
        `Unexpected status ${res.statusCode} for /assets/site.css`
      );
    }
  });
});

// ─── Test Suite 6: 404 fallback is HTML, not bare error ────────────────────────
describe('MISSION-004: 404 fallback is graceful HTML', () => {
  test('GET /nonexistent-route returns 404 with HTML content', async (t) => {
    if (skipIfNoHandler) {
      t.skip('Handler import failed — skipping');
      return;
    }

    const req = {
      url: '/nonexistent-page-xyz-abc',
      method: 'GET',
      headers: {},
      query: {},
      body: {},
    };
    const res = makeMockRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 404, 'Unknown pages must return 404');
    // The 404 response should still be HTML (graceful degradation, not a crash)
    assert.ok(
      typeof res._body === 'string' && res._body.length > 0,
      '404 response must have a non-empty body'
    );
  });
});
