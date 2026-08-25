/**
 * Probe live production endpoints on https://www.emanuelrendas.com
 */

const BASE_URL = 'https://www.emanuelrendas.com';

async function probe() {
  console.log('====================================================');
  console.log(`  PROBING PRODUCTION DEPLOYMENT: ${BASE_URL}`);
  console.log('====================================================\n');

  // 1. GET /api/health
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/health`);
    const lat = Date.now() - t0;
    const body = await res.text();
    console.log(`[GET /api/health] -> HTTP ${res.status} (${lat}ms)`);
    console.log(`Headers:`, Object.fromEntries(res.headers.entries()));
    console.log(`Body:\n${body.substring(0, 500)}\n`);
  } catch (e) {
    console.error(`[GET /api/health] FAILED: ${e.message}\n`);
  }

  // 2. GET /api/test-email
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/test-email?to=privateadvisory@emanuelrendas.com`);
    const lat = Date.now() - t0;
    const body = await res.text();
    console.log(`[GET /api/test-email] -> HTTP ${res.status} (${lat}ms)`);
    console.log(`Headers:`, Object.fromEntries(res.headers.entries()));
    console.log(`Body:\n${body.substring(0, 500)}\n`);
  } catch (e) {
    console.error(`[GET /api/test-email] FAILED: ${e.message}\n`);
  }

  // 3. GET / (Homepage)
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/`);
    const lat = Date.now() - t0;
    console.log(`[GET /] -> HTTP ${res.status} (${lat}ms)`);
    console.log(`Headers:`, Object.fromEntries(res.headers.entries()));
  } catch (e) {
    console.error(`[GET /] FAILED: ${e.message}\n`);
  }
}

probe();
