/**
 * MISSION-003 Automated Verification Test Suite
 * Schema Provenance, Migration Reconciliation, and Fail-Closed Intake Verification
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { handleIntakeRequest } from '../src/api/routes/intake-routes.js';
import { handleAssessmentSubmission } from '../src/api/routes/assessment-routes.js';
import { SupabaseClient } from '../src/db/supabase-client.js';

describe('MISSION-003: Schema Provenance & Write-Path Reconciliation', () => {

  test('1. Migration Directories Consistency: src/db/migrations and src/database/migrations match', () => {
    const dbMigrations = fs.readdirSync(path.resolve('src/db/migrations')).filter(f => f.endsWith('.sql')).sort();
    const databaseMigrations = fs.readdirSync(path.resolve('src/database/migrations')).filter(f => f.endsWith('.sql')).sort();

    assert.deepStrictEqual(dbMigrations, databaseMigrations, 'Migration directories must contain identical file sets');
    assert.ok(dbMigrations.includes('001_create_investors_schema.sql'));
    assert.ok(dbMigrations.includes('002_production_operational_schema.sql'));
    assert.ok(dbMigrations.includes('003_enterprise_core_registries.sql'));
    assert.ok(dbMigrations.includes('004_sprint_2_core_hardening.sql'));
  });

  test('2. Intake Endpoint Metadata returns verified canonical schema tables and governance', async () => {
    const res = await handleIntakeRequest('GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.deepStrictEqual(res.body.canonicalTables, ['investors', 'interaction_logs']);
    assert.strictEqual(res.body.governance.owner, 'Emanuel Rendas');
    assert.strictEqual(res.body.governance.riskTier, 'Tier 1');
    assert.strictEqual(res.body.governance.auditTrail, 'public.interaction_logs');
  });

  test('3. Intake Lead Capture fails closed when Supabase is unconfigured (503 Service Unavailable)', async () => {
    const origUrl = process.env.SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const res = await handleIntakeRequest('POST', {
        action: 'lead_capture',
        name: 'Dr. Sovereign Tester',
        email: 'sovereign@familyoffice.ae',
      });
      assert.strictEqual(res.status, 503);
      assert.strictEqual(res.body.ok, false);
      assert.match(res.body.error, /Fail-Closed enforced/i);
    } finally {
      if (origUrl) process.env.SUPABASE_URL = origUrl;
      if (origKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    }
  });

  test('4. Intake Lead Capture validates mandatory fields (Name and Email required)', async () => {
    const origUrl = process.env.SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_key';

    try {
      const resMissingEmail = await handleIntakeRequest('POST', {
        action: 'lead_capture',
        name: 'Investor Without Email',
      });
      assert.strictEqual(resMissingEmail.status, 400);
      assert.match(resMissingEmail.body.error, /Name and email are required/i);

      const resMissingConsent = await handleIntakeRequest('POST', {
        action: 'lead_capture',
        name: 'Investor Refusing Consent',
        email: 'refused@test.com',
        consent_given: false,
      });
      assert.strictEqual(resMissingConsent.status, 400);
      assert.match(resMissingConsent.body.error, /Explicit consent is required/i);
    } finally {
      if (origUrl) process.env.SUPABASE_URL = origUrl; else delete process.env.SUPABASE_URL;
      if (origKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey; else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  test('5. Assessment Pipeline writes exclusively to verified public.investors and public.interaction_logs', async () => {
    const mockDb = new SupabaseClient({ useMock: true });

    const submissionPayload = {
      name: 'Sheikh Al Maktoum Family Office',
      email: 'investor@sovereign-advisory.ae',
      phone: '+971543871702',
      budget_aed: '30M+',
      investment_objective: 'capital_preservation_and_yield',
      tax_jurisdiction: 'UAE',
      preferred_channel: 'WHATSAPP',
    };

    const result = await handleAssessmentSubmission(submissionPayload, {
      dbClient: mockDb,
      triggerCycle: false,
    });

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.success, true);
    assert.ok(result.body.investorId, 'Must return investorId');

    const investor = await mockDb.getInvestor(result.body.investorId);
    assert.ok(investor, 'Investor must exist in mock database store');
    assert.strictEqual(investor.name, 'Sheikh Al Maktoum Family Office');
    assert.strictEqual(investor.segment, 'SOVEREIGN_FUND');
    assert.strictEqual(investor.budget_aed, 30000000);
    assert.strictEqual(investor.golden_visa_eligible, true);
    assert.strictEqual(investor.escrow_protected, true);

    // Verify Governance Metadata
    assert.strictEqual(investor.metadata.owner, 'Emanuel Rendas');
    assert.strictEqual(investor.metadata.risk_tier, 'Tier 1');
    assert.strictEqual(investor.metadata.audit_trail, 'public.interaction_logs');

    // Verify interaction logged in mock store
    assert.ok(mockDb.mockStore.interaction_logs.length > 0, 'Must have recorded interaction log');
    const loggedInteraction = mockDb.mockStore.interaction_logs[mockDb.mockStore.interaction_logs.length - 1];
    assert.strictEqual(loggedInteraction.event_type, 'INBOUND_PRIVATE_MANDATE');
    assert.strictEqual(loggedInteraction.source_agent, 'MARK');
    assert.strictEqual(loggedInteraction.direction, 'INBOUND');
    assert.strictEqual(loggedInteraction.status, 'SUCCESS');
  });

  test('6. Immutable Audit Table Protection: interaction_logs rejects UPDATE and DELETE operations', async () => {
    const mockDb = new SupabaseClient({ useMock: true });

    await assert.rejects(
      async () => {
        await mockDb.updateInteractionLog('log_123', { status: 'MODIFIED' });
      },
      /strictly prohibited on immutable audit tables/i
    );

    await assert.rejects(
      async () => {
        await mockDb.deleteInteractionLog('log_123');
      },
      /strictly prohibited on immutable audit tables/i
    );
  });
});
