/**
 * RAIOC OS - Enterprise CloudEvents v1.1 Event Bus (Sprint 2 Core)
 * Provides distributed multi-agent event routing, W3C trace context forwarding,
 * cryptographic SHA256 payload hashing, and tamper-evident hash chaining.
 */

import { createHash, randomUUID } from 'node:crypto';
import { supabase } from '../db/supabase-client.js';
import { logger } from '../logging/audit-logger.js';

export class EnterpriseEventBus {
  constructor(options = {}) {
    this.handlers = new Map(); // eventType -> Set<Function>
    this.wildcardHandlers = new Set();
    this.eventLog = []; // In-memory ledger
    this.lastEventHash = options.initialHash || null;
    this.writeBehind = options.writeBehind !== false;
  }

  /**
   * Deterministically computes the SHA-256 hash of a payload or string
   * @param {any} payload 
   * @returns {string} Hex encoded SHA256
   */
  static computeSha256(payload) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Generates a standard W3C traceparent header if not supplied
   * Format: 00-{traceId}-{parentId}-{traceFlags}
   */
  static generateTraceparent() {
    const traceId = randomUUID().replace(/-/g, '');
    const parentId = randomUUID().replace(/-/g, '').substring(0, 16);
    return `00-${traceId}-${parentId}-01`;
  }

  /**
   * Publishes a CloudEvents v1.1 standard envelope
   * @param {string} type - CloudEvent type (e.g. 'lead.qualified', 'fleet.heartbeat')
   * @param {string} source - Originating agent or component URI
   * @param {Object} payload - Event data payload
   * @param {Object} context - Distributed trace and correlation metadata
   * @returns {Object} Full CloudEvent v1.1 Envelope
   */
  async publishEvent(type, source, payload = {}, context = {}) {
    const id = context.id || `evt_${Date.now()}_${randomUUID().substring(0, 8)}`;
    const correlationId = context.correlationId || context.correlation_id || `corr_${randomUUID().substring(0, 12)}`;
    const causationId = context.causationId || context.causation_id || id;
    const traceparent = context.traceparent || EnterpriseEventBus.generateTraceparent();
    const timeoutThreshold = Number(context.timeoutThresholdSeconds) || 300;

    // 1. Compute Cryptographic SHA-256 of Payload
    const payloadSha256 = EnterpriseEventBus.computeSha256(payload);

    // 2. Formulate CloudEvent v1.1 Spec Envelope
    const cloudEvent = {
      specversion: '1.1',
      id,
      type,
      topic: type,
      source: source || 'raioc://os/kernel',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      correlation_id: correlationId,
      causation_id: causationId,
      traceparent,
      data: payload,
      payload: payload,
      metadata: {
        timestamp: new Date().toISOString(),
        correlationId,
        sourceAgent: source,
        ...context,
      },
      payload_sha256: payloadSha256,
      prev_event_hash: this.lastEventHash,
      status: context.status || 'EMITTED',
      retry_count: context.retry_count !== undefined ? Number(context.retry_count) : 0,
      timeout_threshold_seconds: timeoutThreshold,
    };

    // 3. Update In-Memory Chain Hash (Hash of the entire event envelope)
    this.lastEventHash = EnterpriseEventBus.computeSha256({
      id: cloudEvent.id,
      type: cloudEvent.type,
      payload_sha256: cloudEvent.payload_sha256,
      prev_event_hash: cloudEvent.prev_event_hash,
      time: cloudEvent.time,
    });

    this.eventLog.unshift(cloudEvent);
    if (this.eventLog.length > 500) this.eventLog.pop();

    logger.info('EVENT_BUS', `CloudEvent v1.1 published [${type}] from ${source}`, {
      eventId: id,
      correlationId,
      payloadSha256: payloadSha256.substring(0, 12) + '...',
      prevEventHash: cloudEvent.prev_event_hash ? cloudEvent.prev_event_hash.substring(0, 12) + '...' : 'GENESIS',
    });

    // 4. Asynchronous Write-Behind to Database / Ledger
    if (this.writeBehind) {
      supabase.recordEnterpriseEvent(cloudEvent).catch((err) => {
        logger.error('EVENT_BUS', 'Asynchronous event persistence failed', { error: err.message, eventId: id });
      });
    }

    // 5. In-Memory Dispatch to Subscribers
    await this.dispatchToSubscribers(cloudEvent);

    return cloudEvent;
  }

  /**
   * Dispatches event to local registered handlers
   * @param {Object} cloudEvent 
   */
  async dispatchToSubscribers(cloudEvent) {
    const specificHandlers = this.handlers.get(cloudEvent.type) || new Set();
    const allHandlers = [...specificHandlers, ...this.wildcardHandlers];

    const promises = [];
    for (const handler of allHandlers) {
      try {
        // Automatically inject trace context into handler execution
        const result = handler(cloudEvent.data, {
          eventId: cloudEvent.id,
          type: cloudEvent.type,
          source: cloudEvent.source,
          correlationId: cloudEvent.correlation_id,
          causationId: cloudEvent.causation_id,
          traceparent: cloudEvent.traceparent,
          cloudEvent,
        });

        if (result && typeof result.then === 'function') {
          promises.push(
            result.catch((err) => {
              logger.error('EVENT_BUS', `Async handler error for event ${cloudEvent.type}`, { error: err.message });
            })
          );
        }
      } catch (err) {
        logger.error('EVENT_BUS', `Sync handler error for event ${cloudEvent.type}`, { error: err.message });
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Subscribes a handler to an event type or wildcard '*'
   * @param {string} eventType 
   * @param {Function} handler 
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for event type '${eventType}' must be a function`);
    }

    if (eventType === '*') {
      this.wildcardHandlers.add(handler);
      return () => this.wildcardHandlers.delete(handler);
    }

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType).add(handler);

    return () => {
      const set = this.handlers.get(eventType);
      if (set) set.delete(handler);
    };
  }

  /**
   * Retrieves in-memory event history
   * @param {number} limit 
   * @returns {Array<Object>}
   */
  getEventHistory(limit = 50) {
    return this.eventLog.slice(0, limit);
  }

  /**
   * Retrieves an event by ID
   * @param {string} id 
   * @returns {Object|null}
   */
  getEventById(id) {
    return this.eventLog.find((e) => e.id === id) || null;
  }

  /**
   * Clears event history while preserving subscriber handlers
   */
  clearHistory() {
    this.eventLog = [];
    this.lastEventHash = null;
  }

  /**
   * Resets in-memory event store (for tests)
   */
  clear() {
    this.handlers.clear();
    this.wildcardHandlers.clear();
    this.eventLog = [];
    this.lastEventHash = null;
  }
}

export const enterpriseEventBus = new EnterpriseEventBus();
