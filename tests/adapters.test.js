import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppAdapter } from '../src/adapters/whatsapp-adapter.js';
import { EmailAdapter } from '../src/adapters/email-adapter.js';
import { CrmAdapter } from '../src/adapters/crm-adapter.js';
import { N8nAdapter } from '../src/adapters/n8n-adapter.js';
import { TelegramAdapter } from '../src/adapters/telegram-adapter.js';

describe('Adapters Unit Tests', () => {
  test('WhatsAppAdapter handles payload delivery and validates recipient', async () => {
    const adapter = new WhatsAppAdapter();

    // Valid task
    const res = await adapter.dispatch({
      recipient: '+1234567890',
      payload: { message: 'Test WhatsApp notification' },
    });
    assert.ok(res.status === 'QUEUED_FOR_DISPATCH' || res.status === 'queued_for_gateway' || res.status === 'simulated');

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
    assert.ok(res.status === 'QUEUED_FOR_DISPATCH' || res.status === 'queued_for_mailer' || res.status === 'simulated');

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

  test('N8nAdapter compiles event with HMAC signature', async () => {
    const adapter = new N8nAdapter({ webhookSecret: 'test_sec_123' });
    const res = await adapter.dispatchEvent('TEST_EVENT', { sample: 'data' });
    assert.strictEqual(res.success, true);
    assert.ok(res.signature.startsWith('sha256='));
  });

  test('TelegramAdapter formats HTML template without throwing', async () => {
    const adapter = new TelegramAdapter();
    const res = await adapter.sendAlert('NOTIF_QUALIFIED_LEAD', {
      name: 'Elena Rostova',
      company: 'Rostova Capital',
      budget: 'AED 20,000,000',
    });
    assert.strictEqual(res.success, true);
    assert.ok(res.message.includes('Elena Rostova'));
  });
});

