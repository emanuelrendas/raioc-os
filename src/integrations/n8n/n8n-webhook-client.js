/**
 * RAIOC Integrations - Secure n8n Webhook Bus Client
 * Dispatches and receives signed workflow automation events with HMAC-SHA256 integrity verification.
 */

import { config } from '../../config/env.js';
import { secretsManager } from '../../config/secrets-manager.js';
import { webhookVerifier } from '../../security/webhook-verifier.js';
import { logger } from '../../logging/audit-logger.js';

export class N8nWebhookClient {
  constructor(options = {}) {
    this.webhookUrl = options.webhookUrl || config.n8n.webhookUrl;
    this.webhookSecret = options.webhookSecret || config.n8n.webhookSecret;
    this.timeoutMs = options.timeoutMs || config.n8n.timeoutMs;
    this.enabled = options.enabled !== undefined ? options.enabled : config.n8n.enabled;
  }

  /**
   * Dispatches a signed event payload to an n8n workflow trigger
   * @param {string} eventType - e.g. 'lead.qualified', 'brief.generated', 'cycle.completed'
   * @param {Object} data - Event payload
   * @returns {Promise<Object>} Dispatch result
   */
  async triggerWorkflow(eventType, data = {}) {
    const timestamp = new Date().toISOString();
    const eventPayload = {
      event: eventType,
      timestamp,
      data,
    };

    const signature = secretsManager.generateHmacSignature(eventPayload, this.webhookSecret);

    if (!this.enabled) {
      logger.info('N8N_BUS', `n8n disabled - simulating event '${eventType}' dispatch`);
      return { status: 'simulated', eventType, signature, timestamp };
    }

    if (!this.webhookUrl) {
      logger.info('N8N_BUS', `Event '${eventType}' compiled with HMAC-SHA256 signature and ready for n8n gateway`, {
        signaturePreview: signature.substring(0, 10) + '...',
      });
      return {
        status: 'compiled_for_n8n',
        eventType,
        signature: `sha256=${signature}`,
        timestamp,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-Signature': `sha256=${signature}`,
          'X-Timestamp': timestamp,
          'X-Event-Type': eventType,
        },
        body: JSON.stringify(eventPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`n8n webhook responded with status ${res.status}: ${res.statusText}`);
      }

      logger.info('N8N_BUS', `Event '${eventType}' successfully triggered in n8n workflow`);
      return { status: 'dispatched_live', eventType, timestamp };
    } catch (err) {
      clearTimeout(timeoutId);
      logger.error('N8N_BUS', `Failed to trigger n8n event '${eventType}'`, { error: err.message });
      throw err;
    }
  }

  /**
   * Processes and validates an inbound event received from an n8n webhook
   */
  processInboundEvent(rawBody, signatureHeader) {
    const isValid = webhookVerifier.verifyN8nSignature(rawBody, signatureHeader, this.webhookSecret);
    if (!isValid) {
      throw new Error('Inbound n8n webhook failed HMAC-SHA256 signature verification');
    }
    return typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  }
}

export const n8nWebhookClient = new N8nWebhookClient();
