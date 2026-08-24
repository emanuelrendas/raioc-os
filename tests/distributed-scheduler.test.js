import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DistributedScheduler } from '../src/core/distributed-scheduler.js';

describe('Distributed Scheduler Tests', () => {
  test('registers and inspects core jobs', () => {
    const scheduler = new DistributedScheduler({ intervalMs: 1000 });
    const status = scheduler.getJobStatus();

    assert.ok(status.length >= 3);
    const jobIds = status.map((j) => j.id);
    assert.ok(jobIds.includes('core_run_cycle'));
    assert.ok(jobIds.includes('queue_retry_sweep'));
    assert.ok(jobIds.includes('telemetry_heartbeat'));
  });

  test('manages distributed lock acquisition preventing concurrent duplicate runs', async () => {
    const scheduler = new DistributedScheduler({ intervalMs: 1000 });

    const lock1 = await scheduler.acquireLock('job_test_1');
    assert.strictEqual(lock1, true);

    // Duplicate lock attempt while active -> rejected
    const lock2 = await scheduler.acquireLock('job_test_1');
    assert.strictEqual(lock2, false);

    // Release lock
    scheduler.releaseLock('job_test_1');
    const lock3 = await scheduler.acquireLock('job_test_1');
    assert.strictEqual(lock3, true);
    scheduler.releaseLock('job_test_1');
  });

  test('executes custom job with timing and execution counters', async () => {
    const scheduler = new DistributedScheduler({ intervalMs: 1000 });
    let executed = false;

    scheduler.registerJob('custom_test_job', {
      intervalMs: 500,
      execute: async () => {
        executed = true;
        return { success: true };
      },
    });

    const res = await scheduler.runJob('custom_test_job');
    assert.strictEqual(executed, true);
    assert.strictEqual(res.success, true);

    const status = scheduler.getJobStatus().find((j) => j.id === 'custom_test_job');
    assert.strictEqual(status.runCount, 1);
    assert.strictEqual(status.lastStatus, 'SUCCESS');
  });
});
