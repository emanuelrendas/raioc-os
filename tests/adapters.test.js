import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppAdapter } from '../src/adapters/whatsapp-adapter.js';
import { EmailAdapter } from '../src/adapters/email-adapter.js';
import { CrmAdapter } from '../src/adapters/crm-adapter.js';

describe('Adapters Unit Tests', () => {
  test('WhatsAppAdapter handles payload delivery and validates recipient', async () => {
    const adapter = new WhatsAppAdapter();

    // Valid task
    const res = await adapter.dispatch({
      recipient: '+1234567890',
      payload: { message: 'Test WhatsApp notification' },
    });
    assert.ok(res.status === 'queued_for_gateway' || res.status === 'simulated');

    // Missing recipient throws
    await assert.rejects(
      async () => {
        await adapter.dispatch({ payload: { message: 'No recipient' } });
      },
      /Missing recipient/
    );
  });

  test('EmailAdapter handles payload delivery and validates recipient', async () => {
    const adapter = new EmailAdapter();

    const res = await adapter.dispatch({
      recipient: 'test@example.com',
      payload: { subject: 'Test Subject', body: 'Test Body' },
    });
    assert.ok(res.status === 'queued_for_mailer' || res.status === 'simulated');

    await assert.rejects(
      async () => {
        await adapter.dispatch({ payload: { subject: 'Test' } });
      },
      /Missing recipient/
    );
  });

  test('CrmAdapter handles payload sync and validates payload structure', async () => {
    const adapter = new CrmAdapter();

    const res = await adapter.dispatch({
      payload: { companyName: 'Enterprise LLC', email: 'corp@enterprise.com', riisScore: 85 },
    });
    assert.ok(res.status === 'synced_native' || res.status === 'simulated');

    await assert.rejects(
      async () => {
        await adapter.dispatch({ payload: {} });
      },
      /Incomplete CRM payload/
    );
  });
});
