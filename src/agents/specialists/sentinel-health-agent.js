/**
 * RAIOC Specialist Agent: SENTINEL (Operational Watchdog, Health & Security)
 * Monitors agent heartbeats, system queue backlog, error budgets, and liveness telemetry.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { telemetry } from '../../logging/telemetry.js';
import { agentEventBus, AgentEvents } from '../../events/agent-event-bus.js';

export class SentinelHealthAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'sentinel',
      name: 'SENTINEL',
      role: 'Operational Watchdog & Health Guardian',
      capabilities: ['heartbeat_monitoring', 'queue_backlog_audit', 'security_watchdog', 'system_health_telemetry'],
      systemPrompt: 'You monitor the health, availability, and security posture of the entire RAIOC multi-agent operating system.',
    });
  }

  async processTask(task, context = {}) {
    const telemetrySnapshot = telemetry.getSnapshot();

    const healthAudit = {
      systemStatus: telemetrySnapshot.systemHealth,
      metrics: telemetrySnapshot,
      auditedAt: new Date().toISOString(),
      healthy: telemetrySnapshot.systemHealth === 'HEALTHY' || telemetrySnapshot.systemHealth === 'DEGRADED',
    };

    if (telemetrySnapshot.systemHealth === 'CRITICAL') {
      agentEventBus.publish(AgentEvents.ALERT_RAISED, {
        severity: 'CRITICAL',
        message: 'System health degraded to CRITICAL in telemetry audit',
        metrics: telemetrySnapshot,
      });
    }

    this.logDecision(
      `Conducted system health audit: Status is ${telemetrySnapshot.systemHealth} with ${telemetrySnapshot.cycleCount} cycles processed`,
      'MAINTAIN_SYSTEM_HEALTH_OK',
      {
        objectiveId: context.correlationId,
        confidenceScore: 1.0,
        impactLevel: 'LOW',
        metadata: { health: telemetrySnapshot.systemHealth },
      }
    );

    return healthAudit;
  }
}

export const sentinelHealthAgent = new SentinelHealthAgent();
