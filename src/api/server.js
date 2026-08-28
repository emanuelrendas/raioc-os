/**
 * RAIOC OS - Web API Router & HTTP Dispatcher (Sprint 3 & Security Hardened)
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
import { handleMissionControlV1State } from './mission-control/v1-state.js';
import { handleRegistryRequest } from './core/registry.js';
import { handleKnowledgeRequest } from './core/knowledge.js';
import { handleRuntimeTelemetryRequest } from './runtime/telemetry.js';
import { handleEventsRequest } from './events/router.js';
import { handleMemoryAdrRequest } from './memory/adr.js';
import { handleTelegramWebhookRequest } from './v1/channels/telegram.js';
import { handleWhatsAppWebhookRequest } from './v1/channels/whatsapp.js';
import { handleDocumentIntakeRequest } from './v1/intake/document.js';
import { handleVoiceCommunicationRequest } from './v1/communication/voice.js';
import { handleVoiceConversationRequest } from './routes/voice-routes.js';
import { argosMarketIntelligence } from '../core/argos-market-intelligence.js';
import { corridorProjectionEngine } from './analytics/corridor-projections.js';
import { cognitiveRouter } from '../core/cognitive-router.js';
import { enterpriseEventRouter } from '../core/event-router.js';
import { renderExecutiveBriefHtml } from '../site/brief-viewer-html.js';
import { renderMissionControlHtml } from '../site/mission-control-html.js';
import { supabase } from '../db/supabase-client.js';
import { correlationTracer } from '../monitoring/correlation-tracer.js';
import { metricsCollector } from '../monitoring/metrics-collector.js';
import { agentEventBus } from '../events/agent-event-bus.js';
import { executiveDashboard } from '../operational/executive-dashboard.js';
import { connectorHealthMatrix } from '../monitoring/connector-health-matrix.js';
import { memoryRssMonitor } from '../monitoring/memory-rss-monitor.js';
import { agentDirectory } from '../agents/agent-directory.js';
import { jarvis } from '../agents/specialists/jarvis-orchestrator.js';
import { sentinelMeshMonitor } from '../core/sentinel-mesh-monitor.js';
import { distributedScheduler } from '../core/distributed-scheduler.js';
import { authMiddleware, Roles } from '../security/auth-middleware.js';
import { logger } from '../logging/audit-logger.js';

export async function routeApiRequest(reqPath, method = 'GET', body = {}, query = {}, headers = {}) {
  let effectivePath = reqPath;
  let effectiveMethod = method;
  let effectiveBody = body;
  let effectiveQueryInput = query;
  let effectiveHeaders = headers;

  if (typeof reqPath === 'object' && reqPath !== null) {
    effectivePath = reqPath.url || reqPath.path || '/';
    effectiveMethod = reqPath.method || 'GET';
    effectiveBody = reqPath.body || {};
    effectiveQueryInput = reqPath.query || {};
    effectiveHeaders = reqPath.headers || {};
  }

  const url = String(effectivePath).split('?')[0];
  const queryString = String(effectivePath).includes('?') ? String(effectivePath).split('?')[1] : '';
  const parsedQuery = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};
  const effectiveQuery = { ...parsedQuery, ...effectiveQueryInput };
  const startTime = Date.now();
  const correlationId = effectiveHeaders['x-correlation-id'] || effectiveHeaders['X-Correlation-ID'] || correlationTracer.generateCorrelationId('api');

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
      const auth = authMiddleware.authenticateRequest(effectiveHeaders, [Roles.ADMIN, Roles.AGENT]);
      if (!auth.authenticated) {
        response = {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          body: { success: false, error: 'Unauthorized: Mission Control requires authentication', details: auth.error },
        };
      } else {
        const html = renderMissionControlHtml();
        response = {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          body: html,
        };
      }
    }
    // 0c. Liveness & Resource Healthcheck (/healthz, /api/healthz)
    else if (url === '/healthz' || url === '/api/healthz') {
      const mem = memoryRssMonitor.getMemoryMetrics();
      const activeAgents = agentDirectory.listAgents().length;
      const loopStatus = {
        jarvis_loop: Boolean(jarvis.isLoopRunning),
        jarvis_orchestration: Boolean(jarvis.isLoopRunning),
        sentinel_prober: Boolean(sentinelMeshMonitor.isProbingActive),
        sentinel_monitoring: Boolean(sentinelMeshMonitor.isProbingActive),
        distributed_scheduler: Boolean(distributedScheduler.isRunning),
      };

      response = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          status: 'OK',
          uptime: Math.round(process.uptime() * 100) / 100,
          memory_rss_mb: mem.rssMb,
          memory_metrics: mem,
          active_agents_count: activeAgents,
          loop_status: loopStatus,
          runtime_mode: process.env.RUNTIME_MODE || 'development',
          timestamp: new Date().toISOString(),
        },
      };
    }
    // 1. Dashboard UI, Executive Telemetry & Chat (/dashboard, /api/chat, /api/dashboard/*, /api/executive/*, /api/telemetry/*)
    else if (url === '/dashboard' || url === '/api/chat' || url.startsWith('/api/chat') || url.startsWith('/api/dashboard') || url.startsWith('/api/telemetry') || url.startsWith('/api/executive')) {
      const auth = authMiddleware.authenticateRequest(effectiveHeaders, [Roles.ADMIN, Roles.AGENT]);
      if (!auth.authenticated) {
        response = {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          body: {
            success: false,
            error: 'Unauthorized: Authentication required for executive/telemetry resources',
            details: auth.error,
          },
        };
      } else {
        response = await handleTelemetryRequest(url, { headers: effectiveHeaders, query: effectiveQuery, body });
      }
    }
    // 1b. Public Health Endpoint (/health, /api/health)
    else if (url === '/health' || url === '/api/health') {
      response = await handleTelemetryRequest(url, { headers: effectiveHeaders, query: effectiveQuery, body });
    }
    // 2a. ARGOS DLD Transaction Ingestion & Whale Alerts (/api/v1/market/dld-sync, /api/market/dld-sync)
    else if (url.startsWith('/api/v1/market/dld-sync') || url.startsWith('/api/market/dld-sync')) {
      if (method === 'POST') {
        const rawTransactions = body.transactions || body.data || (body.priceAed || body.price || body.corridor ? [body] : []);
        const result = await argosMarketIntelligence.processBatch(rawTransactions, {
          correlationId,
          traceparent: headers.traceparent,
        });
        response = { status: 200, body: { success: true, agent: 'ARGOS', ...result } };
      } else {
        const whaleAlerts = argosMarketIntelligence.getWhaleAlerts(20);
        const recentTransactions = argosMarketIntelligence.getRecentTransactions(50);
        response = { status: 200, body: { success: true, whaleAlertCount: whaleAlerts.length, whaleAlerts, recentTransactions } };
      }
    }
    // 2b. Corridor Analytical Projections (/api/v1/analytics/corridor-insights, /api/analytics/corridor-insights)
    else if (url.startsWith('/api/v1/analytics/corridor-insights') || url.startsWith('/api/analytics/corridor-insights')) {
      const corridor = effectiveQuery.corridor || effectiveQuery.community || body.corridor || 'all';
      const insights = corridorProjectionEngine.getCorridorInsights(corridor);
      response = { status: 200, body: insights };
    }
    // 2c. DLD Market Data
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
    // 5. Document & Lead Intake (/api/v1/intake/document, /api/intake/document, /api/intake)
    else if (url.startsWith('/api/v1/intake/document') || url.startsWith('/api/intake/document')) {
      response = await handleDocumentIntakeRequest(url, method, body, effectiveQuery, headers);
    }
    // 5a. AIDA Voice AI Communication (/api/v1/communication/voice, /api/communication/voice)
    else if (url.startsWith('/api/v1/communication/voice') || url.startsWith('/api/communication/voice')) {
      response = await handleVoiceCommunicationRequest(url, method, body, effectiveQuery, headers);
    }
    // 5b. JARVIS Live Voice Realtime Conversation & Telemetry (/api/v1/voice/*, /api/voice/*)
    else if (url.startsWith('/api/v1/voice') || url.startsWith('/api/voice')) {
      response = await handleVoiceConversationRequest(url, method, body, effectiveQuery, headers);
    }
    else if (url === '/api/intake' || url.startsWith('/api/intake/')) {
      response = await handleIntakeRequest(method, body);
    }
    // 6. IKL Endpoints
    else if (url.startsWith('/api/v1/ikl') || url.startsWith('/api/ikl')) {
      response = await handleIklRequest(url, method, body, effectiveQuery);
    }
    // 7. Property Calculators
    else if (url.startsWith('/api/v1/calculators') || url.startsWith('/api/calculators')) {
      response = await handleCalculatorRequest(url, method, body);
    }
    // 8. Lead Assessment Submissions (DIRA)
    else if (url.startsWith('/api/v1/assessment') || url.startsWith('/api/assessment')) {
      response = await handleAssessmentSubmission(body, effectiveQuery);
    }
    // 9. Lead Submissions & Capture
    else if (url.startsWith('/api/v1/leads') || url.startsWith('/api/leads') || url.startsWith('/api/lead')) {
      response = await handleLeadSubmission(body, method, effectiveQuery);
    }
    // 9a. CRM Sync & Direct Webhook Relay
    else if (url.startsWith('/api/v1/crm') || url.startsWith('/api/crm')) {
      response = await handleCrmRequest(url, method, body, effectiveQuery, headers);
    }
    // 9b. AI Reasoning Tools & Multimodal Engine (Opal, Mixboard, Flow, Pitch Deck)
    else if (url.startsWith('/api/v1/tools') || url.startsWith('/api/tools')) {
      response = await handleAiToolsRequest(url, method, body, effectiveQuery, headers);
    }
    // 10. Mission Control APIs (Fleet, Approvals, Interactions, State)
    else if (url.startsWith('/api/v1/mission-control/fleet') || url.startsWith('/api/mission-control/fleet')) {
      response = await handleFleetRequest(method, body, effectiveHeaders);
    }
    else if (url.startsWith('/api/v1/mission-control/approvals') || url.startsWith('/api/mission-control/approvals')) {
      response = await handleApprovalsRequest(method, body, effectiveHeaders);
    }
    else if (url.startsWith('/api/v1/mission-control/interactions') || url.startsWith('/api/mission-control/interactions')) {
      response = await handleInteractionsRequest(effectiveQuery, effectiveHeaders);
    }
    else if (url.startsWith('/api/v1/mission-control/state') || url.startsWith('/api/mission-control/state')) {
      response = await handleMissionControlV1State(effectiveHeaders);
    }
    // 10b. Core Registries & Enterprise Knowledge Graph
    else if (url.startsWith('/api/v1/core/registries') || url.startsWith('/api/core/registries')) {
      response = await handleRegistryRequest(url, method, body, effectiveHeaders);
    }
    else if (url.startsWith('/api/v1/core/knowledge') || url.startsWith('/api/core/knowledge')) {
      response = await handleKnowledgeRequest(url, method, body, effectiveHeaders);
    }
    // 10c. Runtime Telemetry Registry & ADR Catalog
    else if (url.startsWith('/api/v1/runtime/telemetry') || url.startsWith('/api/runtime/telemetry')) {
      response = await handleRuntimeTelemetryRequest(url, method, body, effectiveHeaders);
    }
    else if (url.startsWith('/api/v1/memory/adr') || url.startsWith('/api/memory/adr')) {
      response = await handleMemoryAdrRequest(url, method, body, effectiveHeaders);
    }
    // 10d. Enterprise Event Router
    else if (url.startsWith('/api/v1/events') || url.startsWith('/api/events')) {
      response = await handleEventsRequest(url, method, body, effectiveHeaders);
    }
    // 11. Webhook Endpoints (n8n & WhatsApp)
    else if (url.startsWith('/api/v1/webhooks') || url.startsWith('/api/webhooks')) {
      response = await handleWebhookRequest(url, method, body, effectiveQuery, headers);
    }
    // 11b. Channel Webhooks: Telegram Ingestion (/api/v1/channels/telegram/webhook, /api/channels/telegram/webhook)
    else if (url.startsWith('/api/v1/channels/telegram') || url.startsWith('/api/channels/telegram')) {
      response = await handleTelegramWebhookRequest(url, method, body, effectiveQuery, headers);
    }
    // 11c. Channel Webhooks: WhatsApp Cloud API Ingestion (/api/v1/channels/whatsapp/webhook, /api/channels/whatsapp/webhook)
    else if (url.startsWith('/api/v1/channels/whatsapp') || url.startsWith('/api/channels/whatsapp')) {
      response = await handleWhatsAppWebhookRequest(url, method, body, effectiveQuery, headers);
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
        'Permissions-Policy': 'microphone=*, camera=(), geolocation=()',
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
    res.setHeader('Permissions-Policy', 'microphone=*, camera=(), geolocation=()');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    // --- Realtime SSE Stream Endpoint ---
    if (parsedUrl.pathname === '/api/dashboard/stream' || parsedUrl.pathname === '/api/realtime') {
      const auth = authMiddleware.authenticateRequest(req.headers, [Roles.ADMIN, Roles.AGENT]);
      if (!auth.authenticated) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Authentication required for realtime SSE stream' }));
        return;
      }

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
        if (raw) {
          body = JSON.parse(raw);
          body._rawBody = raw;
        }
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

// Auto-start API server when run directly (e.g. npm run dev)
if (process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('api\\server.js') || process.argv[1].endsWith('api/server.js'))) {
  const port = process.env.PORT || 3000;
  startApiServer(port);
}
