/**
 * RAIOC Autonomous Operating Center (Company Operating System)
 * Central orchestrator maintaining the always-on multi-agent runtime, heartbeats, and goal executions.
 */

import { jarvis } from '../agents/specialists/jarvis-orchestrator.js';
import { agentDirectory } from '../agents/agent-directory.js';
import { distributedScheduler } from '../core/distributed-scheduler.js';
import { agentEventBus, AgentEvents } from '../events/agent-event-bus.js';
import { sharedMemory } from '../memory/shared-memory.js';
import { kpiCollector } from './kpi-collector.js';
import { executiveDashboard } from './executive-dashboard.js';
import { logger } from '../logging/audit-logger.js';

export class OperatingCenter {
  constructor() {
    this.isOnline = false;
    this.heartbeatTimer = null;
  }

  /**
   * Boots the always-on Autonomous Operating Center
   */
  async boot() {
    if (this.isOnline) return;
    this.isOnline = true;
    logger.info('OPERATING_CENTER', '🚀 Booting RAIOC Autonomous Multi-Agent Operating Center...');

    // 1. Initialize Event Subscriptions
    this._setupEventSubscriptions();

    // 2. Enable Autonomous Reactive Mesh across all Specialist Agents
    agentDirectory.enableAutonomousMesh();

    // 3. Start Distributed Autonomous Scheduler
    await distributedScheduler.start();

    // 4. Start Agent Heartbeat Broadcasting (every 60s)
    this.heartbeatTimer = setInterval(() => {
      if (this.isOnline) {
        agentDirectory.broadcastHeartbeats();
      }
    }, 60000);

    // Broadcast initial heartbeats
    agentDirectory.broadcastHeartbeats();

    logger.info('OPERATING_CENTER', '✅ RAIOC Autonomous Operating Center is ONLINE and ALWAYS-ON');
    return { status: 'ONLINE', agents: agentDirectory.listAgents().length };
  }

  _setupEventSubscriptions() {
    agentEventBus.subscribe(AgentEvents.GOAL_COMPLETED, (event) => {
      logger.info('OPERATING_CENTER', `Goal completed: ${event.payload.reportId} (${event.payload.status})`);
      kpiCollector.recordObjectiveCompleted(event.payload.durationMs || 0);
    });

    agentEventBus.subscribe(AgentEvents.ALERT_RAISED, (event) => {
      logger.warn('OPERATING_CENTER', `Operational Alert: [${event.payload.severity}] ${event.payload.message}`);
    });
  }

  /**
   * Primary entrypoint: Human asks JARVIS one objective, JARVIS decomposes and executes autonomously.
   */
  async requestJarvisObjective(humanObjective, contextData = {}) {
    logger.info('OPERATING_CENTER', `Human objective assigned to JARVIS: "${humanObjective}"`);
    return await jarvis.executeObjective(humanObjective, contextData);
  }

  getDashboard() {
    return executiveDashboard.getDashboardData();
  }

  getDailyBriefing() {
    return executiveDashboard.getDailyBriefing();
  }

  async shutdown() {
    logger.info('OPERATING_CENTER', 'Shutting down Operating Center...');
    this.isOnline = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    await distributedScheduler.stop();
  }
}

export const operatingCenter = new OperatingCenter();
