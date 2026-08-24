import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutiveBriefGenerator } from '../src/engines/executive-brief.js';

describe('ExecutiveBriefGenerator Unit Tests', () => {
  const generator = new ExecutiveBriefGenerator();

  test('generates complete executive brief with structured payloads', () => {
    const lead = {
      id: 'lead_123',
      name: 'John Doe',
      company: 'Acme Corp',
      email: 'john@acme.com',
      phone: '+15551234567',
    };

    const intelligence = {
      riis: {
        score: 88,
        tier: 'TIER_1_STRATEGIC',
        tierLabel: 'Strategic Enterprise Operating Candidate',
      },
      dira: {
        riskLevel: 'LOW',
        riskVectors: [
          { vector: 'Modern Cloud Architecture', severity: 'LOW', recommendation: 'Connect directly.' },
        ],
      },
      compositeScore: 90,
      recommendedTrack: 'ENTERPRISE_AUTONOMOUS_OS',
    };

    const brief = generator.generate(lead, intelligence);

    assert.strictEqual(brief.leadId, 'lead_123');
    assert.strictEqual(brief.companyName, 'Acme Corp');
    assert.strictEqual(brief.contactName, 'John Doe');
    assert.strictEqual(brief.riisScore, 88);
    assert.strictEqual(brief.diraRiskLevel, 'LOW');
    assert.ok(brief.executiveSummary.includes('Acme Corp'));
    assert.strictEqual(brief.actionPlan.length, 3);

    // Verify WhatsApp dispatch payload
    assert.ok(brief.dispatchPayloads.whatsapp);
    assert.strictEqual(brief.dispatchPayloads.whatsapp.recipient, '+15551234567');
    assert.ok(brief.dispatchPayloads.whatsapp.message.includes('88/100'));

    // Verify Email dispatch payload
    assert.ok(brief.dispatchPayloads.email);
    assert.strictEqual(brief.dispatchPayloads.email.recipient, 'john@acme.com');
    assert.ok(brief.dispatchPayloads.email.subject.includes('Acme Corp'));

    // Verify CRM dispatch payload
    assert.ok(brief.dispatchPayloads.crm);
    assert.strictEqual(brief.dispatchPayloads.crm.companyName, 'Acme Corp');
    assert.strictEqual(brief.dispatchPayloads.crm.riisScore, 88);
  });
});
