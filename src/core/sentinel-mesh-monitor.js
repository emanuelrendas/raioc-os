/**
 * RAIOC OS - SENTINEL Mesh Monitor & Circuit Breaker Engine
 * 
 * Provides continuous 60s autonomous probing of the sovereign agent fleet,
 * tool execution telemetry, and external infrastructure health.
 * Automatically trips the Circuit Breaker (CIRCUIT_OPEN) when error rate >= 5%
 * or average latency exceeds 2000ms, publishing CloudEvents to the event bus.
 */

import { supabase } from '../db/supabase-client.js';
import { enterpriseEventBus } from './event-bus.js';
import { logger } from '../logging/audit-logger.js';
import { isServerlessRuntime } from '../config/env.js';

export const CIRCUIT_STATES = {
  CLOSED: 'CIRCUIT_CLOSED',     // Normal, healthy operation
  HALF_OPEN: 'CIRCUIT_HALF_OPEN', // Probe recovery test
  OPEN: 'CIRCUIT_OPEN',         // Tripped, degraded state (fallback active)
};

export const MESH_STATUS = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  CRITICAL: 'CRITICAL',
};

export class SentinelMeshMonitor {
  constructor() {
    this.status = MESH_STATUS.HEALTHY;
    this.circuitBreakerState = CIRCUIT_STATES.CLOSED;
    this.thresholds = {
      errorRateMax: 0.05,    // 5.0% error threshold
      latencyMaxMs: 2000,    // 2000ms max latency
      probeIntervalMs: 60000 // 60s probe cycle
    };
    this.metrics = {
      totalProbes: 0,
      currentErrorRate: 0.0,
      currentAvgLatencyMs: 14,
      activeAgentsCount: 12,
      activeToolsCount: 7,
      lastProbeAt: new Date().toISOString(),
      lastTrippedAt: null,
      tripReason: null,
      recoveryAttempts: 0,
    };
    this.probeHistory = [];
    this.degradationOverrides = null;
    this.probeTimer = null;
    this.isProbingActive = false;
  }

  /**
   * Executes a fleet-wide health probe and evaluates circuit breaker state
   * @param {Object} options - Optional probe parameters
   * @returns {Promise<Object>} Probe evaluation result
   */
  async checkFleetHealth(options = {}) {
    const probeStartTime = Date.now();
    this.metrics.totalProbes += 1;
    this.metrics.lastProbeAt = new Date().toISOString();

    let errorRate = 0.0;
    let avgLatencyMs = 14;
    let agentStatuses = [];

    if (this.degradationOverrides) {
      errorRate = this.degradationOverrides.errorRate !== undefined ? this.degradationOverrides.errorRate : 0.0;
      avgLatencyMs = this.degradationOverrides.latencyMs !== undefined ? this.degradationOverrides.latencyMs : 14;
    } else {
      try {
        const [coreAgents, runtimeTelemetry] = await Promise.all([
          supabase.fetchCoreAgents(),
          supabase.fetchRuntimeAgentTelemetry(),
        ]);

        const telemetryList = runtimeTelemetry || [];
        const totalAgents = coreAgents?.length || 12;
        this.metrics.activeAgentsCount = totalAgents;

        if (telemetryList.length > 0) {
          const totalErrors = telemetryList.reduce((acc, t) => acc + Number(t.error_rate_5m || 0), 0);
          errorRate = Number((totalErrors / telemetryList.length).toFixed(4));

          const totalLatency = telemetryList.reduce((acc, t) => acc + Number(t.last_latency_ms || 12), 0);
          avgLatencyMs = Math.round(totalLatency / telemetryList.length);
        }

        agentStatuses = (coreAgents || []).map((a) => ({
          id: a.id,
          name: a.name,
          status: a.status || 'ACTIVE',
        }));
      } catch (err) {
        logger.warn('SENTINEL_PROBE', 'Error reading runtime telemetry during probe', { error: err.message });
      }
    }

    this.metrics.currentErrorRate = errorRate;
    this.metrics.currentAvgLatencyMs = avgLatencyMs;

    // Evaluate Circuit Breaker Tripping Conditions
    const isErrorTripped = errorRate >= this.thresholds.errorRateMax;
    const isLatencyTripped = avgLatencyMs > this.thresholds.latencyMaxMs;
    const shouldTrip = isErrorTripped || isLatencyTripped;

    let previousState = this.circuitBreakerState;

    if (shouldTrip) {
      this.circuitBreakerState = CIRCUIT_STATES.OPEN;
      this.status = isErrorTripped && isLatencyTripped ? MESH_STATUS.CRITICAL : MESH_STATUS.DEGRADED;
      this.metrics.lastTrippedAt = new Date().toISOString();
      
      const reasons = [];
      if (isErrorTripped) reasons.push(`Error Rate ${(errorRate * 100).toFixed(1)}% >= 5.0%`);
      if (isLatencyTripped) reasons.push(`Latency ${avgLatencyMs}ms > 2000ms`);
      this.metrics.tripReason = reasons.join(' | ');

      logger.warn('SENTINEL_BREAKER', `🚨 SENTINEL Circuit Breaker TRIPPED to [${this.circuitBreakerState}]: ${this.metrics.tripReason}`, {
        errorRate,
        avgLatencyMs,
        tripReason: this.metrics.tripReason,
      });

      // Emit CloudEvent on Event Bus v1.1
      try {
        await enterpriseEventBus.publishEvent(
          'raioc.system.circuit_breaker.tripped.v1',
          'raioc://sentinel/mesh-monitor',
          {
            circuitBreakerState: this.circuitBreakerState,
            status: this.status,
            errorRate,
            avgLatencyMs,
            thresholds: this.thresholds,
            reason: this.metrics.tripReason,
            trippedAt: this.metrics.lastTrippedAt,
          },
          {
            subject: 'sentinel_circuit_breaker_trip',
          }
        );
      } catch (evtErr) {
        logger.error('SENTINEL_BREAKER', 'Failed to publish circuit breaker event', { error: evtErr.message });
      }
    } else {
      if (this.circuitBreakerState === CIRCUIT_STATES.OPEN || this.circuitBreakerState === CIRCUIT_STATES.HALF_OPEN) {
        this.circuitBreakerState = CIRCUIT_STATES.CLOSED;
        this.status = MESH_STATUS.HEALTHY;
        this.metrics.tripReason = null;

        logger.info('SENTINEL_BREAKER', `✅ SENTINEL Circuit Breaker RECOVERED to [${this.circuitBreakerState}]`);

        try {
          await enterpriseEventBus.publishEvent(
            'raioc.system.circuit_breaker.reset.v1',
            'raioc://sentinel/mesh-monitor',
            {
              circuitBreakerState: this.circuitBreakerState,
              status: this.status,
              errorRate,
              avgLatencyMs,
              recoveredAt: new Date().toISOString(),
            }
          );
        } catch {
          // Non-blocking
        }
      } else {
        this.circuitBreakerState = CIRCUIT_STATES.CLOSED;
        this.status = MESH_STATUS.HEALTHY;
      }
    }

    const probeResult = {
      probeId: `probe_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: this.metrics.lastProbeAt,
      durationMs: Date.now() - probeStartTime,
      circuitBreakerState: this.circuitBreakerState,
      status: this.status,
      errorRate,
      avgLatencyMs,
      thresholds: this.thresholds,
      tripReason: this.metrics.tripReason,
      agentCount: this.metrics.activeAgentsCount,
    };

    this.probeHistory.unshift(probeResult);
    if (this.probeHistory.length > 20) this.probeHistory.pop();

    return probeResult;
  }

  /**
   * Simulates synthetic degradation to verify circuit breaker trip behavior
   * @param {Object} params - { errorRate, latencyMs, reason }
   * @returns {Promise<Object>} Evaluated probe result
   */
  async simulateDegradation({ errorRate = 0.08, latencyMs = 2450, reason = 'Simulated Mesh Latency & Error Spike' } = {}) {
    this.degradationOverrides = { errorRate, latencyMs, reason };
    logger.info('SENTINEL_SIMULATION', `Simulating mesh degradation: errorRate=${(errorRate * 100).toFixed(1)}%, latency=${latencyMs}ms`);
    return await this.checkFleetHealth();
  }

  /**
   * Clears overrides and resets circuit breaker to CLOSED
   * @returns {Promise<Object>} Reset result
   */
  async resetCircuitBreaker() {
    this.degradationOverrides = null;
    this.circuitBreakerState = CIRCUIT_STATES.CLOSED;
    this.status = MESH_STATUS.HEALTHY;
    this.metrics.tripReason = null;
    this.metrics.currentErrorRate = 0.0;
    this.metrics.currentAvgLatencyMs = 12;

    logger.info('SENTINEL_BREAKER', 'Circuit Breaker manually reset to CIRCUIT_CLOSED');

    try {
      await enterpriseEventBus.publishEvent(
        'raioc.system.circuit_breaker.reset.v1',
        'raioc://sentinel/mesh-monitor',
        {
          circuitBreakerState: this.circuitBreakerState,
          status: this.status,
          resetAt: new Date().toISOString(),
          manual: true,
        }
      );
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      circuitBreakerState: this.circuitBreakerState,
      status: this.status,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Returns complete mesh monitoring and telemetry state
   * @returns {Object} Mesh status overview
   */
  getMeshStatus() {
    return {
      status: this.status,
      circuitBreakerState: this.circuitBreakerState,
      thresholds: this.thresholds,
      metrics: { ...this.metrics },
      isDegraded: this.circuitBreakerState === CIRCUIT_STATES.OPEN,
      recentProbes: this.probeHistory.slice(0, 5),
    };
  }

  /**
   * Starts autonomous periodic background probing every 60s
   */
  startMeshProbing(intervalMs = 60000) {
    if (this.probeTimer) return;
    if (isServerlessRuntime()) {
      logger.info('SENTINEL_PROBE', '⚡ Serverless runtime detected: Continuous mesh probing decoupled.');
      return;
    }
    this.thresholds.probeIntervalMs = intervalMs;
    this.isProbingActive = true;
    this.probeTimer = setInterval(() => {
      this.checkFleetHealth().catch((err) => {
        logger.error('SENTINEL_PROBE', 'Background probe tick failed', { error: err.message });
      });
    }, intervalMs);
    logger.info('SENTINEL_PROBE', `Autonomous 60s mesh probing started (Interval: ${intervalMs}ms)`);
  }

  start(intervalMs = 60000) {
    return this.startMeshProbing(intervalMs);
  }

  /**
   * Stops background probing
   */
  stopMeshProbing() {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
    this.isProbingActive = false;
  }

  stop() {
    return this.stopMeshProbing();
  }
}

export const sentinelMeshMonitor = new SentinelMeshMonitor();
