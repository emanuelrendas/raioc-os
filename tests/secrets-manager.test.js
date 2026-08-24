import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SecretsManager } from '../src/config/secrets-manager.js';

describe('SecretsManager Unit Tests', () => {
  const customEnv = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_KEY: 'sb_secret_key_12345678',
    INTERNAL_SERVICE_KEY: 'sec_internal_token_9999',
  };
  const manager = new SecretsManager(customEnv);

  test('retrieves secrets with fallbacks', () => {
    assert.strictEqual(manager.get('SUPABASE_URL'), 'https://example.supabase.co');
    assert.strictEqual(manager.get('NON_EXISTENT', 'default_val'), 'default_val');
  });

  test('masks sensitive credentials preventing leaks in logs', () => {
    const masked = manager.mask('AIzaSyD1234567890qwerty');
    assert.strictEqual(masked, 'AIza***erty');
    assert.strictEqual(manager.mask(''), '[EMPTY]');
    assert.strictEqual(manager.mask('short'), '****');
  });

  test('validates required keys correctly', () => {
    const validCheck = manager.validateRequired(['SUPABASE_URL', 'SUPABASE_KEY']);
    assert.strictEqual(validCheck.isValid, true);
    assert.strictEqual(validCheck.missing.length, 0);

    const invalidCheck = manager.validateRequired(['SUPABASE_URL', 'MISSING_SECRET_KEY']);
    assert.strictEqual(invalidCheck.isValid, false);
    assert.deepStrictEqual(invalidCheck.missing, ['MISSING_SECRET_KEY']);
  });

  test('generates deterministic HMAC signatures and performs constant time comparison', () => {
    const payload = { event: 'test.trigger', id: 123 };
    const secret = 'my_test_secret';

    const sig1 = manager.generateHmacSignature(payload, secret);
    const sig2 = manager.generateHmacSignature(payload, secret);

    assert.strictEqual(sig1, sig2);
    assert.strictEqual(manager.constantTimeCompare(sig1, sig2), true);
    assert.strictEqual(manager.constantTimeCompare(sig1, 'tampered_signature_123'), false);
  });
});
