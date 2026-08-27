/**
 * RAIOC OS - Unit Test Suite: Daemon Recovery Engine & DLQ Sweep
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  reclaimStuckProcessingEvents,
  formatCeoIncidentAlert,
  recoveryEngine,
} from '../../src/core/recovery-engine.js';
import { supabase } from '../../src/db/supabase-client.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';
import { startDaemon, stopDaemon, getDaemonStatus } from '../../src/workers/daemon-entrypoint.js';

describe('⚡ Daemon Recovery Engine & DLQ Sweep Suite', () => {
  beforeEach(() => {
    supabase.mockStore.enterprise_events = [];
    supabase.mockStore.enterprise_events_dlq = [];
  });

  afterEach(async () => {
    await stopDaemon();
  });

  test('1. reclaimStuckProcessingEvents reclaims events older than staleThreshold (retry < 3)', async () => {
    const now = Date.now();
    const staleCreatedAt = new Date(now - 400 * 1000).toISOString(); // 400s old (exceeds 300s)

    // Insert stuck event with retry_count: 0
    supabase.mockStore.enterprise_events.push({
      id: 'evt_stuck_001',
      event_type: 'raioc.advisory.brief.requested.v1',
      source: 'raioc://tests/mock',
      payload: { mandateId: 'MAN-001', allocationAed: 35000000 },
      status: 'PROCESSING',
      retry_count: 0,
      created_at: staleCreatedAt,
    });

    // Insert recent event (<300s) that should NOT be reclaimed
    supabase.mockStore.enterprise_events.push({
      id: 'evt_recent_002',
      event_type: 'raioc.channel.whatsapp.message.v1',
      source: 'raioc://tests/mock',
      payload: { text: 'Hello' },
      status: 'PROCESSING',
      retry_count: 0,
      created_at: new Date().toISOString(),
    });

    const capturedReclaimed = [];
    const unsub = enterpriseEventBus.subscribe('*', (data, ctx) => {
      capturedReclaimed.push({ type: ctx?.type, data, ...ctx });
    });

    const res = await reclaimStuckProcessingEvents(300);
    unsub();

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.scannedCount, 1);
    assert.strictEqual(res.reclaimedCount, 1);
    assert.strictEqual(res.dlqCount, 0);

    // Verify stuck event status updated to EMITTED with incremented retry count
    const updated = supabase.mockStore.enterprise_events.find((e) => e.id === 'evt_stuck_001');
    assert.strictEqual(updated.status, 'EMITTED');
    assert.strictEqual(updated.retry_count, 1);

    // Verify recent event was untouched
    const recent = supabase.mockStore.enterprise_events.find((e) => e.id === 'evt_recent_002');
    assert.strictEqual(recent.status, 'PROCESSING');
    assert.strictEqual(recent.retry_count, 0);
  });

  test('2. reclaimStuckProcessingEvents sweeps events with retry_count >= 3 into Dead-Letter Queue (DLQ)', async () => {
    const now = Date.now();
    const staleCreatedAt = new Date(now - 500 * 1000).toISOString();

    // Insert stuck event with max retries exhausted
    supabase.mockStore.enterprise_events.push({
      id: 'evt_dead_letter_003',
      event_type: 'raioc.voice.outreach_dispatched.v1',
      source: 'raioc://tests/mock',
      payload: { phone: '+971501234567', recipient: 'VIP Client' },
      status: 'PROCESSING',
      retry_count: 3,
      created_at: staleCreatedAt,
    });

    const res = await reclaimStuckProcessingEvents(300);

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.scannedCount, 1);
    assert.strictEqual(res.reclaimedCount, 0);
    assert.strictEqual(res.dlqCount, 1);

    // Verify event status is DEAD_LETTER
    const updated = supabase.mockStore.enterprise_events.find((e) => e.id === 'evt_dead_letter_003');
    assert.strictEqual(updated.status, 'DEAD_LETTER');

    // Verify event is present in DLQ store
    const dlqItems = await supabase.fetchDlqEvents();
    assert.strictEqual(dlqItems.length, 1);
    assert.strictEqual(dlqItems[0].event_id, 'evt_dead_letter_003');
    assert.strictEqual(dlqItems[0].event_type, 'raioc.voice.outreach_dispatched.v1');
    assert.ok(dlqItems[0].reason.includes('Exceeded max retry'));
  });

  test('3. formatCeoIncidentAlert compiles institutional multi-timezone alert', () => {
    const alert = formatCeoIncidentAlert({
      reason: 'Database connection pool transient timeout during high-ticket mandate surge.',
      reclaimedEventsCount: 4,
      dbLatencyMs: 45,
      severity: 'CRITICAL',
      correlationId: 'inc_test_9988',
      details: 'Pool size restored to 20 connections.',
    });

    assert.ok(alert.includes('EXECUTIVE INCIDENT NOTIFICATION'));
    assert.ok(alert.includes('Emanuel Rendas'));
    assert.ok(alert.includes('GST (Dubai)'));
    assert.ok(alert.includes('BST (London)'));
    assert.ok(alert.includes('LIS (Lisbon)'));
    assert.ok(alert.includes('EST (New York)'));
    assert.ok(alert.includes('Stale Events Reclaimed: 4'));
    assert.ok(alert.includes('Database Response Latency: 45ms'));
    assert.ok(alert.includes('SEC-INC-inc_test_9988'));
  });

  test('4. startDaemon executes startup recovery and emits raioc.system.daemon.recovered.v1', async () => {
    const capturedEvents = [];
    const unsub = enterpriseEventBus.subscribe('*', (data, ctx) => {
      capturedEvents.push({ type: ctx?.type, data, ...ctx });
    });

    const status = await startDaemon({
      port: 3099,
      strictEnv: false,
      startHttp: false,
      staleThresholdSeconds: 300,
    });

    unsub();

    assert.strictEqual(status.isRunning, true);
    assert.strictEqual(status.runtimeMode, 'persistent_daemon');
    assert.ok(status.recoverySummary);

    // Verify CloudEvent raioc.system.daemon.recovered.v1 emitted
    const recoveredEvent = capturedEvents.find((e) => e.type === 'raioc.system.daemon.recovered.v1');
    assert.ok(recoveredEvent, 'Expected raioc.system.daemon.recovered.v1 CloudEvent to be published');
    assert.strictEqual(recoveredEvent.data.runtimeMode, 'persistent_daemon');

    // Clean up
    await stopDaemon();
    const afterStop = getDaemonStatus();
    assert.strictEqual(afterStop.isRunning, false);
  });
});
