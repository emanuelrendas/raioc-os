import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  routeApiRequest,
  agentDirectory,
  agentEventBus,
  AgentEvents,
  decisionLogger,
  sharedMemory,
  executiveDashboard,
  telemetry,
  supabase,
} from '../src/index.js';

describe('Operational Capability Sprint 01: Automated Investor Communication (End-to-End)', () => {
  before(async () => {
    agentDirectory.enableAutonomousMesh();
  });

  test('Complete automated investor communication flow from Website submission to Mission Control', async () => {
    const correlationId = `corr_investor_sprint01_${Date.now()}`;
    const trackedEvents = [];

    // 1. Subscribe to full pipeline event flow
    const lifecycleEvents = [
      AgentEvents.LEAD_INGESTED,
      AgentEvents.LEAD_QUALIFIED,
      AgentEvents.MARKET_ANALYZED,
      AgentEvents.COMPLIANCE_VERIFIED,
      AgentEvents.BRIEF_DISPATCHED,
      AgentEvents.CRM_SYNCED,
      AgentEvents.CYCLE_AUDITED,
    ];

    const unsubs = lifecycleEvents.map((topic) =>
      agentEventBus.subscribe(topic, (evt) => {
        if (evt.metadata?.correlationId === correlationId) {
          trackedEvents.push({
            topic: evt.topic,
            sourceAgent: evt.metadata.sourceAgent,
            timestamp: evt.metadata.timestamp,
            payload: evt.payload,
          });
        }
      })
    );

    // 2. Stage 1: Website Ingestion (/api/lead)
    const investorSubmission = {
      name: 'His Excellency Tariq Al-Mansoor',
      companyName: 'Al-Mansoor Family Investment Office',
      email: 'privateadvisory@emanuelrendas.com',
      phone: '+971501234567',
      companySize: '500+',
      aiMaturity: 'in_production',
      timeline: 'immediate',
      techStack: 'modern_cloud_native',
      dataStack: 'cloud_postgres_supabase',
      propertyPriceAed: 12500000,
      communityId: 'comm_palm_jumeirah',
      developerId: 'dev_nakheel',
    };

    const leadResponse = await routeApiRequest(
      '/api/lead',
      'POST',
      investorSubmission,
      {},
      { 'X-Correlation-ID': correlationId }
    );

    assert.strictEqual(leadResponse.status, 200);
    assert.strictEqual(leadResponse.body.status, 'INGESTED');
    assert.strictEqual(leadResponse.headers['X-Correlation-ID'], correlationId);

    // 3. Stage 2: Supabase Persistence & Triggering Event Bus
    agentEventBus.publish(
      AgentEvents.LEAD_INGESTED,
      {
        lead: {
          id: leadResponse.body.leadId,
          ...investorSubmission,
          company_name: investorSubmission.companyName,
          contact_name: investorSubmission.name,
        },
      },
      { correlationId, sourceAgent: 'website_api' }
    );

    // 4. Wait for the autonomous specialist mesh to execute:
    // MARK (Triage/RIIS) -> ATLAS (Market/Yields) -> LEX (Compliance/Visa) -> AIDA (Brief/SMTP/WA) -> HERMES (CRM) -> SENTINEL (Audit)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 5. Verification: Event Bus Progression
    const topicList = trackedEvents.map((e) => e.topic);
    assert.ok(topicList.includes(AgentEvents.LEAD_INGESTED), 'Stage 1: LEAD_INGESTED failed');
    assert.ok(topicList.includes(AgentEvents.LEAD_QUALIFIED), 'Stage 2: MARK LEAD_QUALIFIED failed');
    assert.ok(topicList.includes(AgentEvents.MARKET_ANALYZED), 'Stage 3: ATLAS MARKET_ANALYZED failed');
    assert.ok(topicList.includes(AgentEvents.COMPLIANCE_VERIFIED), 'Stage 4: LEX COMPLIANCE_VERIFIED failed');
    assert.ok(topicList.includes(AgentEvents.BRIEF_DISPATCHED), 'Stage 5: AIDA BRIEF_DISPATCHED failed');
    assert.ok(topicList.includes(AgentEvents.CRM_SYNCED), 'Stage 6: HERMES CRM_SYNCED failed');

    // 6. Verification: Structured Decision Logs
    const decisions = decisionLogger.getDecisions({ objectiveId: correlationId });
    assert.ok(decisions.length >= 4, 'Expected at least 4 autonomous decisions logged for this correlationId');

    const actions = decisions.map((d) => d.chosenAction);
    assert.ok(actions.some((a) => a.includes('QUALIFY')), 'MARK decision missing');
    assert.ok(actions.some((a) => a.includes('PRIME_ASSET') || a.includes('ALLOCATION')), 'ATLAS decision missing');
    assert.ok(actions.some((a) => a.includes('REGULATORY')), 'LEX decision missing');
    assert.ok(actions.some((a) => a.includes('DELIVER_EXECUTIVE_BRIEF')), 'AIDA decision missing');

    // 7. Verification: Shared Memory Persistence
    const memories = sharedMemory.search('Palm Jumeirah');
    assert.ok(memories.length > 0, 'Expected shared memory record for Palm Jumeirah asset allocation');

    // 8. Verification: Mission Control Dashboard Metrics
    const dashboard = executiveDashboard.getDashboardData();
    assert.ok(dashboard.financials.pipelineRevenueAed > 0, 'Pipeline revenue should reflect active deals');
    assert.strictEqual(dashboard.status, 'OPERATIONAL');

    // Cleanup
    unsubs.forEach((u) => u());
  });
});
