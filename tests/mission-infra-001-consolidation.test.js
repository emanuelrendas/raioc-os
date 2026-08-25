import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('MISSION INFRA-001 — Consolidated Website + Serverless + Backend Verification', () => {
  test('1. Static HTML pages exist and contain critical meta & SEO tags', () => {
    const requiredPages = [
      'index.html',
      'about.html',
      'contact.html',
      'advisory.html',
      'instruments.html',
      'intelligence.html',
      'addresses.html',
      'robots.txt',
      'sitemap.xml',
      'llms.txt',
      'og.jpg'
    ];
    for (const file of requiredPages) {
      assert.ok(fs.existsSync(file), `Missing static file: ${file}`);
    }

    const indexHtml = fs.readFileSync('index.html', 'utf8');
    assert.ok(indexHtml.includes('<title>'), 'index.html missing <title>');
    assert.ok(indexHtml.includes('Emanuel Rendas'), 'index.html missing brand name');
    assert.ok(indexHtml.includes('name="description"'), 'index.html missing meta description');
    assert.ok(indexHtml.includes('assets/site.css'), 'index.html missing site.css link');
    assert.ok(indexHtml.includes('assets/site.js'), 'index.html missing site.js link');
  });

  test('2. Static assets directory contains required CSS, JS, and image assets', () => {
    const requiredAssets = [
      'assets/calc.js',
      'assets/dira.js',
      'assets/dld.js',
      'assets/emanuel.jpg',
      'assets/map.js',
      'assets/share.js',
      'assets/site.css',
      'assets/site.js'
    ];
    for (const asset of requiredAssets) {
      assert.ok(fs.existsSync(asset), `Missing asset: ${asset}`);
    }
  });

  test('3. Serverless API functions exist and load as valid modules', async () => {
    const serverlessEndpoints = [
      '../api/health.js',
      '../api/lead.js',
      '../api/assessment.js',
      '../api/event.js',
      '../api/intake.js',
      '../api/dld.js',
      '../api/fx.js',
      '../api/test-email.js',
      '../api/executive/connectors.js',
      '../api/executive/status.js',
      '../api/executive/pipeline.js',
      '../api/executive/alerts.js',
      '../api/executive/kpis.js',
      '../api/executive/chat.js',
      '../api/index.js'
    ];

    for (const ep of serverlessEndpoints) {
      const mod = await import(ep);
      assert.strictEqual(typeof mod.default, 'function', `${ep} default export must be a function`);
    }
  });

  test('4. Vercel configuration vercel.json is valid and contains cleanUrls, redirects, rewrites, and headers', () => {
    assert.ok(fs.existsSync('vercel.json'));
    const raw = fs.readFileSync('vercel.json', 'utf8');
    const v = JSON.parse(raw);
    assert.strictEqual(v.cleanUrls, true);
    assert.strictEqual(v.trailingSlash, false);
    assert.ok(Array.isArray(v.redirects), 'redirects must be an array');
    assert.ok(Array.isArray(v.rewrites), 'rewrites must be an array');
    assert.ok(Array.isArray(v.headers), 'headers must be an array');

    const dashboardRewrite = v.rewrites.find(r => r.source === '/dashboard');
    assert.ok(dashboardRewrite, 'Must have /dashboard rewrite to /api/dashboard.js');
    assert.strictEqual(dashboardRewrite.destination, '/api/dashboard.js');
  });

  test('5. Execute serverless handlers locally with mock requests', async () => {
    const mockRes = () => {
      let status = 200;
      let body = null;
      let headers = {};
      const res = {
        setHeader: (k, v) => { headers[k] = v; },
        status: (s) => { status = s; return res; },
        json: (j) => { body = j; return res; },
        send: (b) => { body = b; return res; },
        end: (b) => { if (b) body = b; return res; },
        _get: () => ({ status, body, headers })
      };
      return res;
    };

    // Health
    const healthMod = await import('../api/health.js');
    const rHealth = mockRes();
    await healthMod.default({ method: 'GET', headers: {} }, rHealth);
    assert.strictEqual(rHealth._get().status, 200);

    // Connectors
    const connMod = await import('../api/executive/connectors.js');
    const rConn = mockRes();
    await connMod.default({ method: 'GET', headers: { 'x-correlation-id': 'corr_test_infra' } }, rConn);
    assert.strictEqual(rConn._get().status, 200);
    assert.strictEqual(rConn._get().body.success, true);
    assert.ok(rConn._get().body.connectors.supabase);
    assert.ok(rConn._get().body.connectors.smtp);
    assert.ok(rConn._get().body.connectors.n8n);

    // Status
    const statusMod = await import('../api/executive/status.js');
    const rStatus = mockRes();
    await statusMod.default({ method: 'GET', headers: {} }, rStatus);
    assert.strictEqual(rStatus._get().status, 200);
    assert.strictEqual(rStatus._get().body.runtimeStatus, 'OPERATIONAL');

    // 6. Dedicated api/dashboard.js -> serves Command Center UI
    const dashMod = await import('../api/dashboard.js');
    const rDashDirect = mockRes();
    await dashMod.default({ method: 'GET', headers: {} }, rDashDirect);
    assert.strictEqual(rDashDirect._get().status, 200);
    assert.ok(typeof rDashDirect._get().body === 'string');
    assert.ok(rDashDirect._get().body.includes('Command Center') || rDashDirect._get().body.includes('RAIOC'));

    // 7. api/index.js on '/' -> MUST serve index.html (public website), NEVER the dashboard
    const indexMod = await import('../api/index.js');
    const rRoot = mockRes();
    await indexMod.default({ url: '/', method: 'GET', headers: {} }, rRoot);
    assert.strictEqual(rRoot._get().status, 200);
    assert.ok(typeof rRoot._get().body === 'string');
    assert.ok(rRoot._get().body.includes('Emanuel Rendas — Private Real Estate Advisory'), 'Root / must be the public website');
    assert.ok(!rRoot._get().body.includes('Command Center UI') && !rRoot._get().body.includes('RAIOC COMMAND CENTER'), 'Root / must NOT be the dashboard');

    // 8. api/index.js on '/dashboard' -> serves Command Center UI
    const rDashViaIndex = mockRes();
    await indexMod.default({ url: '/dashboard', method: 'GET', headers: {} }, rDashViaIndex);
    assert.strictEqual(rDashViaIndex._get().status, 200);
    assert.ok(typeof rDashViaIndex._get().body === 'string');
    assert.ok(rDashViaIndex._get().body.includes('Command Center') || rDashViaIndex._get().body.includes('RAIOC'));
  });
});
