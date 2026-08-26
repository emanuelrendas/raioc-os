/**
 * RAIOC OS - CRM & n8n Segmented Pipelines Integration Test Suite
 * Tests dedicated n8n webhook connectors, CRM lead schema endpoints,
 * segmented ingestion pipelines (PT_HNW, ES_HNW, UK_NONDOM, DLD_BUYER, DLD_SELLER),
 * DIRA/RIIS risk scoring, target thesis assignment (Opal ROI / Escrow Guarantee),
 * and n8n workflow template JSON integrity.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { routeApiRequest } from '../../src/api/server.js';
import { handleCrmRequest, SUPPORTED_CRM_SEGMENTS } from '../../src/api/routes/crm-routes.js';
import { agentEventBus, AgentEvents } from '../../src/events/agent-event-bus.js';
import { supabase } from '../../src/db/supabase-client.js';

describe('CRM & n8n Segmented Pipelines Integration Suite', () => {
  beforeEach(() => {
    if (supabase.isMock) {
      supabase.mockStore.leads = [];
      supabase.mockStore.executive_briefs = [];
      supabase.mockStore.dispatch_queue = [];
    }
  });

  test('1. Schema & Segment Discovery Endpoint: GET /api/crm/segments', async () => {
    const res = await routeApiRequest('/api/crm/segments', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.supportedSegments.PT_HNW);
    assert.ok(res.body.supportedSegments.ES_HNW);
    assert.ok(res.body.supportedSegments.UK_NONDOM);
    assert.ok(res.body.supportedSegments.DLD_BUYER);
    assert.ok(res.body.supportedSegments.DLD_SELLER);
    assert.deepStrictEqual(res.body.segmentList, ['PT_HNW', 'ES_HNW', 'UK_NONDOM', 'DLD_BUYER', 'DLD_SELLER']);
  });

  test('2. CRM Status & Health Endpoint: GET /api/crm/status', async () => {
    const res = await routeApiRequest('/api/crm/status', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'OPERATIONAL');
    assert.strictEqual(res.body.connector, 'RAIOC_CRM_N8N_GATEWAY');
  });

  test('3. Portugal HNW Lead Ingestion (PT_HNW) with Opal ROI / Escrow Guarantee Thesis', async () => {
    let emittedEvent = null;
    const unsub = agentEventBus.subscribe(AgentEvents.LEAD_INGESTED, (evt) => {
      emittedEvent = evt;
    });

    const leadPayload = {
      name: 'Gonçalo de Albuquerque',
      email: 'goncalo@albuquerque-capital.pt',
      phone: '+351912345678',
      country: 'Portugal',
      segment: 'PT_HNW',
      budgetAed: 15000000,
      notes: 'Portugal NHR transition mandate, seeking 100% Escrow Law 8 prime assets on Palm Jumeirah.',
    };

    const res = await routeApiRequest('/api/crm/lead/ingest', 'POST', leadPayload, {}, {
      'x-correlation-id': 'corr_test_pt_001',
    });

    unsub();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.status, 'INGESTED');
    assert.strictEqual(res.body.segment, 'PT_HNW');
    assert.strictEqual(res.body.country, 'Portugal');
    assert.strictEqual(res.body.correlationId, 'corr_test_pt_001');

    // Thesis & Statutory Shield verification
    assert.strictEqual(res.body.targetThesis.thesisTitle, 'Opal ROI / Escrow Guarantee');
    assert.strictEqual(res.body.targetThesis.thesisType, 'OPAL_ROI_ESCROW_GUARANTEE');
    assert.strictEqual(res.body.targetThesis.statutoryShield.goldenVisaEligible, true);
    assert.strictEqual(res.body.targetThesis.statutoryShield.goldenVisaThresholdAed, 2000000);
    assert.ok(res.body.targetThesis.financialMetrics.totalOutlayAed > 15000000);
    assert.ok(res.body.targetThesis.financialMetrics.totalAcquisitionCostAed > 0);
    assert.ok(res.body.targetThesis.financialMetrics.projectedNetYieldPct > 0);

    // Intelligence verification
    assert.ok(res.body.riis.score >= 50);
    assert.ok(res.body.dira.riskLevel);
    assert.ok(res.body.briefId);
    assert.ok(res.body.briefUrl.includes(res.body.briefId));
    assert.ok(res.body.executiveBrief);
    assert.ok(res.body.memorandum);

    // Event Bus Emission verification
    assert.ok(emittedEvent !== null);
    assert.strictEqual(emittedEvent.topic, 'lead:ingested');
    assert.strictEqual(emittedEvent.payload.segment, 'PT_HNW');
    assert.strictEqual(emittedEvent.metadata.correlationId, 'corr_test_pt_001');
    assert.strictEqual(emittedEvent.metadata.sourceAgent, 'crm_ingestion_engine');
  });

  test('4. Spain HNW Lead Ingestion (ES_HNW) with Wealth Tax Hedge & Capital Shield', async () => {
    const leadPayload = {
      name: 'Alejandro Morales',
      email: 'amorales@madrid-familyoffice.es',
      phone: '+34600123456',
      country: 'Spain',
      segment: 'ES_HNW',
      budgetAed: 18000000,
      notes: 'Spanish wealth tax hedge, seeking trophy asset with 10-year structural warranty.',
    };

    const res = await routeApiRequest('/api/crm/lead/ingest', 'POST', leadPayload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.segment, 'ES_HNW');
    assert.strictEqual(res.body.targetThesis.thesisTitle, 'Opal ROI / Capital Shield');
    assert.strictEqual(res.body.targetThesis.strategicFocus, 'sovereign_wealth_hedge');
    assert.ok(res.body.targetThesis.keyCatalysts.some(c => c.includes('Spanish Solidarity Wealth Tax')));
  });

  test('5. UK Non-Dom Lead Ingestion (UK_NONDOM) with Escrow Guarantee Sovereign Shield', async () => {
    const leadPayload = {
      name: 'Lord Arthur Kensington',
      email: 'kensington@mayfair-investments.co.uk',
      phone: '+447911123456',
      country: 'United Kingdom',
      segment: 'UK_NONDOM',
      budgetAed: 25000000,
      notes: 'UK Non-Dom abolition hedge, offshore sovereign reallocation into Downtown Dubai freehold.',
    };

    const res = await routeApiRequest('/api/crm/lead/ingest', 'POST', leadPayload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.segment, 'UK_NONDOM');
    assert.strictEqual(res.body.targetThesis.thesisTitle, 'Escrow Guarantee / Sovereign Safe Haven');
    assert.strictEqual(res.body.targetThesis.strategicFocus, 'international_tax_optimization');
    assert.ok(res.body.targetThesis.statutoryShield.freeholdLaw.includes('Law No. (7) of 2006'));
  });

  test('6. DLD Buyer Lead Ingestion (DLD_BUYER) with Off-Plan Capital Appreciation', async () => {
    const leadPayload = {
      name: 'Tariq Al-Mansoor',
      email: 'tariq@gulf-equity.ae',
      phone: '+971509876543',
      country: 'United Arab Emirates',
      segment: 'DLD_BUYER',
      budgetAed: 12000000,
      notes: 'DLD Green List Verified Buyer, pre-launch developer tranche allocation.',
    };

    const res = await routeApiRequest('/api/crm/lead/ingest', 'POST', leadPayload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.segment, 'DLD_BUYER');
    assert.strictEqual(res.body.targetThesis.thesisTitle, 'Opal ROI / Off-Plan Capital Appreciation');
    assert.strictEqual(res.body.targetThesis.strategicFocus, 'off_plan_appreciation');
  });

  test('7. DLD Seller Lead Ingestion (DLD_SELLER) with Equity Harvest & Redeployment', async () => {
    const leadPayload = {
      name: 'Vikram Mehta',
      email: 'vmehta@mehta-holdings.com',
      phone: '+971551234567',
      country: 'United Arab Emirates',
      segment: 'DLD_SELLER',
      budgetAed: 22000000,
      notes: 'DLD Green List Secondary Seller, liquidating secondary villa for off-plan infrastructure redeployment.',
    };

    const res = await routeApiRequest('/api/crm/lead/ingest', 'POST', leadPayload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.segment, 'DLD_SELLER');
    assert.strictEqual(res.body.targetThesis.thesisTitle, 'Escrow Guarantee / Equity Harvest & Reallocation');
    assert.strictEqual(res.body.targetThesis.strategicFocus, 'equity_harvest_reinvestment');
  });

  test('8. Automatic Country & Segment Inference from notes or payload', async () => {
    const leadPayload = {
      name: 'Maria Santos',
      email: 'msantos@lisbon.pt',
      country: 'Portugal',
      // No segment specified
      budgetAed: 10000000,
      notes: 'Planning NHR transition and sovereign Dubai real estate allocation',
    };

    const res = await routeApiRequest('/api/crm/lead/ingest', 'POST', leadPayload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.segment, 'PT_HNW');
    assert.strictEqual(res.body.targetThesis.thesisTitle, 'Opal ROI / Escrow Guarantee');
  });

  test('9. n8n Workflow JSON Verification: lead-enrichment-routing.json', () => {
    const filePath = path.resolve('src/automations/n8n/lead-enrichment-routing.json');
    assert.ok(fs.existsSync(filePath), 'lead-enrichment-routing.json must exist');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    assert.ok(content.name.includes('Lead Enrichment'));
    assert.ok(Array.isArray(content.nodes));
    assert.ok(content.nodes.length >= 6);
    assert.ok(content.connections);

    // Verify webhook trigger node
    const webhookNode = content.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
    assert.ok(webhookNode);
    assert.strictEqual(webhookNode.parameters.path, 'raioc-lead-enrichment-routing');

    // Verify RAIOC CRM gateway call
    const crmNode = content.nodes.find(n => n.parameters?.url?.includes('/api/crm/lead/ingest'));
    assert.ok(crmNode);

    // Verify segment switch node
    const switchNode = content.nodes.find(n => n.type === 'n8n-nodes-base.switch');
    assert.ok(switchNode);
  });

  test('10. n8n Workflow JSON Verification: dld-greenlist-outreach.json', () => {
    const filePath = path.resolve('src/automations/n8n/dld-greenlist-outreach.json');
    assert.ok(fs.existsSync(filePath), 'dld-greenlist-outreach.json must exist');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    assert.ok(content.name.includes('DLD Green List'));
    assert.ok(Array.isArray(content.nodes));
    assert.ok(content.nodes.length >= 6);
    assert.ok(content.connections);

    // Verify DLD market data integration
    const dldNode = content.nodes.find(n => n.parameters?.url?.includes('/api/dld'));
    assert.ok(dldNode);

    // Verify CRM ingestion
    const raiocNode = content.nodes.find(n => n.parameters?.url?.includes('/api/crm/lead/ingest'));
    assert.ok(raiocNode);
  });

  test('11. n8n Workflow JSON Verification: vip-whatsapp-voice-followup.json', () => {
    const filePath = path.resolve('src/automations/n8n/vip-whatsapp-voice-followup.json');
    assert.ok(fs.existsSync(filePath), 'vip-whatsapp-voice-followup.json must exist');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    assert.ok(content.name.includes('VIP WhatsApp & Voice'));
    assert.ok(Array.isArray(content.nodes));
    assert.ok(content.nodes.length >= 6);
    assert.ok(content.connections);

    // Verify VIP Gate filter
    const gateNode = content.nodes.find(n => n.type === 'n8n-nodes-base.if');
    assert.ok(gateNode);

    // Verify Flow teaser generator hook
    const flowNode = content.nodes.find(n => n.parameters?.url?.includes('/api/flow/teaser'));
    assert.ok(flowNode);
  });
});
