import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  operatingCenter,
  jarvis,
  executiveDecisionEngine,
  autonomousTaskManager,
  executiveLongTermMemory,
  MemoryCategories,
  opportunityEngine,
  OpportunityTypes,
  agentPerformanceEngine,
  continuousLearningLayer,
  businessIntelligenceBus,
  BusinessDomains,
  executiveSelfHealingLayer,
  autonomousDailyOperations,
  executiveDashboard,
  agentDirectory,
  agentEventBus,
  AgentEvents,
} from '../src/index.js';

describe('JARVIS Executive Operating System (JOS v1.0) Acceptance Tests', () => {
  before(async () => {
    agentDirectory.enableAutonomousMesh();
  });

  test('1. Executive Decision Engine: Deterministic Multi-Dimensional Evaluation', () => {
    const evaluation = executiveDecisionEngine.evaluate({
      type: 'LEAD_INVESTOR_EVALUATION',
      payload: {
        company_name: 'Al Futtaim Family Office',
        propertyPriceAed: 25000000,
        timeline: 'immediate',
        ai_maturity: 'in_production',
        tech_stack: 'cloud_native',
        data_stack: 'postgres_supabase',
      },
    });

    assert.ok(evaluation.decisionId);
    assert.strictEqual(evaluation.businessImpact, 'CRITICAL');
    assert.strictEqual(evaluation.revenueImpactAed, 500000); // 2% of 25M AED
    assert.strictEqual(evaluation.requiredSpecialist, 'mark');
    assert.ok(evaluation.priorityScore >= 80);
    assert.ok(evaluation.confidence >= 0.9);
    assert.ok(evaluation.nextActions.length > 0);
    assert.ok(evaluation.deadline);

    // Verify stored in executive long-term memory
    const memoryRecord = executiveLongTermMemory.get(
      MemoryCategories.EXECUTIVE_DECISIONS,
      evaluation.decisionId
    );
    assert.ok(memoryRecord !== null);
    assert.strictEqual(memoryRecord.category, MemoryCategories.EXECUTIVE_DECISIONS);
  });

  test('2. Autonomous Task Manager: Enterprise Lifecycle, Dependencies & Auto-Spawn', async () => {
    // Create parent task
    const taskA = autonomousTaskManager.createTask({
      ownerAgent: 'mark',
      objective: 'Triage High-Yield Investor Profile',
      priority: 'CRITICAL',
      priorityScore: 95,
      businessValue: 100000,
      payload: {
        leadData: {
          company_name: 'Sovereign Gulf Fund',
          email: 'invest@sovereigngulf.ae',
          propertyPriceAed: 30000000,
          ai_maturity: 'in_production',
        },
      },
    });

    assert.strictEqual(taskA.status, 'PENDING');
    assert.strictEqual(taskA.priority, 'CRITICAL');

    // Create dependent child task
    const taskB = autonomousTaskManager.createTask({
      ownerAgent: 'lex',
      objective: 'Audit Golden Visa & Statutory DLD 4%',
      priority: 'HIGH',
      dependencies: [taskA.id],
      parentTask: taskA.id,
      payload: {
        propertyPriceAed: 30000000,
      },
    });

    assert.strictEqual(taskB.dependencies[0], taskA.id);

    // Attempting to execute taskB before taskA finishes must wait
    const prematureResult = await autonomousTaskManager.executeTask(taskB.id);
    assert.strictEqual(prematureResult.status, 'WAITING_DEPENDENCY');

    // Execute taskA
    const execResA = await autonomousTaskManager.executeTask(taskA.id);
    assert.strictEqual(execResA.status, 'SUCCESS');
    assert.strictEqual(taskA.status, 'COMPLETED');
    assert.ok(taskA.executionDuration >= 0);
    assert.ok(taskA.executionHistory.length >= 1);

    // Now taskB can execute cleanly
    const execResB = await autonomousTaskManager.executeTask(taskB.id);
    assert.strictEqual(execResB.status, 'SUCCESS');
    assert.strictEqual(taskB.status, 'COMPLETED');
  });

  test('3. Executive Long-Term Memory: Cognitive Categorization, Search & Strategy Guidance', () => {
    // Store strategies
    executiveLongTermMemory.store(
      MemoryCategories.SUCCESSFUL_STRATEGIES,
      'strat_dubai_prime_yield',
      { targetArea: 'Palm Jumeirah', yieldPct: 7.8, strategy: 'Direct off-plan allocation with escrow verification' },
      { tags: ['dubai', 'yield', 'palm_jumeirah'], importance: 1.8 }
    );

    executiveLongTermMemory.store(
      MemoryCategories.FAILED_STRATEGIES,
      'fail_unverified_escrow',
      { riskFactor: 'Secondary unverified broker', outcome: 'Transaction delays' },
      { tags: ['risk', 'escrow'], importance: 1.5 }
    );

    // Semantic / Keyword Search
    const searchResults = executiveLongTermMemory.search('Palm Jumeirah');
    assert.ok(searchResults.length >= 1);
    assert.strictEqual(searchResults[0].key, 'strat_dubai_prime_yield');

    // Strategy Guidance Query
    const guidance = executiveLongTermMemory.queryStrategyGuidance();
    assert.ok(guidance.recommendedPractices.length >= 1);
    assert.ok(guidance.avoidPatterns.length >= 1);
    assert.ok(guidance.totalHistoricalExperiences >= 2);
  });

  test('4. Opportunity Engine: Continuous Discovery & Task Auto-Generation', () => {
    const testLeads = [
      {
        company_name: 'DIFC Global Capital',
        email: 'partners@difcglobal.ae',
        propertyPriceAed: 18000000,
        buyerType: 'FOREIGN_HNWI',
        daysSinceLastContact: 0,
      },
      {
        company_name: 'Dormant European Buyer',
        email: 'investor@geneva.ch',
        propertyPriceAed: 3500000,
        buyerType: 'FOREIGN_INDIVIDUAL',
        daysSinceLastContact: 20,
      },
    ];

    const opportunities = opportunityEngine.scanOpportunities({ leads: testLeads });
    assert.ok(opportunities.length >= 4); // High Value + Golden Visa + Dormant + Market Yield Arbitrage

    const highValueOpp = opportunities.find((o) => o.type === OpportunityTypes.HIGH_VALUE_INVESTOR);
    assert.ok(highValueOpp !== undefined);
    assert.strictEqual(highValueOpp.assignedAgent, 'mark');

    const goldenVisaOpp = opportunities.find((o) => o.type === OpportunityTypes.GOLDEN_VISA_CANDIDATE);
    assert.ok(goldenVisaOpp !== undefined);
    assert.strictEqual(goldenVisaOpp.assignedAgent, 'lex');

    const dormantOpp = opportunities.find((o) => o.type === OpportunityTypes.DORMANT_LEAD);
    assert.ok(dormantOpp !== undefined);
    assert.strictEqual(dormantOpp.assignedAgent, 'aida');

    // Verify tasks generated in task manager
    const tasks = autonomousTaskManager.listTasks();
    assert.ok(tasks.some((t) => t.objective.includes('DIFC Global Capital')));
  });

  test('5. Agent Performance Engine: Continuous Scoring & Leaderboard', () => {
    agentPerformanceEngine.recordTaskExecution({
      agentId: 'atlas',
      status: 'SUCCESS',
      durationMs: 45,
      businessValue: 250000,
      retries: 0,
    });

    agentPerformanceEngine.recordTaskExecution({
      agentId: 'lex',
      status: 'SUCCESS',
      durationMs: 60,
      businessValue: 180000,
      retries: 0,
    });

    const atlasCard = agentPerformanceEngine.getAgentScorecard('atlas');
    assert.strictEqual(atlasCard.agentId, 'atlas');
    assert.strictEqual(atlasCard.successRatePct, 100.0);
    assert.strictEqual(atlasCard.tasksCompleted, 1);
    assert.ok(atlasCard.efficiencyIndex > 0);

    const leaderboard = agentPerformanceEngine.getLeaderboard();
    assert.ok(leaderboard.length >= 8);
    assert.strictEqual(leaderboard[0].rank, 1);
  });

  test('6. Continuous Learning Layer: Retrospective Generation & Strategy Feedback', () => {
    const completedTask = {
      id: 'task_learn_test_001',
      ownerAgent: 'aida',
      objective: 'Dispatch Bespoke Brief via WhatsApp Cloud & Gmail',
      status: 'COMPLETED',
      executionDuration: 120,
    };

    const retroSuccess = continuousLearningLayer.evaluateTaskOutcome(completedTask);
    assert.strictEqual(retroSuccess.shouldFutureStrategyChange, false);
    assert.ok(retroSuccess.whatWorked.length > 0);

    const failedTask = {
      id: 'task_learn_test_002',
      ownerAgent: 'hermes',
      objective: 'Sync CRM Stage',
      status: 'FAILED',
      executionDuration: 5000,
      error: 'Upstream gateway rate limit (429)',
    };

    const retroFailure = continuousLearningLayer.evaluateTaskOutcome(failedTask);
    assert.strictEqual(retroFailure.shouldFutureStrategyChange, true);
    assert.ok(retroFailure.strategyAdjustment.includes('fallback retry'));
  });

  test('7. Business Intelligence Bus: Domain Classification & Real-Time Revenue Pipeline', () => {
    assert.strictEqual(businessIntelligenceBus.classifyDomain('lead:ingested'), BusinessDomains.LEAD);
    assert.strictEqual(businessIntelligenceBus.classifyDomain('market:analyzed'), BusinessDomains.MARKET);
    assert.strictEqual(businessIntelligenceBus.classifyDomain('compliance:verified'), BusinessDomains.COMPLIANCE);
    assert.strictEqual(businessIntelligenceBus.classifyDomain('meeting:scheduled'), BusinessDomains.MEETING);
    assert.strictEqual(businessIntelligenceBus.classifyDomain('brief:dispatched'), BusinessDomains.COMMUNICATION);
    assert.strictEqual(businessIntelligenceBus.classifyDomain('crm:synced'), BusinessDomains.CRM);

    // Publish test lead event with deal value
    businessIntelligenceBus.publish(AgentEvents.LEAD_INGESTED, {
      propertyPriceAed: 10000000,
    });

    const biMetrics = businessIntelligenceBus.getMetrics();
    assert.ok(biMetrics.totalEventsClassified > 0);
    assert.ok(biMetrics.pipelineRevenueAed >= 200000);
  });

  test('8. Executive Self-Healing Layer: Fault Recovery & Task Healing', async () => {
    const healthScan = await executiveSelfHealingLayer.runHealthScan();
    assert.ok(healthScan.status === 'HEALTHY' || healthScan.status === 'RECOVERED');
    assert.ok(healthScan.scannedAt);
  });

  test('9. Autonomous Daily Operations: Morning Brief & Evening Review Routines', async () => {
    const morningBrief = await autonomousDailyOperations.runMorningExecutiveBrief();
    assert.strictEqual(morningBrief.type, 'MORNING_EXECUTIVE_BRIEF');
    assert.ok(morningBrief.executiveSummary.includes('RAIOC Operating System is ONLINE'));

    const eveningReview = await autonomousDailyOperations.runEveningReview();
    assert.strictEqual(eveningReview.type, 'EVENING_OPERATIONAL_REVIEW');
    assert.ok(eveningReview.agentRankings.length > 0);
  });

  test('10. JARVIS Executive Loop & End-to-End Autonomous Governance', async () => {
    // Run an autonomous executive tick
    const tickResult = await jarvis.runExecutiveTick();
    assert.ok(tickResult.cycle >= 1);
    assert.ok(tickResult.timestamp);

    // Ingest human strategic mandate to JARVIS
    const report = await jarvis.executeObjective(
      'Deploy capital into Palm Jumeirah prime luxury villas for Ultra-HNWI foreign investor',
      {
        lead: {
          company_name: 'Apex Sovereign Wealth',
          email: 'sovereign@apexwealth.ae',
          propertyPriceAed: 20000000,
          timeline: 'immediate',
          ai_maturity: 'in_production',
          tech_stack: 'modern_cloud_native',
          data_stack: 'cloud_postgres_supabase',
        },
      }
    );

    assert.strictEqual(report.orchestrator, 'JARVIS');
    assert.strictEqual(report.status, 'COMPLETED');
    assert.ok(report.totalExecutionTimeMs > 0);
    assert.ok(report.executiveDecision);
    assert.strictEqual(report.executiveDecision.businessImpact, 'CRITICAL');
    assert.ok(report.synthesizedIntelligence.marketStrategy !== null);
    assert.ok(report.synthesizedIntelligence.complianceAudit !== null);

    // Verify Executive Dashboard synthesizes JOS v1.0 data
    const dashboard = executiveDashboard.getDashboardData();
    assert.strictEqual(dashboard.status, 'OPERATIONAL');
    assert.strictEqual(dashboard.title, 'RAIOC JARVIS Executive Operating Center (JOS v1.0)');
    assert.ok(dashboard.agentLeaderboard.length >= 8);
    assert.ok(dashboard.financials.pipelineRevenueAed > 0);
    assert.ok(dashboard.memoryStats.cognitiveMemoryStats.totalMemories > 0);
  });
});
