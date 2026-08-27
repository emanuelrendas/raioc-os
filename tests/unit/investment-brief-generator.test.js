/**
 * RAIOC OS - Unit Test Suite: Private Investment Brief Generator
 * Tests canonical One-Pager rendering, ATLAS/LEX integration,
 * SHA-256 cryptographic verification, and CloudEvents v1.1 publishing.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createHash } from 'node:crypto';

import {
  generatePrivateBrief,
  computeDocumentSha256,
} from '../../src/services/investment-brief-generator.js';
import {
  renderPrivateInvestmentBrief,
  sanitizeText,
  formatAed,
  formatPct,
  RAIOC_PIB_SCHEMA_VERSION,
} from '../../src/templates/investment-brief-template.js';

describe('📑 Private Investment Brief (One-Pager) Canonical Unit Suite', () => {

  test('1. Template Helper Utilities: Sanitization and Formatting', () => {
    assert.strictEqual(sanitizeText('  <script>alert(1)</script> Hello World  '), 'alert(1) Hello World');
    assert.strictEqual(formatAed(50000000), 'AED 50,000,000');
    assert.strictEqual(formatPct(5.1234), '5.12%');
    assert.strictEqual(RAIOC_PIB_SCHEMA_VERSION, 'RAIOC_PIB_ONE_PAGER_V2');
  });

  test('2. Mandate 50M AED in Palm Jebel Ali (DIFC SPV): Full Dossier Generation', async () => {
    const mandateId = 'MND-UHNW-50M-PJA';
    const investorName = 'Lord Alistair Sterling & Family';
    const allocationAed = 50000000;
    const correlationId = 'corr_test_50m_pja';

    const brief = await generatePrivateBrief({
      mandateId,
      investorName,
      corridorKey: 'PALM_JEBEL_ALI',
      allocationAed,
      ownershipVehicle: 'SPV_DIFC_ADGM',
      correlationId,
      publishEvent: true,
    });

    // Top-level structure
    assert.strictEqual(brief.success, true);
    assert.ok(brief.briefId.startsWith('PIB-'));
    assert.strictEqual(brief.mandateId, mandateId);
    assert.strictEqual(brief.investorName, investorName);
    assert.strictEqual(brief.corridorKey, 'PALM_JEBEL_ALI');
    assert.strictEqual(brief.strategy, 'CAPITAL_PRESERVATION_ULTRA_PRIME');
    assert.strictEqual(brief.allocationAed, 50000000);

    // Statutory validation
    assert.strictEqual(brief.statutoryValidation.escrowLawCompliant, true);
    assert.strictEqual(brief.statutoryValidation.decennialLiabilityCovered, true);
    assert.strictEqual(brief.statutoryValidation.goldenVisaEligible, true);
    // DLD 4% of 50M = 2,000,000; Sinking fund 1.25% of 50M = 625,000; Trustee = 4200; Oqood = 1000; Admin = 580
    assert.strictEqual(brief.statutoryValidation.totalStatutoryFeesAed, 2000000 + 625000 + 4200 + 1000 + 580);
    assert.strictEqual(brief.statutoryValidation.statutoryOutlayAed, 50000000 + brief.statutoryValidation.totalStatutoryFeesAed);

    // Financial Metrics
    assert.ok(brief.financialSummary.capRate >= 4.5 && brief.financialSummary.capRate <= 6.0);
    assert.ok(brief.financialSummary.sevenYearIrr >= 12.0 && brief.financialSummary.sevenYearIrr <= 17.0);

    // Document Markdown content
    assert.match(brief.documentMarkdown, /# 🏛 PRIVATE INVESTMENT BRIEF \(ONE-PAGER\)/);
    assert.match(brief.documentMarkdown, /Lord Alistair Sterling/);
    assert.match(brief.documentMarkdown, /Palm Jebel Ali Sovereign Corridor/);
    assert.match(brief.documentMarkdown, /AED 50,000,000/);
    assert.match(brief.documentMarkdown, /DIFC \/ ADGM Special Purpose Vehicle/);
    assert.match(brief.documentMarkdown, /Dubai Law No\. 8 of 2007/);
    assert.match(brief.documentMarkdown, /UAE Civil Code Art\. 880/);
    assert.match(brief.documentMarkdown, /Cabinet Resolution No\. 65 of 2022/);

    // CloudEvents v1.1 Envelope
    assert.ok(brief.cloudEvent);
    assert.strictEqual(brief.cloudEvent.specversion, '1.1');
    assert.strictEqual(brief.cloudEvent.type, 'raioc.advisory.brief.generated.v1');
    assert.strictEqual(brief.cloudEvent.source, 'raioc://services/investment-brief-generator');
    assert.strictEqual(brief.cloudEvent.correlation_id, correlationId);
    assert.strictEqual(brief.cloudEvent.data.mandate_id, mandateId);
    assert.strictEqual(brief.cloudEvent.data.document_sha256, brief.documentSha256);
  });

  test('3. Mandate 25M AED in Dubai South (Individual Direct): Full Dossier Generation', async () => {
    const mandateId = 'MND-DWC-25M-GROWTH';
    const investorName = 'Dr. Afonso Henriques';
    const allocationAed = 25000000;

    const brief = await generatePrivateBrief({
      mandateId,
      investorName,
      corridorKey: 'DUBAI_SOUTH_DWC',
      allocationAed,
      ownershipVehicle: 'INDIVIDUAL_DIRECT',
      publishEvent: true,
    });

    assert.strictEqual(brief.success, true);
    assert.strictEqual(brief.corridorKey, 'DUBAI_SOUTH_DWC');
    assert.strictEqual(brief.strategy, 'MACRO_INFRASTRUCTURE_HIGH_YIELD');
    assert.strictEqual(brief.allocationAed, 25000000);

    // Statutory: DLD 4% of 25M = 1,000,000; Sinking fund 1.50% of 25M = 375,000; Trustee = 4200; Oqood = 1000; Admin = 580
    assert.strictEqual(brief.statutoryValidation.totalStatutoryFeesAed, 1000000 + 375000 + 4200 + 1000 + 580);
    assert.ok(brief.financialSummary.capRate >= 7.0 && brief.financialSummary.capRate <= 9.5);
    assert.ok(brief.financialSummary.sevenYearIrr >= 11.0 && brief.financialSummary.sevenYearIrr <= 18.0);
    assert.deepStrictEqual(brief.financialSummary.irr7yBandPercent, [14.5, 16.5]);

    // Document Markdown verification
    assert.match(brief.documentMarkdown, /Dubai South & Al Maktoum International/);
    assert.match(brief.documentMarkdown, /Direct Individual Freehold Title Deed/);
    assert.match(brief.documentMarkdown, /AED 25,000,000/);
    assert.match(brief.documentMarkdown, /MACRO_INFRASTRUCTURE_HIGH_YIELD/);
  });

  test('4. Cryptographic SHA-256 Calculation & Tamper Verification', async () => {
    const brief = await generatePrivateBrief({
      mandateId: 'MND-SHA-TEST',
      investorName: 'Zhang Wei',
      corridorKey: 'PALM_JEBEL_ALI',
      allocationAed: 35000000,
      publishEvent: false,
    });

    // 1. Length and format check
    assert.strictEqual(typeof brief.documentSha256, 'string');
    assert.strictEqual(brief.documentSha256.length, 64);
    assert.match(brief.documentSha256, /^[a-f0-9]{64}$/);

    // 2. Exact match with independent hash computation
    const expectedHash = createHash('sha256').update(brief.documentMarkdown, 'utf8').digest('hex');
    assert.strictEqual(brief.documentSha256, expectedHash);
    assert.strictEqual(computeDocumentSha256(brief.documentMarkdown), expectedHash);

    // 3. Tamper detection: modified content must produce a different hash
    const tamperedMarkdown = brief.documentMarkdown.replace('AED 35,000,000', 'AED 99,000,000');
    const tamperedHash = computeDocumentSha256(tamperedMarkdown);
    assert.notStrictEqual(tamperedHash, brief.documentSha256);
  });

});
