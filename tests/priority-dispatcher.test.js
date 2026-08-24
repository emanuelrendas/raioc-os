import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PriorityTaskDispatcher, TaskPriority } from '../src/operational/priority-task-dispatcher.js';

describe('Priority Task Dispatcher & Execution Queue Tests', () => {
  test('sorts and executes tasks strictly by priority hierarchy', async () => {
    const dispatcher = new PriorityTaskDispatcher();

    dispatcher.enqueueTask({
      id: 'task_bg',
      name: 'Background Sentinel Check',
      agentId: 'sentinel',
      priority: TaskPriority.BACKGROUND,
      payload: {},
    });

    dispatcher.enqueueTask({
      id: 'task_crit',
      name: 'Critical Lead Triage',
      agentId: 'mark',
      priority: TaskPriority.CRITICAL,
      payload: {
        leadData: { company_name: 'Fast Capital', company_size: '500+', ai_maturity: 'in_production', timeline: 'immediate' },
      },
    });

    dispatcher.enqueueTask({
      id: 'task_high',
      name: 'High Priority Compliance',
      agentId: 'lex',
      priority: TaskPriority.HIGH,
      payload: { propertyPriceAed: 5000000 },
    });

    // First dispatched must be CRITICAL
    const first = await dispatcher.dispatchNext();
    assert.strictEqual(first.id, 'task_crit');
    assert.strictEqual(first.status, 'SUCCESS');

    // Second must be HIGH
    const second = await dispatcher.dispatchNext();
    assert.strictEqual(second.id, 'task_high');
    assert.strictEqual(second.status, 'SUCCESS');

    // Third must be BACKGROUND
    const third = await dispatcher.dispatchNext();
    assert.strictEqual(third.id, 'task_bg');
    assert.strictEqual(third.status, 'SUCCESS');
  });

  test('respects dependency ordering executing prerequisite tasks first', async () => {
    const dispatcher = new PriorityTaskDispatcher();

    dispatcher.enqueueTask({
      id: 'task_dep_parent',
      name: 'Parent Market Analysis',
      agentId: 'atlas',
      priority: TaskPriority.NORMAL,
      payload: { communityId: 'comm_downtown_dubai' },
    });

    dispatcher.enqueueTask({
      id: 'task_dep_child',
      name: 'Child Consultation Booking',
      agentId: 'helios',
      priority: TaskPriority.CRITICAL, // Higher priority but depends on parent
      dependencies: ['task_dep_parent'],
      payload: { attendeeEmail: 'client@example.com' },
    });

    // Parent must execute first despite child having higher priority
    const step1 = await dispatcher.dispatchNext();
    assert.strictEqual(step1.id, 'task_dep_parent');
    assert.strictEqual(step1.status, 'SUCCESS');

    const step2 = await dispatcher.dispatchNext();
    assert.strictEqual(step2.id, 'task_dep_child');
    assert.strictEqual(step2.status, 'SUCCESS');
  });
});
