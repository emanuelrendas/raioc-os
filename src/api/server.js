/**
 * RAIOC OS - Web API Router & HTTP Dispatcher (Sprint 3)
 * Dispatches inbound requests, serves the Executive Command Center, and manages SSE Realtime streams.
 */

import { createServer } from 'node:http';
import { handleIklRequest } from './routes/ikl-routes.js';
import { handleCalculatorRequest } from './routes/calculator-routes.js';
import { handleAssessmentSubmission } from './routes/assessment-routes.js';
import { handleLeadSubmission } from './routes/lead-routes.js';
import { handleTelemetryRequest } from './routes/telemetry-routes.js';
import { handleWebhookRequest } from './routes/webhook-routes.js';
import { handleAgentRequest } from './routes/agent-routes.js';
import { handleDldRequest } from './routes/dld-routes.js';
import { handleFxRequest } from './routes/fx-routes.js';
import { handleEventRequest } from './routes/event-routes.js';
import { handleIntakeRequest } from './routes/intake-routes.js';
import { handleAiToolsRequest } from './routes/ai-tools-routes.js';
import { handleSocialRequest } from './routes/social-routes.js';
import { handleCrmRequest } from './routes/crm-routes.js';
import { handleFleetRequest } from './mission-control/fleet.js';
import { handleApprovalsRequest } from './mission-control/approvals.js';
import { handleInteractionsRequest } from './mission-control/interactions.js';
import { handleRegistryRequest } from './core/registry.js';
import { handleKnowledgeRequest } from './core/knowledge.js';
import { handleRuntimeTelemetryRequest } from './runtime/telemetry.js';
import { handleEventsRequest } from './events/router.js';
import { handleMemoryAdrRequest } from './memory/adr.js';
import { cognitiveRouter } from '../core/cognitive-router.js';
import { renderExecutiveBriefHtml } from '../site/brief-viewer-html.js';
import { renderMissionControlHtml } from '../site/mission-control-html.js';
import { supabase } from '../db/supabase-client.js';
import { correlationTracer } from '../monitoring/correlation-tracer.js';
import { metricsCollector } from '../monitoring/metrics-collector.js';
import { agentEventBus } from '../events/agent-event-bus.js';
import { executiveDashboard } from '../operational/executive-dashboard.js';
import { connectorHealthMatrix } from '../monitoring/connector-health-matrix.js';
import { logger } from '../logging/audit-logger.js';

export async function routeApiRequest(reqPath, method = 'GET', body = {}, query = {}, headers = {}) {
  const url = reqPath.split('?')[0];
  const queryString = reqPath.includes('?') ? reqPath.split('?')[1] : '';
  const parsedQuery = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};
  const effectiveQuery = { ...parsedQuery, ...query };
  const startTime = Date.now();
  const correlationId = headers['x-correlation-id'] || headers['X-Correlation-ID'] || correlationTracer.generateCorrelationId('api');

  metricsCollector.incrementCounter('http_requests_total');

  return await correlationTracer.runWithContext({ correlationId }, async () => {
    let response;

    // 0. Dynamic Executive Brief Public Viewer (/brief/:id, /api/brief/:id)
    if ((url.startsWith('/brief') || url.startsWith('/api/brief/')) && method === 'GET') {
      const briefId = url.replace(/^\/(api\/)?brief\/?/, '').split('/')[0].split('?')[0];
      const briefRecord = await supabase.fetchExecutiveBriefById(briefId);
      const html = renderExecutiveBriefHtml(briefRecord || { id: briefId, companyName: 'Private Sovereign Client' });
      response = {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html,
      };
    }
    // 0b. Executive Mission Control UI (/admin/mission-control, /mission-control, /api/mission-control/ui)
    else if ((url === '/admin/mission-control' || url === '/mission-control' || url === '/api/mission-control/ui') && method === 'GET') {
      const html = renderMissionControlHtml();
      response = {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html,
      };
    }
    // 1. Dashboard UI, Executive Telemetry & Chat (/dashboard, /api/chat, /api/dashboard/*, /api/executive/*, /api/telemetry/*, /health, /api/health, /api/test-email)
    else if (url === '/dashboard' || url === '/api/test-email' || url === '/api/chat' || url.startsWith('/api/chat') || url.startsWith('/api/dashboard') || url.startsWith('/api/telemetry') || url.startsWith('/api/executive') || url === '/health' || url === '/api/health') {
      response = await handleTelemetryRequest(url, { headers, query: effectiveQuery, body });
    }
    // 2. DLD Market Data
    else if (url === '/api/dld' || url.startsWith('/api/dld/')) {
      response = await handleDldRequest();
    }
    // 3. FX Exchange Rates
    else if (url === '/api/fx' || url.startsWith('/api/fx/')) {
      response = await handleFxRequest();
    }
    // 4. Telemetry / Event Tracking
    else if (url === '/api/event' || url.startsWith('/api/event/')) {
      response = await handleEventRequest(method, body);
    }
    // 5. Multi-channel Intake
    else if (url === '/api/intake' || url.startsWith('/api/intake/')) {
      response = await handleIntakeRequest(method, body);
    }
    // 6. IKL Endpoints
    else if (url.startsWith('/api/ikl')) {
      response = await handleIklRequest(url, effectiveQuery);
    }
    // 7. Calculator Endpoints
    else if (url.startsWith('/api/calculators')) {
      response = await handleCalculatorRequest(url, body);
    }
    // 8. AI Tools Endpoints (Google Opal, Mixboard, Flow, Gemini Advisor) - Canonical /api/v1 and Legacy /api
    else if (url.startsWith('/api/v1/opal') || url.startsWith('/api/opal') || url.startsWith('/api/v1/mixboard') || url.startsWith('/api/mixboard') || url.startsWith('/api/v1/flow') || url.startsWith('/api/flow') || url.startsWith('/api/v1/ai') || url.startsWith('/api/ai')) {
      response = await handleAiToolsRequest(url, method, body, effectiveQuery, headers);
    }
    // 8a. Cognitive Multi-Tier Router (/api/v1/cognitive/dispatch, /api/cognitive/dispatch)
    else if (url.startsWith('/api/v1/cognitive/dispatch') || url.startsWith('/api/cognitive/dispatch') || url === '/api/v1/cognitive' || url === '/api/cognitive') {
      const prompt = body.prompt || body.message || body.context || effectiveQuery.prompt || '';
      const cogRes = await cognitiveRouter.dispatch(prompt, { ...effectiveQuery, ...body, correlationId });
      response = { status: 200, body: { success: true, ...cogRes } };
    }
    // 8b. Mission Control Fleet Telemetry (/api/v1/mission-control/fleet, /api/mission-control/fleet)
    else if (url.startsWith('/api/v1/mission-control/fleet') || url.startsWith('/api/mission-control/fleet')) {
      response = await handleFleetRequest(url, method, body, effectiveQuery, headers);
    }
    // 8c. Mission Control Executive Approvals (/api/v1/mission-control/approvals, /api/mission-control/approvals)
    else if (url.startsWith('/api/v1/mission-control/approvals') || url.startsWith('/api/mission-control/approvals')) {
      response = await handleApprovalsRequest(url, method, body, effectiveQuery, headers);
    }
    // 8d. Mission Control Ingestion Stream (/api/v1/mission-control/interactions, /api/mission-control/interactions)
    else if (url.startsWith('/api/v1/mission-control/interactions') || url.startsWith('/api/mission-control/interactions')) {
      response = await handleInteractionsRequest(url, method, body, effectiveQuery, headers);
    }
    // 8e. Enterprise Core Registries (/api/v1/core/agents, /api/v1/core/tools, /api/v1/core/workflows)
    else if (url.startsWith('/api/v1/core/agents') || url.startsWith('/api/core/agents') || url.startsWith('/api/v1/core/tools') || url.startsWith('/api/core/tools') || url.startsWith('/api/v1/core/workflows') || url.startsWith('/api/core/workflows')) {
      response = await handleRegistryRequest(url, method, body, effectiveQuery, headers);
    }
    // 8f. Enterprise Knowledge Graph (/api/v1/core/knowledge, /api/core/knowledge)
    else if (url.startsWith('/api/v1/core/knowledge') || url.startsWith('/api/core/knowledge')) {
      response = await handleKnowledgeRequest(url, method, body, effectiveQuery, headers);
    }
    // 8g. Runtime Telemetry Split (/api/v1/runtime/telemetry/*, /api/v1/runtime/health-matrix, /api/runtime/*)
    else if (url.startsWith('/api/v1/runtime') || url.startsWith('/api/runtime')) {
      response = await handleRuntimeTelemetryRequest(url, method, body, effectiveQuery, headers);
    }
    // 8h. CloudEvents v1.1 Store & Recovery (/api/v1/events/*, /api/events/*)
    else if (url.startsWith('/api/v1/events') || url.startsWith('/api/events')) {
      response = await handleEventsRequest(url, method, body, effectiveQuery, headers);
    }
    // 8i. Architectural Decision Records (/api/v1/memory/adr, /api/memory/adr)
    else if (url.startsWith('/api/v1/memory/adr') || url.startsWith('/api/memory/adr')) {
      response = await handleMemoryAdrRequest(url, method, body, effectiveQuery, headers);
    }
    // 9. Assessment Submission
    else if (url.startsWith('/api/assessment') || url.startsWith('/api/dira')) {
      response = await handleAssessmentSubmission(body);
    }
    // 10. Lead Submission
    else if (url.startsWith('/api/lead') || url.startsWith('/api/brief')) {
      response = await handleLeadSubmission(body);
    }
    // 10b. CRM & Ingestion Pipeline (/api/v1/crm, /api/crm)
    else if (url.startsWith('/api/v1/crm') || url.startsWith('/api/crm')) {
      response = await handleCrmRequest(url, method, body, effectiveQuery, headers);
    }
    // 11. Webhook Endpoints (n8n & WhatsApp)
    else if (url.startsWith('/api/v1/webhooks') || url.startsWith('/api/webhooks')) {
      response = await handleWebhookRequest(url, method, body, effectiveQuery, headers);
    }
    // 12. Shared Agent API
    else if (url.startsWith('/api/v1/agents') || url.startsWith('/api/agents')) {
      response = await handleAgentRequest(url, method, body, headers);
    }
    // 13. Social Media & Content Automation API
    else if (url.startsWith('/api/v1/social') || url.startsWith('/api/social')) {
      response = await handleSocialRequest(url, method, body, effectiveQuery, headers);
    } else {
      response = { status: 404, body: { error: `Endpoint not found: ${url}` } };
    }

    const durationMs = Date.now() - startTime;
    metricsCollector.recordLatency(`http_${url.split('/')[2] || 'root'}`, durationMs);

    // Compute deprecation header if calling unversioned legacy endpoint
    const isLegacyAlias = url.startsWith('/api/') && !url.startsWith('/api/v1/');
    const extraHeaders = isLegacyAlias
      ? {
          Deprecation: '@deprecated Use /api/v1/... instead',
          Link: `<${url.replace('/api/', '/api/v1/')}>; rel="canonical"`,
          Sunset: '2026-12-31',
        }
      : {};

    return {
      ...response,
      headers: {
        'Content-Type': response.headers?.['Content-Type'] || 'application/json',
        'X-Correlation-ID': correlationId,
        ...extraHeaders,
        ...(response.headers || {}),
      },
    };
  });
}

/**
 * Starts a native standalone HTTP server with SSE Realtime streaming support
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

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    // --- Realtime SSE Stream Endpoint ---
    if (parsedUrl.pathname === '/api/dashboard/stream' || parsedUrl.pathname === '/api/realtime') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Send initial snapshot
      const snapshot = executiveDashboard.getDashboardData();
      const connectors = connectorHealthMatrix.getAllConnectorHealth();
      res.write(`data: ${JSON.stringify({ type: 'SNAPSHOT', data: snapshot, connectors })}\n\n`);

      // Subscribe to real-time events on the bus
      const unsub = agentEventBus.subscribe('*', (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      // Keep connection alive with periodic heartbeat comment
      const keepAliveTimer = setInterval(() => {
        res.write(': ping\n\n');
      }, 15000);

      req.on('close', () => {
        clearInterval(keepAliveTimer);
        unsub();
      });
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

    const response = await routeApiRequest(parsedUrl.pathname, req.method, body, query, req.headers);

    if (response.headers) {
      for (const [k, v] of Object.entries(response.headers)) {
        res.setHeader(k, v);
      }
    }

    const contentType = response.headers?.['Content-Type'] || 'application/json';
    const isHtml = contentType.includes('text/html');
    const isRawString = typeof response.body === 'string';

    res.writeHead(response.status, {
      'Content-Type': contentType,
    });
    res.end(isHtml || isRawString ? response.body : JSON.stringify(response.body));
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      logger.info('API_SERVER', `RAIOC Executive Command Center & API server listening on http://localhost:${port}`);
      resolve(server);
    });
  });
}
