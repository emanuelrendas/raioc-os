import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runProductionPipelineVerification } from '../src/core/verify-pipeline.js';

describe('RAIOC Go-Live Production Pipeline Verification', () => {
  test('executes all 15 production stages with a real production-grade test lead', async () => {
    const report = await runProductionPipelineVerification();

    assert.strictEqual(report.overallStatus, 'VERIFIED_PRODUCTION_READY');
    assert.strictEqual(report.errors.length, 0);
    assert.strictEqual(report.stages.length, 15);

    // Verify all stages passed
    for (const stage of report.stages) {
      assert.strictEqual(
        stage.status,
        'PASSED',
        `Stage ${stage.stage} (${stage.name}) did not pass: ${stage.error || 'unknown'}`
      );
      assert.ok(stage.latencyMs >= 0);
    }

    assert.ok(report.totalDurationMs > 0);
  });
});
