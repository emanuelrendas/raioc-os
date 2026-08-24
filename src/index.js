/**
 * RAIOC OS - Rendas AI Intelligence Operating Center
 * Core Entry Point (Sprint 2 - Operational Infrastructure)
 */

import { run_cycle } from './core/run-cycle.js';
import { scheduler } from './core/scheduler.js';
import { distributedScheduler } from './core/distributed-scheduler.js';
import { diraRiisEngine } from './engines/dira-riis-engine.js';
import { executiveBriefGenerator } from './engines/executive-brief.js';
import { queueEngine } from './engines/queue-engine.js';
import { supabase } from './db/supabase-client.js';
import { telemetry } from './logging/telemetry.js';
import { logger } from './logging/audit-logger.js';
import { config } from './config/env.js';
import { secretsManager } from './config/secrets-manager.js';
import { authMiddleware } from './security/auth-middleware.js';
import { webhookVerifier } from './security/webhook-verifier.js';
import { ikl } from './core/ikl/index.js';
import { routeApiRequest, startApiServer, propertyCalculators } from './api/index.js';
import { gmailClient } from './integrations/google/gmail-client.js';
import { googleCalendarClient } from './integrations/google/calendar-client.js';
import { whatsAppBusinessClient } from './integrations/whatsapp/whatsapp-business-client.js';
import { crmSyncClient } from './integrations/crm/crm-sync-client.js';
import { n8nWebhookClient } from './integrations/n8n/n8n-webhook-client.js';
import { gmailAdapter } from './adapters/gmail-adapter.js';
import { calendarAdapter } from './adapters/calendar-adapter.js';
import { whatsAppCloudAdapter } from './adapters/whatsapp-cloud-adapter.js';
import { toolRegistry } from './agents/tool-registry.js';
import { agentRuntime } from './agents/agent-runtime.js';
import { AgentAction, AgentContext, ExecutionResult } from './agents/agent-action-interface.js';
import { correlationTracer } from './monitoring/correlation-tracer.js';
import { metricsCollector } from './monitoring/metrics-collector.js';

export {
  run_cycle,
  scheduler,
  distributedScheduler,
  diraRiisEngine,
  executiveBriefGenerator,
  queueEngine,
  supabase,
  telemetry,
  logger,
  config,
  secretsManager,
  authMiddleware,
  webhookVerifier,
  ikl,
  routeApiRequest,
  startApiServer,
  propertyCalculators,
  gmailClient,
  googleCalendarClient,
  whatsAppBusinessClient,
  crmSyncClient,
  n8nWebhookClient,
  gmailAdapter,
  calendarAdapter,
  whatsAppCloudAdapter,
  toolRegistry,
  agentRuntime,
  AgentAction,
  AgentContext,
  ExecutionResult,
  correlationTracer,
  metricsCollector,
};

// If started directly, start autonomous scheduler with graceful signal handling
if (process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('raioc-os'))) {
  logger.info('SYSTEM', 'Booting RAIOC OS Autonomous Operating System (MAS-INFRA v1.0)...');

  distributedScheduler.start().catch((err) => {
    logger.error('SYSTEM', 'Fatal boot failure', { error: err.message });
    process.exit(1);
  });

  const handleShutdown = async (signal) => {
    logger.info('SYSTEM', `Received ${signal}, shutting down gracefully...`);
    await distributedScheduler.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}
