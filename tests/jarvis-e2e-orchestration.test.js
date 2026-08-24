import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { jarvis } from '../src/agents/specialists/jarvis-orchestrator.js';
import { sharedMemory } from '../src/memory/shared-memory.js';
import { decisionLogger } from '../src/operational/decision-logger.js';
import { operatingCenter } from '../src/operational/operating-center.js';

describe('JARVIS Autonomous Multi-Agent Orchestration End-to-End Acceptance Tests', () => {
  test('Human asks JARVIS one objective -> Autonomous decomposition, execution, decision logging, memory update, and executive report synthesis', async () => {
    const humanObjective = 'Execute full institutional advisory onboarding for Apex Real Estate Holdings with DIRA/RIIS intelligence, Palm Jumeirah asset allocation, UAE Golden Visa compliance, Executive Brief delivery, CRM deal staging, and Google Calendar consultation booking.';

    const contextData = {
      companyName: 'Apex Real Estate Holdings',
      contactName: 'Sir Arthur Pendelton',
      email: 'arthur@apexholdings.co.uk',
      phone: '+971501239876',
      companySize: '500+',
      aiMaturity: 'in_production',
      timeline: 'immediate',
      techStack: 'modern_cloud_native',
      dataStack: 'cloud_postgres_supabase',
      propertyPriceAed: 12000000,
      communityId: 'comm_palm_jumeirah',
      developerId: 'dev_nakheel',
    };

    // Execute objective autonomously through JARVIS
    const report = await jarvis.executeObjective(humanObjective, contextData);

    // 1. Verify Report Status & Synthesized Intelligence
    assert.strictEqual(report.status, 'COMPLETED');
    assert.strictEqual(report.orchestrator, 'JARVIS');
    assert.ok(report.totalExecutionTimeMs >= 0);
    assert.strictEqual(report.planSummary.failedTasks, 0);
    assert.ok(report.planSummary.succeededTasks >= 6);

    // 2. Verify Specialist Agent Contributions
    const intel = report.synthesizedIntelligence;
    assert.ok(intel.riskEvaluation);
    assert.strictEqual(intel.riskEvaluation.dira.riskLevel, 'LOW');
    assert.ok(intel.riskEvaluation.riis.score >= 80);

    assert.ok(intel.marketStrategy);
    assert.strictEqual(intel.marketStrategy.community.name, 'Palm Jumeirah');

    assert.ok(intel.complianceAudit);
    assert.strictEqual(intel.complianceAudit.goldenVisaEligibility.isEligible, true);
    assert.strictEqual(intel.complianceAudit.acquisitionBreakdown.breakdown.dldTransferFee, 480000); // 4% of 12M

    assert.ok(intel.communications);
    assert.ok(intel.communications.brief.executive_summary);
    assert.strictEqual(intel.communications.dispatches.length, 2); // Gmail + WhatsApp

    assert.ok(intel.crmStaging);
    assert.ok(intel.calendarBooking);
    assert.ok(intel.calendarBooking.meetLink);

    // 3. Verify Shared Memory Updated
    const recalledReport = sharedMemory.recallKnowledge(report.correlationId);
    assert.ok(recalledReport.length > 0);

    // 4. Verify Decision Logs Recorded
    const decisions = decisionLogger.getDecisions({ objectiveId: report.correlationId });
    assert.ok(decisions.length >= 4);
    const agentIds = decisions.map((d) => d.agentId);
    assert.ok(agentIds.includes('jarvis'));
    assert.ok(agentIds.includes('mark'));
    assert.ok(agentIds.includes('lex'));
  });

  test('OperatingCenter handles human objective request directly via always-on interface', async () => {
    const res = await operatingCenter.requestJarvisObjective(
      'Conduct prime market yield benchmark and regulatory tax check for Downtown Dubai luxury penthouse',
      {
        communityId: 'comm_downtown_dubai',
        budgetAed: 8000000,
      }
    );

    assert.strictEqual(res.status, 'COMPLETED');
    assert.ok(res.synthesizedIntelligence.marketStrategy);
  });
});
