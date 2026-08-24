/**
 * RAIOC OS - Rendas AI Intelligence Operating Center
 * Core Entry Point
 */

import { run_cycle } from './core/run-cycle.js';
import { scheduler } from './core/scheduler.js';
import { diraRiisEngine } from './engines/dira-riis-engine.js';
import { executiveBriefGenerator } from './engines/executive-brief.js';
import { queueEngine } from './engines/queue-engine.js';
import { supabase } from './db/supabase-client.js';
import { telemetry } from './logging/telemetry.js';
import { logger } from './logging/audit-logger.js';
import { config } from './config/env.js';

export {
  run_cycle,
  scheduler,
  diraRiisEngine,
  executiveBriefGenerator,
  queueEngine,
  supabase,
  telemetry,
  logger,
  config,
};

// If started directly, start autonomous scheduler with graceful signal handling
if (process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('raioc-os'))) {
  logger.info('SYSTEM', 'Booting RAIOC OS Autonomous Operating System...');

  scheduler.start().catch((err) => {
    logger.error('SYSTEM', 'Fatal boot failure', { error: err.message });
    process.exit(1);
  });

  const handleShutdown = async (signal) => {
    logger.info('SYSTEM', `Received ${signal}, shutting down gracefully...`);
    await scheduler.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}
