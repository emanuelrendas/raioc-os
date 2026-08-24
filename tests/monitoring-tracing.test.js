import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CorrelationTracer } from '../src/monitoring/correlation-tracer.js';
import { MetricsCollector } from '../src/monitoring/metrics-collector.js';

describe('Monitoring & Tracing Tests', () => {
  test('CorrelationTracer generates and propagates context across asynchronous scopes', async () => {
    const tracer = new CorrelationTracer();
    const testId = 'corr_test_987654';

    await tracer.runWithContext({ correlationId: testId }, async () => {
      // Async step
      await new Promise((resolve) => setTimeout(resolve, 5));
      assert.strictEqual(tracer.getCorrelationId(), testId);
    });
  });

  test('MetricsCollector increments counters and tracks latency percentiles', () => {
    const metrics = new MetricsCollector();

    metrics.incrementCounter('api_calls', 1);
    metrics.incrementCounter('api_calls', 2);
    metrics.recordLatency('db_query', 10);
    metrics.recordLatency('db_query', 20);
    metrics.recordLatency('db_query', 30);

    const summary = metrics.getMetricsSummary();
    assert.strictEqual(summary.counters['api_calls'], 3);
    assert.strictEqual(summary.latencies['db_query'].avgMs, 20);
    assert.strictEqual(summary.latencies['db_query'].minMs, 10);
    assert.strictEqual(summary.latencies['db_query'].maxMs, 30);
    assert.strictEqual(summary.latencies['db_query'].sampleCount, 3);
  });
});
