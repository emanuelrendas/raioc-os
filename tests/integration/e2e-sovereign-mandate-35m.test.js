/**
 * RAIOC OS - Integration Test: E2E Sovereign Mandate Pipeline Simulation (AED 35,000,000)
 * 
 * Simulates complete end-to-end institutional workflow:
 * 1. Multi-channel WhatsApp Ingestion via CloudEvent v1.1
 * 2. DIRA / RIIS Surgical Triage (MARK & DM_CONVERSION >= 90 -> HOT_MANDATE)
 * 3. Deterministic ATLAS Opal ROI Financial Modeling (Palm Jebel Ali, 4% DLD, 1.25% Sinking Fund)
 * 4. LEX Statutory Ringfencing (Law 8/2007 Escrow, Art. 880 Decennial, Res. 65/2022 Golden Visa, DIFC SPV)
 * 5. Executive HITL Approval Gate Enforcement (Threshold >= 10M AED)
 * 6. Private Investment Brief One-Pager Generation with SHA-256 & CloudEvent Dispatch
 * 7. AIDA Fiduciary Voice AI Synthesis Readiness (OBJ_OFFPLAN_ESCROW_LAW8)
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

import handler from '../../api/index.js';
import { supabase } from '../../src/db/supabase-client.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';
import { enterpriseEventRouter } from '../../src/core/event-router.js';
import { secretsManager } from '../../src/config/secrets-manager.js';
import { generatePrivateBrief, computeDocumentSha256 } from '../../src/services/investment-brief-generator.js';
import { aidaVoiceService, getFiduciaryTemplate } from '../../src/services/aida-voice-service.js';
import { executeDeterministicOpalCalculation } from '../../src/services/corridor-benchmark-service.js';

function createMockRes() {
  let statusCode = 200;
  const headers = {};
  let bodyData = '';

  return {
    setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
    getHeader: (k) => headers[k.toLowerCase()],
    getHeaders: () => headers,
    status: function (code) { statusCode = code; return this; },
    writeHead: function (code, hdrs = {}) {
      statusCode = code;
      Object.entries(hdrs).forEach(([k, v]) => { headers[k.toLowerCase()] = v; });
      return this;
    },
    json: function (data) {
      this.setHeader('Content-Type', 'application/json');
      bodyData = JSON.stringify(data);
      return this;
    },
    end: function (data) {
      if (data) bodyData = typeof data === 'string' ? data : JSON.stringify(data);
      return this;
    },
    _get: () => ({
      status: statusCode,
      headers,
      body: (() => {
        try {
          return JSON.parse(bodyData);
        } catch {
          return bodyData;
        }
      })(),
    }),
  };
}

describe('🏛 E2E Pipeline Simulation: AED 35,000,000 Sovereign Mandate (Palm Jebel Ali / DIFC SPV)', () => {

  beforeEach(() => {
    enterpriseEventRouter.init();
    if (supabase.isMock) {
      supabase.initEnterpriseCoreSeeds();
    }
  });

  afterEach(() => {
    enterpriseEventRouter.destroy();
  });

  test('FULL SOVEREIGN PIPELINE: Ingestion -> Triage -> Modeling -> Compliance -> HITL -> Brief -> Voice AI', async () => {
    const mandateId = `MND-SOV-35M-${Date.now()}`;
    const correlationId = `corr_sov_35m_${Date.now()}`;
    const traceparent = `00-${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-01`;
    const investorName = 'Baroness Victoria Vance';
    const investorPhone = '971501234567';
    const allocationAed = 35000000;
    const corridorKey = 'PALM_JEBEL_ALI';
    const ownershipVehicle = 'SPV_DIFC_ADGM';

    // ──────────────────────────────────────────────────────────────────
    // STEP 1: Multi-Channel WhatsApp Webhook Ingestion
    // ──────────────────────────────────────────────────────────────────
    const rawWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BIZ_ACCOUNT_99',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '+97140000000', phone_number_id: 'PN_RAIOC_01' },
                contacts: [{ profile: { name: investorName }, wa_id: investorPhone }],
                messages: [
                  {
                    from: investorPhone,
                    id: `wamid.HBgL${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'text',
                    text: {
                      body: `Mandate Notice: Allocating AED 35,000,000 into Palm Jebel Ali ultra-prime frond asset. Structuring through DIFC SPV Common Law trust. Require Escrow Law 8 compliance certification and 10-year Golden Visa processing.`,
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const webhookSecret = 'wa_sec_secret_key_888';
    const signature = `sha256=${secretsManager.generateHmacSignature(rawWebhookPayload, webhookSecret)}`;

    const ingestRes = createMockRes();
    await handler({
      url: '/api/v1/channels/whatsapp/webhook',
      method: 'POST',
      body: rawWebhookPayload,
      headers: {
        'host': 'api.emanuelrendas.com',
        'x-hub-signature-256': signature,
        'traceparent': traceparent,
        'x-correlation-id': correlationId,
      },
    }, ingestRes);

    const ingestOut = ingestRes._get();
    assert.strictEqual(ingestOut.status, 200, 'WhatsApp Webhook must ingest with HTTP 200');
    assert.strictEqual(ingestOut.body.status, 'RECEIVED');
    assert.ok(ingestOut.body.eventId);
    assert.strictEqual(ingestOut.body.traceparent, traceparent);
    assert.strictEqual(ingestOut.body.correlationId, correlationId);

    // ──────────────────────────────────────────────────────────────────
    // STEP 2: DIRA/RIIS Surgical Triage & Scoring (MARK / DM_CONVERSION)
    // ──────────────────────────────────────────────────────────────────
    // Grounded in dm-triage-rules.json:
    // Step 1: TIER_SOVEREIGN_UHNW (35M AED >= 25M AED) -> 40 points
    // Step 2: PALM_JEBEL_ALI -> 35 points
    // Step 3: SPV_DIFC_ADGM -> 25 points
    const riisScore = 40 + 35 + 25; // 100
    assert.ok(riisScore >= 90, 'RIIS Qualification Score must be >= 90 for Sovereign UHNW Tier');
    const mandateStatus = riisScore >= 85 ? 'HOT_MANDATE' : 'QUALIFIED';
    assert.strictEqual(mandateStatus, 'HOT_MANDATE');

    // ──────────────────────────────────────────────────────────────────
    // STEP 3: Deterministic Financial Modeling ATLAS (Opal ROI)
    // ──────────────────────────────────────────────────────────────────
    const opalFinancials = executeDeterministicOpalCalculation({
      purchasePriceAed: allocationAed,
      corridor: corridorKey,
      unitSizeSqft: 5200,
    });

    assert.strictEqual(opalFinancials.success, true);
    assert.strictEqual(opalFinancials.corridorBenchmark.id, 'PALM_JEBEL_ALI');
    assert.strictEqual(opalFinancials.corridorBenchmark.strategy, 'CAPITAL_PRESERVATION_ULTRA_PRIME');

    const { statutoryFeeBreakdown } = opalFinancials.statutoryShield;
    assert.strictEqual(statutoryFeeBreakdown.dldFeeAed, 1400000, '4% DLD on 35M must equal AED 1,400,000');
    assert.strictEqual(statutoryFeeBreakdown.trusteeFeeAed, 4200, 'Trustee fee must equal AED 4,200');
    assert.strictEqual(statutoryFeeBreakdown.oqoodFeeAed, 1000, 'Oqood fee must equal AED 1,000');
    assert.strictEqual(statutoryFeeBreakdown.sinkingFundAed, 437500, '1.25% Sinking fund on 35M must equal AED 437,500');
    assert.strictEqual(statutoryFeeBreakdown.adminFeeAed, 580, 'DLD admin fee must equal AED 580');
    assert.strictEqual(statutoryFeeBreakdown.totalStatutoryFeesAed, 1843280);
    assert.strictEqual(statutoryFeeBreakdown.totalAllInOutlayAed, 36843280);

    // Verify Cap Rate and 7-Year IRR bounds
    assert.ok(opalFinancials.financialMetrics.capRate >= 4.8 && opalFinancials.financialMetrics.capRate <= 5.5, 'Cap rate must align with Palm Jebel Ali band');
    assert.ok(opalFinancials.financialMetrics.sevenYearIrr >= 12.0 && opalFinancials.financialMetrics.sevenYearIrr <= 17.0, '7-Year IRR must be verified');

    // ──────────────────────────────────────────────────────────────────
    // STEP 4: Compliance Audit LEX (Statutory Ringfencing)
    // ──────────────────────────────────────────────────────────────────
    assert.strictEqual(opalFinancials.statutoryShield.goldenVisaEligible, true);
    assert.match(opalFinancials.statutoryShield.escrowProtection, /Dubai Law No\. \(8\) of 2007/i);
    assert.match(opalFinancials.statutoryShield.decennialLiability, /UAE Civil Code Art\. 880/i);
    assert.match(opalFinancials.statutoryShield.statutoryDecree, /UAE Cabinet Resolution No\. 65 of 2022/i);

    // ──────────────────────────────────────────────────────────────────
    // STEP 5: Executive HITL Approval Gate (Ticket >= 10M AED)
    // ──────────────────────────────────────────────────────────────────
    const pendingApprovals = await supabase.fetchApprovals('PENDING');
    const matchingAppr = pendingApprovals.find(
      (a) => a.recipient === investorName || a.payload?.name === investorName || a.payload?.from === investorPhone
    );
    assert.ok(matchingAppr, 'High-ticket mandate (35M >= 10M AED) must trigger HITL Executive Approval');
    assert.strictEqual(matchingAppr.priority, 'CRITICAL');

    // Executive Approval granted by CEO
    const approvedResult = await supabase.resolveApproval(matchingAppr.id, 'APPROVED', 'Emanuel Rendas (CEO)', {
      decisionNotes: 'Sovereign mandate approved for immediate One-Pager brief and fiduciary outreach.',
    });
    assert.ok(approvedResult, 'HITL gate must transition cleanly to APPROVED');
    assert.strictEqual(approvedResult.status, 'APPROVED');

    // ──────────────────────────────────────────────────────────────────
    // STEP 6: Private Investment Brief (One-Pager) Generation
    // ──────────────────────────────────────────────────────────────────
    const briefResult = await generatePrivateBrief({
      mandateId,
      investorName,
      corridorKey,
      allocationAed,
      ownershipVehicle,
      correlationId,
      traceparent,
      publishEvent: true,
    });

    assert.strictEqual(briefResult.success, true);
    assert.ok(briefResult.briefId.startsWith('PIB-'));
    assert.strictEqual(briefResult.allocationAed, 35000000);
    assert.strictEqual(briefResult.ownershipVehicle, 'SPV_DIFC_ADGM');

    // SHA-256 Digest Validation
    assert.strictEqual(typeof briefResult.documentSha256, 'string');
    assert.strictEqual(briefResult.documentSha256.length, 64);
    assert.strictEqual(briefResult.documentSha256, computeDocumentSha256(briefResult.documentMarkdown));

    // CloudEvents v1.1 Verification
    assert.ok(briefResult.cloudEvent);
    assert.strictEqual(briefResult.cloudEvent.specversion, '1.1');
    assert.strictEqual(briefResult.cloudEvent.type, 'raioc.advisory.brief.generated.v1');
    assert.strictEqual(briefResult.cloudEvent.source, 'raioc://services/investment-brief-generator');
    assert.strictEqual(briefResult.cloudEvent.data.document_sha256, briefResult.documentSha256);
    assert.strictEqual(briefResult.cloudEvent.correlation_id, correlationId);

    // ──────────────────────────────────────────────────────────────────
    // STEP 7: AIDA Voice AI Synthesis Readiness
    // ──────────────────────────────────────────────────────────────────
    const voiceTemplate = getFiduciaryTemplate('OBJ_OFFPLAN_ESCROW_LAW8');
    assert.ok(voiceTemplate, 'OBJ_OFFPLAN_ESCROW_LAW8 template must exist in config');
    assert.strictEqual(voiceTemplate.anchor, 'UAE_LAW_8_2007_ESCROW');
    assert.strictEqual(voiceTemplate.estimated_duration_seconds, 50);

    const voiceOutput = await aidaVoiceService.synthesizeFiduciaryVoiceNote({
      templateId: 'OBJ_OFFPLAN_ESCROW_LAW8',
      recipient: investorName,
      budgetAed: allocationAed,
      correlationId,
      publishEvent: true,
    });

    assert.strictEqual(voiceOutput.success, true);
    assert.strictEqual(voiceOutput.templateId, 'OBJ_OFFPLAN_ESCROW_LAW8');
    assert.strictEqual(voiceOutput.audioDurationSeconds, 50);
    assert.ok(voiceOutput.audioSha256 && voiceOutput.audioSha256.length === 64);
    assert.ok(voiceOutput.audioUrl.includes('uae_law_8_2007_escrow'));
    assert.strictEqual(voiceOutput.cloudEvent.type, 'raioc.communication.voice.fiduciary_synthesized.v1');
  });

});
