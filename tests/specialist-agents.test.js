import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { jarvis } from '../src/agents/specialists/jarvis-orchestrator.js';
import { agentDirectory } from '../src/agents/agent-directory.js';
import { markTriageAgent } from '../src/agents/specialists/mark-triage-agent.js';
import { atlasMarketAgent } from '../src/agents/specialists/atlas-market-agent.js';
import { lexComplianceAgent } from '../src/agents/specialists/lex-compliance-agent.js';
import { aidaCommsAgent } from '../src/agents/specialists/aida-comms-agent.js';
import { heliosCalendarAgent } from '../src/agents/specialists/helios-calendar-agent.js';
import { hermesCrmAgent } from '../src/agents/specialists/hermes-crm-agent.js';
import { sentinelHealthAgent } from '../src/agents/specialists/sentinel-health-agent.js';

describe('Specialist Agents & Agent Directory Tests', () => {
  test('AgentDirectory registers all 8 permanent autonomous agents', () => {
    const agents = agentDirectory.listAgents();
    assert.strictEqual(agents.length, 8);

    const ids = agents.map((a) => a.id);
    assert.ok(ids.includes('jarvis'));
    assert.ok(ids.includes('mark'));
    assert.ok(ids.includes('atlas'));
    assert.ok(ids.includes('lex'));
    assert.ok(ids.includes('aida'));
    assert.ok(ids.includes('helios'));
    assert.ok(ids.includes('hermes'));
    assert.ok(ids.includes('sentinel'));
  });

  test('broadcasts heartbeats across all registered agents', () => {
    const heartbeats = agentDirectory.broadcastHeartbeats();
    assert.strictEqual(heartbeats.length, 8);
    assert.strictEqual(heartbeats.every((h) => h.status === 'IDLE' || h.status === 'BUSY'), true);
  });

  test('MARK executes lead triage with DIRA evaluation and RIIS scoring', async () => {
    const res = await markTriageAgent.executeTask({
      leadData: {
        company_name: 'Apex Capital',
        company_size: '500+',
        ai_maturity: 'in_production',
        timeline: 'immediate',
        tech_stack: 'modern_cloud_native',
      },
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.agentId, 'mark');
    assert.ok(res.output.riis.score >= 80);
    assert.strictEqual(res.output.dira.riskLevel, 'LOW');
  });

  test('ATLAS evaluates Dubai prime communities and investment recommendations', async () => {
    const res = await atlasMarketAgent.executeTask({
      communityId: 'comm_palm_jumeirah',
      budgetAed: 10000000,
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.agentId, 'atlas');
    assert.strictEqual(res.output.community.name, 'Palm Jumeirah');
    assert.ok(res.output.community.avgGrossYield > 0);
  });

  test('LEX audits Golden Visa qualification and 4% DLD costs', async () => {
    const res = await lexComplianceAgent.executeTask({
      propertyPriceAed: 3500000,
      offPlan: true,
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.agentId, 'lex');
    assert.strictEqual(res.output.goldenVisaEligibility.isEligible, true);
    assert.strictEqual(res.output.acquisitionBreakdown.breakdown.dldTransferFee, 140000); // 4% of 3.5M
  });

  test('AIDA formats and dispatches bespoke executive brief', async () => {
    const res = await aidaCommsAgent.executeTask({
      leadData: {
        company_name: 'Elysium Investments',
        email: 'partner@elysium.ae',
        phone: '+971501112233',
        company_size: '100-500',
        ai_maturity: 'evaluating',
        timeline: '1-3_months',
      },
      channel: 'all',
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.agentId, 'aida');
    assert.ok(res.output.brief.executive_summary);
    assert.strictEqual(res.output.dispatches.length, 2); // Gmail + WhatsApp
  });

  test('HELIOS coordinates advisory appointment and Google Meet link', async () => {
    const res = await heliosCalendarAgent.executeTask({
      attendeeEmail: 'director@investcorp.ae',
      summary: 'Private UAE Real Estate Consultation',
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.agentId, 'helios');
    assert.ok(res.output.meetLink);
  });

  test('HERMES syncs CRM deal and contact pipeline', async () => {
    const res = await hermesCrmAgent.executeTask({
      leadData: {
        company_name: 'Apex Capital',
        email: 'investor@apexcapital.ae',
      },
      riisScore: 88,
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.agentId, 'hermes');
  });

  test('SENTINEL executes telemetry watchdog check', async () => {
    const res = await sentinelHealthAgent.executeTask({});
    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.agentId, 'sentinel');
    assert.strictEqual(res.output.healthy, true);
  });
});
