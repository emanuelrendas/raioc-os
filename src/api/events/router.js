/**
 * RAIOC OS - Enterprise CloudEvents v1.1 API Gateway (Sprint 2 Core)
 * Exposes event publication, recovery engine trigger, and audit log inspection.
 * 
 * Endpoints:
 * - POST /api/v1/events/publish
 * - POST /api/v1/events/reclaim
 * - GET  /api/v1/events
 */

import { enterpriseEventBus } from '../../core/event-bus.js';
import { recoveryEngine } from '../../core/recovery-engine.js';
import { supabase } from '../../db/supabase-client.js';
import { authMiddleware } from '../../security/auth-middleware.js';
import { logger } from '../../logging/audit-logger.js';

export async function handleEventsRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  // 1. POST /api/v1/events/publish
  if (url.includes('/events/publish')) {
    if (method !== 'POST') {
      return { status: 405, body: { success: false, error: `Method ${method} not allowed on /events/publish` } };
    }

    const auth = authMiddleware.authenticateRequest(headers);
    if (!auth.authenticated) {
      return { status: 401, body: { success: false, error: 'Unauthorized: Event publication requires authentication' } };
    }

    const { type, source, data, payload, correlationId, causationId, traceparent, timeoutThresholdSeconds } = body;

    if (!type || !source) {
      return { status: 400, body: { success: false, error: 'Event type and source are required' } };
    }

    const eventData = data || payload || {};
    const cloudEvent = await enterpriseEventBus.publishEvent(type, source, eventData, {
      correlationId: correlationId || headers['x-correlation-id'],
      causationId,
      traceparent: traceparent || headers.traceparent,
      timeoutThresholdSeconds,
    });

    return {
      status: 200,
      body: {
        success: true,
        event: cloudEvent,
      },
    };
  }

  // 2. POST /api/v1/events/reclaim
  if (url.includes('/events/reclaim')) {
    if (method !== 'POST') {
      return { status: 405, body: { success: false, error: `Method ${method} not allowed on /events/reclaim` } };
    }

    const auth = authMiddleware.authenticateRequest(headers);
    if (!auth.authenticated) {
      return { status: 401, body: { success: false, error: 'Unauthorized: Event reclamation requires authentication' } };
    }

    const threshold = Number(body.staleThresholdSeconds || query.staleThresholdSeconds) || 300;
    const report = await recoveryEngine.reclaimStuckProcessingEvents(threshold);

    return {
      status: 200,
      body: {
        success: true,
        report,
      },
    };
  }

  // 3. GET /api/v1/events
  if (method === 'GET') {
    const limit = Number(query.limit) || 50;
    const filter = {
      status: query.status,
      event_type: query.event_type || query.type,
      correlation_id: query.correlation_id || query.correlationId,
      limit,
    };

    const events = await supabase.fetchEnterpriseEvents(filter);
    return {
      status: 200,
      body: {
        success: true,
        events,
        count: events.length,
        limit,
        timestamp: new Date().toISOString(),
      },
    };
  }

  return { status: 404, body: { success: false, error: `Events endpoint not found: ${url}` } };
}
