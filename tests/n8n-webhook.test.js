import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { N8nWebhookClient } from '../src/integrations/n8n/n8n-webhook-client.js';
import { secretsManager } from '../src/config/secrets-manager.js';

describe('n8n Webhook Integration Tests', () => {
  const secret = 'test_n8n_secret_key';
  const client = new N8nWebhookClient({
    webhookSecret: secret,
  });

  test('triggers outbound signed workflow event', async () => {
    const res = await client.triggerWorkflow('lead.qualified', {
      leadId: 'lead_123',
      riisScore: 88,
      company: 'Apex Real Estate Partners',
    });

    assert.ok(res.status === 'compiled_for_n8n' || res.status === 'dispatched_live' || res.status === 'simulated');
    assert.strictEqual(res.eventType, 'lead.qualified');
    assert.ok(res.signature.startsWith('sha256='));
  });

  test('validates and processes inbound n8n webhook with HMAC signature', () => {
    const payload = { action: 'trigger_cycle', leadId: 'lead_999' };
    const rawString = JSON.stringify(payload);
    const validSignature = `sha256=${secretsManager.generateHmacSignature(rawString, secret)}`;

    const processed = client.processInboundEvent(rawString, validSignature);
    assert.strictEqual(processed.action, 'trigger_cycle');
    assert.strictEqual(processed.leadId, 'lead_999');

    // Invalid signature throws
    assert.throws(() => {
      client.processInboundEvent(rawString, 'sha256=invalid_tampered_sig');
    }, /failed HMAC-SHA256 signature verification/);
  });
});
