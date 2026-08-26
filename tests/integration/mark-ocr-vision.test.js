/**
 * Integration Test: MARK Multimodal Document OCR & Vision Intelligence Pipeline
 * Validates document intake API, file constraint validation (15MB / MIME),
 * structured multimodal extraction (Title Deeds, Proof of Funds), W3C trace propagation,
 * MARK lead triage & DIRA score recalculation, HITL approval triggers, and audit immutability.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import handler from '../../api/index.js';
import { supabase } from '../../src/db/supabase-client.js';
import { enterpriseEventBus } from '../../src/core/event-bus.js';
import { enterpriseEventRouter } from '../../src/core/event-router.js';
import { documentVision, DOCUMENT_CLASSES } from '../../src/core/document-vision.js';
import { markTriage } from '../../src/core/mark-triage.js';

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

beforeEach(() => {
  enterpriseEventRouter.init();
  if (supabase.isMock) {
    supabase.initEnterpriseCoreSeeds();
  }
});

afterEach(() => {
  enterpriseEventRouter.destroy();
});

// ══════════════════════════════════════════════════════════════════════
// 1. Ingestion Endpoint Validation & Constraint Verification
// ══════════════════════════════════════════════════════════════════════

test('MARK OCR VISION: Rejection of file exceeding 15MB limit (HTTP 413)', async () => {
  const hugeBase64 = 'A'.repeat(22 * 1024 * 1024); // ~22MB base64 exceeds 15MB limit

  const res = createMockRes();
  await handler({
    url: '/api/v1/intake/document',
    method: 'POST',
    body: {
      fileName: 'large_masterplan.pdf',
      mimeType: 'application/pdf',
      fileBase64: hugeBase64,
    },
    headers: { host: 'api.emanuelrendas.com' },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 413);
  assert.strictEqual(out.body.success, false);
  assert.match(out.body.error, /exceeds 15MB size limit/i);
});

test('MARK OCR VISION: Rejection of unsupported MIME types (HTTP 400)', async () => {
  const res = createMockRes();
  await handler({
    url: '/api/v1/intake/document',
    method: 'POST',
    body: {
      fileName: 'archive.zip',
      mimeType: 'application/zip',
      fileBase64: 'UEsDBBQAAAAIA...',
    },
    headers: { host: 'api.emanuelrendas.com' },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 400);
  assert.strictEqual(out.body.success, false);
  assert.match(out.body.error, /unsupported file format/i);
});

test('MARK OCR VISION: Legacy Route Deprecation Header on /api/intake/document', async () => {
  const res = createMockRes();
  await handler({
    url: '/api/intake/document',
    method: 'POST',
    body: {
      fileName: 'title_deed_cr804.pdf',
      mimeType: 'application/pdf',
      textContent: 'Dubai Land Department Title Deed Unit CR-804 Palm Jumeirah Nakheel',
    },
    headers: { host: 'api.emanuelrendas.com' },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 200);
  assert.ok(out.headers.deprecation);
  assert.match(out.headers.deprecation, /@deprecated/);
  assert.strictEqual(out.body.status, 'RECEIVED');
  assert.ok(out.body.fileSha256);
});

// ══════════════════════════════════════════════════════════════════════
// 2. Structured JSON Extraction for Title Deeds & Proof of Funds
// ══════════════════════════════════════════════════════════════════════

test('MARK OCR VISION: Structured Extraction of TITLE_DEED', async () => {
  const titleDeedText = `
    GOVERNMENT OF DUBAI - DUBAI LAND DEPARTMENT
    TITLE DEED CERTIFICATE
    Title Deed Number: TD-DXB-2026-88192
    Community: Palm Jumeirah (West Crescent)
    Master Developer: Nakheel PJSC
    Property / Unit Number: CR-804
    Suite Size: 4,850 SQFT
    Escrow Account Status: VERIFIED_ACTIVE (Law No. 8 of 2007 Compliant)
    Owner Entity: Sovereign Capital Holdings SPV
  `;

  const extraction = await documentVision.extract({
    documentType: 'TITLE_DEED',
    fileName: 'nakheel_title_deed_cr804.pdf',
    textContent: titleDeedText,
  });

  assert.strictEqual(extraction.success, true);
  assert.strictEqual(extraction.documentClass, DOCUMENT_CLASSES.TITLE_DEED);
  assert.strictEqual(extraction.data.community, 'Palm Jumeirah');
  assert.strictEqual(extraction.data.master_developer, 'Nakheel');
  assert.strictEqual(extraction.data.escrow_account_status, 'VERIFIED_ACTIVE');
  assert.ok(extraction.confidence >= 0.75);
  assert.strictEqual(extraction.requiresManualReview, false);
});

test('MARK OCR VISION: Structured Extraction of PROOF_OF_FUNDS (USD to AED)', async () => {
  const pofText = `
    EMIRATES NBD PRIVATE BANKING
    ACCOUNT VERIFICATION & LIQUIDITY STATEMENT
    Client: Lord Alistair Sterling
    Statement Date: 2026-08-15
    Verified Liquid Balance: USD 6,800,000.00
    Account Status: ACTIVE & VERIFIED
    Funds Origin: Clean Sovereign Capital Reserves
  `;

  const extraction = await documentVision.extract({
    documentType: 'PROOF_OF_FUNDS',
    fileName: 'emirates_nbd_pof.pdf',
    textContent: pofText,
  });

  assert.strictEqual(extraction.success, true);
  assert.strictEqual(extraction.documentClass, DOCUMENT_CLASSES.PROOF_OF_FUNDS);
  assert.strictEqual(extraction.data.currency, 'USD');
  assert.strictEqual(extraction.data.original_amount, 6800000);
  assert.strictEqual(extraction.data.liquid_amount_aed, 24973000); // 6.8M * 3.6725
  assert.strictEqual(extraction.data.financial_institution, 'Emirates NBD');
  assert.strictEqual(extraction.data.verification_status, 'VERIFIED');
  assert.ok(extraction.confidence >= 0.75);
});

// ══════════════════════════════════════════════════════════════════════
// 3. W3C Trace Context Propagation & MARK Triage Integration
// ══════════════════════════════════════════════════════════════════════

test('MARK OCR VISION: End-to-End W3C Trace Context & Lead DIRA Recalculation', async () => {
  const customTraceparent = '00-8af92f3577b34da6a3ce929d0e0e9999-00f067aa0ba902b7-01';
  const customCorrelationId = 'corr_doc_sterling_proof_7711';

  // Ingest POF document for existing investor 'inv_sterling_001'
  const initialInvestor = await supabase.getInvestor('inv_sterling_001');
  const initialDira = initialInvestor.dira_score || 88;

  const res = createMockRes();
  await handler({
    url: '/api/v1/intake/document',
    method: 'POST',
    body: {
      documentType: 'PROOF_OF_FUNDS',
      investorId: 'inv_sterling_001',
      fileName: 'sterling_bank_pof.pdf',
      textContent: 'Emirates NBD Private Banking statement for Lord Alistair Sterling showing 25M AED liquid capital.',
    },
    headers: {
      host: 'api.emanuelrendas.com',
      traceparent: customTraceparent,
      'x-correlation-id': customCorrelationId,
    },
  }, res);

  const out = res._get();
  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.body.status, 'RECEIVED');
  assert.strictEqual(out.body.traceparent, customTraceparent);
  assert.strictEqual(out.body.correlationId, customCorrelationId);

  // 1. Verify Investor CRM Record Update in Supabase
  const updatedInvestor = await supabase.getInvestor('inv_sterling_001');
  assert.ok(updatedInvestor);
  assert.strictEqual(updatedInvestor.stage, 'HOT_MANDATE');
  assert.ok(updatedInvestor.dira_score > initialDira);
  assert.ok(updatedInvestor.tags.includes('VERIFIED_POF'));
  assert.ok(updatedInvestor.tags.includes('GOLDEN_VISA_VERIFIED'));

  // 2. Verify Interaction Log Sanitization (NO raw base64 stored)
  const logs = await supabase.fetchInteractionLogs();
  const docLog = logs.find((l) => l.channel === 'DOCUMENT_OCR' && l.correlation_id === customCorrelationId);
  assert.ok(docLog);
  assert.strictEqual(docLog.source_agent, 'MARK');
  assert.strictEqual(docLog.traceparent, customTraceparent);
  assert.ok(docLog.payload.fileSha256);
  assert.strictEqual(docLog.payload.fileBase64, undefined); // Sensitive base64 omitted from log

  // 3. Verify Pending HITL Executive Approval created for high-value mandate (25M AED)
  const approvals = await supabase.fetchApprovals();
  const docApproval = approvals.find((a) => a.id.startsWith('appr_doc_') && a.payload?.documentClass === 'PROOF_OF_FUNDS');
  assert.ok(docApproval);
  assert.strictEqual(docApproval.status, 'PENDING');
  assert.strictEqual(docApproval.priority, 'CRITICAL');
});

// ══════════════════════════════════════════════════════════════════════
// 4. Low Confidence (<0.75) HITL Approval Trigger
// ══════════════════════════════════════════════════════════════════════

test('MARK OCR VISION: Low Confidence Scan Triggers HITL Review', async () => {
  // Pass corrupted/unclear generic document
  const lowConfidenceResult = {
    documentClass: 'TITLE_DEED',
    data: {
      property_number: null, // missing required fields
      community: 'Unknown Zone',
      size_sqft: 0,
      title_deed_ref: null,
    },
    confidence: 0.60,
    requiresManualReview: true,
  };

  const triage = await markTriage.evaluateDocumentTriage(lowConfidenceResult, 'inv_lisbon_003', {
    correlationId: 'corr_low_conf_test',
  });

  assert.strictEqual(triage.success, true);
  assert.strictEqual(triage.triageStatus, 'REVIEW_REQUIRED');
  assert.ok(triage.approvalId);

  const approvals = await supabase.fetchApprovals();
  const lowConfApproval = approvals.find((a) => a.id === triage.approvalId);
  assert.ok(lowConfApproval);
  assert.strictEqual(lowConfApproval.status, 'PENDING');
  assert.strictEqual(lowConfApproval.priority, 'HIGH');
  assert.strictEqual(lowConfApproval.payload.requiresManualReview, true);
});

// ══════════════════════════════════════════════════════════════════════
// 5. Runtime Tool Telemetry & Mission Control Consolidated State
// ══════════════════════════════════════════════════════════════════════

test('MARK OCR VISION: Tool Telemetry Probe & Mission Control V1 Reflection', async () => {
  // 1. Verify Runtime Tool Telemetry for 'mark_ocr_vision'
  const toolTelemetry = await supabase.getToolRuntimeTelemetry('mark_ocr_vision');
  assert.ok(toolTelemetry);
  assert.strictEqual(toolTelemetry.tool_id, 'mark_ocr_vision');
  assert.strictEqual(toolTelemetry.live_health_status, 'HEALTHY');
  assert.ok(toolTelemetry.total_calls_today >= 1);

  // 2. Verify Mission Control Consolidated State Feed
  const mcRes = createMockRes();
  await handler({
    url: '/api/v1/mission-control/v1-state',
    method: 'GET',
    headers: { host: 'api.emanuelrendas.com' },
  }, mcRes);

  const mcState = mcRes._get();
  assert.strictEqual(mcState.status, 200);
  assert.strictEqual(mcState.body.success, true);

  const docPulse = mcState.body.ingestionPulse.find((p) => p.channel === 'DOCUMENT_OCR');
  assert.ok(docPulse);
  assert.strictEqual(docPulse.channel, 'DOCUMENT_OCR');
  assert.strictEqual(docPulse.source_agent, 'MARK');
});

// ══════════════════════════════════════════════════════════════════════
// 6. Audit Log Immutability Protection
// ══════════════════════════════════════════════════════════════════════

test('MARK OCR VISION: Rejection of UPDATE/DELETE on interaction_logs', async () => {
  await assert.rejects(
    async () => {
      await supabase.updateInteractionLog('log_sample', { summary: 'Tampered summary' });
    },
    /FATAL: UPDATE or DELETE operations are strictly prohibited/
  );

  await assert.rejects(
    async () => {
      await supabase.deleteInteractionLog('log_sample');
    },
    /FATAL: UPDATE or DELETE operations are strictly prohibited/
  );
});
