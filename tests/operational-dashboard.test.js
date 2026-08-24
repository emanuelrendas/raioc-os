import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { jarvis } from '../src/agents/specialists/jarvis-orchestrator.js';
import { kpiCollector } from '../src/operational/kpi-collector.js';
import { dailyBriefingGenerator } from '../src/operational/daily-briefing-generator.js';
import { executiveDashboard } from '../src/operational/executive-dashboard.js';

describe('Operational Dashboard, KPIs & Daily Briefing Tests', () => {
  test('KpiCollector tracks operational KPIs and agent utilization', () => {
    const kpis = kpiCollector.getOperationalKpis();
    assert.strictEqual(kpis.kpiSummary.autonomousReadiness, '100%');
    assert.ok(kpis.kpiSummary.activeAgents >= 7);
    assert.ok(kpis.agentUtilization.length >= 7);
  });

  test('DailyBriefingGenerator creates structured executive daily brief', () => {
    const briefing = dailyBriefingGenerator.generateBriefing('2026-08-24');
    assert.strictEqual(briefing.date, '2026-08-24');
    assert.ok(briefing.sections.executiveSummary.includes('RAIOC Autonomous Operating Center'));
    assert.ok(briefing.sections.marketPulse.primeCommunities.length > 0);
  });

  test('ExecutiveDashboard synthesizes all real-time metrics', () => {
    const dashboard = executiveDashboard.getDashboardData();
    assert.strictEqual(dashboard.status, 'OPERATIONAL');
    assert.ok(dashboard.agents.length >= 7);
    assert.ok(dashboard.executiveMetrics);
  });
});
