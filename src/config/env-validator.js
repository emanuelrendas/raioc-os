/**
 * RAIOC OS - Fail-Closed Production Environment Validator
 * Enforces cryptographic key strength, database URL integrity, and secret ringfencing.
 */

import { secretsManager } from './secrets-manager.js';

export class EnvValidationError extends Error {
  constructor(code, message, details = {}) {
    super(`[FAIL_CLOSED_ENV] ${code}: ${message}`);
    this.name = 'EnvValidationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Validates production environment readiness with Fail-Closed security.
 * @param {Object} options
 * @param {boolean} [options.strict=false] - If true, enforces production rules regardless of NODE_ENV
 * @param {Object} [options.env=process.env] - Environment map to validate
 * @returns {Object} Validation summary
 */
export function validateProductionEnv(options = {}) {
  const env = options.env || process.env;
  const isProd = env.NODE_ENV === 'production' || options.strict === true;
  const validatedKeys = [];
  const warnings = [];

  // If in non-strict dev/test mode without production flag, verify basic sandbox readiness
  if (!isProd) {
    return {
      isValid: true,
      mode: 'DEVELOPMENT_SANDBOX',
      timestamp: new Date().toISOString(),
      validatedKeys: ['NODE_ENV'],
      warnings: ['Operating in non-production sandbox mode. Production fail-closed rules bypassed.'],
    };
  }

  // 1. Validate RAIOC_INTERNAL_SECRET (or INTERNAL_SERVICE_KEY)
  const internalSecret = env.RAIOC_INTERNAL_SECRET || env.INTERNAL_SERVICE_KEY || '';
  if (!internalSecret) {
    throw new EnvValidationError(
      'ERR_ENV_MISSING_INTERNAL_SECRET',
      'Mandatory environment variable RAIOC_INTERNAL_SECRET is missing or empty.'
    );
  }
  if (internalSecret === 'raioc_sec_default_dev_key' || internalSecret.includes('dev_key')) {
    throw new EnvValidationError(
      'ERR_ENV_INSECURE_DEV_KEY',
      'Insecure development default key detected for RAIOC_INTERNAL_SECRET in production mode.'
    );
  }
  if (internalSecret.length < 32) {
    throw new EnvValidationError(
      'ERR_ENV_SHORT_INTERNAL_SECRET',
      `RAIOC_INTERNAL_SECRET length (${internalSecret.length}) does not meet the minimum requirement of 32 characters.`
    );
  }
  validatedKeys.push('RAIOC_INTERNAL_SECRET');

  // 2. Validate JWT_SECRET (or RAIOC_JWT_SECRET)
  const jwtSecret = env.JWT_SECRET || env.RAIOC_JWT_SECRET || '';
  if (!jwtSecret) {
    throw new EnvValidationError(
      'ERR_ENV_MISSING_JWT_SECRET',
      'Mandatory environment variable JWT_SECRET is missing or empty.'
    );
  }
  if (jwtSecret === 'raioc_sec_default_dev_key' || jwtSecret === 'default_secret') {
    throw new EnvValidationError(
      'ERR_ENV_INSECURE_JWT_SECRET',
      'Insecure default value detected for JWT_SECRET in production mode.'
    );
  }
  if (jwtSecret.length < 32) {
    throw new EnvValidationError(
      'ERR_ENV_SHORT_JWT_SECRET',
      `JWT_SECRET length (${jwtSecret.length}) does not meet the minimum requirement of 32 characters.`
    );
  }
  validatedKeys.push('JWT_SECRET');

  // 3. Validate SUPABASE_URL
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!supabaseUrl) {
    throw new EnvValidationError(
      'ERR_ENV_MISSING_SUPABASE_URL',
      'Mandatory environment variable SUPABASE_URL is missing or empty.'
    );
  }
  try {
    const parsed = new URL(supabaseUrl);
    if (!parsed.protocol.startsWith('http')) {
      throw new Error('Invalid protocol');
    }
  } catch (err) {
    throw new EnvValidationError(
      'ERR_ENV_INVALID_SUPABASE_URL',
      'SUPABASE_URL is not a valid HTTP/HTTPS URL.'
    );
  }
  validatedKeys.push('SUPABASE_URL');

  // 4. Validate SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY || '';
  if (!supabaseServiceKey) {
    throw new EnvValidationError(
      'ERR_ENV_MISSING_SUPABASE_KEY',
      'Mandatory environment variable SUPABASE_SERVICE_ROLE_KEY is missing or empty.'
    );
  }
  if (supabaseServiceKey.length < 20) {
    throw new EnvValidationError(
      'ERR_ENV_SHORT_SUPABASE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY does not meet the minimum key length requirement.'
    );
  }
  validatedKeys.push('SUPABASE_SERVICE_ROLE_KEY');

  // 5. Port configuration sanity
  if (env.PORT) {
    const portNum = parseInt(env.PORT, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      throw new EnvValidationError(
        'ERR_ENV_INVALID_PORT',
        `Configured PORT value '${env.PORT}' is out of valid range (1-65535).`
      );
    }
    validatedKeys.push('PORT');
  }

  return {
    isValid: true,
    mode: 'PRODUCTION_ENFORCED',
    timestamp: new Date().toISOString(),
    validatedKeys,
    warnings,
  };
}
