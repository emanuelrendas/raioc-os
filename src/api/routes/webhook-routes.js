/**
 * RAIOC API - Webhook Routes (n8n & WhatsApp Cloud API)
 * Handles incoming webhook payloads with cryptographic signature verification.
 */

import { webhookVerifier } from '../../security/webhook-verifier.js';
import { run_cycle } from '../../core/run-cycle.js';
import { logger } from '../../logging/audit-logger.js';

export async function handleWebhookRequest(path, method = 'POST', body = {}, query = {}, headers = {}) {
  const normalized = path.replace(/^\/api\/webhooks\/?/, '');

  // 1. n8n Inbound Webhook
  if (normalized.startsWith('n8n')) {
    const signature = headers['x-n8n-signature'] || headers['X-N8N-Signature'] || '';
    const isValid = webhookVerifier.verifyN8nSignature(body, signature);

    if (!isValid) {
      logger.warn('WEBHOOK_API', 'Rejected n8n webhook: Invalid HMAC signature');
      return { status: 401, body: { error: 'Invalid HMAC signature' } };
    }

    logger.info('WEBHOOK_API', 'Accepted verified n8n webhook event', { event: body.event });

    if (body.action === 'trigger_cycle' || body.event === 'trigger_cycle') {
      run_cycle().catch((e) => logger.error('WEBHOOK_API', 'Cycle trigger failed', { error: e.message }));
    }

    return {
      status: 200,
      body: { success: true, processedAt: new Date().toISOString() },
    };
  }

  // 2. WhatsApp Inbound Webhook
  if (normalized.startsWith('whatsapp')) {
    // Verification Challenge (GET)
    if (method === 'GET') {
      const mode = query['hub.mode'] || query['mode'];
      const token = query['hub.verify_token'] || query['token'];
      const challenge = query['hub.challenge'] || query['challenge'];

      const result = webhookVerifier.verifyWhatsAppChallenge(mode, token, challenge);
      if (result.success) {
        return { status: 200, body: result.challenge };
      }
      return { status: 403, body: { error: result.error } };
    }

    // Inbound Messages & Status Updates (POST)
    const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'] || '';
    const isValid = webhookVerifier.verifyWhatsAppSignature(body, signature);

    if (!isValid) {
      logger.warn('WEBHOOK_API', 'Rejected WhatsApp webhook: Invalid Meta signature');
      return { status: 401, body: { error: 'Invalid Meta signature' } };
    }

    logger.info('WEBHOOK_API', 'Received WhatsApp Cloud API event callback');
    return { status: 200, body: { status: 'EVENT_RECEIVED' } };
  }

  return { status: 404, body: { error: `Unknown webhook provider: ${path}` } };
}
