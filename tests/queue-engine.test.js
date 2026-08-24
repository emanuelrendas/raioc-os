import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { QueueEngine } from '../src/engines/queue-engine.js';
import { SupabaseClient } from '../src/db/supabase-client.js';

describe('QueueEngine Unit Tests', () => {
  test('successfully executes adapter dispatch and marks task dispatched', async () => {
    const queue = new QueueEngine({ maxRetries: 3, baseBackoffMs: 10 });
    const mockDb = new SupabaseClient({ useMock: true });

    // Register a mock adapter
    let dispatched = false;
    queue.registerAdapter('mock_channel', {
      async dispatch(task) {
        dispatched = true;
        return { delivered: true, taskId: task.id };
      },
    });

    const task = await mockDb.enqueueDispatch({
      type: 'mock_channel',
      recipient: 'user_1',
      payload: { msg: 'hello' },
    });

    const result = await queue.processTask(task, mockDb);
    assert.strictEqual(result.success, true);
    assert.strictEqual(dispatched, true);

    const updatedTask = mockDb.mockStore.dispatch_queue.find((t) => t.id === task.id);
    assert.strictEqual(updatedTask.status, 'dispatched');
    assert.ok(updatedTask.dispatched_at);
  });

  test('retries on adapter failure with exponential backoff', async () => {
    const queue = new QueueEngine({ maxRetries: 2, baseBackoffMs: 20 });
    const mockDb = new SupabaseClient({ useMock: true });

    queue.registerAdapter('failing_channel', {
      async dispatch() {
        throw new Error('Network timeout');
      },
    });

    const task = await mockDb.enqueueDispatch({
      type: 'failing_channel',
      recipient: 'user_2',
      payload: { msg: 'fail' },
    });

    // First attempt -> should retry
    const res1 = await queue.processTask(task, mockDb);
    assert.strictEqual(res1.success, false);
    assert.strictEqual(res1.retrying, true);

    let updated = mockDb.mockStore.dispatch_queue.find((t) => t.id === task.id);
    assert.strictEqual(updated.status, 'retrying');
    assert.strictEqual(updated.retry_count, 1);
    assert.strictEqual(updated.last_error, 'Network timeout');

    // Second attempt -> should retry again
    const res2 = await queue.processTask(updated, mockDb);
    assert.strictEqual(res2.retrying, true);
    assert.strictEqual(updated.retry_count, 2);

    // Third attempt (exceeds maxRetries = 2) -> should mark failed
    const res3 = await queue.processTask(updated, mockDb);
    assert.strictEqual(res3.failed, true);
    assert.strictEqual(updated.status, 'failed');
    assert.ok(updated.failed_at);
  });

  test('marks failed if no adapter registered for task type', async () => {
    const queue = new QueueEngine();
    const mockDb = new SupabaseClient({ useMock: true });

    const task = await mockDb.enqueueDispatch({
      type: 'unregistered_type',
      recipient: 'user_x',
      payload: {},
    });

    const res = await queue.processTask(task, mockDb);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('No adapter registered'));

    const updated = mockDb.mockStore.dispatch_queue.find((t) => t.id === task.id);
    assert.strictEqual(updated.status, 'failed');
  });
});
