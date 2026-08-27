import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AuthMiddleware, Roles } from '../src/security/auth-middleware.js';
import { WebhookVerifier } from '../src/security/webhook-verifier.js';
import { secretsManager } from '../src/config/secrets-manager.js';

describe('Security & Authentication Tests', () => {
  const auth = new AuthMiddleware({ internalKey: 'sec_test_token_12345' });
  const verifier = new WebhookVerifier();

  test('authenticates valid Bearer token and rejects missing/invalid tokens', () => {
    // Valid token
    const valid = auth.authenticateRequest({ authorization: 'Bearer sec_test_token_12345' });
    assert.strictEqual(valid.authenticated, true);
    assert.strictEqual(valid.role, Roles.ADMIN);

    // Missing token
    const missing = auth.authenticateRequest({});
    assert.strictEqual(missing.authenticated, false);
    assert.ok(missing.error);

    // Invalid token
    const invalid = auth.authenticateRequest({ authorization: 'Bearer wrong_token' });
    assert.strictEqual(invalid.authenticated, false);
  });

  test('allows public routes when PUBLIC role permitted', () => {
    const pub = auth.authenticateRequest({}, [Roles.PUBLIC]);
    assert.strictEqual(pub.authenticated, true);
    assert.strictEqual(pub.role, Roles.PUBLIC);
  });

  test('verifies n8n webhook HMAC-SHA256 signature', () => {
    const payload = { action: 'trigger_cycle', leadId: 'lead_abc' };
    const secret = 'n8n_test_secret';
    const validSig = `sha256=${secretsManager.generateHmacSignature(payload, secret)}`;

    assert.strictEqual(verifier.verifyN8nSignature(payload, validSig, secret), true);
    assert.strictEqual(verifier.verifyN8nSignature(payload, 'sha256=invalid_signature', secret), false);
  });

  test('verifies WhatsApp Meta verification challenge', () => {
    const challengeRes = verifier.verifyWhatsAppChallenge('subscribe', 'my_verify_token', '11559933', 'my_verify_token');
    assert.strictEqual(challengeRes.success, true);
    assert.strictEqual(challengeRes.challenge, '11559933');

    const failRes = verifier.verifyWhatsAppChallenge('subscribe', 'wrong_token', '11559933', 'my_verify_token');
    assert.strictEqual(failRes.success, false);
  });

  test('verifies WhatsApp inbound HMAC-SHA256 signature (Fail-Closed)', () => {
    const payload = { entry: [{ id: 'wa_123', changes: [{ value: { messages: [{ from: '+971501234567', text: { body: 'Hello' } }] } }] }] };
    const secret = 'wa_sec_secret_key_888';
    const validSig = `sha256=${secretsManager.generateHmacSignature(payload, secret)}`;

    // Valid signature
    assert.strictEqual(verifier.verifyWhatsAppSignature(payload, validSig, secret), true);

    // Tampered payload / invalid signature
    assert.strictEqual(verifier.verifyWhatsAppSignature(payload, 'sha256=invalid_hash', secret), false);

    // Missing signature header (Fail-Closed)
    assert.strictEqual(verifier.verifyWhatsAppSignature(payload, null, secret), false);

    // Missing app secret (Fail-Closed)
    assert.strictEqual(verifier.verifyWhatsAppSignature(payload, validSig, null), false);
  });
});
