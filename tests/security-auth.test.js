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

  test('validates Permissions-Policy and CSP headers for microphone access across production config', async () => {
    const fs = await import('node:fs');
    const { routeApiRequest } = await import('../src/api/server.js');

    // 1. Check vercel.json
    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    const globalHeaderRule = vercelConfig.headers.find(h => h.source === '/(.*)');
    assert.ok(globalHeaderRule, 'Must contain global header rule in vercel.json');

    const permPolicy = globalHeaderRule.headers.find(h => h.key === 'Permissions-Policy');
    assert.ok(permPolicy, 'Must contain Permissions-Policy header');
    assert.ok(permPolicy.value.includes('microphone=*'), 'Must explicitly allow microphone in Permissions-Policy');

    const csp = globalHeaderRule.headers.find(h => h.key === 'Content-Security-Policy');
    assert.ok(csp, 'Must contain Content-Security-Policy');
    assert.ok(csp.value.includes("media-src 'self' blob: data: https://api.elevenlabs.io"), 'Must allow media-src for ElevenLabs and blob/data');

    // 2. Check API router headers
    const res = await routeApiRequest('/healthz');
    assert.ok(res.headers['Permissions-Policy'], 'routeApiRequest must include Permissions-Policy header');
    assert.ok(res.headers['Permissions-Policy'].includes('microphone=*'), 'Must include microphone=* in Permissions-Policy');
  });
});
