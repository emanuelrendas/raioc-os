/**
 * RAIOC OS - Hardened Recovery Engine & Dynamic Circuit Breaker (Sprint 2 Core)
 * Reclaims stuck processing events, manages Dead-Letter Queues (DLQ), and provides
 * fault isolation with automated exponential backoff across external providers.
 */

import { supabase } from '../db/supabase-client.js';
import { enterpriseEventBus } from './event-bus.js';
import { logger } from '../logging/audit-logger.js';

export const CircuitState = {
  CLOSED: 'CLOSED',       // Normal operation, passing calls
  OPEN: 'OPEN',           // Failing, fast-failing calls immediately
  HALF_OPEN: 'HALF_OPEN', // Trial probe call to verify service recovery
};

export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 3000;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Executes an asynchronous action wrapped with circuit breaker semantics
   * @param {Function} actionFn 
   * @param {Function} [fallbackFn] 
   * @returns {Promise<any>}
   */
  async execute(actionFn, fallbackFn = null) {
    const now = Date.now();

    // 1. Check if OPEN state has elapsed resetTimeout -> transition to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && now >= this.nextAttemptTime) {
        this.state = CircuitState.HALF_OPEN;
        logger.info('CIRCUIT_BREAKER', `Circuit [${this.name}] transitioned to HALF_OPEN (probing health)`);
      } else {
        logger.warn('CIRCUIT_BREAKER', `Circuit [${this.name}] is OPEN. Fast-failing execution.`);
        if (typeof fallbackFn === 'function') {
          return await fallbackFn(new Error(`CircuitBreaker [${this.name}] is OPEN`));
        }
        throw new Error(`CircuitBreaker [${this.name}] is OPEN (Service unavailable)`);
      }
    }

    // 2. Attempt Execution
    try {
      const result = await actionFn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure(err);
      if (typeof fallbackFn === 'function') {
        return await fallbackFn(err);
      }
      throw err;
    }
  }

  recordSuccess() {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.nextAttemptTime = null;
      logger.info('CIRCUIT_BREAKER', `Circuit [${this.name}] recovered and returned to CLOSED state`);
    }
  }

  recordFailure(err) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
      logger.warn('CIRCUIT_BREAKER', `Circuit [${this.name}] tripped to OPEN state after ${this.failureCount} failures`, {
        error: err.message,
        resetInMs: this.resetTimeoutMs,
      });
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime).toISOString() : null,
    };
  }

  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.nextAttemptTime = null;
  }
}

export class RecoveryEngine {
  constructor() {
    this.circuitBreakers = new Map();
  }

  /**
   * Gets or registers a CircuitBreaker for a component/tool
   * @param {string} name 
   * @param {Object} options 
   * @returns {CircuitBreaker}
   */
  getCircuitBreaker(name, options = {}) {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, new CircuitBreaker(name, options));
    }
    return this.circuitBreakers.get(name);
  }

  /**
   * Scans for events stuck in 'PROCESSING' state beyond stale threshold.
   * If retry_count >= 3 -> route to Dead-Letter Queue (DLQ).
   * Otherwise -> re-emit with incremented retry count.
   * @param {number} staleThresholdSeconds 
   * @returns {Promise<Object>} Summary of reclaimed and DLQ events
   */
  async reclaimStuckProcessingEvents(staleThresholdSeconds = 300) {
    const now = Date.now();
    const staleCutoff = new Date(now - staleThresholdSeconds * 1000).toISOString();

    const stuckEvents = await supabase.fetchStuckEnterpriseEvents(staleCutoff);
    const reclaimed = [];
    const deadLettered = [];

    for (const evt of stuckEvents) {
      if (evt.retry_count >= 3) {
        // Exceeded retries -> Dead-Letter Queue (DLQ)
        const updated = await supabase.updateEnterpriseEventStatus(evt.id, 'DEAD_LETTER', {
          dlq_reason: `Exceeded max retry threshold (attempts: ${evt.retry_count})`,
          moved_to_dlq_at: new Date().toISOString(),
        });
        deadLettered.push(updated);

        enterpriseEventBus.publishEvent('system.dlq.alert', 'raioc://os/recovery-engine', {
          eventId: evt.id,
          eventType: evt.event_type,
          retryCount: evt.retry_count,
          reason: 'Max retries exhausted',
        }, { correlationId: evt.correlation_id, causationId: evt.id });

        logger.error('RECOVERY_ENGINE', `Event ${evt.id} [${evt.event_type}] routed to DEAD-LETTER QUEUE (DLQ)`);
      } else {
        // Increment retry count & reset to EMITTED for re-processing
        const nextRetry = (evt.retry_count || 0) + 1;
        const updated = await supabase.updateEnterpriseEventStatus(evt.id, 'EMITTED', {
          retry_count: nextRetry,
          reclaimed_at: new Date().toISOString(),
        });
        reclaimed.push(updated);

        // Re-dispatch into the live Event Bus
        enterpriseEventBus.publishEvent(evt.event_type, evt.source, evt.payload || evt.data || {}, {
          id: evt.id,
          correlationId: evt.correlation_id,
          causationId: evt.causation_id,
          traceparent: evt.traceparent,
          retry_count: nextRetry,
          timeoutThresholdSeconds: evt.timeout_threshold_seconds,
        });

        logger.warn('RECOVERY_ENGINE', `Reclaimed stuck event ${evt.id} [${evt.event_type}] (Attempt ${nextRetry}/3)`);
      }
    }

    return {
      success: true,
      scannedCount: stuckEvents.length,
      reclaimedCount: reclaimed.length,
      deadLetterCount: deadLettered.length,
      reclaimed,
      deadLettered,
      timestamp: new Date().toISOString(),
    };
  }

  getCircuitBreakerStatus() {
    const status = {};
    for (const [name, cb] of this.circuitBreakers.entries()) {
      status[name] = cb.getState();
    }
    return status;
  }
}

export const recoveryEngine = new RecoveryEngine();
