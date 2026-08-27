/**
 * RAIOC OS - Unit Test Suite: Canonical Meta WhatsApp Cloud API Webhook Gateway
 * Specification: RAIOC-SPEC-META-WA-2026-V1
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  handleWhatsAppWebhookRequest,
  clearWamidCache,
  isWamidProcessed,
} from '../../src/api/routes/whatsapp-webhook-routes.js';
import { secretsManager } from '../../src/config/secrets-manager.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';

describe('📲 Canonical Meta WhatsApp Cloud API Webhook Gateway Suite (RAIOC-SPEC-META-WA-2026-V1)', () => {
  const APP_SECRET = 'wa_sec_secret_key_888';
  const VERIFY_TOKEN = 'raioc_meta_verify_token_2026';

  beforeEach(() => {
    clearWamidCache();
    process.env.META_APP_SECRET = APP_SECRET;
    process.env.META_VERIFY_TOKEN = VERIFY_TOKEN;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. GET Handshake Challenge Verification
  // ──────────────────────────────────────────────────────────────────────────
  test('1. GET Handshake: Successfully verifies with valid verify_token and returns text/plain challenge', async () => {
    const query = {
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': 'challenge_meta_987654321',
    };

    const res = await handleWhatsAppWebhookRequest('/api/v1/channels/whatsapp/webhook', 'GET', {}, query);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['Content-Type'], 'text/plain');
    assert.strictEqual(res.body, 'challenge_meta_987654321');
  });

  test('1b. GET Handshake: Accepts raioc_sovereign_auth_2026_x99 as canonical verify token', async () => {
    const query = {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'raioc_sovereign_auth_2026_x99',
      'hub.challenge': 'challenge_sov_2026',
    };

    const res = await handleWhatsAppWebhookRequest('/api/v1/channels/whatsapp/webhook', 'GET', {}, query);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['Content-Type'], 'text/plain');
    assert.strictEqual(res.body, 'challenge_sov_2026');
  });

  test('2. GET Handshake: Rejects with 403 Forbidden on invalid verify_token', async () => {
    const query = {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong_token_hacker',
      'hub.challenge': 'challenge_123',
    };

    const res = await handleWhatsAppWebhookRequest('/api/v1/channels/whatsapp/webhook', 'GET', {}, query);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Verification token mismatch');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. POST HMAC-SHA256 Signature Verification
  // ──────────────────────────────────────────────────────────────────────────
  test('3. POST Webhook: Rejects with 401 Unauthorized on corrupted or missing HMAC signature in production', async () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ id: 'wamid.test.001', from: '971501234567', type: 'text', text: { body: 'Hello' } }],
          },
        }],
      }],
    };

    // Corrupted signature
    const resBadSig = await handleWhatsAppWebhookRequest('/api/v1/channels/whatsapp/webhook', 'POST', payload, {}, {
      'x-hub-signature-256': 'sha256=invalid_hex_signature_0000000000000000000000000000000000000000',
    });
    assert.strictEqual(resBadSig.status, 401);
    assert.strictEqual(resBadSig.body.success, false);

    // Missing signature in production
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const resNoSig = await handleWhatsAppWebhookRequest('/api/v1/channels/whatsapp/webhook', 'POST', payload, {}, {});
    process.env.NODE_ENV = prevEnv;
    assert.strictEqual(resNoSig.status, 401);
    assert.strictEqual(resNoSig.body.success, false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Ingestion of Text, Audio (Voice Notes), and PDF Documents
  // ──────────────────────────────────────────────────────────────────────────
  test('4. POST Webhook: Ingests text message and dispatches raioc.channel.whatsapp.message.v1 CloudEvent', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'WHATSAPP_BIZ_ACCOUNT_99',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '+97140000000', phone_number_id: 'PN_RAIOC_01' },
            contacts: [{ profile: { name: 'Lady Eleanor Vance' }, wa_id: '971501234567' }],
            messages: [{
              from: '971501234567',
              id: 'wamid.HBgL_TEXT_001',
              timestamp: '1787820000',
              type: 'text',
              text: { body: 'Mandate: Palm Jebel Ali villa acquisition AED 45,000,000 via DIFC SPV.' },
            }],
          },
        }],
      }],
    };

    const signature = `sha256=${secretsManager.generateHmacSignature(payload, APP_SECRET)}`;
    const capturedEvents = [];
    const unsub = enterpriseEventBus.subscribe('raioc.channel.whatsapp.message.v1', (data, ctx) => {
      capturedEvents.push({ type: ctx?.type, data, ...ctx });
    });

    const res = await handleWhatsAppWebhookRequest('/api/v1/channels/whatsapp/webhook', 'POST', payload, {}, {
      'x-hub-signature-256': signature,
      'x-correlation-id': 'corr_test_text_001',
    });

    unsub();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'RECEIVED');
    assert.strictEqual(res.body.wamid, 'wamid.HBgL_TEXT_001');
    assert.ok(res.body.eventId);

    // Verify CloudEvent
    assert.strictEqual(capturedEvents.length, 1);
    const evt = capturedEvents[0];
    assert.strictEqual(evt.type, 'raioc.channel.whatsapp.message.v1');
    assert.strictEqual(evt.data.wamid, 'wamid.HBgL_TEXT_001');
    assert.strictEqual(evt.data.from, '971501234567');
    assert.strictEqual(evt.data.name, 'Lady Eleanor Vance');
    assert.strictEqual(evt.data.messageType, 'text');
    assert.ok(evt.data.text.includes('Palm Jebel Ali'));
  });

  test('5. POST Webhook: Ingests audio voice note and extracts audio metadata', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { phone_number_id: 'PN_RAIOC_01' },
            contacts: [{ profile: { name: 'Lord Sterling' }, wa_id: '447912345678' }],
            messages: [{
              from: '447912345678',
              id: 'wamid.HBgL_AUDIO_002',
              timestamp: '1787820000',
              type: 'audio',
              audio: { id: 'media_audio_7788', mime_type: 'audio/ogg; codecs=opus', voice: true },
            }],
          },
        }],
      }],
    };

    const signature = `sha256=${secretsManager.generateHmacSignature(payload, APP_SECRET)}`;
    const capturedEvents = [];
    const unsub = enterpriseEventBus.subscribe('raioc.channel.whatsapp.message.v1', (data, ctx) => {
      capturedEvents.push({ type: ctx?.type, data, ...ctx });
    });

    const res = await handleWhatsAppWebhookRequest('/api/v1/channels/whatsapp/webhook', 'POST', payload, {}, {
      'x-hub-signature-256': signature,
    });

    unsub();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'RECEIVED');
    assert.strictEqual(capturedEvents.length, 1);

    const evt = capturedEvents[0];
    assert.strictEqual(evt.data.messageType, 'audio');
    assert.strictEqual(evt.data.audio.id, 'media_audio_7788');
    assert.strictEqual(evt.data.audio.voice, true);
  });

  test('6. POST Webhook: Ingests PDF document attachment and extracts document metadata', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { phone_number_id: 'PN_RAIOC_01' },
            contacts: [{ profile: { name: 'Dr. Afonso Henriques' }, wa_id: '351912345678' }],
            messages: [{
              from: '351912345678',
              id: 'wamid.HBgL_DOC_003',
              timestamp: '1787820000',
              type: 'document',
              document: { id: 'media_pdf_5544', filename: 'sovereign_mandate_dossier.pdf', mime_type: 'application/pdf', caption: 'KYC and SPV Resolution' },
            }],
          },
        }],
      }],
    };

    const signature = `sha256=${secretsManager.generateHmacSignature(payload, APP_SECRET)}`;
    const capturedEvents = [];
    const unsub = enterpriseEventBus.subscribe('raioc.channel.whatsapp.message.v1', (data, ctx) => {
      capturedEvents.push({ type: ctx?.type, data, ...ctx });
    });

    const res = await handleWhatsAppWebhookRequest('/api/v1/channels/whatsapp/webhook', 'POST', payload, {}, {
      'x-hub-signature-256': signature,
    });

    unsub();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'RECEIVED');
    assert.strictEqual(capturedEvents.length, 1);

    const evt = capturedEvents[0];
    assert.strictEqual(evt.data.messageType, 'document');
    assert.strictEqual(evt.data.document.id, 'media_pdf_5544');
    assert.strictEqual(evt.data.document.filename, 'sovereign_mandate_dossier.pdf');
    assert.strictEqual(evt.data.document.mime_type, 'application/pdf');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Deduplication / Idempotency Check (WAMID Cache)
  // ──────────────────────────────────────────────────────────────────────────
  test('7. POST Webhook: Discards duplicate message with same WAMID and returns ALREADY_PROCESSED', async () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '971501234567',
              id: 'wamid.HBgL_IDEMPOTENT_999',
              timestamp: '1787820000',
              type: 'text',
              text: { body: 'First delivery attempt' },
            }],
          },
        }],
      }],
    };

    const signature = `sha256=${secretsManager.generateHmacSignature(payload, APP_SECRET)}`;
    const capturedEvents = [];
    const unsub = enterpriseEventBus.subscribe('raioc.channel.whatsapp.message.v1', (data, ctx) => {
      capturedEvents.push({ type: ctx?.type, data, ...ctx });
    });

    // 1st delivery attempt
    const res1 = await handleWhatsAppWebhookRequest('/api/v1/channels/whatsapp/webhook', 'POST', payload, {}, {
      'x-hub-signature-256': signature,
    });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.status, 'RECEIVED');
    assert.strictEqual(capturedEvents.length, 1);
    assert.strictEqual(isWamidProcessed('wamid.HBgL_IDEMPOTENT_999'), true);

    // 2nd delivery attempt (Meta Webhook retry with same WAMID)
    const res2 = await handleWhatsAppWebhookRequest('/api/v1/channels/whatsapp/webhook', 'POST', payload, {}, {
      'x-hub-signature-256': signature,
    });

    unsub();

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.status, 'ALREADY_PROCESSED');
    assert.strictEqual(res2.body.wamid, 'wamid.HBgL_IDEMPOTENT_999');

    // Event must NOT have been emitted a second time
    assert.strictEqual(capturedEvents.length, 1, 'Duplicate WAMID must not emit duplicate CloudEvent');
  });
});
