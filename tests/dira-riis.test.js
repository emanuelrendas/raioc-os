import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DiraRiisEngine } from '../src/engines/dira-riis-engine.js';

describe('DiraRiisEngine Unit Tests', () => {
  const engine = new DiraRiisEngine();

  test('calculates high RIIS score for enterprise lead', () => {
    const input = {
      company_size: '500+',
      ai_maturity: 'in_production',
      bottlenecks: 'data latency and scale',
      timeline: 'immediate',
    };

    const riis = engine.evaluateRiis(input);
    assert.ok(riis.score >= 80, `Expected score >= 80, got ${riis.score}`);
    assert.strictEqual(riis.tier, 'TIER_1_STRATEGIC');
    assert.strictEqual(riis.tierLabel, 'Strategic Enterprise Operating Candidate');
    assert.ok(riis.factors.length > 0);
  });

  test('calculates foundational RIIS score for startup lead', () => {
    const input = {
      company_size: '1-19',
      ai_maturity: 'manual',
      timeline: 'quarter',
    };

    const riis = engine.evaluateRiis(input);
    assert.ok(riis.score >= 50 && riis.score < 80);
    assert.ok(riis.tier.startsWith('TIER_'));
  });

  test('evaluates DIRA critical risk for legacy/manual bottlenecks', () => {
    const input = {
      data_stack: 'spreadsheets and legacy ERP',
      manual_hours: 'critical 40+ hours per week',
      compliance: 'fintech banking regulation',
    };

    const riis = engine.evaluateRiis(input);
    const dira = engine.evaluateDira(input, riis);

    assert.ok(dira.riskScore >= 50, `Expected riskScore >= 50, got ${dira.riskScore}`);
    assert.strictEqual(dira.riskLevel, 'CRITICAL');
    assert.strictEqual(dira.riskVectors.length, 3);
  });

  test('comprehensive analyze returns composite score and recommended track', () => {
    const analysis = engine.analyze({
      company_size: '100-500',
      ai_maturity: 'piloting',
      timeline: 'immediate',
      data_stack: 'modern cloud',
    });

    assert.ok(analysis.compositeScore > 0 && analysis.compositeScore <= 100);
    assert.ok(analysis.recommendedTrack);
    assert.ok(analysis.riis);
    assert.ok(analysis.dira);
  });
});
