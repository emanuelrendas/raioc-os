import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppBusinessClient } from '../src/integrations/whatsapp/whatsapp-business-client.js';
import { WhatsAppCloudAdapter } from '../src/adapters/whatsapp-cloud-adapter.js';

describe('WhatsApp Business Cloud API Tests', () => {
  const client = new WhatsAppBusinessClient();
  const adapter = new WhatsAppCloudAdapter(client);

  test('normalizes international phone numbers', () => {
    assert.strictEqual(client.formatPhoneNumber('+971 50 123 4567'), '971501234567');
    assert.strictEqual(client.formatPhoneNumber('(971) 50-987-6543'), '971509876543');
    assert.strictEqual(client.formatPhoneNumber(''), '');
  });

  test('dispatches structured template messages', async () => {
    const res = await client.sendTemplateMessage({
      to: '+971501234567',
      templateName: 'executive_brief_dispatch',
      language: 'en',
    });

    assert.ok(res.status === 'compiled_for_meta_cloud_api' || res.status === 'sent_live' || res.status === 'simulated');
    assert.strictEqual(res.recipient, '971501234567');
  });

  test('dispatches direct text messages via adapter', async () => {
    const res = await adapter.dispatch({
      recipient: '+971509876543',
      payload: { message: 'Your RAIOC Executive Brief is available.' },
    });

    assert.ok(res.status === 'compiled_for_meta_cloud_api' || res.status === 'sent_live' || res.status === 'simulated');
    assert.strictEqual(res.recipient, '971509876543');
  });
});
