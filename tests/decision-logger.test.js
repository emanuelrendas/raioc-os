import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DecisionLogger } from '../src/operational/decision-logger.js';

describe('Autonomous Decision Logger Tests', () => {
  const logger = new DecisionLogger();

  test('records and retrieves structured agent decisions', () => {
    const decision = logger.logDecision({
      agentId: 'lex',
      objectiveId: 'obj_acquisition_001',
      rationale: 'Property value is AED 2.5M exceeding the statutory AED 2.0M Golden Visa requirement',
      chosenAction: 'APPROVE_GOLDEN_VISA_PATHWAY',
      alternativesConsidered: ['REQUEST_ADDITIONAL_EQUITY', 'REJECT_VISA_APPLICATION'],
      confidenceScore: 0.99,
      impactLevel: 'HIGH',
    });

    assert.ok(decision.decisionId.startsWith('dec_'));
    assert.strictEqual(decision.agentId, 'lex');
    assert.strictEqual(decision.chosenAction, 'APPROVE_GOLDEN_VISA_PATHWAY');

    const decisions = logger.getDecisions({ agentId: 'lex' });
    assert.strictEqual(decisions.length, 1);
    assert.strictEqual(decisions[0].decisionId, decision.decisionId);
  });

  test('filters decisions by impact level and provides summary', () => {
    logger.logDecision({
      agentId: 'sentinel',
      rationale: 'All health checks within nominal tolerances',
      chosenAction: 'MAINTAIN_SYSTEM_HEALTH_OK',
      impactLevel: 'LOW',
    });

    const highImpact = logger.getDecisions({ impactLevel: 'HIGH' });
    assert.strictEqual(highImpact.length, 1);

    const summary = logger.getRecentDecisionsSummary(5);
    assert.ok(summary.length >= 2);
    assert.strictEqual(summary[0].agent, 'lex');
  });
});
