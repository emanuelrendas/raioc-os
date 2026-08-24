/**
 * RAIOC API - Telemetry & Dashboard Feed Routes (Sprint 3)
 * Provides real-time operational feeds, executive dashboards, connector matrices, SSE Realtime streams,
 * and live diagnostic endpoints (/api/test-email).
 */

import { telemetry } from '../../logging/telemetry.js';
import { logger } from '../../logging/audit-logger.js';
import { ikl } from '../../core/ikl/index.js';
import { executiveDashboard } from '../../operational/executive-dashboard.js';
import { connectorHealthMatrix } from '../../monitoring/connector-health-matrix.js';
import { agentEventBus } from '../../events/agent-event-bus.js';
import { autonomousTaskManager } from '../../operational/autonomous-task-manager.js';
import { renderCommandCenterHtml } from '../../dashboard/command-center-html.js';
import { emailAdapter } from '../../adapters/email-adapter.js';

export async function handleTelemetryRequest(path, context = {}) {
  const normalized = path.replace(/^\/api\/(dashboard|telemetry)\/?/, '');

  // 1. Live Diagnostic SMTP Endpoint: /api/test-email
  if (path === '/api/test-email' || normalized === 'test-email') {
    const query = context.query || {};
    const body = context.body || {};
    const to = query.to || body.to || 'privateadvisory@emanuelrendas.com';
    const subject = query.subject || body.subject || 'RAIOC — SMTP Live Operational Verification';
    const customMessage = query.message || body.message || 'RAIOC Autonomous Operating System — Live Production Test Email';

    const cfg = emailAdapter.getSmtpConfig();

    try {
      // Require live delivery (will verify connection and send or throw real error)
      const result = await emailAdapter.dispatch(
        {
          id: `diag_live_${Date.now()}`,
          recipient: to,
          payload: {
            subject,
            body: `${customMessage}\n\nRecipient: ${to}\nTransport: Namecheap PrivateEmail (SMTP / Nodemailer)\nHost: ${cfg.host}:${cfg.port} (SSL: ${cfg.secure})\nFrom: ${cfg.from}\nTimestamp: ${new Date().toISOString()}\n\nStatus: VERIFIED_OPERATIONAL`,
          },
        },
        { requireLiveSend: true }
      );

      return {
        status: 200,
        body: {
          success: true,
          endpoint: '/api/test-email',
          recipient: to,
          smtpDiagnostics: {
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            from: cfg.from,
            userLoaded: Boolean(cfg.user),
            user: cfg.user ? cfg.user : '[NOT SET]',
            passwordExists: Boolean(cfg.password),
            passwordLength: cfg.password ? cfg.password.length : 0,
          },
          dispatchResult: {
            status: result.status,
            smtpVerified: result.smtpVerified,
            accepted: result.accepted || [],
            rejected: result.rejected || [],
            response: result.response,
            messageId: result.messageId,
            envelope: result.envelope,
          },
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      logger.error('TELEMETRY_ROUTES', `Live SMTP test failed: ${err.message}`, {
        code: err.code,
        command: err.command,
        response: err.response,
        stack: err.stack,
      });

      return {
        status: 500,
        body: {
          success: false,
          endpoint: '/api/test-email',
          recipient: to,
          smtpDiagnostics: {
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            from: cfg.from,
            userLoaded: Boolean(cfg.user),
            user: cfg.user ? cfg.user : '[NOT SET]',
            passwordExists: Boolean(cfg.password),
            passwordLength: cfg.password ? cfg.password.length : 0,
          },
          error: {
            message: err.message,
            code: err.code || 'UNKNOWN_ERROR',
            command: err.command || null,
            response: err.response || null,
            responseCode: err.responseCode || null,
            stack: err.stack,
          },
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // 2. Executive Command Center UI (HTML)
  if (path === '/' || path === '/dashboard' || path === '/api/dashboard/ui') {
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      body: renderCommandCenterHtml(),
    };
  }

  // 3. Full Executive Dashboard Snapshot (JSON)
  if (normalized === 'executive' || normalized === 'overview' || normalized === '') {
    return {
      status: 200,
      body: executiveDashboard.getDashboardData(),
    };
  }

  // 4. Connector Health Matrix
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

  // 5. Tasks & Queue Status
  if (normalized === 'tasks' || normalized === 'queue') {
    return {
      status: 200,
      body: {
        queueStats: autonomousTaskManager.getQueueStats(),
        tasks: autonomousTaskManager.listTasks(),
      },
    };
  }

  // 6. Recent Event Stream
  if (normalized === 'events' || normalized === 'event-stream') {
    return {
      status: 200,
      body: {
        events: agentEventBus.getRecentEvents(null, 50),
      },
    };
  }

  // 7. Daily Executive Briefing
  if (normalized === 'briefing' || normalized === 'daily') {
    return {
      status: 200,
      body: executiveDashboard.getDailyBriefing(),
    };
  }

  // 8. Health Endpoint
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

  // 9. Metrics Snapshot
  if (normalized === 'metrics' || normalized === 'snapshot') {
    return {
      status: 200,
      body: telemetry.getSnapshot(),
    };
  }

  // 10. Audit Logs
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
