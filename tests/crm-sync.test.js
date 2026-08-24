import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CrmSyncClient } from '../src/integrations/crm/crm-sync-client.js';

describe('CRM Integration Tests', () => {
  const client = new CrmSyncClient();

  test('synchronizes contact and deal parameters into structured CRM payload', async () => {
    const res = await client.syncLead({
      companyName: 'Al-Mansoor Holdings',
      contactName: 'Tariq Al-Mansoor',
      email: 'tariq@almansoor.ae',
      phone: '+971501234567',
      riisScore: 92,
      riskLevel: 'LOW',
      dealValueAed: 15000000,
      lifecycleStage: 'opportunity',
      dealStage: 'executive_brief_delivered',
    });

    assert.ok(res.status === 'compiled_for_crm_api' || res.status === 'synced_live' || res.status === 'simulated');
    assert.strictEqual(res.company, 'Al-Mansoor Holdings');
    assert.strictEqual(res.email, 'tariq@almansoor.ae');
  });

  test('throws error on missing contact identity', async () => {
    await assert.rejects(
      async () => {
        await client.syncLead({ phone: '+971500000000' });
      },
      /Missing mandatory email or company name/
    );
  });
});
