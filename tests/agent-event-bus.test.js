import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AgentEventBus, AgentEvents } from '../src/events/agent-event-bus.js';

describe('Agent Event Bus & Inter-Agent Messaging Tests', () => {
  const bus = new AgentEventBus();

  test('publishes and subscribes to typed agent events', async () => {
    let receivedEvent = null;
    const unsubscribe = bus.subscribe(AgentEvents.TASK_COMPLETED, (event) => {
      receivedEvent = event;
    });

    bus.publish(AgentEvents.TASK_COMPLETED, { taskId: 'task_001', status: 'SUCCESS' }, {
      sourceAgent: 'mark',
      correlationId: 'corr_test_123',
    });

    assert.ok(receivedEvent);
    assert.strictEqual(receivedEvent.topic, AgentEvents.TASK_COMPLETED);
    assert.strictEqual(receivedEvent.payload.taskId, 'task_001');
    assert.strictEqual(receivedEvent.metadata.sourceAgent, 'mark');

    unsubscribe();
  });

  test('dispatches point-to-point direct messages into recipient agent mailboxes', () => {
    bus.sendDirectMessage('jarvis', 'lex', 'Perform Golden Visa verification for AED 5M portfolio', 'corr_visa_1');

    const unread = bus.getMailbox('lex', true);
    assert.strictEqual(unread.length, 1);
    assert.strictEqual(unread[0].sender, 'jarvis');
    assert.strictEqual(unread[0].recipient, 'lex');
    assert.strictEqual(unread[0].read, false);

    // Mark read
    bus.markMessagesRead('lex');
    assert.strictEqual(bus.getMailbox('lex', true).length, 0);
    assert.strictEqual(bus.getMailbox('lex', false).length, 1);
  });
});
