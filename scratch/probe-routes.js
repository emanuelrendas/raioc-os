/**
 * Probes route patterns on https://www.emanuelrendas.com
 */

const routes = [
  { path: '/api/health', method: 'GET' },
  { path: '/api/lead', method: 'POST', body: { name: 'Audit', email: 'test@emanuelrendas.com' } },
  { path: '/api/assessment', method: 'POST', body: { email: 'test@emanuelrendas.com', score: 85 } },
  { path: '/api/contact', method: 'POST', body: { name: 'Audit', email: 'test@emanuelrendas.com', message: 'Hello' } },
  { path: '/api/submit-assessment', method: 'POST', body: { email: 'test@emanuelrendas.com' } },
  { path: '/api/dira', method: 'GET' },
  { path: '/api/riis', method: 'GET' },
  { path: '/assessment', method: 'GET' },
  { path: '/calculator', method: 'GET' },
];

async function probeRoutes() {
  for (const r of routes) {
    try {
      const t0 = Date.now();
      const res = await fetch(`https://www.emanuelrendas.com${r.path}`, {
        method: r.method,
        headers: r.body ? { 'Content-Type': 'application/json' } : {},
        body: r.body ? JSON.stringify(r.body) : undefined,
      });
      const latencyMs = Date.now() - t0;
      const text = await res.text();
      const preview = text.length > 80 ? text.substring(0, 80) + '...' : text;
      console.log(`${r.method} ${r.path}: ${res.status} (${latencyMs}ms) -> ${preview}`);
    } catch (err) {
      console.log(`${r.method} ${r.path}: ERROR (${err.message})`);
    }
  }
}

probeRoutes();
