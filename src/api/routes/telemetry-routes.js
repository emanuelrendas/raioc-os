/**
 * RAIOC API - Telemetry & Dashboard Feed Routes (Sprint 3)
 * Provides real-time operational feeds, executive dashboards, connector matrices, and SSE Realtime streams.
 */

import { telemetry } from '../../logging/telemetry.js';
import { logger } from '../../logging/audit-logger.js';
import { ikl } from '../../core/ikl/index.js';
import { executiveDashboard } from '../../operational/executive-dashboard.js';
import { connectorHealthMatrix } from '../../monitoring/connector-health-matrix.js';
import { agentEventBus } from '../../events/agent-event-bus.js';
import { autonomousTaskManager } from '../../operational/autonomous-task-manager.js';
import { renderCommandCenterHtml } from '../../dashboard/command-center-html.js';

export async function handleTelemetryRequest(path, headers = {}) {
  const normalized = path.replace(/^\/api\/(dashboard|telemetry)\/?/, '');

  // 1. Executive Command Center UI (HTML)
  if (path === '/' || path === '/dashboard' || path === '/api/dashboard/ui') {
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      body: renderCommandCenterHtml(),
    };
  }

  // 2. Full Executive Dashboard Snapshot (JSON)
  if (normalized === 'executive' || normalized === 'overview' || normalized === '') {
    return {
      status: 200,
      body: executiveDashboard.getDashboardData(),
    };
  }

  // 3. Connector Health Matrix
  if (normalized === 'connectors' || normalized === 'connectors/health') {
    return {
      status: 200,
      body: {
        status: 'SUCCESS',
        connectors: connectorHealthMatrix.getAllConnectorHealth(),
        probedAt: new Date().toISOString(),
      },
    };
  }

  // 4. Tasks & Queue Status
  if (normalized === 'tasks' || normalized === 'queue') {
    return {
      status: 200,
      body: {
        queueStats: autonomousTaskManager.getQueueStats(),
        tasks: autonomousTaskManager.listTasks(),
      },
    };
  }

  // 5. Recent Event Stream
  if (normalized === 'events' || normalized === 'event-stream') {
    return {
      status: 200,
      body: {
        events: agentEventBus.getRecentEvents(null, 50),
      },
    };
  }

  // 6. Daily Executive Briefing
  if (normalized === 'briefing' || normalized === 'daily') {
    return {
      status: 200,
      body: executiveDashboard.getDailyBriefing(),
    };
  }

  // 7. Health Endpoint
  if (normalized === 'health' || path === '/health' || path === '/api/health') {
    const snapshot = telemetry.getSnapshot();
    return {
      status: 200,
      body: {
        status: snapshot.systemHealth,
        iklVersion: ikl.getVersion(),
        cycleCount: snapshot.cycleCount,
        leadsProcessed: snapshot.totalLeadsProcessed,
        latenciesMs: snapshot.latenciesMs,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 8. Metrics Snapshot
  if (normalized === 'metrics' || normalized === 'snapshot') {
    return {
      status: 200,
      body: telemetry.getSnapshot(),
    };
  }

  // 9. Audit Logs
  if (normalized === 'audit' || normalized === 'logs') {
    return {
      status: 200,
      body: {
        logs: logger.getRecentLogs(50),
      },
    };
  }

  return { status: 404, body: { error: `Unknown telemetry endpoint: ${path}` } };
}
