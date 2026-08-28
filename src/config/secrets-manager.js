/**
 * RAIOC OS - Production Secrets Management & Environment Vault
 * Provides secure retrieval, zero-leak masking, key validation, and secret rotation readiness.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export class SecretsManager {
  constructor(customEnv = process.env) {
    this.env = customEnv;
  }

  /**
   * Retrieves a secret with fallback support
   */
  get(key, defaultValue = '') {
    return this.env[key] || defaultValue;
  }

  /**
   * Masks sensitive credentials for logs and diagnostic outputs
   * e.g., "AIzaSyD...1234" -> "AIza***1234"
   */
  mask(value) {
    if (!value || typeof value !== 'string') return '[EMPTY]';
    if (value.length <= 8) return '****';
    const start = value.substring(0, 4);
    const end = value.substring(value.length - 4);
    return `${start}***${end}`;
  }

  /**
   * Validates presence of critical production secrets
   */
  validateRequired(requiredKeys = []) {
    const missing = [];
    for (const key of requiredKeys) {
      if (!this.env[key]) {
        missing.push(key);
      }
    }
    return {
      isValid: missing.length === 0,
      missing,
    };
  }

  /**
   * Generates HMAC-SHA256 signature for payload verification
   */
  generateHmacSignature(payload, secretKey) {
    if (!secretKey) return '';
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHmac('sha256', secretKey).update(raw).digest('hex');
  }

  /**
   * Generates a cryptographically signed session token (HMAC-SHA256)
   * Format: base64url(payloadJSON).signatureHex
   */
  signSession(payload = {}, secretKey = this.env.RAIOC_INTERNAL_SECRET || this.env.INTERNAL_SERVICE_KEY, ttlMs = 86400000) {
    if (!secretKey) {
      throw new Error('Cannot sign session without configured secretKey');
    }
    const iat = Date.now();
    const exp = payload.exp || (iat + ttlMs);
    const fullPayload = {
      sub: 'operator',
      role: 'ADMIN',
      ...payload,
      iat,
      exp,
    };
    const payloadBase64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = this.generateHmacSignature(payloadBase64, secretKey);
    return `${payloadBase64}.${signature}`;
  }

  /**
   * Cryptographically verifies an HMAC-SHA256 signed session token
   * Validates signature integrity and timestamp expiration (Fail-Closed)
   */
  verifySession(token, secretKey = this.env.RAIOC_INTERNAL_SECRET || this.env.INTERNAL_SERVICE_KEY) {
    if (!token || typeof token !== 'string' || !secretKey) {
      return { valid: false, error: 'Missing token or secret key' };
    }

    const parts = token.trim().split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid session token format' };
    }

    const [payloadBase64, signatureHex] = parts;
    if (!payloadBase64 || !signatureHex) {
      return { valid: false, error: 'Malformed session token parts' };
    }

    const expectedSignature = this.generateHmacSignature(payloadBase64, secretKey);
    if (!expectedSignature || !this.constantTimeCompare(signatureHex, expectedSignature)) {
      return { valid: false, error: 'Invalid session cryptographic signature' };
    }

    try {
      const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);

      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Invalid session payload structure' };
      }

      if (payload.exp && typeof payload.exp === 'number' && payload.exp < Date.now()) {
        return { valid: false, error: 'Session token expired' };
      }

      return {
        valid: true,
        payload,
      };
    } catch {
      return { valid: false, error: 'Failed to decode session payload' };
    }
  }

  /**
   * Timing-safe comparison to prevent side-channel timing attacks (Fail-Closed)
   */
  constantTimeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /**
   * Returns a sanitized diagnostic overview of configured infrastructure
   */
  getDiagnostics() {
    return {
      supabaseConfigured: Boolean(this.env.SUPABASE_URL && (this.env.SUPABASE_SERVICE_ROLE_KEY || this.env.SUPABASE_KEY)),
      gmailConfigured: Boolean(this.env.GMAIL_CLIENT_ID && this.env.GMAIL_CLIENT_SECRET && this.env.GMAIL_REFRESH_TOKEN),
      calendarConfigured: Boolean(this.env.GOOGLE_CALENDAR_ID || this.env.GMAIL_CLIENT_ID),
      whatsappBusinessConfigured: Boolean(this.env.WHATSAPP_PHONE_NUMBER_ID && this.env.WHATSAPP_ACCESS_TOKEN),
      crmConfigured: Boolean(this.env.CRM_API_KEY || this.env.CRM_WEBHOOK_URL),
      n8nConfigured: Boolean(this.env.N8N_WEBHOOK_URL),
      internalServiceAuthEnabled: Boolean(this.env.INTERNAL_SERVICE_KEY || this.env.RAIOC_INTERNAL_SECRET),
      nodeEnv: this.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
    };
  }
}

export const secretsManager = new SecretsManager();
