/**
 * RAIOC Security - Service Authentication & RBAC Middleware
 * Enforces timing-safe cryptographic authentication, session validation, and strict Fail-Closed access control.
 */

import { config } from '../config/env.js';
import { secretsManager } from '../config/secrets-manager.js';
import { logger } from '../logging/audit-logger.js';

export const Roles = {
  ADMIN: 'ADMIN',
  AGENT: 'AGENT',
  WEBHOOK: 'WEBHOOK',
  PUBLIC: 'PUBLIC',
  ANONYMOUS: 'ANONYMOUS',
};

export class AuthMiddleware {
  constructor(options = {}) {
    this.internalKey = options.internalKey || process.env.RAIOC_INTERNAL_SECRET || process.env.INTERNAL_SERVICE_KEY || config.service.internalKey || '';
  }

  getSecret() {
    const secret = process.env.RAIOC_INTERNAL_SECRET || process.env.INTERNAL_SERVICE_KEY || this.internalKey || config.service.internalKey || '';
    return secret ? secret.trim() : '';
  }

  /**
   * Authenticates an incoming HTTP request using cryptographic Bearer Token, X-API-Key, X-RAIOC-Secret,
   * or cryptographically signed session cookie (HMAC-SHA256).
   * Strict Fail-Closed behavior is enforced.
   *
   * @param {Object} headers - HTTP request headers
   * @param {Array<string>} allowedRoles - List of permitted roles for the route
   * @returns {Object} { authenticated: boolean, role: string, error?: string }
   */
  authenticateRequest(headers = {}, allowedRoles = [Roles.ADMIN, Roles.AGENT]) {
    // If public route allowed explicitly
    if (allowedRoles.includes(Roles.PUBLIC)) {
      return { authenticated: true, role: Roles.PUBLIC };
    }

    const serverSecret = this.getSecret();
    if (!serverSecret) {
      logger.error('AUTH_MIDDLEWARE', 'Fail-Closed: Server secret is not configured in environment. Rejecting protected access.');
      return { authenticated: false, role: Roles.ANONYMOUS, error: 'Server authentication secret is not configured (Fail-Closed enforced)' };
    }

    const authHeader = headers['authorization'] || headers['Authorization'] || '';
    const apiKeyHeader = headers['x-api-key'] || headers['X-API-Key'] || '';
    const secretHeader = headers['x-raioc-secret'] || headers['X-RAIOC-Secret'] || headers['x-internal-secret'] || headers['raioc-internal-secret'] || '';
    const cookieHeader = headers['cookie'] || headers['Cookie'] || '';

    let token = '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (apiKeyHeader) {
      token = apiKeyHeader.trim();
    } else if (secretHeader) {
      token = secretHeader.trim();
    } else if (cookieHeader) {
      const match = cookieHeader.match(/(?:raioc_session|session|auth_token)=([^;]+)/i);
      if (match) {
        token = decodeURIComponent(match[1]).trim();
      }
    }

    if (!token) {
      logger.warn('AUTH_MIDDLEWARE', 'Unauthorized access attempt: Missing credentials');
      return { authenticated: false, role: Roles.ANONYMOUS, error: 'Missing authorization token or API key' };
    }

    const validSecrets = [
      process.env.RAIOC_INTERNAL_SECRET,
      process.env.INTERNAL_SERVICE_KEY,
      this.internalKey,
      config.service.internalKey,
    ].filter(Boolean).map(s => s.trim()).filter(s => s.length > 0);

    // 1. Direct service-to-service key check using constant-time comparison
    if (validSecrets.length > 0) {
      const isDirectKeyValid = validSecrets.some((secret) => secretsManager.constantTimeCompare(token, secret));
      if (isDirectKeyValid) {
        return {
          authenticated: true,
          role: Roles.ADMIN,
          authenticatedAt: new Date().toISOString(),
        };
      }
    }

    // 2. Cryptographic session token verification (HMAC-SHA256 signature verification)
    const sessionResult = secretsManager.verifySession(token, serverSecret);
    if (sessionResult.valid && sessionResult.payload) {
      const userRole = sessionResult.payload.role || Roles.ADMIN;
      if (allowedRoles.includes(userRole)) {
        return {
          authenticated: true,
          role: userRole,
          sub: sessionResult.payload.sub || 'operator',
          authenticatedAt: new Date().toISOString(),
        };
      } else {
        return {
          authenticated: false,
          role: userRole,
          error: `Insufficient role permissions: ${userRole}. Required: ${allowedRoles.join(', ')}`,
        };
      }
    }

    logger.warn('AUTH_MIDDLEWARE', 'Unauthorized access attempt: Invalid token signature or expired session');
    return { authenticated: false, role: Roles.ANONYMOUS, error: 'Invalid or expired authentication credentials' };
  }
}

export const authMiddleware = new AuthMiddleware();
