/**
 * Probes https://www.emanuelrendas.com with real POST/GET payloads.
 */

async function probeWebsite() {
  console.log('=== PROBING LIVE PRODUCTION WEBSITE: https://www.emanuelrendas.com ===\n');

  // 1. Root page
  try {
    const t0 = Date.now();
    const res = await fetch('https://www.emanuelrendas.com');
    console.log(`GET /: ${res.status} ${res.statusText} (${Date.now() - t0}ms)`);
  } catch (err) {
    console.log(`GET /: ERROR ${err.message}`);
  }

  // 2. Health endpoint
  try {
    const t0 = Date.now();
    const res = await fetch('https://www.emanuelrendas.com/api/health');
    const text = await res.text();
    console.log(`GET /api/health: ${res.status} (${Date.now() - t0}ms) -> ${text}`);
  } catch (err) {
    console.log(`GET /api/health: ERROR ${err.message}`);
  }

  // 3. POST /api/leads
  try {
    const t0 = Date.now();
    const res = await fetch('https://www.emanuelrendas.com/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'RAIOC Production Probe',
        email: 'probe@emanuelrendas.com',
        phone: '+971501234567',
        timeline: 'immediate',
      }),
    });
    const text = await res.text();
    console.log(`POST /api/leads: ${res.status} (${Date.now() - t0}ms) -> ${text}`);
  } catch (err) {
    console.log(`POST /api/leads: ERROR ${err.message}`);
  }

  // 4. POST /api/assessments
  try {
    const t0 = Date.now();
    const res = await fetch('https://www.emanuelrendas.com/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'RAIOC Production Probe',
        email: 'probe@emanuelrendas.com',
        company_size: '50-200',
        ai_maturity: 'in_production',
      }),
    });
    const text = await res.text();
    console.log(`POST /api/assessments: ${res.status} (${Date.now() - t0}ms) -> ${text}`);
  } catch (err) {
    console.log(`POST /api/assessments: ERROR ${err.message}`);
  }
}

probeWebsite();
