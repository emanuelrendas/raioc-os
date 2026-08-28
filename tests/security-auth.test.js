import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AuthMiddleware, Roles } from '../src/security/auth-middleware.js';
import { WebhookVerifier } from '../src/security/webhook-verifier.js';
import { secretsManager } from '../src/config/secrets-manager.js';

describe('Security & Authentication Tests (MISSION-001 Hardened)', () => {
  const testSecret = 'sec_test_token_12345_cryptographic_key';
  const auth = new AuthMiddleware({ internalKey: testSecret });
  const verifier = new WebhookVerifier();

  test('1. Authenticates valid Bearer token and rejects missing/invalid tokens (Fail-Closed)', () => {
    // Valid token
    const valid = auth.authenticateRequest({ authorization: `Bearer ${testSecret}` });
    assert.strictEqual(valid.authenticated, true);
    assert.strictEqual(valid.role, Roles.ADMIN);

    // Missing token (Fail-Closed)
    const missing = auth.authenticateRequest({});
    assert.strictEqual(missing.authenticated, false);
    assert.ok(missing.error);

    // Invalid token
    const invalid = auth.authenticateRequest({ authorization: 'Bearer wrong_token' });
    assert.strictEqual(invalid.authenticated, false);
  });

  test('2. Cryptographic Session Tokens: Generates, verifies, and rejects tampered HMAC session tokens', () => {
    // Generate valid signed session
    const signedToken = secretsManager.signSession({ sub: 'emanuel_rendas', role: 'ADMIN' }, testSecret, 3600000);
    assert.ok(signedToken.includes('.'), 'Session token must be formatted as payload.signature');

    // Authenticate via Cookie header with signed token
    const resCookie = auth.authenticateRequest({ cookie: `raioc_session=${signedToken}` });
    assert.strictEqual(resCookie.authenticated, true);
    assert.strictEqual(resCookie.role, Roles.ADMIN);
    assert.strictEqual(resCookie.sub, 'emanuel_rendas');

    // Authenticate via Bearer header with signed token
    const resBearer = auth.authenticateRequest({ authorization: `Bearer ${signedToken}` });
    assert.strictEqual(resBearer.authenticated, true);

    // Tampered token payload
    const [payloadBase64, sig] = signedToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'attacker', role: 'ADMIN', exp: Date.now() + 100000 })).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${sig}`;

    const resTampered = auth.authenticateRequest({ cookie: `raioc_session=${tamperedToken}` });
    assert.strictEqual(resTampered.authenticated, false);
    assert.strictEqual(resTampered.error, 'Invalid authentication credentials provided');

    // Expired token
    const expiredToken = secretsManager.signSession({ sub: 'expired_user', role: 'ADMIN' }, testSecret, -10000);
    const resExpired = auth.authenticateRequest({ cookie: `raioc_session=${expiredToken}` });
    assert.strictEqual(resExpired.authenticated, false);
  });

  test('3. Rejection of Pseudo-Tokens: sess_ and authenticated_ prefixes without signature are rejected', () => {
    const fakeSess = auth.authenticateRequest({ authorization: 'Bearer sess_fake_token_123' });
    assert.strictEqual(fakeSess.authenticated, false, 'Must reject sess_ prefix');

    const fakeAuth = auth.authenticateRequest({ cookie: 'raioc_session=authenticated_operator' });
    assert.strictEqual(fakeAuth.authenticated, false, 'Must reject authenticated_ prefix');

    const fakeCookie2 = auth.authenticateRequest({ cookie: 'raioc_session=sess_operator_valid_token_2026' });
    assert.strictEqual(fakeCookie2.authenticated, false, 'Must reject raw sess_ cookies');
  });

  test('4. Rejection of Referer and Origin Bypass: Spoofed headers cannot bypass authentication', () => {
    // Spoofed referer pointing to mission control
    const resReferer = auth.authenticateRequest({
      referer: 'http://localhost:3000/admin/mission-control',
      host: 'localhost:3000',
      'sec-fetch-site': 'same-origin',
    });
    assert.strictEqual(resReferer.authenticated, false, 'Referer must not bypass auth');
    assert.strictEqual(resReferer.error, 'Missing authorization token or API key');

    // Spoofed referer with unvalidated cookie string
    const resSpoofedWithCookie = auth.authenticateRequest({
      referer: 'http://localhost:3000/admin/mission-control',
      host: 'localhost:3000',
      cookie: 'raioc_session=invalid_random_session',
    });
    assert.strictEqual(resSpoofedWithCookie.authenticated, false, 'Unvalidated cookie with referer must be rejected');
  });

  test('5. Rejection of Hardcoded Master Keys: Static legacy fallback string is rejected', () => {
    const resStatic = auth.authenticateRequest({ authorization: 'Bearer raioc_sovereign_auth_2026_x99' });
    assert.strictEqual(resStatic.authenticated, false, 'Legacy master key must be rejected');
  });

  test('6. Allows public routes when PUBLIC role permitted', () => {
    const pub = auth.authenticateRequest({}, [Roles.PUBLIC]);
    assert.strictEqual(pub.authenticated, true);
    assert.strictEqual(pub.role, Roles.PUBLIC);
  });

  test('7. Verifies n8n webhook HMAC-SHA256 signature (Fail-Closed)', () => {
    const payload = { action: 'trigger_cycle', leadId: 'lead_abc' };
    const secret = 'n8n_test_secret_32chars_required_001';
    const validSig = `sha256=${secretsManager.generateHmacSignature(payload, secret)}`;

    assert.strictEqual(verifier.verifyN8nSignature(payload, validSig, secret), true);
    assert.strictEqual(verifier.verifyN8nSignature(payload, 'sha256=invalid_signature', secret), false);
    assert.strictEqual(verifier.verifyN8nSignature(payload, null, secret), false, 'Missing sig must fail closed');
    assert.strictEqual(verifier.verifyN8nSignature(payload, validSig, null), false, 'Missing secret must fail closed');
  });

  test('8. Verifies WhatsApp Meta verification challenge (Fail-Closed)', () => {
    const challengeRes = verifier.verifyWhatsAppChallenge('subscribe', 'my_verify_token', '11559933', 'my_verify_token');
    assert.strictEqual(challengeRes.success, true);
    assert.strictEqual(challengeRes.challenge, '11559933');

    const failRes = verifier.verifyWhatsAppChallenge('subscribe', 'wrong_token', '11559933', 'my_verify_token');
    assert.strictEqual(failRes.success, false);

    const noSecretRes = verifier.verifyWhatsAppChallenge('subscribe', 'wrong_token', '11559933', null);
    assert.strictEqual(noSecretRes.success, false, 'Unconfigured verify token must fail closed');
  });

  test('9. Verifies WhatsApp inbound HMAC-SHA256 signature (Fail-Closed)', () => {
    const payload = { entry: [{ id: 'wa_123', changes: [{ value: { messages: [{ from: '+971501234567', text: { body: 'Hello' } }] } }] }] };
    const secret = 'wa_sec_secret_key_888_secure_hmac_key';
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

  test('10. Verifies TikTok webhook signature (Fail-Closed)', () => {
    const payload = { event: 'comment', text: 'Interested in Palm Jumeirah' };
    const secret = 'tiktok_secret_32_bytes_long_key_01';
    const validSig = `sha256=${secretsManager.generateHmacSignature(payload, secret)}`;

    // Valid signature
    assert.strictEqual(verifier.verifyTikTokSignature(payload, validSig, secret), true);

    // Invalid signature
    assert.strictEqual(verifier.verifyTikTokSignature(payload, 'sha256=invalid_sig', secret), false);

    // Missing signature header (Fail-Closed)
    assert.strictEqual(verifier.verifyTikTokSignature(payload, null, secret), false);

    // Missing secret (Fail-Closed)
    assert.strictEqual(verifier.verifyTikTokSignature(payload, validSig, null), false);
  });

  test('11. Validates Permissions-Policy and CSP headers for microphone access across production config', async () => {
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
