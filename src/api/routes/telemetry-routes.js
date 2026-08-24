/**
 * RAIOC API - Telemetry & Dashboard Feed Routes
 * Provides real-time operational feeds, health status, and execution metrics to frontend dashboards.
 */

import { telemetry } from '../../logging/telemetry.js';
import { logger } from '../../logging/audit-logger.js';
import { ikl } from '../../core/ikl/index.js';

export async function handleTelemetryRequest(path) {
  const normalized = path.replace(/^\/api\/(dashboard|telemetry)\/?/, '');

  if (normalized === 'health' || normalized === '') {
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

  if (normalized === 'metrics' || normalized === 'snapshot') {
    return {
      status: 200,
      body: telemetry.getSnapshot(),
    };
  }

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
