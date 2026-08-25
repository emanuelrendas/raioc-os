/**
 * RAIOC API - Assessment & Qualification Routes
 * Connects frontend assessment flows directly into DIRA/RIIS engine, Executive Brief generator, and run_cycle pipeline.
 */

import { diraRiisEngine } from '../../engines/dira-riis-engine.js';
import { executiveBriefGenerator } from '../../engines/executive-brief.js';
import { memorandumGenerator } from '../../engines/memorandum-generator.js';
import { supabase } from '../../db/supabase-client.js';
import { run_cycle } from '../../core/run-cycle.js';
import { logger } from '../../logging/audit-logger.js';

export async function handleAssessmentSubmission(payload = {}, options = {}) {
  const db = options.dbClient || supabase;

  try {
    const leadRecord = {
      id: payload.id || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: payload.name || payload.full_name || 'Executive Lead',
      email: payload.email || '',
      phone: payload.phone || payload.whatsapp || '',
      company: payload.company || payload.company_name || 'Private Client',
      company_size: payload.company_size || payload.employees || '1-19',
      ai_maturity: payload.ai_maturity || payload.automation_level || 'manual',
      timeline: payload.timeline || payload.urgency || 'immediate',
      data_stack: payload.data_stack || payload.tech_stack || 'cloud',
      capital_band: payload.capital_band || payload.budget || payload.budget_aed || '5M+',
      budget_aed: payload.budget_aed || payload.budget || payload.capital_band || '5M+',
      strategic_focus: payload.strategic_focus || payload.strategicFocus || 'off_plan_appreciation',
      tax_jurisdiction: payload.tax_jurisdiction || payload.taxJurisdiction || 'INTERNATIONAL',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // 1. Run IKL-backed DIRA & RIIS Intelligence Evaluation
    const intelligence = diraRiisEngine.analyze(leadRecord);

    // 2. Generate Autonomous Institutional Investment Memorandum
    const memorandum = memorandumGenerator.generate(leadRecord, intelligence);

    // 3. Generate Executive Brief
    const brief = executiveBriefGenerator.generate(leadRecord, intelligence);
    brief.memorandum = memorandum;
    brief.memorandumId = memorandum.id;
    brief.memorandumMarkdown = memorandum.markdown;
    brief.matchingProjects = memorandum.matchingProjects;
    brief.sections = memorandum.sections;
    brief.budgetAed = memorandum.budgetAed;

    // 4. Persist to Supabase Mock/Live Store
    if (db.isMock) {
      db.mockStore.leads.push(leadRecord);
    }
    await db.saveExecutiveBrief(brief);

    // 4. Enqueue Multi-Channel Dispatches
    if (brief.dispatchPayloads.whatsapp.recipient) {
      await db.enqueueDispatch({
        type: 'whatsapp',
        recipient: brief.dispatchPayloads.whatsapp.recipient,
        payload: brief.dispatchPayloads.whatsapp,
        priority: 2,
      });
    }

    if (brief.dispatchPayloads.email.recipient) {
      await db.enqueueDispatch({
        type: 'email',
        recipient: brief.dispatchPayloads.email.recipient,
        payload: brief.dispatchPayloads.email,
        priority: 1,
      });
    }

    await db.enqueueDispatch({
      type: 'crm',
      recipient: 'crm_system',
      payload: brief.dispatchPayloads.crm,
      priority: 1,
    });

    // 5. Trigger run_cycle asynchronously or synchronously if requested
    if (options.triggerCycle !== false) {
      run_cycle({ dbClient: db }).catch((err) => {
        logger.error('API_ASSESSMENT', 'Background cycle execution failed', { error: err.message });
      });
    }

    logger.audit('API_ASSESSMENT', 'ASSESSMENT_SUBMITTED', leadRecord.id, 'new', 'processed', {
      riisScore: intelligence.riis.score,
      diraRisk: intelligence.dira.riskLevel,
    });

    return {
      status: 200,
      body: {
        success: true,
        status: 'INGESTED',
        leadId: leadRecord.id,
        briefId: brief.id,
        riis: intelligence.riis,
        dira: intelligence.dira,
        persona: intelligence.persona,
        recommendedStrategy: intelligence.strategy,
        executiveBrief: brief,
        memorandum: brief.memorandum,
        actionPlan: brief.actionPlan,
        iklVersion: intelligence.iklVersion,
      },
    };
  } catch (err) {
    logger.error('API_ASSESSMENT', 'Failed processing assessment submission', { error: err.message });
    return {
      status: 500,
      body: {
        success: false,
        error: err.message,
      },
    };
  }
}
