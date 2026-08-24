/**
 * RAIOC OS - Web API Router & HTTP Dispatcher (Sprint 2 Updated)
 * Dispatches inbound requests from website frontend, n8n, Meta WhatsApp, and autonomous agents.
 */

import { createServer } from 'node:http';
import { handleIklRequest } from './routes/ikl-routes.js';
import { handleCalculatorRequest } from './routes/calculator-routes.js';
import { handleAssessmentSubmission } from './routes/assessment-routes.js';
import { handleLeadSubmission } from './routes/lead-routes.js';
import { handleTelemetryRequest } from './routes/telemetry-routes.js';
import { handleWebhookRequest } from './routes/webhook-routes.js';
import { handleAgentRequest } from './routes/agent-routes.js';
import { correlationTracer } from '../monitoring/correlation-tracer.js';
import { metricsCollector } from '../monitoring/metrics-collector.js';
import { logger } from '../logging/audit-logger.js';

export async function routeApiRequest(reqPath, method = 'GET', body = {}, query = {}, headers = {}) {
  const url = reqPath.split('?')[0];
  const startTime = Date.now();
  const correlationId = headers['x-correlation-id'] || headers['X-Correlation-ID'] || correlationTracer.generateCorrelationId('api');

  metricsCollector.incrementCounter('http_requests_total');

  return await correlationTracer.runWithContext({ correlationId }, async () => {
    let response;

    // 1. IKL Endpoints
    if (url.startsWith('/api/ikl')) {
      response = await handleIklRequest(url, query);
    }
    // 2. Calculator Endpoints
    else if (url.startsWith('/api/calculators')) {
      response = await handleCalculatorRequest(url, body);
    }
    // 3. Assessment Submission
    else if (url.startsWith('/api/assessment') || url.startsWith('/api/dira')) {
      response = await handleAssessmentSubmission(body);
    }
    // 4. Lead Submission
    else if (url.startsWith('/api/lead') || url.startsWith('/api/brief')) {
      response = await handleLeadSubmission(body);
    }
    // 5. Webhook Endpoints (n8n & WhatsApp)
    else if (url.startsWith('/api/webhooks')) {
      response = await handleWebhookRequest(url, method, body, query, headers);
    }
    // 6. Shared Agent API
    else if (url.startsWith('/api/agents')) {
      response = await handleAgentRequest(url, method, body, headers);
    }
    // 7. Dashboard & Telemetry
    else if (url.startsWith('/api/dashboard') || url.startsWith('/api/telemetry') || url === '/health' || url === '/api/health') {
      response = await handleTelemetryRequest(url);
    } else {
      response = { status: 404, body: { error: `Endpoint not found: ${url}` } };
    }

    const durationMs = Date.now() - startTime;
    metricsCollector.recordLatency(`http_${url.split('/')[2] || 'root'}`, durationMs);

    return {
      ...response,
      headers: {
        'X-Correlation-ID': correlationId,
      },
    };
  });
}

/**
 * Starts a native standalone HTTP server for local testing and containerized deployments
 */
export function startApiServer(port = 3000) {
  const server = createServer(async (req, res) => {
    // Enable CORS for frontend integration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Correlation-ID, X-N8N-Signature, X-Hub-Signature-256');

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

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    const response = await routeApiRequest(parsedUrl.pathname, req.method, body, query, req.headers);

    if (response.headers) {
      for (const [k, v] of Object.entries(response.headers)) {
        res.setHeader(k, v);
      }
    }

    const isRawString = typeof response.body === 'string';
    res.writeHead(response.status, {
      'Content-Type': isRawString ? 'text/plain' : 'application/json',
    });
    res.end(isRawString ? response.body : JSON.stringify(response.body));
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      logger.info('API_SERVER', `RAIOC Web API server listening on http://localhost:${port}`);
      resolve(server);
    });
  });
}
