/**
 * RAIOC OS - Unit Test Suite: AIDA Fiduciary Voice Objection Templates & Dispatch Service
 * 
 * Validates:
 * 1. Integrity of canonical templates in src/config/aida-voice-templates.json
 * 2. Statutory anchor mappings (UAE Law 8/2007, UAE Civil Code Art 880, Cabinet Res 65/2022)
 * 3. Exact text integrity and estimated duration metrics (~50-55s)
 * 4. Cryptographic SHA-256 payload & audio hash calculations
 * 5. CloudEvents v1.1 specification envelope compliance and event bus routing
 * 6. Error handling for invalid template identifiers
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  aidaVoiceService,
  synthesizeFiduciaryVoiceNote,
  getFiduciaryTemplate,
  listFiduciaryTemplates,
  hasFiduciaryTemplate,
  computeSha256,
  FIDUCIARY_TEMPLATES,
} from '../../src/services/aida-voice-service.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_FILE_PATH = join(__dirname, '../../src/config/aida-voice-templates.json');

test('AIDA FIDUCIARY TEMPLATES: JSON Configuration File Integrity', async () => {
  // 1. File exists
  assert.ok(existsSync(TEMPLATES_FILE_PATH), 'aida-voice-templates.json must exist at src/config/');

  // 2. File parses as valid JSON
  const rawData = readFileSync(TEMPLATES_FILE_PATH, 'utf-8');
  const templates = JSON.parse(rawData);
  assert.ok(templates && typeof templates === 'object', 'Templates must be a valid JSON object');

  // 3. Exactly the 3 required canonical templates exist
  const expectedKeys = [
    'OBJ_OFFPLAN_ESCROW_LAW8',
    'OBJ_STRUCTURAL_CIVIL_880',
    'OBJ_GOLDEN_VISA_RES65',
  ];

  for (const key of expectedKeys) {
    assert.ok(key in templates, `Template key "${key}" must be defined in aida-voice-templates.json`);
  }
});

test('AIDA FIDUCIARY TEMPLATES: Statutory Anchors & Content Verification', async () => {
  const templates = FIDUCIARY_TEMPLATES;

  // Template 1: OBJ_OFFPLAN_ESCROW_LAW8
  const t1 = templates.OBJ_OFFPLAN_ESCROW_LAW8;
  assert.strictEqual(t1.template_id, 'OBJ_OFFPLAN_ESCROW_LAW8');
  assert.strictEqual(t1.anchor, 'UAE_LAW_8_2007_ESCROW');
  assert.ok(t1.estimated_duration_seconds >= 45 && t1.estimated_duration_seconds <= 55, 'Duration should be ~50s');
  assert.ok(t1.text.includes('Lei número oito de dois mil e sete'), 'Must reference UAE Law 8 of 2007');
  assert.ok(t1.text.includes('Escrow segregada'), 'Must mention Escrow segregada');
  assert.ok(t1.text.includes('Dubai Land Department e pela RERA'), 'Must mention DLD and RERA');
  assert.ok(t1.text.includes('cinco por cento'), 'Must mention 5% retention guarantee');

  // Template 2: OBJ_STRUCTURAL_CIVIL_880
  const t2 = templates.OBJ_STRUCTURAL_CIVIL_880;
  assert.strictEqual(t2.template_id, 'OBJ_STRUCTURAL_CIVIL_880');
  assert.strictEqual(t2.anchor, 'UAE_CIVIL_CODE_ART_880');
  assert.ok(t2.estimated_duration_seconds >= 45 && t2.estimated_duration_seconds <= 55, 'Duration should be ~50s');
  assert.ok(t2.text.includes('Artigo oitocentos e oitenta do Código Civil'), 'Must reference UAE Civil Code Article 880');
  assert.ok(t2.text.includes('Responsabilidade Decenal obrigatória'), 'Must mention Decennial Liability');
  assert.ok(t2.text.includes('dez anos'), 'Must mention 10-year warranty');
  assert.ok(t2.text.includes('ordem pública'), 'Must mention public order character');

  // Template 3: OBJ_GOLDEN_VISA_RES65
  const t3 = templates.OBJ_GOLDEN_VISA_RES65;
  assert.strictEqual(t3.template_id, 'OBJ_GOLDEN_VISA_RES65');
  assert.strictEqual(t3.anchor, 'CABINET_RES_65_2022_GOLDEN_VISA');
  assert.ok(t3.estimated_duration_seconds >= 50 && t3.estimated_duration_seconds <= 60, 'Duration should be ~55s');
  assert.ok(t3.text.includes('Resolução de Gabinete número sessenta e cinco de dois mil e vinte e dois'), 'Must reference Cabinet Res 65/2022');
  assert.ok(t3.text.includes('dois milhões de dirhams'), 'Must reference 2M AED threshold');
  assert.ok(t3.text.includes('Golden Visa de dez anos'), 'Must mention 10-Year Golden Visa');
  assert.ok(t3.text.includes('aquisições em planta'), 'Must mention off-plan acquisitions');
});

test('AIDA VOICE SERVICE: Template Retrieval Helper Functions', async () => {
  assert.strictEqual(hasFiduciaryTemplate('OBJ_OFFPLAN_ESCROW_LAW8'), true);
  assert.strictEqual(hasFiduciaryTemplate('OBJ_STRUCTURAL_CIVIL_880'), true);
  assert.strictEqual(hasFiduciaryTemplate('OBJ_GOLDEN_VISA_RES65'), true);
  assert.strictEqual(hasFiduciaryTemplate('NON_EXISTENT_TEMPLATE'), false);

  const t1 = getFiduciaryTemplate('OBJ_OFFPLAN_ESCROW_LAW8');
  assert.strictEqual(t1.anchor, 'UAE_LAW_8_2007_ESCROW');

  const all = listFiduciaryTemplates();
  assert.strictEqual(all.length, 3);
  assert.ok(all.some(t => t.anchor === 'UAE_LAW_8_2007_ESCROW'));
  assert.ok(all.some(t => t.anchor === 'UAE_CIVIL_CODE_ART_880'));
  assert.ok(all.some(t => t.anchor === 'CABINET_RES_65_2022_GOLDEN_VISA'));
});

test('AIDA VOICE SERVICE: Cryptographic SHA-256 Calculations', async () => {
  const sampleText = 'RAIOC Sovereign Fiduciary Text';
  const expectedHash = createHash('sha256').update(sampleText).digest('hex');
  const computedHash = computeSha256(sampleText);

  assert.strictEqual(computedHash, expectedHash);
  assert.strictEqual(computedHash.length, 64);
  assert.match(computedHash, /^[0-9a-f]{64}$/);

  // Object payload hashing
  const samplePayload = { anchor: 'UAE_LAW_8_2007_ESCROW', budget_aed: 25000000 };
  const expectedObjHash = createHash('sha256').update(JSON.stringify(samplePayload)).digest('hex');
  assert.strictEqual(computeSha256(samplePayload), expectedObjHash);
});

test('AIDA VOICE SERVICE: Synthesize OBJ_OFFPLAN_ESCROW_LAW8 with CloudEvents v1.1', async () => {
  const correlationId = 'corr_test_fiduciary_law8_001';
  const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

  const result = await synthesizeFiduciaryVoiceNote({
    templateId: 'OBJ_OFFPLAN_ESCROW_LAW8',
    recipient: 'Lord Alistair Sterling',
    budgetAed: 25000000,
    correlationId,
    traceparent,
    channel: 'WHATSAPP',
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.templateId, 'OBJ_OFFPLAN_ESCROW_LAW8');
  assert.strictEqual(result.anchor, 'UAE_LAW_8_2007_ESCROW');
  assert.strictEqual(result.estimatedDurationSeconds, 50);
  assert.strictEqual(result.audioDurationSeconds, 50);
  assert.ok(result.text.includes('Lei número oito de dois mil e sete'));

  // Audio SHA-256 check
  const expectedAudioSha256 = createHash('sha256').update(result.text).digest('hex');
  assert.strictEqual(result.audioSha256, expectedAudioSha256);

  // CloudEvents v1.1 Envelope validation
  const ce = result.cloudEvent;
  assert.ok(ce, 'CloudEvent envelope must be present');
  assert.strictEqual(ce.specversion, '1.1');
  assert.strictEqual(ce.type, 'raioc.communication.voice.fiduciary_synthesized.v1');
  assert.strictEqual(ce.source, 'raioc://services/aida-voice-service');
  assert.strictEqual(ce.correlation_id, correlationId);
  assert.strictEqual(ce.traceparent, traceparent);
  assert.strictEqual(ce.datacontenttype, 'application/json');

  // Payload SHA-256 check
  const expectedPayloadSha256 = computeSha256(ce.data);
  assert.strictEqual(result.payloadSha256, expectedPayloadSha256);
  assert.strictEqual(ce.payload_sha256, expectedPayloadSha256);

  // Data content validation
  assert.strictEqual(ce.data.template_id, 'OBJ_OFFPLAN_ESCROW_LAW8');
  assert.strictEqual(ce.data.anchor, 'UAE_LAW_8_2007_ESCROW');
  assert.strictEqual(ce.data.recipient_name, 'Lord Alistair Sterling');
  assert.strictEqual(ce.data.budget_aed, 25000000);
  assert.strictEqual(ce.data.channel, 'WHATSAPP');
});

test('AIDA VOICE SERVICE: Synthesize OBJ_STRUCTURAL_CIVIL_880 with CloudEvents v1.1', async () => {
  const result = await synthesizeFiduciaryVoiceNote({
    templateId: 'OBJ_STRUCTURAL_CIVIL_880',
    recipient: 'Dr. Afonso Henriques',
    budgetAed: 30000000,
    channel: 'TELEGRAM',
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.templateId, 'OBJ_STRUCTURAL_CIVIL_880');
  assert.strictEqual(result.anchor, 'UAE_CIVIL_CODE_ART_880');
  assert.strictEqual(result.estimatedDurationSeconds, 50);
  assert.ok(result.text.includes('Artigo oitocentos e oitenta do Código Civil'));
  assert.ok(result.audioSha256.length === 64);
  assert.ok(result.payloadSha256.length === 64);

  assert.strictEqual(result.cloudEvent.specversion, '1.1');
  assert.strictEqual(result.cloudEvent.data.channel, 'TELEGRAM');
});

test('AIDA VOICE SERVICE: Synthesize OBJ_GOLDEN_VISA_RES65 with CloudEvents v1.1', async () => {
  const result = await synthesizeFiduciaryVoiceNote({
    templateId: 'OBJ_GOLDEN_VISA_RES65',
    recipient: 'Baroness Victoria Vance',
    budgetAed: 45000000,
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.templateId, 'OBJ_GOLDEN_VISA_RES65');
  assert.strictEqual(result.anchor, 'CABINET_RES_65_2022_GOLDEN_VISA');
  assert.strictEqual(result.estimatedDurationSeconds, 55);
  assert.ok(result.text.includes('Resolução de Gabinete número sessenta e cinco de dois mil e vinte e dois'));
  assert.ok(result.audioSha256.length === 64);
  assert.ok(result.payloadSha256.length === 64);

  assert.strictEqual(result.cloudEvent.specversion, '1.1');
  assert.strictEqual(result.cloudEvent.data.recipient_name, 'Baroness Victoria Vance');
});

test('AIDA VOICE SERVICE: Event Bus Delivery and Trace Verification', async () => {
  const correlationId = `corr_bus_verify_${Date.now()}`;
  const result = await synthesizeFiduciaryVoiceNote({
    templateId: 'OBJ_OFFPLAN_ESCROW_LAW8',
    recipient: 'Zhang Wei',
    budgetAed: 60000000,
    correlationId,
    publishEvent: true,
  });

  assert.strictEqual(result.success, true);

  // Check event bus log
  const eventLog = enterpriseEventBus.getEventHistory(100);
  const publishedEvent = eventLog.find(
    e => e.correlation_id === correlationId && e.type === 'raioc.communication.voice.fiduciary_synthesized.v1'
  );

  assert.ok(publishedEvent, 'Synthesized CloudEvent must be registered in Enterprise Event Bus');
  assert.strictEqual(publishedEvent.data.recipient_name, 'Zhang Wei');
  assert.strictEqual(publishedEvent.data.anchor, 'UAE_LAW_8_2007_ESCROW');
  assert.strictEqual(publishedEvent.payload_sha256, result.payloadSha256);
});

test('AIDA VOICE SERVICE: Error Handling on Invalid Template ID', async () => {
  await assert.rejects(
    async () => {
      await synthesizeFiduciaryVoiceNote({
        templateId: 'INVALID_UNKNOWN_TEMPLATE_KEY',
      });
    },
    {
      code: 'INVALID_TEMPLATE_ID',
      message: /Invalid or missing fiduciary templateId/i,
    }
  );
});
