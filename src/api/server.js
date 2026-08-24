/**
 * RAIOC OS - Web API Router & HTTP Dispatcher
 * Dispatches inbound requests from website frontend to IKL, Calculators, Assessment, and Telemetry services.
 */

import { createServer } from 'node:http';
import { handleIklRequest } from './routes/ikl-routes.js';
import { handleCalculatorRequest } from './routes/calculator-routes.js';
import { handleAssessmentSubmission } from './routes/assessment-routes.js';
import { handleLeadSubmission } from './routes/lead-routes.js';
import { handleTelemetryRequest } from './routes/telemetry-routes.js';
import { logger } from '../logging/audit-logger.js';

export async function routeApiRequest(reqPath, method = 'GET', body = {}, query = {}) {
  const url = reqPath.split('?')[0];

  // 1. IKL Endpoints
  if (url.startsWith('/api/ikl')) {
    return await handleIklRequest(url, query);
  }

  // 2. Calculator Endpoints
  if (url.startsWith('/api/calculators')) {
    return await handleCalculatorRequest(url, body);
  }

  // 3. Assessment Submission
  if (url.startsWith('/api/assessment') || url.startsWith('/api/dira')) {
    return await handleAssessmentSubmission(body);
  }

  // 4. Lead Submission
  if (url.startsWith('/api/lead') || url.startsWith('/api/brief')) {
    return await handleLeadSubmission(body);
  }

  // 5. Dashboard & Telemetry
  if (url.startsWith('/api/dashboard') || url.startsWith('/api/telemetry') || url === '/health' || url === '/api/health') {
    return await handleTelemetryRequest(url);
  }

  return { status: 404, body: { error: `Endpoint not found: ${url}` } };
}

/**
 * Starts a native standalone HTTP server for local testing and containerized deployments
 */
export function startApiServer(port = 3000) {
  const server = createServer(async (req, res) => {
    // Enable CORS for frontend integration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let body = {};
    if (req.method === 'POST') {
      try {
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const raw = Buffer.concat(buffers).toString();
        if (raw) body = JSON.parse(raw);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }
    }

    const response = await routeApiRequest(req.url, req.method, body);
    res.writeHead(response.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response.body));
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      logger.info('API_SERVER', `RAIOC Web API server listening on http://localhost:${port}`);
      resolve(server);
    });
  });
}
