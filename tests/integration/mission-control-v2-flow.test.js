/**
 * RAIOC OS - Mission Control V2 Integrated Flow Test Suite
 * 
 * Verifies:
 * 1. HTML Rendering of Mission Control V2 UI (ATLAS Modeler, Daemon Health, HITL Gateway).
 * 2. Deterministic ATLAS Opal ROI Calculator (/api/v1/opal/roi) for sovereign corridors.
 * 3. 1-Click HITL Decision resolution (/api/v1/approvals/decide) and VIP dispatch emission.
 * 4. Consolidated Telemetry state (/api/v1/mission-control/v1-state) and Daemon health (/healthz).
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { routeApiRequest } from '../../src/api/server.js';
import { supabase } from '../../src/db/supabase-client.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';
import { renderMissionControlHtml } from '../../src/site/mission-control-html.js';

const VALID_SECRET = 'sec_test_sovereign_auth_2026';
process.env.RAIOC_INTERNAL_SECRET = VALID_SECRET;
process.env.INTERNAL_SERVICE_KEY = VALID_SECRET;

describe('INTEGRATION: Mission Control V2 Integrated Flow & HITL Governance', () => {
  beforeEach(() => {
    if (supabase.isMock) {
      supabase.mockStore.executive_approvals = [];
      supabase.mockStore.interaction_logs = [];
      supabase.mockStore.agent_fleet_status = new Map();
    }
  });

  test('1. Render Mission Control V2 HTML: contains executive indicators, ATLAS modeler and daemon health', () => {
    const html = renderMissionControlHtml();

    assert.ok(typeof html === 'string');
    assert.ok(html.includes('RAIOC MISSION CONTROL'));
    assert.ok(html.includes('V2 SOVEREIGN'));
    assert.ok(html.includes('ATLAS SOVEREIGN CORRIDOR MODELER'));
    assert.ok(html.includes('OPAL ROI'));
    assert.ok(html.includes('PALM_JEBEL_ALI'));
    assert.ok(html.includes('DUBAI_SOUTH_DWC'));
    assert.ok(html.includes('DAEMON MEMORY RSS'));
    assert.ok(html.includes('DAEMON LOOPS'));
    assert.ok(html.includes('HITL APPROVALS'));
    assert.ok(html.includes('/api/v1/opal/roi'));
    assert.ok(html.includes('/api/v1/approvals/decide'));
    assert.ok(html.includes('Emanuel Rendas'));
  });

  test('2. GET /admin/mission-control returns 200 and renders full HTML dashboard', async () => {
    const res = await routeApiRequest('/admin/mission-control', 'GET');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body === 'string');
    assert.ok(res.body.includes('<!DOCTYPE html>'));
    assert.ok(res.body.includes('ATLAS SOVEREIGN CORRIDOR MODELER'));
  });

  test('3. POST /api/v1/opal/roi executes deterministic pro-forma for Palm Jebel Ali (35M AED)', async () => {
    const payload = {
      corridor: 'PALM_JEBEL_ALI',
      allocation_aed: 35000000,
      ownership_vehicle: 'SPV_DIFC_ADGM',
    };

    const res = await routeApiRequest('/api/v1/opal/roi', 'POST', payload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const data = res.body.data || res.body;
    assert.strictEqual(data.corridor, 'PALM_JEBEL_ALI');
    assert.strictEqual(data.allocation_aed, 35000000);
    assert.strictEqual(data.statutory_breakdown.dld_fee_aed, 1400000); // 4% of 35M
    assert.strictEqual(data.statutory_breakdown.trustee_fee_aed, 4200);
    assert.strictEqual(data.statutory_breakdown.oqood_fee_aed, 1000);
    assert.ok(data.net_cap_rate >= 0.045 && data.net_cap_rate <= 0.06);
    assert.ok((data.irr_7y >= 0.12 && data.irr_7y <= 0.18) || (data.irr_7y >= 12.0 && data.irr_7y <= 18.0));
    assert.ok(data.cagr_10y >= 0.080 && data.cagr_10y <= 0.11);
    assert.strictEqual(data.golden_visa_qualified, true);
  });

  test('4. POST /api/v1/opal/roi executes deterministic pro-forma for Dubai South DWC (15M AED)', async () => {
    const payload = {
      corridor: 'DUBAI_SOUTH_DWC',
      allocation_aed: 15000000,
      ownership_vehicle: 'INDIVIDUAL_DIRECT',
    };

    const res = await routeApiRequest('/api/v1/opal/roi', 'POST', payload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const data = res.body.data || res.body;
    assert.strictEqual(data.corridor, 'DUBAI_SOUTH_DWC');
    assert.strictEqual(data.allocation_aed, 15000000);
    assert.strictEqual(data.statutory_breakdown.dld_fee_aed, 600000); // 4% of 15M
    assert.ok(data.net_cap_rate >= 0.075 && data.net_cap_rate <= 0.095);
    assert.ok((data.irr_7y >= 0.12 && data.irr_7y <= 0.18) || (data.irr_7y >= 12.0 && data.irr_7y <= 18.0));
    assert.strictEqual(data.golden_visa_qualified, true);
  });

  test('5. POST /api/v1/approvals/decide resolves HITL gate and publishes VIP dispatch CloudEvent', async () => {
    // Seed an approval in supabase
    const approvalId = 'appr_uhnw_palm_jebel_35m';
    if (supabase.isMock) {
      supabase.mockStore.executive_approvals.push({
        id: approvalId,
        title: 'Sovereign Mandate: Palm Jebel Ali (35M AED)',
        recipient: 'Sheikh Ahmed Al Maktoum Family Trust',
        name: 'Sheikh Ahmed Al Maktoum Family Trust',
        status: 'PENDING',
        priority: 'CRITICAL',
        mandate_id: 'MND-35M-PJA-001',
        payload: {
          recipient: 'Sheikh Ahmed Al Maktoum Family Trust',
          budgetAed: 35000000,
          corridorKey: 'PALM_JEBEL_ALI',
          corridorName: 'Palm Jebel Ali Sovereign Corridor',
          targetAsset: 'The Fronds Private Villas - Palm Jebel Ali',
          ownershipVehicle: 'SPV_DIFC_ADGM',
          channel: 'WHATSAPP',
          intent: 'INVESTOR_FOLLOWUP',
          diraScore: 98,
          locale: 'en',
        },
        created_at: new Date().toISOString(),
      });
    }

    const capturedEvents = [];
    const unsub = enterpriseEventBus.subscribe('*', (data, ctx) => {
      capturedEvents.push({ type: ctx?.type, data, ...ctx });
    });

    const decidePayload = {
      approvalId: approvalId,
      decision: 'APPROVED',
      approvedBy: 'Emanuel Rendas',
      actor: 'Emanuel Rendas',
      note: 'Aprovado via Mission Control V2. Despacho autónomo da AIDA autorizado.',
    };

    const res = await routeApiRequest('/api/v1/approvals/decide', 'POST', decidePayload, {}, {
      Authorization: `Bearer ${VALID_SECRET}`,
      'X-Correlation-ID': 'corr_hitl_test_35m',
    });

    unsub();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.decision, 'APPROVED');
    assert.strictEqual(res.body.actor, 'Emanuel Rendas');
    assert.ok(res.body.vipDispatch);
    assert.ok(res.body.vipDispatch.messageSha256);
    assert.ok(res.body.vipDispatch.timezones);

    // Verify CloudEvents emitted
    const vipEvent = capturedEvents.find((e) => e.type === 'raioc.communication.vip.dispatched.v1');
    assert.ok(vipEvent, 'Expected raioc.communication.vip.dispatched.v1 event');
    assert.strictEqual(vipEvent.data.approvalId, approvalId);
    assert.strictEqual(vipEvent.data.allocationAed, 35000000);
    assert.strictEqual(vipEvent.data.approvedBy, 'Emanuel Rendas');
    assert.ok(vipEvent.data.messageSha256);

    const voiceEvent = capturedEvents.find((e) => e.type === 'raioc.voice.outreach_dispatched.v1');
    assert.ok(voiceEvent, 'Expected raioc.voice.outreach_dispatched.v1 event');
    assert.strictEqual(voiceEvent.data.approvedBy, 'Emanuel Rendas');

    // Verify approval record status is updated
    const allApprovals = await supabase.fetchApprovals('ALL');
    const resolved = allApprovals.find((a) => a.id === approvalId);
    assert.strictEqual(resolved.status, 'APPROVED');
    assert.strictEqual(resolved.decided_by, 'Emanuel Rendas');
  });

  test('6. GET /api/v1/mission-control/v1-state returns consolidated telemetry state', async () => {
    const res = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const state = res.body;
    assert.ok(state.healthBar);
    assert.ok(state.agentFleet);
    assert.ok(Array.isArray(state.agentFleet));
    assert.ok(state.crmPipeline);
    assert.ok(state.approvalsQueue !== undefined);
    assert.ok(state.infrastructure);
    assert.ok(state.systemClock);
    assert.strictEqual(state.systemClock.timezone, 'GST (UTC+4)');
  });

  test('7. GET /healthz returns 200 with persistent daemon memory RSS and loop statuses', async () => {
    const res = await routeApiRequest('/healthz', 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'OK');
    assert.ok(res.body.memory_rss_mb > 0);
    assert.ok(res.body.uptime >= 0);
    assert.ok(res.body.active_agents_count >= 5);
    assert.ok(res.body.loop_status);
    assert.strictEqual(typeof res.body.loop_status.jarvis_orchestration, 'boolean');
    assert.strictEqual(typeof res.body.loop_status.sentinel_monitoring, 'boolean');
    assert.strictEqual(typeof res.body.loop_status.distributed_scheduler, 'boolean');
  });
});
