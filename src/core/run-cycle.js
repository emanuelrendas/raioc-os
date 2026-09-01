/**
 * RAIOC OS - Autonomous Run Cycle Engine
 * Coordinates the full processing loop: Ingestion -> DIRA/RIIS Scoring -> Executive Brief -> Dispatch Queue -> Telemetry.
 */

import { config } from '../config/env.js';
import { supabase } from '../db/supabase-client.js';
import { diraRiisEngine } from '../engines/dira-riis-engine.js';
import { executiveBriefGenerator } from '../engines/executive-brief.js';
import { memorandumGenerator } from '../engines/memorandum-generator.js';
import { queueEngine } from '../engines/queue-engine.js';
import { whatsAppAdapter } from '../adapters/whatsapp-adapter.js';
import { emailAdapter } from '../adapters/email-adapter.js';
import { crmAdapter } from '../adapters/crm-adapter.js';
import { dispatchN8nEvent } from '../adapters/n8n-adapter.js';
import { sendTelegramAlert } from '../adapters/telegram-adapter.js';
import { logger } from '../logging/audit-logger.js';
import { telemetry } from '../logging/telemetry.js';
import {
  ACQUIRE_OUTCOME,
  EFFECT_TYPES,
  acquireLeadExecution,
  completeLeadExecution,
  concludeFailedAttempt,
  dispatchGuardedEffect,
} from './execution-authority.js';

// Register adapters into the Queue Engine
queueEngine.registerAdapter('whatsapp', whatsAppAdapter);
queueEngine.registerAdapter('email', emailAdapter);
queueEngine.registerAdapter('crm', crmAdapter);

const RUNTIME_EXECUTION_MODES = new Set(['off', 'canary', 'active']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolves the only admission policy for lead execution. This intentionally
 * reads process.env per cycle so an operator-controlled deployment setting is
 * evaluated at execution time, and every absent or invalid configuration stops.
 */
function resolveRuntimeExecution() {
  const configuredMode = process.env.RAIOC_RUNTIME_EXECUTION_MODE;
  if (!RUNTIME_EXECUTION_MODES.has(configuredMode)) {
    return {
      mode: 'off',
      enabled: false,
      reason: configuredMode === undefined ? 'RUNTIME_MODE_OFF_BY_DEFAULT' : 'RUNTIME_MODE_INVALID',
      canaryLeadIds: [],
    };
  }

  if (configuredMode === 'off') {
    return { mode: 'off', enabled: false, reason: 'RUNTIME_MODE_OFF', canaryLeadIds: [] };
  }

  if (configuredMode === 'active') {
    return { mode: 'active', enabled: true, reason: null, canaryLeadIds: [] };
  }

  const rawCanaryLeadIds = process.env.RAIOC_CANARY_LEAD_IDS;
  if (typeof rawCanaryLeadIds !== 'string' || rawCanaryLeadIds.trim() === '') {
    return { mode: 'canary', enabled: false, reason: 'CANARY_LEAD_IDS_EMPTY', canaryLeadIds: [] };
  }

  const canaryLeadIds = rawCanaryLeadIds.split(',').map((leadId) => leadId.trim());
  if (canaryLeadIds.some((leadId) => !UUID_PATTERN.test(leadId))) {
    return { mode: 'canary', enabled: false, reason: 'CANARY_LEAD_IDS_INVALID', canaryLeadIds: [] };
  }

  return {
    mode: 'canary',
    enabled: true,
    reason: null,
    // UUIDs are case-insensitive identifiers. Normalising gives the allowlist
    // exact, stable comparison semantics regardless of database casing.
    canaryLeadIds: [...new Set(canaryLeadIds.map((leadId) => leadId.toLowerCase()))],
  };
}

/**
 * Executes a single complete autonomous processing cycle
 * @param {Object} options - Cycle configuration overrides
 * @returns {Promise<Object>} Cycle execution summary
 */
export async function run_cycle(options = {}) {
  const startTime = Date.now();
  const db = options.dbClient || supabase;
  const batchSize = options.batchSize || 50;
  const runtimeExecution = resolveRuntimeExecution();

  logger.info('RUN_CYCLE', `Starting autonomous execution cycle at ${new Date().toISOString()}`);

  const summary = {
    leadsProcessed: 0,
    leadsSkipped: 0,
    assessmentsProcessed: 0,
    executiveBriefsGenerated: 0,
    dispatches: {
      whatsapp: 0,
      email: 0,
      crm: 0,
      n8n: 0,
      telegram: 0,
    },
    queueResults: {
      processed: 0,
      successful: 0,
      retrying: 0,
      failed: 0,
    },
    failures: {
      processing: 0,
      dispatch: 0,
      recovery: 0,
    },
    skippedByConsent: {
      whatsapp: 0,
      email: 0,
    },
    runtimeExecution: {
      mode: runtimeExecution.mode,
      enabled: runtimeExecution.enabled,
      reason: runtimeExecution.reason,
      canaryLeadCount: runtimeExecution.canaryLeadIds.length,
    },
  };

  // This is deliberately before discovery, claiming, assessment work, queue
  // writes, and provider calls. A missing, malformed, or explicitly-off mode
  // is a production safety stop, not an empty successful processing cycle.
  if (!runtimeExecution.enabled) {
    const durationMs = Date.now() - startTime;
    telemetry.recordCycle(durationMs, summary);
    logger.warn('RUN_CYCLE', 'Runtime execution is disabled; no lead discovery, claim, effect, or dispatch was attempted', {
      mode: runtimeExecution.mode,
      reason: runtimeExecution.reason,
    });
    return {
      status: 'DISABLED',
      durationMs,
      summary,
      telemetry: telemetry.getSnapshot(),
    };
  }

  try {
    // 1. Fetch pending leads
    const pendingLeads = await db.fetchPendingLeads(
      batchSize,
      runtimeExecution.mode === 'canary' ? { leadIds: runtimeExecution.canaryLeadIds } : undefined,
    );
    // The database predicate is the efficient discovery boundary. Keep this
    // local allowlist check as a second boundary: a client implementation that
    // ignores the optional predicate can never turn a historical lead into a
    // claimable one.
    const eligibleLeads = runtimeExecution.mode === 'canary'
      ? pendingLeads.filter((lead) => runtimeExecution.canaryLeadIds.includes(String(lead.id).toLowerCase()))
      : pendingLeads;
    logger.info('RUN_CYCLE', `Retrieved ${eligibleLeads.length} pending leads`, {
      mode: runtimeExecution.mode,
    });

    // 2. Process each lead
    for (const lead of eligibleLeads) {
      // Discovery is not authority (ADR-015D). Only a database claim grants the
      // right to score this lead or to contact anyone about it.
      let handle;
      try {
        const acquisition = await acquireLeadExecution(db, lead.id);
        if (acquisition.outcome !== ACQUIRE_OUTCOME.CLAIMED) {
          summary.leadsSkipped++;
          logger.info('RUN_CYCLE', `Skipping lead ${lead.id}: ${acquisition.reason}`);
          continue;
        }
        handle = {
          execution: acquisition.execution,
          claimVersion: acquisition.claimVersion,
        };
      } catch (claimError) {
        // Fail-closed law: if the execution layer cannot answer, nothing runs.
        summary.failures.processing++;
        logger.error('RUN_CYCLE', `Could not establish execution authority for lead ${lead.id}; no processing, no effects`, {
          error: claimError.message,
        });
        continue;
      }

      try {
        // Execute DIRA & RIIS intelligence assessment
        const intelligence = diraRiisEngine.analyze(lead);

        // Generate Autonomous Institutional Investment Memorandum
        const memorandum = memorandumGenerator.generate(lead, intelligence);

        // Generate Executive Brief
        const brief = executiveBriefGenerator.generate(lead, intelligence);
        brief.memorandum = memorandum;
        brief.memorandumId = memorandum.id;
        brief.memorandumMarkdown = memorandum.markdown;
        brief.matchingProjects = memorandum.matchingProjects;
        brief.sections = memorandum.sections;
        brief.budgetAed = memorandum.budgetAed;
        brief.multimodal = memorandum.multimodal;
        brief.primaryVideo = memorandum.primaryVideo;
        brief.audioBriefing = memorandum.audioBriefing;

        // Save Executive Brief to Supabase
        await db.saveExecutiveBrief(brief);
        summary.executiveBriefsGenerated++;

        // Automated Webhook & VIP Bridge: Dispatch QUALIFIED_LEAD to n8n and Telegram.
        // Both are direct externally-visible effects, so each one goes through
        // execution-effect authority: ownership is re-proven and the effect is
        // reserved before the provider is contacted, and never twice.
        const correlationId = lead.correlation_id || lead.metadata?.correlationId || `corr_cycle_${lead.id}_${Date.now()}`;

        const n8nOutcome = await dispatchGuardedEffect(
          db,
          handle,
          EFFECT_TYPES.N8N_WEBHOOK,
          () => dispatchN8nEvent('QUALIFIED_LEAD', { lead, intelligence, brief, correlationId })
        );
        if (n8nOutcome.dispatched) summary.dispatches.n8n++;

        const telegramOutcome = await dispatchGuardedEffect(
          db,
          handle,
          EFFECT_TYPES.TELEGRAM_ALERT,
          () => sendTelegramAlert('NOTIF_QUALIFIED_LEAD', { lead, intelligence, brief, correlationId })
        );
        if (telegramOutcome.dispatched) summary.dispatches.telegram++;

        // Enqueue Dispatches
        if (lead.consent_status === 'opted_in') {
          if (brief.dispatchPayloads.whatsapp.recipient) {
            await db.enqueueDispatch({
              type: 'whatsapp',
              recipient: brief.dispatchPayloads.whatsapp.recipient,
              payload: brief.dispatchPayloads.whatsapp,
              priority: 2,
            });
            summary.dispatches.whatsapp++;
          }

          if (brief.dispatchPayloads.email.recipient) {
            await db.enqueueDispatch({
              type: 'email',
              recipient: brief.dispatchPayloads.email.recipient,
              payload: brief.dispatchPayloads.email,
              priority: 1,
            });
            summary.dispatches.email++;
          }
        } else {
          // Consent is intentionally read-only. Unknown or any non-opted-in
          // state means no customer-facing queue entry and no synthetic success.
          summary.skippedByConsent.whatsapp++;
          summary.skippedByConsent.email++;
          logger.info('RUN_CYCLE', `Skipped customer-facing dispatches for lead ${lead.id}: consent is not opted_in`);
        }

        await db.enqueueDispatch({
          type: 'crm',
          recipient: 'crm_system',
          payload: brief.dispatchPayloads.crm,
          priority: 1,
        });
        summary.dispatches.crm++;

        // Terminal success on the execution, conditional on still owning it.
        // leads.status is untouched: finishing the workflow is not a business
        // qualification decision.
        const completed = await completeLeadExecution(db, handle);
        if (!completed) {
          summary.leadsSkipped++;
          logger.warn('RUN_CYCLE', `Lead ${lead.id} processed but claim was taken over before completion; not recorded as completed`, {
            executionId: handle.execution.id,
            claimVersion: handle.claimVersion,
          });
          continue;
        }

        summary.leadsProcessed++;
        logger.audit('RUN_CYCLE', 'LEAD_EXECUTION_COMPLETED', lead.id, 'RUNNING', 'COMPLETED', {
          executionId: handle.execution.id,
          claimVersion: handle.claimVersion,
          riisScore: intelligence.riis.score,
          diraRisk: intelligence.dira.riskLevel,
        });
      } catch (leadError) {
        summary.failures.processing++;
        logger.error('RUN_CYCLE', `Failed processing lead ${lead.id}`, { error: leadError.message });

        // The execution keeps its identity and its remaining attempts; it
        // becomes reclaimable when the lease lapses. The lead's business status
        // is not touched because a worker failure says nothing about the lead.
        try {
          await concludeFailedAttempt(db, handle);
        } catch (ledgerError) {
          logger.error('RUN_CYCLE', `Could not record attempt outcome for lead ${lead.id}`, {
            error: ledgerError.message,
          });
        }
      }
    }

    // 3. Fetch pending assessments (if separate table)
    const pendingAssessments = await db.fetchPendingAssessments(batchSize);
    for (const assessment of pendingAssessments) {
      try {
        const intelligence = diraRiisEngine.analyze(assessment);
        await db.updateAssessmentStatus(
          assessment.id,
          'completed',
          intelligence.riis.score,
          intelligence.dira
        );
        summary.assessmentsProcessed++;
      } catch (assessmentError) {
        summary.failures.processing++;
        logger.error('RUN_CYCLE', `Failed processing assessment ${assessment.id}`, {
          error: assessmentError.message,
        });
      }
    }

    // 4. Process the Dispatch Queue only in active mode. A canary can create
    // work for its exact allowlisted lead, but must never drain unrelated legacy
    // queue entries that cannot be attributed to that selected lead.
    if (runtimeExecution.mode === 'active') {
      const queueOutcome = await queueEngine.processQueue(db, batchSize);
      summary.queueResults = queueOutcome;
      summary.failures.dispatch += queueOutcome.failed;
    } else {
      logger.info('RUN_CYCLE', 'Canary cycle did not drain the global dispatch queue');
    }

    // 5. Compute Cycle Telemetry
    const durationMs = Date.now() - startTime;
    telemetry.recordCycle(durationMs, summary);

    logger.info('RUN_CYCLE', `Completed cycle in ${durationMs}ms: ${summary.leadsProcessed} leads processed, ${summary.queueResults.successful} dispatches succeeded`);

    return {
      status: 'SUCCESS',
      durationMs,
      summary,
      telemetry: telemetry.getSnapshot(),
    };
  } catch (cycleError) {
    const durationMs = Date.now() - startTime;
    summary.failures.processing++;
    telemetry.recordFailure('processing');
    logger.error('RUN_CYCLE', 'Cycle execution encountered critical error', { error: cycleError.message });

    return {
      status: 'ERROR',
      durationMs,
      error: cycleError.message,
      summary,
      telemetry: telemetry.getSnapshot(),
    };
  }
}

// CLI runner if executed directly
if (process.argv[1] && process.argv[1].endsWith('run-cycle.js')) {
  run_cycle()
    .then((result) => {
      console.log('CYCLE_EXECUTION_RESULT:', JSON.stringify(result, null, 2));
      process.exit(result.status === 'SUCCESS' ? 0 : 1);
    })
    .catch((err) => {
      console.error('FATAL_CYCLE_ERROR:', err);
      process.exit(1);
    });
}
