/**
 * RAIOC Operational Layer - Executive Dashboard Aggregator
 * Synthesizes all real-time operational metrics, agent roster states, decisions, and market intelligence for leadership.
 */

import { kpiCollector } from './kpi-collector.js';
import { decisionLogger } from './decision-logger.js';
import { priorityTaskDispatcher } from './priority-task-dispatcher.js';
import { agentDirectory } from '../agents/agent-directory.js';
import { dailyBriefingGenerator } from './daily-briefing-generator.js';
import { sharedMemory } from '../memory/shared-memory.js';

export class ExecutiveDashboard {
  /**
   * Retrieves the full executive dashboard snapshot
   */
  getDashboardData() {
    const kpis = kpiCollector.getOperationalKpis();
    const queueStatus = priorityTaskDispatcher.getQueueStatus();
    const agentRoster = agentDirectory.listAgents();
    const recentDecisions = decisionLogger.getRecentDecisionsSummary(8);
    const memoryStats = sharedMemory.getStats();

    return {
      status: 'OPERATIONAL',
      title: 'RAIOC Executive Intelligence Operating Center',
      executiveMetrics: kpis.kpiSummary,
      agents: agentRoster,
      queueStatus,
      recentStrategicDecisions: recentDecisions,
      memoryStats,
      timestamp: new Date().toISOString(),
    };
  }

  getDailyBriefing() {
    return dailyBriefingGenerator.generateBriefing();
  }
}

export const executiveDashboard = new ExecutiveDashboard();
