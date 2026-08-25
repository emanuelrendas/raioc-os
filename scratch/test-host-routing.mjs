/**
 * RAIOC OS - Host-Based Routing Verification Test
 * Tests unified serverless entrypoint (api/index.js) with:
 * 1. Host: dashboard.emanuelrendas.com -> Dashboard HTML
 * 2. Host: www.emanuelrendas.com -> Institutional Landing Page HTML
 * 3. Host: api.emanuelrendas.com -> Executive API JSON
 */

import assert from 'node:assert/strict';
import serverlessHandler from '../api/index.js';

async function mockInvoke({ host, url = '/', method = 'GET', body = {} }) {
  let statusCode = 0;
  let headersSet = {};
  let responseBody = '';

  const req = {
    method,
    url,
    headers: {
      host,
      'x-forwarded-host': host,
    },
    query: {
      __path: url,
    },
    body,
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(name, val) {
      headersSet[name] = val;
    },
    send(data) {
      responseBody = data;
      return this;
    },
    end(data) {
      if (data) responseBody = data;
      return this;
    },
  };

  await serverlessHandler(req, res);
  return { status: statusCode, headers: headersSet, body: responseBody };
}

async function runTests() {
  console.log('================================================================================');
  console.log('🌐 TESTING HOST-BASED ROUTING VIA UNIFIED SERVERLESS GATEWAY (api/index.js)');
  console.log('================================================================================\n');

  // Test 1: dashboard.emanuelrendas.com
  console.log('▶ Test 1: Host: dashboard.emanuelrendas.com at path "/"');
  const dashRes = await mockInvoke({ host: 'dashboard.emanuelrendas.com', url: '/' });
  assert.strictEqual(dashRes.status, 200, `Expected status 200, got ${dashRes.status}`);
  assert.ok(dashRes.headers['Content-Type'].includes('text/html'), 'Expected text/html content-type');
  const hasDashboardMarkers = dashRes.body.includes('Executive Command Center') || dashRes.body.includes('Mission Control') || dashRes.body.includes('RAIOC');
  assert.ok(hasDashboardMarkers, 'Dashboard HTML must contain Command Center / Mission Control markers');
  
  // Extract Title from Dashboard HTML
  const dashTitleMatch = dashRes.body.match(/<title>([^<]+)<\/title>/i);
  const dashTitle = dashTitleMatch ? dashTitleMatch[1] : 'Unknown Title';
  console.log(`  ✔ HTTP ${dashRes.status} | Content-Type: ${dashRes.headers['Content-Type']}`);
  console.log(`  ✔ Title: "${dashTitle}"`);
  console.log(`  ✔ HTML Length: ${dashRes.body.length} bytes\n`);

  // Test 2: www.emanuelrendas.com
  console.log('▶ Test 2: Host: www.emanuelrendas.com at path "/"');
  const webRes = await mockInvoke({ host: 'www.emanuelrendas.com', url: '/' });
  assert.strictEqual(webRes.status, 200, `Expected status 200, got ${webRes.status}`);
  assert.ok(webRes.headers['Content-Type'].includes('text/html'), 'Expected text/html content-type');
  assert.ok(webRes.body.includes('Emanuel Rendas'), 'Website HTML must contain Emanuel Rendas');
  const webTitleMatch = webRes.body.match(/<title>([^<]+)<\/title>/i);
  const webTitle = webTitleMatch ? webTitleMatch[1] : 'Unknown Title';
  console.log(`  ✔ HTTP ${webRes.status} | Content-Type: ${webRes.headers['Content-Type']}`);
  console.log(`  ✔ Title: "${webTitle}"`);
  console.log(`  ✔ HTML Length: ${webRes.body.length} bytes\n`);

  // Test 3: api.emanuelrendas.com
  console.log('▶ Test 3: Host: api.emanuelrendas.com at path "/"');
  const apiRes = await mockInvoke({ host: 'api.emanuelrendas.com', url: '/' });
  assert.strictEqual(apiRes.status, 200, `Expected status 200, got ${apiRes.status}`);
  assert.ok(apiRes.headers['Content-Type'].includes('application/json'), 'Expected application/json content-type');
  const apiData = typeof apiRes.body === 'string' ? JSON.parse(apiRes.body) : apiRes.body;
  assert.ok(apiData.ok !== false || apiData.status, 'API response must contain status payload');
  console.log(`  ✔ HTTP ${apiRes.status} | Content-Type: ${apiRes.headers['Content-Type']}`);
  console.log(`  ✔ Payload Status: ${JSON.stringify(apiData).slice(0, 100)}...\n`);

  console.log('================================================================================');
  console.log('✅ ALL HOST-BASED ROUTING SIMULATIONS PASSED SUCCESSFULLY');
  console.log('================================================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
