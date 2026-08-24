/**
 * RAIOC Chief Orchestrator: JARVIS
 * Decomposes human objectives, coordinates specialist agents, collects intelligence, and produces executive reports.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { autonomousPlanner } from '../../operational/autonomous-planner.js';
import { priorityTaskDispatcher } from '../../operational/priority-task-dispatcher.js';
import { agentEventBus, AgentEvents } from '../../events/agent-event-bus.js';
import { sharedMemory } from '../../memory/shared-memory.js';
import { agentDirectory } from '../agent-directory.js';
import { logger } from '../../logging/audit-logger.js';

export class JarvisOrchestrator extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'jarvis',
      name: 'JARVIS',
      role: 'Chief Autonomous Orchestration Agent',
      capabilities: ['goal_decomposition', 'multi_agent_coordination', 'executive_synthesis', 'strategic_governance'],
      systemPrompt: 'You are JARVIS, Chief Intelligence Orchestrator of RAIOC. You ingest high-level human objectives, command specialist agents, govern autonomous operations, and synthesize executive intelligence.',
    });
  }

  /**
   * Autonomous Objective Execution Loop
   * @param {string} humanObjective - Natural language objective or mandate
   * @param {Object} contextData - Associated parameters
   * @returns {Promise<Object>} Comprehensive Executive Synthesis Report
   */
  async executeObjective(humanObjective, contextData = {}) {
    const startTime = Date.now();
    const correlationId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    logger.info('JARVIS', `Ingesting human objective: "${humanObjective}"`, { correlationId });

    // 1. Publish Event
    agentEventBus.publish(AgentEvents.GOAL_RECEIVED, { objective: humanObjective, contextData }, {
      sourceAgent: this.id,
      correlationId,
    });

    // 2. Autonomous Decomposition into Execution Plan
    const plan = autonomousPlanner.createPlan(humanObjective, contextData);

    this.logDecision(
      `Decomposed human objective into execution plan [${plan.planId}] containing ${plan.tasks.length} specialist tasks`,
      'ORCHESTRATE_MULTI_AGENT_PLAN',
      {
        objectiveId: correlationId,
        confidenceScore: 0.99,
        impactLevel: 'CRITICAL',
        metadata: { taskCount: plan.tasks.length, planId: plan.planId },
      }
    );

    // 3. Enqueue Tasks into Priority Dispatcher
    for (const task of plan.tasks) {
      task.correlationId = correlationId;
      task.objectiveId = correlationId;
      priorityTaskDispatcher.enqueueTask(task);
    }

    // 4. Autonomous Execution of all Dependency Tasks
    const executionResults = await priorityTaskDispatcher.processAll();

    const successCount = executionResults.filter((r) => r.status === 'SUCCESS').length;
    const failedCount = executionResults.filter((r) => r.status === 'FAILED').length;
    const durationMs = Date.now() - startTime;

    // 5. Synthesize Executive Report
    const executiveReport = {
      reportId: `exec_rep_${Date.now()}`,
      correlationId,
      objective: humanObjective,
      orchestrator: 'JARVIS',
      status: failedCount === 0 ? 'COMPLETED' : 'COMPLETED_WITH_WARNINGS',
      totalExecutionTimeMs: durationMs,
      planSummary: {
        planId: plan.planId,
        totalTasks: plan.tasks.length,
        succeededTasks: successCount,
        failedTasks: failedCount,
      },
      agentContributions: executionResults.map((t) => ({
        taskId: t.id,
        taskName: t.name,
        agentId: t.agentId,
        status: t.status,
        outputSummary: typeof t.result === 'object' ? Object.keys(t.result || {}) : t.result,
      })),
      synthesizedIntelligence: {
        riskEvaluation: executionResults.find((t) => t.agentId === 'mark')?.result || null,
        marketStrategy: executionResults.find((t) => t.agentId === 'atlas')?.result || null,
        complianceAudit: executionResults.find((t) => t.agentId === 'lex')?.result || null,
        communications: executionResults.find((t) => t.agentId === 'aida')?.result || null,
        crmStaging: executionResults.find((t) => t.agentId === 'hermes')?.result || null,
        calendarBooking: executionResults.find((t) => t.agentId === 'helios')?.result || null,
        systemHealth: executionResults.find((t) => t.agentId === 'sentinel')?.result || null,
      },
      generatedAt: new Date().toISOString(),
    };

    // 6. Update Long-Term Shared Memory
    sharedMemory.storeKnowledge(`executive_report_${correlationId}`, executiveReport, {
      importance: 2.0,
      tags: ['executive_report', 'jarvis', 'orchestration', 'objective'],
    });

    // 7. Publish Goal Completed Event
    agentEventBus.publish(AgentEvents.GOAL_COMPLETED, { reportId: executiveReport.reportId, status: executiveReport.status }, {
      sourceAgent: this.id,
      correlationId,
    });

    logger.info('JARVIS', `Autonomous objective completed in ${durationMs}ms with status: ${executiveReport.status}`);
    return executiveReport;
  }
}

export const jarvis = new JarvisOrchestrator();
agentDirectory.registerAgent(jarvis);
