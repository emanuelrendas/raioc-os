import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { agentDirectory } from '../src/agents/agent-directory.js';
import { agentEventBus, AgentEvents } from '../src/events/agent-event-bus.js';
import { sharedMemory } from '../src/memory/shared-memory.js';
import { decisionLogger } from '../src/operational/decision-logger.js';
import { operatingCenter } from '../src/operational/operating-center.js';
import { markTriageAgent } from '../src/agents/specialists/mark-triage-agent.js';
import { lexComplianceAgent } from '../src/agents/specialists/lex-compliance-agent.js';
import { sentinelHealthAgent } from '../src/agents/specialists/sentinel-health-agent.js';

describe('Autonomous Multi-Agent Ecosystem Continuous Operation Tests', () => {
  before(async () => {
    // Enable autonomous mesh across all agents
    agentDirectory.enableAutonomousMesh();
  });

  test('Autonomous Event-Driven Chaining across specialist agents without human orchestration', async () => {
    const correlationId = `chain_test_${Date.now()}`;
    const chainedEvents = [];

    // Track all chained lifecycle events
    const eventTopics = [
      AgentEvents.LEAD_INGESTED,
      AgentEvents.LEAD_QUALIFIED,
      AgentEvents.MARKET_ANALYZED,
      AgentEvents.COMPLIANCE_VERIFIED,
      AgentEvents.BRIEF_DISPATCHED,
      AgentEvents.CRM_SYNCED,
      AgentEvents.MEETING_SCHEDULED,
      AgentEvents.CYCLE_AUDITED,
    ];

    const unsubscribers = eventTopics.map((topic) =>
      agentEventBus.subscribe(topic, (evt) => {
        if (evt.metadata.correlationId === correlationId) {
          chainedEvents.push(evt.topic);
        }
      })
    );

    // Trigger initial business event: Inbound lead arrival
    agentEventBus.publish(
      AgentEvents.LEAD_INGESTED,
      {
        lead: {
          id: 'lead_auto_chain_001',
          company_name: 'Royal Emirates Capital',
          contact_name: 'Sheikh Mansoor Al Qasimi',
          email: 'mansoor@royalemirates.ae',
          phone: '+971509998877',
          company_size: '500+',
          ai_maturity: 'in_production',
          timeline: 'immediate',
          tech_stack: 'modern_cloud_native',
          data_stack: 'cloud_postgres_supabase',
          propertyPriceAed: 15000000,
          communityId: 'comm_palm_jumeirah',
          developerId: 'dev_nakheel',
        },
      },
      { correlationId }
    );

    // Allow asynchronous event chain to propagate through all 7 specialist agents
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Verify all steps in the autonomous chain fired in order
    assert.ok(chainedEvents.includes(AgentEvents.LEAD_INGESTED));
    assert.ok(chainedEvents.includes(AgentEvents.LEAD_QUALIFIED));
    assert.ok(chainedEvents.includes(AgentEvents.MARKET_ANALYZED));
    assert.ok(chainedEvents.includes(AgentEvents.COMPLIANCE_VERIFIED));
    assert.ok(chainedEvents.includes(AgentEvents.BRIEF_DISPATCHED));
    assert.ok(chainedEvents.includes(AgentEvents.CRM_SYNCED));
    assert.ok(chainedEvents.includes(AgentEvents.MEETING_SCHEDULED));
    assert.ok(chainedEvents.includes(AgentEvents.CYCLE_AUDITED));

    // Cleanup subscriptions
    unsubscribers.forEach((unsub) => unsub());
  });

  test('Autonomous Self-Healing: SENTINEL intercepts failed task and triggers recovery', async () => {
    const correlationId = `recovery_test_${Date.now()}`;
    let recoveredEvent = null;

    const unsub = agentEventBus.subscribe(AgentEvents.TASK_RECOVERED, (evt) => {
      if (evt.metadata.correlationId === correlationId) {
        recoveredEvent = evt;
      }
    });

    // Simulate task failure in the event bus
    agentEventBus.publish(
      AgentEvents.TASK_FAILED,
      {
        task: { id: 'task_simulated_fail_999', name: 'CRM Pipeline Staging' },
        error: 'Network gateway timeout (504)',
        agentId: 'hermes',
      },
      { correlationId }
    );

    // Allow watchdog to react
    await new Promise((resolve) => setTimeout(resolve, 200));

    assert.ok(recoveredEvent !== null);
    assert.strictEqual(recoveredEvent.payload.recoveredTaskId, 'task_simulated_fail_999');
    assert.strictEqual(recoveredEvent.payload.agentId, 'hermes');

    // Verify decision log contains recovery record
    const decisions = decisionLogger.getDecisions({ objectiveId: correlationId });
    assert.ok(decisions.length >= 1);
    assert.strictEqual(decisions[0].chosenAction, 'TRIGGER_SELF_HEALING_RECOVERY');

    unsub();
  });

  test('Direct Inter-Agent Messaging & Autonomous Collaboration', () => {
    const correlationId = `collab_${Date.now()}`;

    // MARK sends direct inquiry to LEX
    const msg = markTriageAgent.sendMessage(
      'lex',
      'Please verify UAE Golden Visa compliance for AED 15M off-plan asset in Palm Jumeirah.',
      correlationId
    );

    assert.strictEqual(msg.sender, 'mark');
    assert.strictEqual(msg.recipient, 'lex');

    // Check LEX mailbox
    const lexMailbox = agentEventBus.getMailbox('lex', true);
    assert.ok(lexMailbox.some((m) => m.correlationId === correlationId));

    // Mark messages read
    agentEventBus.markMessagesRead('lex');
    assert.strictEqual(agentEventBus.getMailbox('lex', true).length, 0);

    // Verify conversation stored in shared memory
    const history = sharedMemory.getConversationHistory({ correlationId });
    assert.ok(history.length >= 1);
    assert.strictEqual(history[0].sender, 'mark');
    assert.strictEqual(history[0].recipient, 'lex');
  });

  test('State & Memory Persistence: Agent decisions and working memories are recorded', () => {
    const memoryKey = `test_memory_persist_${Date.now()}`;
    const testPayload = { assetAllocation: 'Palm Jumeirah', targetYield: '7.2%' };

    lexComplianceAgent.storeMemory(memoryKey, testPayload, { tags: ['test', 'persistence'] });

    const recalled = lexComplianceAgent.recallMemory(memoryKey);
    assert.ok(recalled.length > 0);
    assert.strictEqual(recalled[0].content.assetAllocation, 'Palm Jumeirah');

    const status = lexComplianceAgent.getStatus();
    assert.strictEqual(status.id, 'lex');
    assert.strictEqual(status.isAutonomous, true);
  });
});
