/**
 * RAIOC API - CRM & n8n Lead Ingestion Routes
 * Handles segmented inbound leads for Portugal (PT_HNW), Spain (ES_HNW),
 * UK Non-Dom (UK_NONDOM), and DLD Green List (DLD_BUYER, DLD_SELLER).
 * Automatically triggers DIRA/RIIS intelligence scoring, assigns target investment theses
 * (Opal ROI / Escrow Guarantee), emits Event Bus notifications, and syncs to CRM & n8n.
 */

import { diraRiisEngine } from '../../engines/dira-riis-engine.js';
import { executiveBriefGenerator } from '../../engines/executive-brief.js';
import { memorandumGenerator } from '../../engines/memorandum-generator.js';
import { propertyCalculators } from '../calculators/property-calculators.js';
import { supabase } from '../../db/supabase-client.js';
import { agentEventBus, AgentEvents } from '../../events/agent-event-bus.js';
import { crmSyncClient } from '../../integrations/crm/crm-sync-client.js';
import { n8nWebhookClient } from '../../integrations/n8n/n8n-webhook-client.js';
import { run_cycle } from '../../core/run-cycle.js';
import { correlationTracer } from '../../monitoring/correlation-tracer.js';
import { logger } from '../../logging/audit-logger.js';

export const SUPPORTED_CRM_SEGMENTS = {
  PT_HNW: {
    code: 'PT_HNW',
    name: 'Portugal HNW / NHR Transition',
    country: 'Portugal',
    defaultBudgetAed: 15000000,
    thesisType: 'OPAL_ROI_ESCROW_GUARANTEE',
    thesisTitle: 'Opal ROI / Escrow Guarantee',
    strategicFocus: 'sovereign_capital_preservation',
    description: 'Capital preservation and Golden Visa arbitrage following Portugal NHR sunset; allocation into Dubai Tier-1 prime assets with 100% Escrow Law No. 8 and 7.2%+ audited net yields.',
    keyCatalysts: [
      'Portugal NHR Regime Sunset & European Wealth Tax Hedge',
      'UAE Cabinet Resolution No. 65 of 2022 (10-Year Golden Visa AED 2M+ Equity)',
      'Dubai Law No. (8) of 2007 (100% Escrow Trust Banking)',
    ],
  },
  ES_HNW: {
    code: 'ES_HNW',
    name: 'Spain HNW / Wealth Tax Hedge',
    country: 'Spain',
    defaultBudgetAed: 18000000,
    thesisType: 'OPAL_ROI_CAPITAL_SHIELD',
    thesisTitle: 'Opal ROI / Capital Shield',
    strategicFocus: 'sovereign_wealth_hedge',
    description: 'Direct hedge against Spanish Solidarity Wealth Tax and regional surcharges; tax-neutral capital growth in Dubai prime corridors with guaranteed decennial structural warranties.',
    keyCatalysts: [
      'Spanish Solidarity Wealth Tax & Real Estate Surcharge Neutralization',
      '0% Personal Income & Capital Gains Tax Environment',
      'UAE Civil Code Art. 880 (10-Year Decennial Structural Warranty)',
    ],
  },
  UK_NONDOM: {
    code: 'UK_NONDOM',
    name: 'UK Non-Dom Abolition Sovereign Shield',
    country: 'United Kingdom',
    defaultBudgetAed: 25000000,
    thesisType: 'ESCROW_GUARANTEE_SOVEREIGN_SAFE_HAVEN',
    thesisTitle: 'Escrow Guarantee / Sovereign Safe Haven',
    strategicFocus: 'international_tax_optimization',
    description: 'Preemptive offshore reallocation against UK non-domiciled regime abolition and worldwide inheritance tax exposure; ultra-secure Dubai statutory trust banking and freehold ownership.',
    keyCatalysts: [
      'UK Non-Domiciled Tax Status Abolition & Worldwide IHT Shield',
      'Dubai Law No. (7) of 2006 (Designated Foreign Freehold Property Ownership)',
      'Bank of International Settlements (BIS) Capital Stability Anchor',
    ],
  },
  DLD_BUYER: {
    code: 'DLD_BUYER',
    name: 'DLD Green List Verified Buyer',
    country: 'United Arab Emirates',
    defaultBudgetAed: 12000000,
    thesisType: 'OPAL_ROI_OFFPLAN_APPRECIATION',
    thesisTitle: 'Opal ROI / Off-Plan Capital Appreciation',
    strategicFocus: 'off_plan_appreciation',
    description: 'Priority developer pre-launch allocation with Mollak-audited service charges and high yield appreciation arbitrage; Golden Visa automatic qualification.',
    keyCatalysts: [
      'DLD Registered Transaction Verified Pricing & Median Indexation',
      'Mollak Audited Service Charge Escrow Framework',
      'Pre-Handover Capital Gain Harvesting (30-40% Payment Milestones)',
    ],
  },
  DLD_SELLER: {
    code: 'DLD_SELLER',
    name: 'DLD Green List Verified Seller',
    country: 'United Arab Emirates',
    defaultBudgetAed: 20000000,
    thesisType: 'ESCROW_GUARANTEE_EQUITY_HARVEST',
    thesisTitle: 'Escrow Guarantee / Equity Harvest & Reallocation',
    strategicFocus: 'equity_harvest_reinvestment',
    description: 'Secondary portfolio equity extraction at market peak; 1031-style tax-free redeployment into high-yielding off-plan development tranches with built-in construction-linked escrow milestone releases.',
    keyCatalysts: [
      'Secondary Market Peak Valuation Liquidity Harvesting',
      '100% Trust Escrow Release Control under Dubai Law No. 8 of 2007',
      'Tax-Free Redeployment into Prime Infrastructure Corridors (Dubai South / Palm Jebel Ali)',
    ],
  },
};

/**
 * Computes targeted investment thesis and statutory financial anchors
 * @param {string} segmentCode 
 * @param {number} budgetAed 
 * @param {Object} intelligence 
 * @returns {Object}
 */
export function buildTargetThesis(segmentCode, budgetAed = 10000000, intelligence = {}) {
  const segmentConfig = SUPPORTED_CRM_SEGMENTS[segmentCode] || SUPPORTED_CRM_SEGMENTS.DLD_BUYER;
  const price = Number(budgetAed) || segmentConfig.defaultBudgetAed;

  // Compute standard statutory and yield metrics
  const acquisitionCost = propertyCalculators.calculateAcquisitionCost({ propertyPriceAed: price, price });
  const goldenVisa = propertyCalculators.calculateGoldenVisaEligibility({ totalPropertyEquityAed: price, propertyValueAed: price });
  const rentalYield = propertyCalculators.calculateRentalYield({
    propertyPriceAed: price,
    annualRentAed: price * 0.075,
    serviceChargesPerSqFt: 18,
    propertySqFt: Math.round(price / 3200),
  });

  return {
    segment: segmentConfig.code,
    segmentName: segmentConfig.name,
    country: segmentConfig.country,
    thesisType: segmentConfig.thesisType,
    thesisTitle: segmentConfig.thesisTitle,
    strategicFocus: segmentConfig.strategicFocus,
    description: segmentConfig.description,
    keyCatalysts: segmentConfig.keyCatalysts,
    statutoryShield: {
      goldenVisaEligible: goldenVisa.isEligible,
      goldenVisaThresholdAed: goldenVisa.thresholdAed || 2000000,
      goldenVisaDecree: 'UAE Cabinet Resolution No. 65 of 2022',
      escrowGuaranteeLaw: 'Dubai Law No. (8) of 2007 (100% Escrow Banking + 5% Defect Retention)',
      decennialWarrantyCode: 'UAE Civil Code Article 880 (10-Year Structural Liability)',
      freeholdLaw: 'Dubai Law No. (7) of 2006 (Foreign Ownership in Designated Freehold Zones)',
    },
    financialMetrics: {
      allocatedBudgetAed: price,
      allocatedBudgetUsd: Math.round(price / 3.6725),
      dldTransferFeeAed: acquisitionCost.breakdown?.dldTransferFee || Math.round(price * 0.04),
      totalAcquisitionCostAed: acquisitionCost.breakdown?.totalAcquisitionCosts || Math.round(price * 0.065),
      totalOutlayAed: acquisitionCost.totalOutlayAed || Math.round(price * 1.065),
      projectedGrossYieldPct: rentalYield.longTerm?.grossYieldPercent || 7.5,
      projectedNetYieldPct: rentalYield.longTerm?.netYieldPercent || 6.8,
      annualNetIncomeAed: rentalYield.longTerm?.annualNetIncomeAed || Math.round(price * 0.068),
    },
  };
}

/**
 * Normalizes inbound lead payloads from various formats (camelCase, snake_case, webhook)
 * @param {Object} raw 
 * @returns {Object}
 */
export function normalizeLeadPayload(raw = {}) {
  const payload = raw.lead || raw.data || raw;

  // Segment normalization
  let rawSegment = (payload.segment || payload.campaign_segment || payload.lead_segment || '').toString().trim().toUpperCase();
  if (!SUPPORTED_CRM_SEGMENTS[rawSegment]) {
    // Infer segment from country or notes if not explicitly specified
    const country = (payload.country || payload.location || '').toString().toLowerCase();
    const notes = (payload.notes || payload.mandate || '').toString().toLowerCase();

    if (rawSegment.includes('PT') || country.includes('portugal') || notes.includes('nhr') || notes.includes('portug')) {
      rawSegment = 'PT_HNW';
    } else if (rawSegment.includes('ES') || country.includes('spain') || notes.includes('beckham') || country.includes('españa')) {
      rawSegment = 'ES_HNW';
    } else if (rawSegment.includes('UK') || country.includes('uk') || country.includes('united kingdom') || country.includes('london') || notes.includes('non-dom') || notes.includes('nondom')) {
      rawSegment = 'UK_NONDOM';
    } else if (rawSegment.includes('SELL') || notes.includes('seller') || notes.includes('selling') || notes.includes('secondary')) {
      rawSegment = 'DLD_SELLER';
    } else {
      rawSegment = 'DLD_BUYER';
    }
  }

  const segmentConfig = SUPPORTED_CRM_SEGMENTS[rawSegment] || SUPPORTED_CRM_SEGMENTS.DLD_BUYER;

  // Budget normalization
  let rawBudget = payload.budgetAed ?? payload.budget_aed ?? payload.budget ?? payload.capital_band;
  let parsedBudget = null;
  if (typeof rawBudget === 'number' && !isNaN(rawBudget)) {
    parsedBudget = rawBudget;
  } else if (typeof rawBudget === 'string') {
    const num = parseFloat(rawBudget.replace(/[^0-9.]/g, ''));
    if (!isNaN(num)) {
      if (rawBudget.toLowerCase().includes('m')) parsedBudget = num * 1000000;
      else if (rawBudget.toLowerCase().includes('k')) parsedBudget = num * 1000;
      else parsedBudget = num;
    }
  }
  if (!parsedBudget || parsedBudget < 100000) {
    parsedBudget = segmentConfig.defaultBudgetAed;
  }

  const country = payload.country || payload.location || segmentConfig.country;
  const name = payload.name || payload.contact_name || payload.fullName || payload.full_name || 'Private Sovereign Client';
  const email = (payload.email || payload.contact_email || '').trim().toLowerCase();
  const phone = (payload.phone || payload.mobile || payload.whatsapp || '').trim();
  const notes = payload.notes || payload.mandate_description || payload.mandate || payload.comments || '';

  return {
    id: payload.id || `lead_crm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    email,
    phone,
    country,
    segment: segmentConfig.code,
    budgetAed: parsedBudget,
    budget_aed: parsedBudget,
    company: payload.company || payload.company_name || `${name} Family Office`,
    notes,
    timeline: payload.timeline || 'immediate',
    strategic_focus: segmentConfig.strategicFocus,
    tax_jurisdiction: segmentConfig.country.toUpperCase(),
    ai_maturity: payload.ai_maturity || 'advanced',
    data_stack: payload.data_stack || 'cloud_enterprise',
    origin: payload.origin || 'n8n_crm_pipeline',
    source: payload.source || 'crm_webhook',
    created_at: new Date().toISOString(),
  };
}

/**
 * Core Lead Ingestion Logic
 * Ingests lead, runs DIRA/RIIS intelligence, assigns target thesis, generates brief/memo,
 * emits LEAD_INGESTED event, and notifies CRM/n8n.
 * 
 * @param {Object} body 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
export async function ingestCrmLead(body = {}, options = {}) {
  const db = options.dbClient || supabase;
  const correlationId = options.correlationId || correlationTracer.generateCorrelationId('crm_lead');

  // 1. Normalize Lead Record
  const leadRecord = normalizeLeadPayload(body);

  // 2. Run IKL-backed DIRA & RIIS Intelligence Evaluation
  const intelligence = diraRiisEngine.analyze(leadRecord);

  // 3. Construct Target Investment Thesis (Opal ROI / Escrow Guarantee)
  const targetThesis = buildTargetThesis(leadRecord.segment, leadRecord.budgetAed, intelligence);

  // 4. Generate Autonomous Institutional Memorandum & Executive Brief
  const memorandum = memorandumGenerator.generate(leadRecord, intelligence);
  const brief = executiveBriefGenerator.generate(leadRecord, intelligence);
  brief.targetThesis = targetThesis;
  brief.memorandum = memorandum;
  brief.memorandumId = memorandum.id;
  brief.memorandumMarkdown = memorandum.markdown;
  brief.matchingProjects = memorandum.matchingProjects;
  brief.sections = memorandum.sections;
  brief.budgetAed = leadRecord.budgetAed;

  // 5. Persist to Database / Memory Store
  if (db.isMock) {
    db.mockStore.leads = db.mockStore.leads || [];
    db.mockStore.leads.push(leadRecord);
  }
  await db.saveExecutiveBrief(brief);

  // 6. Queue Multi-Channel Dispatches
  if (brief.dispatchPayloads.whatsapp?.recipient) {
    await db.enqueueDispatch({
      type: 'whatsapp',
      recipient: brief.dispatchPayloads.whatsapp.recipient,
      payload: {
        ...brief.dispatchPayloads.whatsapp,
        targetThesisTitle: targetThesis.thesisTitle,
      },
      priority: 2,
    });
  }

  if (brief.dispatchPayloads.email?.recipient) {
    await db.enqueueDispatch({
      type: 'email',
      recipient: brief.dispatchPayloads.email.recipient,
      payload: {
        ...brief.dispatchPayloads.email,
        targetThesis,
      },
      priority: 1,
    });
  }

  await db.enqueueDispatch({
    type: 'crm',
    recipient: 'hubspot_crm',
    payload: {
      ...brief.dispatchPayloads.crm,
      segment: leadRecord.segment,
      targetThesis: targetThesis.thesisTitle,
      budgetAed: leadRecord.budgetAed,
    },
    priority: 1,
  });

  // 7. Emit AgentEvents.LEAD_INGESTED with Correlation ID
  const eventPayload = {
    leadId: leadRecord.id,
    lead: leadRecord,
    segment: leadRecord.segment,
    country: leadRecord.country,
    budgetAed: leadRecord.budgetAed,
    targetThesis,
    riisScore: intelligence.riis.score,
    diraRiskLevel: intelligence.dira.riskLevel,
    compositeScore: intelligence.compositeScore,
    briefId: brief.id,
    briefUrl: `https://www.emanuelrendas.com/brief/${brief.id}`,
    correlationId,
    timestamp: new Date().toISOString(),
  };

  agentEventBus.publish(AgentEvents.LEAD_INGESTED, eventPayload, {
    correlationId,
    sourceAgent: 'crm_ingestion_engine',
  });

  // 8. Trigger CRM Sync Client (HubSpot / REST)
  let crmSyncResult = null;
  try {
    crmSyncResult = await crmSyncClient.syncLead({
      companyName: leadRecord.company,
      contactName: leadRecord.name,
      email: leadRecord.email || `lead_${leadRecord.id}@private.emanuelrendas.com`,
      phone: leadRecord.phone,
      riisScore: intelligence.riis.score,
      riskLevel: intelligence.dira.riskLevel,
      dealValueAed: leadRecord.budgetAed,
      dealStage: leadRecord.segment === 'DLD_SELLER' ? 'equity_harvest' : 'qualified_opportunity',
      lifecycleStage: 'marketingqualifiedlead',
    });
  } catch (err) {
    logger.warn('CRM_ROUTE', `CRM sync warning: ${err.message}`, { correlationId });
  }

  // 9. Forward to n8n Webhook Client if configured and enabled
  let n8nDispatchResult = null;
  try {
    if (n8nWebhookClient.enabled) {
      n8nDispatchResult = await n8nWebhookClient.triggerWorkflow(AgentEvents.LEAD_INGESTED, eventPayload, {
        correlationId,
        sourceAgent: 'crm_ingestion_engine',
      });
    }
  } catch (err) {
    logger.warn('CRM_ROUTE', `n8n webhook forward warning: ${err.message}`, { correlationId });
  }

  // 10. Optionally trigger run_cycle in background
  if (options.triggerCycle !== false) {
    run_cycle({ dbClient: db }).catch((err) => {
      logger.error('CRM_ROUTE', 'Background run_cycle failed', { error: err.message, correlationId });
    });
  }

  logger.audit('CRM_INGEST', 'LEAD_INGESTED_SUCCESS', leadRecord.id, 'inbound', 'processed', {
    segment: leadRecord.segment,
    country: leadRecord.country,
    budgetAed: leadRecord.budgetAed,
    thesis: targetThesis.thesisTitle,
    correlationId,
  });

  return {
    success: true,
    status: 'INGESTED',
    leadId: leadRecord.id,
    correlationId,
    segment: leadRecord.segment,
    country: leadRecord.country,
    budgetAed: leadRecord.budgetAed,
    targetThesis,
    riis: intelligence.riis,
    dira: intelligence.dira,
    compositeScore: intelligence.compositeScore,
    briefId: brief.id,
    briefUrl: `https://www.emanuelrendas.com/brief/${brief.id}`,
    executiveBrief: brief,
    memorandum: memorandum,
    crmSync: crmSyncResult,
    n8nDispatch: n8nDispatchResult,
    ingestedAt: new Date().toISOString(),
  };
}

/**
 * Main HTTP Router for /api/crm/*
 * @param {string} url 
 * @param {string} method 
 * @param {Object} body 
 * @param {Object} query 
 * @param {Object} headers 
 * @returns {Promise<Object>}
 */
export async function handleCrmRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  const normalized = url.replace(/^\/api\/crm\/?/, '').split('?')[0];
  const correlationId = headers['x-correlation-id'] || headers['X-Correlation-ID'] || correlationTracer.generateCorrelationId('crm_api');

  // 1. Ingest Inbound Lead: POST /api/crm/lead/ingest, POST /api/crm/ingest, POST /api/crm/lead
  if (
    method === 'POST' &&
    (normalized === 'lead/ingest' || normalized === 'ingest' || normalized === 'lead' || normalized === '')
  ) {
    try {
      const result = await ingestCrmLead(body, { correlationId });
      return {
        status: 200,
        body: result,
      };
    } catch (err) {
      logger.error('CRM_ROUTE', `Lead ingestion error: ${err.message}`, { correlationId });
      return {
        status: 500,
        body: {
          success: false,
          error: err.message,
          correlationId,
        },
      };
    }
  }

  // 2. Discover Supported Segments: GET /api/crm/segments
  if (method === 'GET' && (normalized === 'segments' || normalized === 'schema')) {
    return {
      status: 200,
      body: {
        success: true,
        endpoint: '/api/crm/segments',
        supportedSegments: SUPPORTED_CRM_SEGMENTS,
        requiredFields: ['name', 'email', 'phone', 'country', 'segment', 'budgetAed', 'notes'],
        segmentList: Object.keys(SUPPORTED_CRM_SEGMENTS),
      },
    };
  }

  // 3. CRM Health & Connector Status: GET /api/crm/status or GET /api/crm/health
  if (method === 'GET' && (normalized === 'status' || normalized === 'health' || normalized === '')) {
    return {
      status: 200,
      body: {
        success: true,
        status: 'OPERATIONAL',
        connector: 'RAIOC_CRM_N8N_GATEWAY',
        version: 'v2026.Q3.1',
        supportedSegments: Object.keys(SUPPORTED_CRM_SEGMENTS),
        crmSyncEnabled: crmSyncClient.enabled,
        n8nWebhookEnabled: n8nWebhookClient.enabled,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 4. Retrieve Recent Ingested Leads: GET /api/crm/leads
  if (method === 'GET' && normalized === 'leads') {
    const leads = supabase.isMock ? (supabase.mockStore.leads || []) : [];
    return {
      status: 200,
      body: {
        success: true,
        count: leads.length,
        leads: leads.slice(-50),
      },
    };
  }

  return {
    status: 404,
    body: {
      error: `CRM Endpoint not found: ${url}`,
      availableEndpoints: [
        'POST /api/crm/lead/ingest',
        'GET /api/crm/segments',
        'GET /api/crm/status',
        'GET /api/crm/leads',
      ],
    },
  };
}
