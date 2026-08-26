/**
 * RAIOC API - Assessment & Qualification Routes
 * Connects frontend assessment and private wealth intake flows directly into DIRA/RIIS engine,
 * Executive Brief generator, Event Bus v1.1, Supabase CRM, and Mission Control V1.
 */

import { diraRiisEngine } from '../../engines/dira-riis-engine.js';
import { executiveBriefGenerator } from '../../engines/executive-brief.js';
import { memorandumGenerator } from '../../engines/memorandum-generator.js';
import { supabase } from '../../db/supabase-client.js';
import { enterpriseEventBus } from '../../core/event-bus.js';
import { run_cycle } from '../../core/run-cycle.js';
import { logger } from '../../logging/audit-logger.js';

export async function handleAssessmentSubmission(payload = {}, options = {}) {
  const db = options.dbClient || supabase;

  try {
    const leadRecord = {
      id: payload.id || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: payload.name || payload.full_name || 'Private Investor',
      email: payload.email || '',
      phone: payload.phone || payload.whatsapp || payload.mobile || '',
      company: payload.company || payload.company_name || 'Private Wealth Mandate',
      company_size: payload.company_size || payload.employees || '1-19',
      ai_maturity: payload.ai_maturity || payload.automation_level || 'manual',
      timeline: payload.timeline || payload.urgency || payload.horizon || 'immediate',
      data_stack: payload.data_stack || payload.tech_stack || 'cloud',
      capital_band: payload.capital_band || payload.budget || payload.budget_aed || payload.budget_band || '5M+',
      budget_aed: payload.budget_aed || payload.budget || payload.capital_band || payload.budget_band || '5M+',
      strategic_focus: payload.strategic_focus || payload.strategicFocus || payload.investment_objective || 'off_plan_appreciation',
      tax_jurisdiction: payload.tax_jurisdiction || payload.taxJurisdiction || 'PT',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Parse numeric budget AED
    let numericBudget = 5000000;
    const rawBudget = String(leadRecord.budget_aed || '').toUpperCase();
    if (rawBudget.includes('30M') || rawBudget.includes('25M+') || rawBudget.includes('50M')) {
      numericBudget = 30000000;
    } else if (rawBudget.includes('15M') || rawBudget.includes('20M') || rawBudget.includes('10M')) {
      numericBudget = 15000000;
    } else if (rawBudget.includes('5M') || rawBudget.includes('5M+')) {
      numericBudget = 7500000;
    } else if (rawBudget.includes('2M') || rawBudget.includes('2.5M') || rawBudget.includes('2M-5M')) {
      numericBudget = 3500000;
    } else if (rawBudget.includes('1M') || rawBudget.includes('1M-2M')) {
      numericBudget = 1500000;
    } else if (!isNaN(Number(rawBudget)) && Number(rawBudget) > 0) {
      numericBudget = Number(rawBudget);
    }

    // Determine sovereign segment
    let segment = 'PT_HNW';
    const taxJ = String(leadRecord.tax_jurisdiction || '').toUpperCase();
    if (taxJ === 'ES') segment = 'ES_HNW';
    else if (taxJ === 'UK') segment = 'UK_NONDOM';
    else if (taxJ === 'UAE' || taxJ === 'GCC') segment = 'SOVEREIGN_FUND';
    else if (numericBudget >= 20000000) segment = 'FAMILY_OFFICE';
    else if (taxJ === 'INTL' || taxJ === 'INTERNATIONAL') segment = 'INSTITUTIONAL';

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
    brief.multimodal = memorandum.multimodal;
    brief.primaryVideo = memorandum.primaryVideo;
    brief.audioBriefing = memorandum.audioBriefing;

    // 4. Persist to Supabase Mock/Live Store
    if (db.isMock) {
      db.mockStore.leads.push(leadRecord);
    }
    await db.saveExecutiveBrief(brief);

    // 5. Sovereign Investor Record Ingestion (CRM & Mission Control)
    const investorRecord = await db.upsertInvestor({
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reference_id: `REF-WEB-${Date.now()}`,
      name: leadRecord.name,
      email: leadRecord.email,
      phone: leadRecord.phone,
      company: leadRecord.company,
      country: leadRecord.tax_jurisdiction === 'PT' ? 'Portugal' : leadRecord.tax_jurisdiction === 'ES' ? 'Spain' : leadRecord.tax_jurisdiction === 'UK' ? 'United Kingdom' : 'International',
      segment,
      status: 'NEW_LEAD',
      stage: 'NEW_LEAD',
      budget_aed: numericBudget,
      budget_usd: Math.round(numericBudget / 3.6725),
      target_thesis: leadRecord.strategic_focus,
      riis_score: intelligence.riis.score,
      dira_risk_level: intelligence.dira.riskLevel,
      golden_visa_eligible: numericBudget >= 2000000,
      escrow_protected: true,
      preferred_channel: payload.preferred_channel || (leadRecord.phone ? 'WHATSAPP' : 'EMAIL'),
      target_asset: payload.target_asset || (numericBudget >= 20000000 ? 'Palm Jebel Ali Corridor' : numericBudget >= 10000000 ? 'Como Residences' : 'Rosehill Dubai Hills'),
      notes: `Inbound Private Wealth Mandate via Website. Horizon: ${payload.horizon || 'Immediate'}. Focus: ${leadRecord.strategic_focus}.`,
      tags: [segment, 'WEBSITE_INTAKE', numericBudget >= 2000000 ? 'GOLDEN_VISA' : 'ENTRY_ALLOCATION'],
    });

    // 6. Log interaction in interaction_logs
    await db.logInteraction({
      channel: 'WEBSITE',
      event_type: 'INBOUND_PRIVATE_MANDATE',
      source_agent: 'MARK',
      direction: 'INBOUND',
      summary: `Private Wealth Mandate Ingested: ${leadRecord.name} (AED ${numericBudget.toLocaleString()})`,
      payload: {
        name: leadRecord.name,
        email: leadRecord.email,
        phone: leadRecord.phone,
        budget_aed: numericBudget,
        segment,
        strategic_focus: leadRecord.strategic_focus,
        horizon: payload.horizon || 'Immediate',
        preferred_channel: payload.preferred_channel || 'WHATSAPP',
      },
      latency_ms: 2,
      status: 'SUCCESS',
    });

    // 7. Publish CloudEvent v1.1 to Event Bus
    await enterpriseEventBus.publishEvent({
      type: 'raioc.investor.lead.ingested.v1',
      source: 'raioc://channels/website/intake',
      subject: investorRecord.id,
      correlation_id: `corr_web_${investorRecord.id}`,
      data: {
        investor_id: investorRecord.id,
        name: investorRecord.name,
        budget_aed: numericBudget,
        segment,
        riis_score: intelligence.riis.score,
        preferred_channel: investorRecord.preferred_channel,
      },
    });

    // 8. Trigger High-Value HITL Executive Approval if >= 10M AED
    if (numericBudget >= 10000000) {
      await db.createApproval({
        id: `appr_web_${Date.now()}`,
        action_type: 'HIGH_VALUE_MANDATE_ALLOCATION',
        action: 'HIGH_VALUE_MANDATE_ALLOCATION',
        risk_rating: 'HIGH',
        title: `High-Value Allocation Request via Website (${numericBudget.toLocaleString()} AED)`,
        summary: `Investor ${leadRecord.name} requested advisory mandate with allocation AED ${numericBudget.toLocaleString()}`,
        payload_summary: `High-Value Private Wealth Mandate (${numericBudget.toLocaleString()} AED)`,
        agent: 'MARK',
        requester_agent: 'MARK',
        recipient: leadRecord.name,
        targetAsset: investorRecord.target_asset,
        priority: 'CRITICAL',
        payload: {
          investor_id: investorRecord.id,
          budget_aed: numericBudget,
          segment,
        },
      });
    }

    // 9. Enqueue Multi-Channel Dispatches
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

    // 10. Trigger run_cycle asynchronously
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
        ok: true,
        success: true,
        status: 'INGESTED',
        leadId: leadRecord.id,
        investorId: investorRecord.id,
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
        ok: false,
        success: false,
        error: err.message,
      },
    };
  }
}
