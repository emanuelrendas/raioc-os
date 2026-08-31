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

// Register adapters into the Queue Engine
queueEngine.registerAdapter('whatsapp', whatsAppAdapter);
queueEngine.registerAdapter('email', emailAdapter);
queueEngine.registerAdapter('crm', crmAdapter);

/**
 * Confirms that a lead status write actually reached storage.
 *
 * updateLeadStatus swallows its own failures, so its return value is the only
 * evidence the caller has. It resolves to:
 *   null        the write threw and was caught inside the client
 *   undefined   mock store held no lead with that id
 *   []          PostgREST matched zero rows (Prefer: return=representation)
 *   [{...}]     the row was written
 *   {...}       mock store wrote the row
 *
 * Only the last two are a persisted transition. An empty array is truthy, so a
 * plain falsy check would read a zero-row write as success — the exact silent
 * false-success this gate exists to prevent.
 *
 * @param {*} result - value resolved by updateLeadStatus
 * @returns {boolean} true only when a row was demonstrably written
 */
function isStatusPersisted(result) {
  if (result === null || result === undefined) return false;
  if (Array.isArray(result)) return result.length > 0;
  return typeof result === 'object';
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

  logger.info('RUN_CYCLE', `Starting autonomous execution cycle at ${new Date().toISOString()}`);

  const summary = {
    leadsProcessed: 0,
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
  };

  try {
    // 1. Fetch pending leads
    const pendingLeads = await db.fetchPendingLeads(batchSize);
    logger.info('RUN_CYCLE', `Retrieved ${pendingLeads.length} pending leads`);

    // 2. Process each lead
    for (const lead of pendingLeads) {
      try {
        // Mark lead as processing.
        // Fail closed: this transition must be confirmed durable before the lead
        // reaches any externally-visible step. If storage did not accept it we
        // abort this lead rather than dispatch on state we failed to record.
        const marked = await db.updateLeadStatus(lead.id, 'processing');
        if (!isStatusPersisted(marked)) {
          summary.failures.processing++;
          logger.error(
            'RUN_CYCLE',
            `Aborting lead ${lead.id}: initial status transition was not persisted`,
            { leadId: lead.id, attemptedStatus: 'processing' }
          );
          continue;
        }

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

        // Automated Webhook & VIP Bridge: Dispatch QUALIFIED_LEAD to n8n and Telegram
        const correlationId = lead.correlation_id || lead.metadata?.correlationId || `corr_cycle_${lead.id}_${Date.now()}`;
        await dispatchN8nEvent('QUALIFIED_LEAD', {
          lead,
          intelligence,
          brief,
          correlationId,
        });
        summary.dispatches.n8n++;

        await sendTelegramAlert('NOTIF_QUALIFIED_LEAD', {
          lead,
          intelligence,
          brief,
          correlationId,
        });
        summary.dispatches.telegram++;

        // Enqueue Dispatches
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

        await db.enqueueDispatch({
          type: 'crm',
          recipient: 'crm_system',
          payload: brief.dispatchPayloads.crm,
          priority: 1,
        });
        summary.dispatches.crm++;

        // Mark lead as completed
        await db.updateLeadStatus(lead.id, 'completed');

        summary.leadsProcessed++;
        logger.audit('RUN_CYCLE', 'LEAD_PROCESSED', lead.id, 'pending', 'completed', {
          riisScore: intelligence.riis.score,
          diraRisk: intelligence.dira.riskLevel,
        });
      } catch (leadError) {
        summary.failures.processing++;
        logger.error('RUN_CYCLE', `Failed processing lead ${lead.id}`, { error: leadError.message });
        await db.updateLeadStatus(lead.id, 'failed');
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

    // 4. Process the Dispatch Queue
    const queueOutcome = await queueEngine.processQueue(db, batchSize);
    summary.queueResults = queueOutcome;
    summary.failures.dispatch += queueOutcome.failed;

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
