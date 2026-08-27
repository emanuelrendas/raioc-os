/**
 * RAIOC OS - Unit Test Suite: Fail-Closed Environment Validator
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { validateProductionEnv, EnvValidationError } from '../../src/config/env-validator.js';

describe('🔒 Fail-Closed Production Environment Validator Suite', () => {
  const validProdEnv = {
    NODE_ENV: 'production',
    PORT: '3000',
    RAIOC_INTERNAL_SECRET: 'raioc_sovereign_auth_2026_x99_enterprise_secure_token_32chars',
    JWT_SECRET: 'raioc_jwt_sovereign_advisory_2026_key_super_secure_token_32chars',
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role_key_long_enough',
  };

  test('1. Non-production / sandbox mode allows flexible execution', () => {
    const devEnv = { NODE_ENV: 'development' };
    const res = validateProductionEnv({ env: devEnv, strict: false });
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.mode, 'DEVELOPMENT_SANDBOX');
    assert.ok(res.warnings.length > 0);
  });

  test('2. Strict mode throws when RAIOC_INTERNAL_SECRET is missing', () => {
    const invalidEnv = { ...validProdEnv, RAIOC_INTERNAL_SECRET: '' };
    assert.throws(
      () => validateProductionEnv({ env: invalidEnv, strict: true }),
      (err) => {
        assert.ok(err instanceof EnvValidationError);
        assert.strictEqual(err.code, 'ERR_ENV_MISSING_INTERNAL_SECRET');
        return true;
      }
    );
  });

  test('3. Strict mode rejects insecure development default key', () => {
    const invalidEnv = { ...validProdEnv, RAIOC_INTERNAL_SECRET: 'raioc_sec_default_dev_key' };
    assert.throws(
      () => validateProductionEnv({ env: invalidEnv, strict: true }),
      (err) => {
        assert.ok(err instanceof EnvValidationError);
        assert.strictEqual(err.code, 'ERR_ENV_INSECURE_DEV_KEY');
        return true;
      }
    );
  });

  test('4. Strict mode rejects RAIOC_INTERNAL_SECRET under 32 characters', () => {
    const invalidEnv = { ...validProdEnv, RAIOC_INTERNAL_SECRET: 'short_key_123' };
    assert.throws(
      () => validateProductionEnv({ env: invalidEnv, strict: true }),
      (err) => {
        assert.ok(err instanceof EnvValidationError);
        assert.strictEqual(err.code, 'ERR_ENV_SHORT_INTERNAL_SECRET');
        return true;
      }
    );
  });

  test('5. Strict mode rejects missing or short JWT_SECRET (< 32 chars)', () => {
    const missingJwt = { ...validProdEnv, JWT_SECRET: '' };
    assert.throws(
      () => validateProductionEnv({ env: missingJwt, strict: true }),
      (err) => {
        assert.ok(err instanceof EnvValidationError);
        assert.strictEqual(err.code, 'ERR_ENV_MISSING_JWT_SECRET');
        return true;
      }
    );

    const shortJwt = { ...validProdEnv, JWT_SECRET: 'too_short_jwt_key' };
    assert.throws(
      () => validateProductionEnv({ env: shortJwt, strict: true }),
      (err) => {
        assert.ok(err instanceof EnvValidationError);
        assert.strictEqual(err.code, 'ERR_ENV_SHORT_JWT_SECRET');
        return true;
      }
    );
  });

  test('6. Strict mode validates SUPABASE_URL presence and valid URL structure', () => {
    const missingUrl = { ...validProdEnv, SUPABASE_URL: '' };
    assert.throws(
      () => validateProductionEnv({ env: missingUrl, strict: true }),
      (err) => {
        assert.ok(err instanceof EnvValidationError);
        assert.strictEqual(err.code, 'ERR_ENV_MISSING_SUPABASE_URL');
        return true;
      }
    );

    const invalidUrl = { ...validProdEnv, SUPABASE_URL: 'not-a-valid-url' };
    assert.throws(
      () => validateProductionEnv({ env: invalidUrl, strict: true }),
      (err) => {
        assert.ok(err instanceof EnvValidationError);
        assert.strictEqual(err.code, 'ERR_ENV_INVALID_SUPABASE_URL');
        return true;
      }
    );
  });

  test('7. Strict mode validates SUPABASE_SERVICE_ROLE_KEY presence and length', () => {
    const missingKey = { ...validProdEnv, SUPABASE_SERVICE_ROLE_KEY: '' };
    assert.throws(
      () => validateProductionEnv({ env: missingKey, strict: true }),
      (err) => {
        assert.ok(err instanceof EnvValidationError);
        assert.strictEqual(err.code, 'ERR_ENV_MISSING_SUPABASE_KEY');
        return true;
      }
    );

    const shortKey = { ...validProdEnv, SUPABASE_SERVICE_ROLE_KEY: 'short_key' };
    assert.throws(
      () => validateProductionEnv({ env: shortKey, strict: true }),
      (err) => {
        assert.ok(err instanceof EnvValidationError);
        assert.strictEqual(err.code, 'ERR_ENV_SHORT_SUPABASE_KEY');
        return true;
      }
    );
  });

  test('8. Full production environment passes validation and reports validated keys', () => {
    const res = validateProductionEnv({ env: validProdEnv, strict: true });
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.mode, 'PRODUCTION_ENFORCED');
    assert.ok(res.validatedKeys.includes('RAIOC_INTERNAL_SECRET'));
    assert.ok(res.validatedKeys.includes('JWT_SECRET'));
    assert.ok(res.validatedKeys.includes('SUPABASE_URL'));
    assert.ok(res.validatedKeys.includes('SUPABASE_SERVICE_ROLE_KEY'));
  });
});
