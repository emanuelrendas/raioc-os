/**
 * RAIOC OS - Email Queue Adapter
 * Responsible for delivering formatted executive briefs and intelligence alerts via Email.
 */

import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';

export class EmailAdapter {
  constructor(options = {}) {
    this.apiKey = options.apiKey || config.adapters.email.apiKey;
    this.from = options.from || config.adapters.email.from;
    this.enabled = options.enabled !== undefined ? options.enabled : config.adapters.email.enabled;
  }

  async dispatch(task) {
    const { recipient, payload } = task;
    const subject = payload.subject || 'RAIOC Executive Intelligence Brief';
    const body = payload.body || payload.text || '';

    if (!recipient) {
      throw new Error('Email dispatch failed: Missing recipient email address');
    }

    if (!this.enabled) {
      logger.info('EMAIL_ADAPTER', `Email disabled - simulating delivery to ${recipient}`);
      return { status: 'simulated', recipient, timestamp: new Date().toISOString() };
    }

    if (!this.apiKey) {
      logger.info('EMAIL_ADAPTER', `Executive Brief email ready for delivery to ${recipient}`, {
        subject,
      });
      return {
        status: 'queued_for_mailer',
        recipient,
        subject,
        timestamp: new Date().toISOString(),
      };
    }

    // Direct HTTP Dispatch to Resend / SendGrid / Postmark
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: this.from,
        to: recipient,
        subject,
        text: body,
      }),
    });

    if (!res.ok) {
      throw new Error(`Email provider responded with status ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  }
}

export const emailAdapter = new EmailAdapter();
