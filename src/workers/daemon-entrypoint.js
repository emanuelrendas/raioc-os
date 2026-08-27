/**
 * RAIOC OS - Persistent Daemon Entrypoint (Always-On Autonomous Agents Runtime)
 * 
 * Manages background autonomous loops for long-running containerized / VM environments:
 * 1. JARVIS Continuous Executive Operating System Loop (Opportunity scanning & self-healing)
 * 2. SENTINEL Mesh Monitor (Continuous health probes & circuit breaking)
 * 3. Distributed Autonomous Scheduler (Interval task execution & lease locking)
 * 4. Memory RSS Watchdog (Warning @ 180MB, Orderly drain @ 250MB)
 * 5. Graceful Shutdown & Signal Trapping (SIGTERM, SIGINT) with connection draining.
 */

import { jarvis } from '../agents/specialists/jarvis-orchestrator.js';
import { sentinelMeshMonitor } from '../core/sentinel-mesh-monitor.js';
import { distributedScheduler } from '../core/distributed-scheduler.js';
import { memoryRssMonitor } from '../monitoring/memory-rss-monitor.js';
import { startApiServer } from '../api/server.js';
import { logger } from '../logging/audit-logger.js';
import { isServerlessRuntime } from '../config/env.js';
import { validateProductionEnv } from '../config/env-validator.js';
import { reclaimStuckProcessingEvents } from '../core/recovery-engine.js';
import { enterpriseEventBus } from '../core/event-bus.js';
import { agentDirectory } from '../agents/agent-directory.js';
import { supabase } from '../db/supabase-client.js';

let daemonState = {
  isRunning: false,
  runtimeMode: 'persistent_daemon',
  startedAt: null,
  stoppedAt: null,
  activeServices: [],
  httpServer: null,
  signalListenersRegistered: false,
  recoverySummary: null,
};

/**
 * Initializes and starts all Always-On persistent daemon services
 * @param {Object} options
 * @param {number} [options.port=3000] - Port for the health/API server
 * @param {number} [options.jarvisIntervalMs=30000] - JARVIS executive tick interval
 * @param {number} [options.sentinelIntervalMs=60000] - Sentinel mesh probe interval
 * @param {number} [options.memoryCheckIntervalMs=15000] - Memory monitor probe interval
 * @param {number} [options.staleThresholdSeconds=300] - In-flight event stale reclamation threshold
 * @param {boolean} [options.startHttp=true] - Whether to start the HTTP API / Health server
 * @param {boolean} [options.strictEnv=false] - Whether to enforce production strict validation
 * @returns {Promise<Object>} Daemon runtime status
 */
export async function startDaemon(options = {}) {
  if (daemonState.isRunning) {
    logger.warn('DAEMON', 'Persistent daemon is already running');
    return getDaemonStatus();
  }

  // 0. Validate Environment with Fail-Closed rules
  validateProductionEnv({ strict: options.strictEnv || false });

  // Enforce persistent daemon runtime mode
  process.env.RUNTIME_MODE = 'persistent_daemon';
  process.env.DAEMON_MODE = 'true';

  const port = parseInt(process.env.PORT || options.port || '3000', 10);
  const jarvisIntervalMs = options.jarvisIntervalMs || 30000;
  const sentinelIntervalMs = options.sentinelIntervalMs || 60000;
  const memoryCheckIntervalMs = options.memoryCheckIntervalMs || 15000;
  const staleThresholdSeconds = options.staleThresholdSeconds || 300;
  const startHttp = options.startHttp !== false;

  logger.info('DAEMON', '🚀 Initializing RAIOC OS Persistent Always-On Daemon Runtime...');

  // 0a. Hydrate State & Registries from Supabase
  try {
    if (typeof agentDirectory?.hydrateFromSupabase === 'function') {
      await agentDirectory.hydrateFromSupabase();
    }
    await supabase.fetchApprovals?.('ALL');
    logger.info('DAEMON', '✅ Registries & state hydrated from Supabase');
  } catch (err) {
    logger.warn('DAEMON', `Registry hydration warning: ${err.message}`);
  }

  // 0b. Reclaim Stuck In-Flight Events (>300s) & Sweep to DLQ
  let recoverySummary = { reclaimedCount: 0, dlqCount: 0 };
  try {
    recoverySummary = await reclaimStuckProcessingEvents(staleThresholdSeconds);
    logger.info('DAEMON', `✅ Event recovery completed: ${recoverySummary.reclaimedCount} reclaimed, ${recoverySummary.dlqCount} in DLQ`);
  } catch (err) {
    logger.error('DAEMON', `Event recovery failed: ${err.message}`);
  }

  const activeServices = [];

  // 1. Optional HTTP Server for Healthchecks, /healthz, and Inbound Webhooks
  if (startHttp) {
    try {
      daemonState.httpServer = await startApiServer(port);
      activeServices.push(`API_SERVER_PORT_${port}`);
      logger.info('DAEMON', `✅ HTTP & Healthcheck server listening on port ${port} (Route: /healthz active)`);
    } catch (err) {
      logger.warn('DAEMON', `HTTP Server already running or could not bind port ${port}: ${err.message}`);
    }
  }

  // 2. Start JARVIS Continuous Executive Operating System Loop
  try {
    jarvis.startContinuousExecutiveLoop(jarvisIntervalMs);
    activeServices.push('JARVIS_EXECUTIVE_LOOP');
    logger.info('DAEMON', `✅ JARVIS Continuous Executive Loop started (${jarvisIntervalMs}ms interval)`);
  } catch (err) {
    logger.error('DAEMON', `Failed to start JARVIS executive loop: ${err.message}`);
  }

  // 3. Start SENTINEL Mesh Monitor (Probing Fleet Health)
  try {
    sentinelMeshMonitor.startMeshProbing(sentinelIntervalMs);
    activeServices.push('SENTINEL_MESH_MONITOR');
    logger.info('DAEMON', `✅ SENTINEL Mesh Prober active (${sentinelIntervalMs}ms interval)`);
  } catch (err) {
    logger.error('DAEMON', `Failed to start SENTINEL mesh monitor: ${err.message}`);
  }

  // 4. Start Distributed Autonomous Scheduler
  try {
    await distributedScheduler.start();
    activeServices.push('DISTRIBUTED_SCHEDULER');
    logger.info('DAEMON', '✅ Distributed Autonomous Scheduler started');
  } catch (err) {
    logger.error('DAEMON', `Failed to start Distributed Scheduler: ${err.message}`);
  }

  // 5. Start Memory RSS Watchdog
  try {
    memoryRssMonitor.start(memoryCheckIntervalMs, () => {
      logger.error('DAEMON', 'Executing critical memory drain triggered by RSS monitor.');
      stopDaemon();
    });
    activeServices.push('MEMORY_RSS_WATCHDOG');
    logger.info('DAEMON', `✅ Memory RSS Watchdog active (${memoryCheckIntervalMs}ms interval, 180MB warn, 250MB drain)`);
  } catch (err) {
    logger.error('DAEMON', `Failed to start Memory RSS Monitor: ${err.message}`);
  }

  daemonState = {
    ...daemonState,
    isRunning: true,
    runtimeMode: 'persistent_daemon',
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    activeServices,
    recoverySummary,
  };

  // 6. Dispatch CloudEvent raioc.system.daemon.recovered.v1
  try {
    enterpriseEventBus.publishEvent(
      'raioc.system.daemon.recovered.v1',
      'raioc://workers/daemon-entrypoint',
      {
        daemonStartedAt: daemonState.startedAt,
        recoverySummary,
        activeServices,
        runtimeMode: 'persistent_daemon',
      },
      {
        correlationId: `corr_daemon_boot_${Date.now()}`,
      }
    );
  } catch (err) {
    logger.warn('DAEMON', `Failed to dispatch daemon recovery CloudEvent: ${err.message}`);
  }

  // 7. Register Process Signal Handlers for Graceful Shutdown
  registerSignalHandlers();

  logger.info('DAEMON', '🟢 RAIOC OS Always-On Persistent Daemon fully operational', {
    activeServices,
    isServerless: isServerlessRuntime(),
  });

  return getDaemonStatus();
}

/**
 * Stops all Always-On background daemon services and cleans up resources
 * @returns {Promise<Object>} Final daemon status
 */
export async function stopDaemon() {
  if (!daemonState.isRunning) {
    return getDaemonStatus();
  }

  logger.info('DAEMON', '🛑 Initiating graceful shutdown of persistent daemon...');

  // 1. Stop Memory Monitor
  try {
    memoryRssMonitor.stop();
  } catch (err) {
    logger.error('DAEMON', `Error stopping Memory Monitor: ${err.message}`);
  }

  // 2. Stop JARVIS Executive Loop
  try {
    jarvis.stopContinuousExecutiveLoop();
    logger.info('DAEMON', '⏹️ Stopped JARVIS executive loop');
  } catch (err) {
    logger.error('DAEMON', `Error stopping JARVIS: ${err.message}`);
  }

  // 3. Stop SENTINEL Mesh Probing
  try {
    sentinelMeshMonitor.stopMeshProbing();
    logger.info('DAEMON', '⏹️ Stopped SENTINEL mesh prober');
  } catch (err) {
    logger.error('DAEMON', `Error stopping SENTINEL: ${err.message}`);
  }

  // 4. Stop Distributed Scheduler
  try {
    await distributedScheduler.stop();
    logger.info('DAEMON', '⏹️ Stopped Distributed Scheduler');
  } catch (err) {
    logger.error('DAEMON', `Error stopping Distributed Scheduler: ${err.message}`);
  }

  // 5. Close HTTP Server if listening
  if (daemonState.httpServer && typeof daemonState.httpServer.close === 'function') {
    try {
      await new Promise((resolve) => {
        daemonState.httpServer.close(() => {
          logger.info('DAEMON', '⏹️ HTTP & Healthcheck server closed');
          resolve();
        });
      });
    } catch (err) {
      logger.warn('DAEMON', `Error closing HTTP server: ${err.message}`);
    }
  }

  daemonState = {
    ...daemonState,
    isRunning: false,
    stoppedAt: new Date().toISOString(),
    activeServices: [],
    httpServer: null,
  };

  logger.info('DAEMON', '🏁 RAIOC OS Persistent Daemon gracefully stopped.');
  return getDaemonStatus();
}

/**
 * Returns current status of the persistent daemon
 * @returns {Object}
 */
export function getDaemonStatus() {
  return {
    isRunning: daemonState.isRunning,
    runtimeMode: process.env.RUNTIME_MODE || daemonState.runtimeMode,
    isServerless: isServerlessRuntime(),
    startedAt: daemonState.startedAt,
    stoppedAt: daemonState.stoppedAt,
    activeServices: [...daemonState.activeServices],
    recoverySummary: daemonState.recoverySummary,
  };
}

/**
 * Registers process signal listeners for SIGINT and SIGTERM
 */
function registerSignalHandlers() {
  if (daemonState.signalListenersRegistered) return;
  daemonState.signalListenersRegistered = true;

  const handleShutdownSignal = async (signal) => {
    logger.info('DAEMON', `Received OS signal [${signal}]. Initiating graceful drain and exit...`);
    await stopDaemon();
    // Only exit process if running as main process CLI
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => handleShutdownSignal('SIGTERM'));
  process.on('SIGINT', () => handleShutdownSignal('SIGINT'));
}

// Auto-boot daemon when executed directly (e.g. `npm run start:daemon` or `node src/workers/daemon-entrypoint.js`)
if (process.argv[1] && (process.argv[1].endsWith('daemon-entrypoint.js') || process.argv[1].endsWith('daemon-entrypoint'))) {
  startDaemon().catch((err) => {
    logger.error('DAEMON', `Fatal error during daemon boot: ${err.message}`, { stack: err.stack });
    process.exit(1);
  });
}
