import { routeApiRequest } from '../src/api/server.js';

async function testAllRoutes() {
  console.log('--- Testing RAIOC OS routes locally ---');

  const r1 = await routeApiRequest('/api/health', 'GET');
  console.log('/api/health:', r1.status, r1.body);

  const r2 = await routeApiRequest('/api/test-email', 'GET', {}, { to: 'privateadvisory@emanuelrendas.com' });
  console.log('/api/test-email:', r2.status, r2.body);

  const r3 = await routeApiRequest('/api/dashboard/overview', 'GET');
  console.log('/api/dashboard/overview:', r3.status, r3.body?.status);

  const r4 = await routeApiRequest('/api/dashboard/connectors', 'GET');
  console.log('/api/dashboard/connectors:', r4.status, r4.body?.connectors?.length);
}

testAllRoutes();
