/**
 * RAIOC OS - n8n Egress Webhook Dispatcher Adapter
 * Dispatches automated signed event webhooks to n8n workflows with HMAC-SHA256 authentication,
 * strict 5000ms timeout enforcement, and non-blocking audit error logging.
 */

import { createHmac } from 'node:crypto';
import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';
import { supabase } from '../db/supabase-client.js';

export class N8nAdapter {
  constructor(options = {}) {
    this.webhookUrl = options.webhookUrl || process.env.N8N_OUTBOUND_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || config.n8n?.webhookUrl || '';
    this.webhookSecret = options.webhookSecret || process.env.N8N_OUTBOUND_SECRET || process.env.N8N_WEBHOOK_SECRET || config.n8n?.webhookSecret || 'raioc_n8n_hmac_secret';
    this.timeoutMs = options.timeoutMs || 5000;
    this.enabled = options.enabled !== undefined 
      ? options.enabled 
      : (process.env.N8N_ENABLED !== 'false' && config.n8n?.enabled !== false);
  }

  /**
   * Signs a payload using HMAC-SHA256
   * @param {Object|string} payload - Payload to sign
   * @param {string} secret - Secret key
   * @returns {string} Hex HMAC digest
   */
  signPayload(payload, secret = this.webhookSecret) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHmac('sha256', secret || 'raioc_n8n_hmac_secret').update(raw).digest('hex');
  }

  /**
   * Dispatches an event to n8n outbound webhook with non-blocking error handling
   * @param {string} event - Event name (e.g. 'QUALIFIED_LEAD', 'LEAD_INGESTED')
   * @param {Object} payload - Event data payload
   * @param {Object} options - Override options (webhookUrl, secret, timeoutMs)
   * @returns {Promise<Object>} Dispatch outcome (never throws)
   */
  async dispatchEvent(event, payload = {}, options = {}) {
    const targetUrl = options.webhookUrl || process.env.N8N_OUTBOUND_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || this.webhookUrl;
    const secret = options.webhookSecret || process.env.N8N_OUTBOUND_SECRET || process.env.N8N_WEBHOOK_SECRET || this.webhookSecret;
    const timeoutMs = options.timeoutMs || this.timeoutMs || 5000;
    const timestamp = new Date().toISOString();
    const correlationId = options.correlationId || payload.correlationId || `corr_n8n_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const eventPayload = {
      event,
      timestamp,
      correlationId,
      source: 'raioc-os',
      data: payload,
    };

    const signature = this.signPayload(eventPayload, secret);

    // If disabled
    if (!this.enabled) {
      logger.info('N8N_ADAPTER', `n8n webhook disabled - simulating event [${event}] dispatch`, { correlationId });
      return {
        success: true,
        status: 'simulated',
        event,
        correlationId,
        signature: `sha256=${signature}`,
        timestamp,
      };
    }

    // If no webhook URL configured
    if (!targetUrl) {
      logger.info('N8N_ADAPTER', `n8n outbound webhook URL not configured - event [${event}] compiled with HMAC-SHA256 signature`, {
        correlationId,
        signaturePreview: signature.substring(0, 10) + '...',
      });
      return {
        success: true,
        status: 'compiled_for_n8n',
        event,
        correlationId,
        signature: `sha256=${signature}`,
        payload: eventPayload,
        timestamp,
      };
    }

    // Execute HTTP POST with 5000ms timeout and non-blocking error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      logger.info('N8N_ADAPTER', `Dispatching event [${event}] to n8n webhook: ${targetUrl}`, { correlationId });

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-Signature': `sha256=${signature}`,
          'X-Event-Type': event,
          'X-Timestamp': timestamp,
          'X-Correlation-ID': correlationId,
        },
        body: JSON.stringify(eventPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`n8n webhook returned status ${res.status}: ${res.statusText}`);
      }

      let responseData = {};
      try {
        responseData = await res.json();
      } catch {
        responseData = { status: 'OK' };
      }

      logger.info('N8N_ADAPTER', `Successfully dispatched event [${event}] to n8n`, { correlationId, status: res.status });
      logger.audit('N8N_ADAPTER', 'N8N_EVENT_DISPATCHED', correlationId, 'PENDING', 'SENT', {
        event,
        status: res.status,
      });

      await supabase.recordAuditLog({
        category: 'N8N_ADAPTER',
        action: 'N8N_EVENT_DISPATCHED',
        entityId: correlationId,
        message: `n8n outbound webhook dispatched for event [${event}]`,
        correlationId,
        metadata: { event, status: res.status, response: responseData },
      });

      return {
        success: true,
        status: 'SENT',
        httpStatus: res.status,
        event,
        correlationId,
        signature: `sha256=${signature}`,
        response: responseData,
        timestamp,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
      const errorMessage = isTimeout 
        ? `n8n outbound webhook timed out after ${timeoutMs}ms` 
        : err.message;

      // Non-blocking error handling: Log failure to audit log without failing parent process
      logger.error('N8N_ADAPTER', `Failed to dispatch n8n event [${event}]: ${errorMessage}`, {
        correlationId,
        error: errorMessage,
        isTimeout,
      });

      logger.audit('N8N_ADAPTER', 'N8N_EVENT_FAILED', correlationId, 'PENDING', 'FAILED', {
        event,
        error: errorMessage,
      });

      await supabase.recordAuditLog({
        category: 'N8N_ADAPTER',
        action: 'N8N_EVENT_FAILED',
        entityId: correlationId,
        message: `Failed to dispatch n8n event [${event}]: ${errorMessage}`,
        correlationId,
        metadata: { event, error: errorMessage, isTimeout },
      });

      return {
        success: false,
        status: 'FAILED',
        event,
        correlationId,
        error: errorMessage,
        isTimeout,
        timestamp,
      };
    }
  }
}

export const n8nAdapter = new N8nAdapter();

/**
 * Top-level helper function for dispatching n8n events
 * @param {string} event - Event name (e.g. 'QUALIFIED_LEAD')
 * @param {Object} payload - Event payload
 * @param {Object} options - Optional overrides
 * @returns {Promise<Object>} Dispatch result
 */
export async function dispatchN8nEvent(event, payload = {}, options = {}) {
  return await n8nAdapter.dispatchEvent(event, payload, options);
}
