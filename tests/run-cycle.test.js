import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { run_cycle } from '../src/core/run-cycle.js';
import { SupabaseClient } from '../src/db/supabase-client.js';

describe('Run Cycle End-to-End Integration Tests', () => {
  test('executes full autonomous cycle from pending lead to executive brief and dispatches', async () => {
    const mockDb = new SupabaseClient({ useMock: true });

    // Seed mock data
    mockDb.mockStore.leads.push(
      {
        id: 'lead_001',
        name: 'Sarah Connor',
        company: 'Cyberdyne Systems',
        email: 'sarah@cyberdyne.com',
        phone: '+14155550199',
        company_size: '500+',
        ai_maturity: 'in_production',
        timeline: 'immediate',
        data_stack: 'modern cloud',
        status: 'pending',
        created_at: new Date().toISOString(),
      },
      {
        id: 'lead_002',
        name: 'Marcus Wright',
        company: 'Resistance Inc',
        email: 'marcus@resistance.org',
        phone: '+14155550288',
        company_size: '20-99',
        ai_maturity: 'piloting',
        timeline: 'quarter',
        data_stack: 'spreadsheets',
        status: 'pending',
        created_at: new Date().toISOString(),
      }
    );

    mockDb.mockStore.assessments.push({
      id: 'asm_001',
      company_name: 'Cyberdyne Systems',
      employees: '500+',
      challenges: 'scale bottlenecks',
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    const result = await run_cycle({ dbClient: mockDb });

    assert.strictEqual(result.status, 'SUCCESS');
    assert.strictEqual(result.summary.leadsProcessed, 2);
    assert.strictEqual(result.summary.assessmentsProcessed, 1);
    assert.strictEqual(result.summary.executiveBriefsGenerated, 2);

    // Verify Executive Briefs in DB
    assert.strictEqual(mockDb.mockStore.executive_briefs.length, 2);
    const brief1 = mockDb.mockStore.executive_briefs.find((b) => b.lead_id === 'lead_001');
    assert.ok(brief1);
    assert.strictEqual(brief1.company_name, 'Cyberdyne Systems');
    assert.ok(brief1.riis_score >= 80);

    // Verify Leads status updated to completed
    const lead1 = mockDb.mockStore.leads.find((l) => l.id === 'lead_001');
    assert.strictEqual(lead1.status, 'completed');

    // Verify Dispatches completed
    assert.ok(result.summary.dispatches.whatsapp >= 2);
    assert.ok(result.summary.dispatches.email >= 2);
    assert.ok(result.summary.dispatches.crm >= 2);
    assert.strictEqual(result.summary.queueResults.processed, 6);
    assert.strictEqual(result.summary.queueResults.successful, 6);
    assert.strictEqual(result.summary.queueResults.failed, 0);

    // Verify Telemetry Snapshot
    assert.ok(result.telemetry);
    assert.strictEqual(result.telemetry.systemHealth, 'HEALTHY');
    assert.ok(result.telemetry.cycleCount >= 1);
  });
});
