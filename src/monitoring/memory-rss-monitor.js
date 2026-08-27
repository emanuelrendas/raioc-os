/**
 * RAIOC OS - Memory RSS Watchdog & Drain Monitor
 * 
 * Monitors Resident Set Size (RSS) memory consumption in containerized & daemon runtimes:
 * - Warning Threshold: >= 180MB (emits structured warning log)
 * - Critical Threshold: >= 250MB in persistent mode (executes orderly task draining and graceful restart)
 */

import { logger } from '../logging/audit-logger.js';

export const MEMORY_THRESHOLDS = {
  WARNING_MB: 180,
  CRITICAL_MB: 250,
};

class MemoryRssMonitor {
  constructor() {
    this.timer = null;
    this.isMonitoring = false;
    this.lastCheckedMb = 0;
    this.warningCount = 0;
  }

  /**
   * Reads current memory usage metrics in Megabytes
   * @returns {{ rssMb: number, heapUsedMb: number, heapTotalMb: number, externalMb: number }}
   */
  getMemoryMetrics() {
    const mem = process.memoryUsage();
    return {
      rssMb: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / (1024 * 1024)) * 100) / 100,
      externalMb: Math.round((mem.external / (1024 * 1024)) * 100) / 100,
    };
  }

  /**
   * Performs an immediate memory health check and triggers warnings / drains if thresholds are exceeded
   * @param {Function} [onCriticalDrain] - Optional callback to invoke when RSS exceeds 250MB in persistent mode
   * @returns {{ status: 'NORMAL' | 'WARNING' | 'CRITICAL', metrics: Object, drained: boolean }}
   */
  checkMemoryUsage(onCriticalDrain = null) {
    const metrics = this.getMemoryMetrics();
    this.lastCheckedMb = metrics.rssMb;

    let status = 'NORMAL';
    let drained = false;

    // 1. Critical Limit (>= 250MB) in Persistent Daemon Runtime
    if (metrics.rssMb >= MEMORY_THRESHOLDS.CRITICAL_MB) {
      status = 'CRITICAL';
      const isPersistent = process.env.RUNTIME_MODE === 'persistent_daemon' || process.env.DAEMON_MODE === 'true';
      
      logger.error('MEMORY_MONITOR', `🚨 CRITICAL MEMORY USAGE: ${metrics.rssMb}MB exceeds critical threshold (${MEMORY_THRESHOLDS.CRITICAL_MB}MB)`, {
        metrics,
        runtimeMode: process.env.RUNTIME_MODE,
        isPersistent,
      });

      if (isPersistent && typeof onCriticalDrain === 'function') {
        logger.warn('MEMORY_MONITOR', 'Executing orderly memory drain sequence...');
        onCriticalDrain();
        drained = true;
      }
    }
    // 2. Warning Limit (>= 180MB)
    else if (metrics.rssMb >= MEMORY_THRESHOLDS.WARNING_MB) {
      status = 'WARNING';
      this.warningCount++;
      logger.warn('MEMORY_MONITOR', `⚠️ HIGH MEMORY WARNING: ${metrics.rssMb}MB exceeds warning threshold (${MEMORY_THRESHOLDS.WARNING_MB}MB)`, {
        metrics,
        warningCount: this.warningCount,
      });
    }

    return {
      status,
      metrics,
      drained,
    };
  }

  /**
   * Starts periodic memory monitoring
   * @param {number} [intervalMs=15000]
   * @param {Function} [onCriticalDrain]
   */
  start(intervalMs = 15000, onCriticalDrain = null) {
    if (this.timer) return;
    this.isMonitoring = true;
    this.timer = setInterval(() => {
      this.checkMemoryUsage(onCriticalDrain);
    }, intervalMs);
    logger.info('MEMORY_MONITOR', `Memory RSS watchdog started (Interval: ${intervalMs}ms, Warning: ${MEMORY_THRESHOLDS.WARNING_MB}MB, Critical: ${MEMORY_THRESHOLDS.CRITICAL_MB}MB)`);
  }

  /**
   * Stops periodic memory monitoring
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isMonitoring = false;
  }
}

export const memoryRssMonitor = new MemoryRssMonitor();
