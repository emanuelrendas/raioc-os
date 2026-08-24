/**
 * RAIOC API - Telemetry & Dashboard Feed Routes
 * Provides real-time operational feeds, executive dashboards, and daily intelligence briefings.
 */

import { telemetry } from '../../logging/telemetry.js';
import { logger } from '../../logging/audit-logger.js';
import { ikl } from '../../core/ikl/index.js';
import { executiveDashboard } from '../../operational/executive-dashboard.js';

export async function handleTelemetryRequest(path) {
  const normalized = path.replace(/^\/api\/(dashboard|telemetry)\/?/, '');

  // 1. Full Executive Dashboard
  if (normalized === 'executive' || normalized === 'overview') {
    return {
      status: 200,
      body: executiveDashboard.getDashboardData(),
    };
  }

  // 2. Daily Executive Briefing
  if (normalized === 'briefing' || normalized === 'daily') {
    return {
      status: 200,
      body: executiveDashboard.getDailyBriefing(),
    };
  }

  // 3. Health Endpoint
  if (normalized === 'health' || normalized === '' || path === '/health' || path === '/api/health') {
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

  // 4. Metrics Snapshot
  if (normalized === 'metrics' || normalized === 'snapshot') {
    return {
      status: 200,
      body: telemetry.getSnapshot(),
    };
  }

  // 5. Audit Logs
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
