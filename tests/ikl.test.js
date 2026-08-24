import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ikl,
  versionManager,
  provenanceEngine,
  confidenceEngine,
  recommendationEngine,
  AuthorityLevel,
  ConfidenceTier,
  IKL_CURRENT_VERSION,
} from '../src/core/ikl/index.js';

describe('Institutional Knowledge Layer (IKL v1.0) Tests', () => {
  describe('Version Management', () => {
    test('returns current version 1.0.0', () => {
      assert.strictEqual(versionManager.getCurrentVersion(), '1.0.0');
      assert.strictEqual(IKL_CURRENT_VERSION, '1.0.0');
      assert.strictEqual(ikl.getVersion(), '1.0.0');
    });

    test('retrieves version metadata and validates semantic compatibility', () => {
      const meta = versionManager.getVersionMetadata('1.0.0');
      assert.strictEqual(meta.status, 'ACTIVE');
      assert.strictEqual(meta.schemaVersion, '1.0');
      assert.strictEqual(versionManager.isCompatible('1.2.0'), true);
      assert.strictEqual(versionManager.isCompatible('2.0.0'), false);
    });

    test('returns version changelog history', () => {
      const changelog = versionManager.getChangelog();
      assert.ok(Array.isArray(changelog));
      assert.ok(changelog.length >= 1);
      assert.strictEqual(changelog[0].version, '1.0.0');
    });
  });

  describe('Provenance Engine', () => {
    test('generates deterministic SHA-256 verification hashes', () => {
      const hash1 = provenanceEngine.generateHash({ test: 123 });
      const hash2 = provenanceEngine.generateHash({ test: 123 });
      assert.strictEqual(hash1, hash2);
      assert.strictEqual(typeof hash1, 'string');
      assert.strictEqual(hash1.length, 16);
    });

    test('registers and retrieves provenance records with authority weights', () => {
      const entry = provenanceEngine.register('test_source', {
        source: 'Dubai Land Department Official Registry',
        citation: 'DLD Circular 2026',
        authorityWeight: AuthorityLevel.STATUTORY,
      });

      assert.strictEqual(entry.key, 'test_source');
      assert.strictEqual(entry.authorityWeight, 1.0);
      assert.strictEqual(entry.status, 'VERIFIED');

      const retrieved = provenanceEngine.getProvenance('test_source');
      assert.strictEqual(retrieved.source, 'Dubai Land Department Official Registry');
    });
  });

  describe('Confidence Scoring Engine', () => {
    test('computes very high confidence for statutory sources with complete evidence', () => {
      const prov = {
        authorityWeight: AuthorityLevel.STATUTORY,
        lastVerified: new Date().toISOString(),
      };
      const context = { matchedCount: 3, expectedCount: 3 };

      const conf = confidenceEngine.calculateConfidence(prov, context);
      assert.ok(conf.score >= 0.90, `Expected score >= 0.90, got ${conf.score}`);
      assert.strictEqual(conf.tier, ConfidenceTier.VERY_HIGH);
      assert.strictEqual(conf.factors.authorityWeight, 1.0);
      assert.strictEqual(conf.factors.evidenceCoverage, 1.0);
    });

    test('applies decay and partial evidence correctly', () => {
      const prov = {
        authorityWeight: AuthorityLevel.EXPERT_ANALYSIS,
        lastVerified: '2025-01-01T00:00:00.000Z', // Old date -> triggers decay
      };
      const context = { matchedCount: 1, expectedCount: 4 };

      const conf = confidenceEngine.calculateConfidence(prov, context);
      assert.ok(conf.score < 0.90);
      assert.ok(conf.factors.freshnessFactor < 1.0);
    });
  });

  describe('Institutional Knowledge Domains & Datasets', () => {
    test('queries communities with yields, price sqft, and provenance', () => {
      const communities = ikl.getCommunities();
      assert.ok(communities.length >= 5);

      const downtown = ikl.getCommunity('comm_downtown_dubai');
      assert.ok(downtown);
      assert.strictEqual(downtown.name, 'Downtown Dubai');
      assert.strictEqual(downtown.avgGrossYield, 6.8);
      assert.strictEqual(downtown.provenance.authorityWeight, AuthorityLevel.STATUTORY);

      const highYield = ikl.getCommunities((c) => c.avgGrossYield >= 7.0);
      assert.ok(highYield.length >= 2);
    });

    test('queries developers with ratings, escrow compliance, and track record', () => {
      const developers = ikl.getDevelopers();
      assert.ok(developers.length >= 5);

      const emaar = ikl.getDeveloper('dev_emaar');
      assert.ok(emaar);
      assert.strictEqual(emaar.rating, 'AAA');
      assert.strictEqual(emaar.escrowCompliance, 'STRICT_FULL');
      assert.ok(emaar.deliveryTrackRecordPercent > 95);
    });

    test('queries regulations including Escrow and Golden Visa laws', () => {
      const regulations = ikl.getRegulations();
      assert.ok(regulations.length >= 4);

      const goldenVisa = ikl.getRegulation('reg_golden_visa_property');
      assert.ok(goldenVisa);
      assert.strictEqual(goldenVisa.thresholdAed, 2000000);
      assert.strictEqual(goldenVisa.provenance.authorityWeight, AuthorityLevel.STATUTORY);
    });

    test('queries tax rules including 0% personal income and 4% DLD transfer fee', () => {
      const taxRules = ikl.getTaxRules();
      assert.ok(taxRules.length >= 4);

      const personalTax = ikl.getTaxRule('tax_personal_income');
      assert.strictEqual(personalTax.ratePercent, 0.0);

      const dldFee = ikl.getTaxRule('tax_dld_transfer_fee');
      assert.strictEqual(dldFee.ratePercent, 4.0);
    });

    test('queries personas and strategies', () => {
      const personas = ikl.getPersonas();
      assert.ok(personas.length >= 4);

      const strategies = ikl.getStrategies();
      assert.ok(strategies.length >= 3);

      const enterpriseStrat = ikl.getStrategy('ENTERPRISE_AUTONOMOUS_OS');
      assert.ok(enterpriseStrat);
      assert.strictEqual(enterpriseStrat.actionPlan.length, 3);
    });
  });

  describe('Recommendation & Query Interface', () => {
    test('matches persona and recommends strategy with deterministic confidence', () => {
      const lead = {
        company: 'Global Enterprises Inc',
        employees: '500+',
        ai_maturity: 'in_production',
      };

      const match = ikl.matchPersona(lead, 85);
      assert.strictEqual(match.persona.code, 'STRATEGIC_ENTERPRISE');
      assert.ok(match.confidence.score >= 0.80);

      const strat = ikl.recommendStrategy(match.persona, 'LOW');
      assert.strictEqual(strat.strategy.code, 'ENTERPRISE_AUTONOMOUS_OS');
      assert.ok(strat.confidence.score >= 0.85);

      const plan = ikl.generateActionPlan(strat.strategy, 'LOW');
      assert.strictEqual(plan.length, 3);
      assert.strictEqual(plan[0].step, 1);
    });

    test('retrieves RIIS and DIRA rules with provenance', () => {
      const riisRules = ikl.getRiisRules();
      assert.strictEqual(riisRules.baseScore, 50);
      assert.ok(riisRules.factors.companySize.length > 0);
      assert.strictEqual(riisRules.provenance.authorityWeight, AuthorityLevel.STATUTORY);

      const diraRules = ikl.getDiraRules();
      assert.ok(diraRules.riskVectors.length >= 3);
      assert.strictEqual(diraRules.severityLevels.length, 4);
    });
  });
});
