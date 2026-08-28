/**
 * RAIOC Security - Webhook Signature Verifier
 * Verifies HMAC-SHA256 signatures for Meta WhatsApp Cloud API, Instagram, TikTok, and n8n workflow triggers.
 * Enforces strict Fail-Closed validation.
 */

import { config } from '../config/env.js';
import { secretsManager } from '../config/secrets-manager.js';
import { logger } from '../logging/audit-logger.js';

export class WebhookVerifier {
  /**
   * Verifies an inbound n8n webhook signature (X-N8N-Signature)
   * @param {string|Object} payload - Raw request body
   * @param {string} signatureHeader - Signature from headers
   * @param {string} secretKey - Webhook secret key
   * @returns {boolean} True if signature matches
   */
  verifyN8nSignature(payload, signatureHeader, secretKey = config.n8n?.webhookSecret || process.env.N8N_OUTBOUND_SECRET || process.env.N8N_WEBHOOK_SECRET) {
    if (!signatureHeader || !secretKey) {
      logger.warn('WEBHOOK_VERIFIER', 'n8n signature verification failed: Missing signature or secret (Fail-Closed)');
      return false;
    }

    const cleanSignature = signatureHeader.replace(/^sha256=/, '').trim();
    const expectedSignature = secretsManager.generateHmacSignature(payload, secretKey);

    return secretsManager.constantTimeCompare(expectedSignature, cleanSignature);
  }

  /**
   * Verifies an inbound Meta WhatsApp webhook signature (X-Hub-Signature-256)
   * @param {string|Object} payload - Raw request body
   * @param {string} signatureHeader - Header 'X-Hub-Signature-256' (sha256=...)
   * @param {string} appSecret - Meta App Secret
   * @returns {boolean} True if signature matches
   */
  verifyWhatsAppSignature(payload, signatureHeader, appSecret = config.whatsappBusiness?.appSecret || process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET || process.env.META_WHATSAPP_APP_SECRET) {
    if (!signatureHeader || !appSecret) {
      logger.warn('WEBHOOK_VERIFIER', 'WhatsApp signature verification rejected: Missing signature header or app secret (Fail-Closed enforced)');
      return false;
    }

    const cleanSignature = signatureHeader.replace(/^sha256=/, '').trim();
    const expectedSignature = secretsManager.generateHmacSignature(payload, appSecret);

    return secretsManager.constantTimeCompare(expectedSignature, cleanSignature);
  }

  /**
   * Validates Meta/Instagram Webhook Verification Challenge (GET /api/webhooks/instagram, /api/webhooks/meta)
   */
  verifyMetaChallenge(mode, token, challenge, verifyToken = config.whatsappBusiness?.verifyToken || process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN) {
    if (!verifyToken) {
      logger.warn('WEBHOOK_VERIFIER', 'Meta/Instagram webhook challenge verification failed: No verify token configured (Fail-Closed)');
      return { success: false, error: 'Verification token not configured' };
    }

    if (mode === 'subscribe' && secretsManager.constantTimeCompare(token, verifyToken)) {
      logger.info('WEBHOOK_VERIFIER', 'Meta/Instagram webhook subscription challenge verified successfully');
      return { success: true, challenge };
    }
    logger.warn('WEBHOOK_VERIFIER', 'Meta/Instagram webhook challenge verification failed: Token mismatch');
    return { success: false, error: 'Verification token mismatch' };
  }

  /**
   * Validates Meta WhatsApp Webhook Verification Challenge (GET /api/webhooks/whatsapp)
   */
  verifyWhatsAppChallenge(mode, token, challenge, verifyToken = config.whatsappBusiness?.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN) {
    if (!verifyToken) {
      logger.warn('WEBHOOK_VERIFIER', 'WhatsApp webhook challenge verification failed: No verify token configured (Fail-Closed)');
      return { success: false, error: 'Verification token not configured' };
    }

    if (mode === 'subscribe' && secretsManager.constantTimeCompare(token, verifyToken)) {
      logger.info('WEBHOOK_VERIFIER', 'WhatsApp webhook subscription challenge verified successfully');
      return { success: true, challenge };
    }
    logger.warn('WEBHOOK_VERIFIER', 'WhatsApp webhook challenge verification failed: Token mismatch');
    return { success: false, error: 'Verification token mismatch' };
  }

  /**
   * Verifies an inbound TikTok webhook signature (X-TikTok-Signature) (Fail-Closed)
   */
  verifyTikTokSignature(payload, signatureHeader, secretKey = process.env.TIKTOK_WEBHOOK_SECRET) {
    if (!signatureHeader || !secretKey) {
      logger.warn('WEBHOOK_VERIFIER', 'TikTok signature check rejected: Missing signature or secret (Fail-Closed enforced)');
      return false;
    }
    const cleanSignature = signatureHeader.replace(/^sha256=/, '').trim();
    const expectedSignature = secretsManager.generateHmacSignature(payload, secretKey);
    return secretsManager.constantTimeCompare(expectedSignature, cleanSignature);
  }
}

export const webhookVerifier = new WebhookVerifier();
