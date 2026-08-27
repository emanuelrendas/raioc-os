/**
 * RAIOC OS - Unit Test Suite: Internationalization (i18n) Fiduciary Pipeline
 * 
 * Validates:
 * 1. Correct resolution of AIDA fiduciary objection scripts in 'en' (primary) and 'pt' (secondary).
 * 2. Generation of Private Investment Brief (One-Pager) in English by default and Portuguese when requested.
 * 3. VIP Post-Approval Dispatch message formatting with GST (Dubai), BST (London), EST (New York) timezones,
 *    and cryptographic SHA-256 integrity verification.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  getFiduciaryTemplate,
  listFiduciaryTemplates,
  synthesizeFiduciaryVoiceNote,
} from '../../src/services/aida-voice-service.js';
import {
  generatePrivateBrief,
  computeDocumentSha256,
} from '../../src/services/investment-brief-generator.js';
import {
  renderPrivateInvestmentBrief,
  sanitizeBriefData,
} from '../../src/templates/investment-brief-template.js';
import {
  formatVipPostApprovalDispatch,
  computeVipMessageSha256,
  VIP_DISPATCH_CONFIG,
} from '../../src/services/vip-dispatch-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('🌐 Canonical Internationalization (i18n) Fiduciary Suite', () => {

  test('1. AIDA Multi-Locale Voice Scripts Resolution (English Primary & Portuguese Secondary)', async () => {
    // 1a. English Resolution (Default / Primary)
    const law8En = getFiduciaryTemplate('OBJ_OFFPLAN_ESCROW_LAW8', 'en');
    assert.strictEqual(law8En.locale, 'en');
    assert.strictEqual(law8En.language, 'en');
    assert.match(law8En.text, /Law Number Eight of Two Thousand and Seven/i);
    assert.match(law8En.text, /segregated Escrow trust account/i);
    assert.match(law8En.text, /Dubai Land Department and RERA/i);

    const art880En = getFiduciaryTemplate('OBJ_STRUCTURAL_CIVIL_880', 'en');
    assert.strictEqual(art880En.locale, 'en');
    assert.match(art880En.text, /Article Eight Hundred and Eighty of the UAE Civil Code/i);
    assert.match(art880En.text, /Decennial Liability/i);

    const res65En = getFiduciaryTemplate('OBJ_GOLDEN_VISA_RES65', 'en');
    assert.strictEqual(res65En.locale, 'en');
    assert.match(res65En.text, /Cabinet Resolution Number Sixty-Five/i);
    assert.match(res65En.text, /two million dirham threshold/i);

    // 1b. Portuguese Resolution (Secondary)
    const law8Pt = getFiduciaryTemplate('OBJ_OFFPLAN_ESCROW_LAW8', 'pt');
    assert.strictEqual(law8Pt.locale, 'pt');
    assert.strictEqual(law8Pt.language, 'pt');
    assert.match(law8Pt.text, /Lei número oito de dois mil e sete/i);
    assert.match(law8Pt.text, /Escrow segregada/i);

    const art880Pt = getFiduciaryTemplate('OBJ_STRUCTURAL_CIVIL_880', 'pt');
    assert.strictEqual(art880Pt.locale, 'pt');
    assert.match(art880Pt.text, /Artigo oitocentos e oitenta do Código Civil/i);
    assert.match(art880Pt.text, /Responsabilidade Decenal obrigatória/i);

    const res65Pt = getFiduciaryTemplate('OBJ_GOLDEN_VISA_RES65', 'pt');
    assert.strictEqual(res65Pt.locale, 'pt');
    assert.match(res65Pt.text, /Resolução de Gabinete número sessenta e cinco/i);
    assert.match(res65Pt.text, /dois milhões de dirhams/i);

    // 1c. Listing templates by locale
    const allEn = listFiduciaryTemplates('en');
    assert.strictEqual(allEn.length, 3);
    assert.ok(allEn.every(t => t.locale === 'en'));

    const allPt = listFiduciaryTemplates('pt');
    assert.strictEqual(allPt.length, 3);
    assert.ok(allPt.every(t => t.locale === 'pt'));
  });

  test('2. AIDA Voice Note Synthesis with Multi-Locale Support', async () => {
    // English Synthesis
    const synthEn = await synthesizeFiduciaryVoiceNote({
      templateId: 'OBJ_OFFPLAN_ESCROW_LAW8',
      recipient: 'Lord Alistair Sterling',
      budgetAed: 50000000,
      locale: 'en',
    });
    assert.strictEqual(synthEn.success, true);
    assert.strictEqual(synthEn.locale, 'en');
    assert.strictEqual(synthEn.language, 'en');
    assert.match(synthEn.text, /Law Number Eight of Two Thousand and Seven/i);
    assert.strictEqual(synthEn.cloudEvent.data.locale, 'en');

    // Portuguese Synthesis
    const synthPt = await synthesizeFiduciaryVoiceNote({
      templateId: 'OBJ_OFFPLAN_ESCROW_LAW8',
      recipient: 'Dr. Afonso Henriques',
      budgetAed: 30000000,
      locale: 'pt',
    });
    assert.strictEqual(synthPt.success, true);
    assert.strictEqual(synthPt.locale, 'pt');
    assert.strictEqual(synthPt.language, 'pt');
    assert.match(synthPt.text, /Lei número oito de dois mil e sete/i);
    assert.strictEqual(synthPt.cloudEvent.data.locale, 'pt');
  });

  test('3. Private Investment Brief One-Pager: English Default & Portuguese Option', async () => {
    // 3a. English Default Generation
    const briefEn = await generatePrivateBrief({
      mandateId: 'MND-I18N-EN-50M',
      investorName: 'Baroness Victoria Vance',
      corridorKey: 'PALM_JEBEL_ALI',
      allocationAed: 50000000,
      ownershipVehicle: 'SPV_DIFC_ADGM',
      locale: 'en',
      publishEvent: false,
    });

    assert.strictEqual(briefEn.success, true);
    assert.strictEqual(briefEn.locale, 'en');
    assert.match(briefEn.documentMarkdown, /# 🏛 PRIVATE INVESTMENT BRIEF \(ONE-PAGER\)/);
    assert.match(briefEn.documentMarkdown, /### I\. EXECUTIVE ALLOCATION & CORRIDOR VECTOR/);
    assert.match(briefEn.documentMarkdown, /### II\. DETERMINISTIC FINANCIAL BENCHMARKS & RETURN PROFILE/);
    assert.match(briefEn.documentMarkdown, /### III\. STATUTORY ACQUISITION BREAKDOWN/);
    assert.match(briefEn.documentMarkdown, /### IV\. STATUTORY COMPLIANCE & SOVEREIGN SHIELD \(LEX VERIFIED\)/);
    assert.match(briefEn.documentMarkdown, /### V\. FIDUCIARY ATTESTATION & ADVISORY SEAL/);
    assert.match(briefEn.documentMarkdown, /Dubai Land Department Transfer \(4\.0%\):\*\* AED 2,000,000/);

    // 3b. Portuguese Generation
    const briefPt = await generatePrivateBrief({
      mandateId: 'MND-I18N-PT-35M',
      investorName: 'Dr. Afonso Henriques',
      corridorKey: 'PALM_JEBEL_ALI',
      allocationAed: 35000000,
      ownershipVehicle: 'SPV_DIFC_ADGM',
      locale: 'pt',
      publishEvent: false,
    });

    assert.strictEqual(briefPt.success, true);
    assert.strictEqual(briefPt.locale, 'pt');
    assert.match(briefPt.documentMarkdown, /# 🏛 DOSSIÊ DE INVESTIMENTO PRIVADO \(ONE-PAGER\)/);
    assert.match(briefPt.documentMarkdown, /### I\. ALOCAÇÃO EXECUTIVA & VETOR DE CORREDOR/);
    assert.match(briefPt.documentMarkdown, /### II\. BENCHMARKS FINANCEIROS DETERMINÍSTICOS & PERFIL DE RETORNO/);
    assert.match(briefPt.documentMarkdown, /### III\. DETALHAMENTO ESTATUTÁRIO DE AQUISIÇÃO/);
    assert.match(briefPt.documentMarkdown, /### IV\. CONFORMIDADE ESTATUTÁRIA & BLINDAGEM SOBERANA \(AUDITADO POR LEX\)/);
    assert.match(briefPt.documentMarkdown, /### V\. ATESTAÇÃO FIDUCIÁRIA & SELO CONSULTIVO/);
    assert.match(briefPt.documentMarkdown, /Registo Dubai Land Department \(4\.0%\):\*\* AED 1,400,000/);
  });

  test('4. VIP Post-Approval Dispatch Formatting with GST, BST & EST Timezones', async () => {
    // 4a. Configuration File Integrity
    const vipConfigPath = join(__dirname, '../../src/config/vip-dispatch-templates.json');
    assert.ok(existsSync(vipConfigPath), 'vip-dispatch-templates.json must exist');
    const rawConfig = JSON.parse(readFileSync(vipConfigPath, 'utf-8'));
    assert.strictEqual(rawConfig.schema, 'RAIOC_VIP_DISPATCH_V1');
    assert.ok(rawConfig.timezones.GST, 'Must define GST timezone');
    assert.ok(rawConfig.timezones.BST, 'Must define BST timezone');
    assert.ok(rawConfig.timezones.EST, 'Must define EST timezone');

    // 4b. English VIP Dispatch Formatting
    const dispatchEn = formatVipPostApprovalDispatch({
      mandateId: 'MND-SOV-50M-STERLING',
      investorName: 'Lord Alistair Sterling',
      corridorName: 'Palm Jebel Ali Sovereign Frond',
      corridorKey: 'PALM_JEBEL_ALI',
      allocationAed: 50000000,
      ownershipVehicle: 'DIFC Special Purpose Vehicle (SPV)',
      briefId: 'PIB-STERLING-001',
      documentSha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      locale: 'en',
    });

    assert.strictEqual(dispatchEn.success, true);
    assert.strictEqual(dispatchEn.locale, 'en');
    assert.match(dispatchEn.subject, /Executive Clearance Granted: Sovereign Mandate MND-SOV-50M-STERLING/);
    assert.match(dispatchEn.messageText, /PRIVATE EXECUTIVE DISPATCH · EMANUEL RENDAS ADVISORY/);
    assert.match(dispatchEn.messageText, /Dear Lord Alistair Sterling,/);
    assert.match(dispatchEn.messageText, /AED 50,000,000/);
    assert.match(dispatchEn.messageText, /Dubai \(GST, UTC\+4\): 10:00 – 19:00 GST/);
    assert.match(dispatchEn.messageText, /London \(BST, UTC\+1\): 07:00 – 16:00 BST/);
    assert.match(dispatchEn.messageText, /New York \(EST, UTC-5\): 06:00 – 11:00 EST/);
    assert.match(dispatchEn.messageText, /`a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0`/);

    // Cryptographic SHA-256 Digest
    assert.strictEqual(typeof dispatchEn.messageSha256, 'string');
    assert.strictEqual(dispatchEn.messageSha256.length, 64);
    assert.strictEqual(dispatchEn.messageSha256, computeVipMessageSha256(dispatchEn.messageText));

    // 4c. Portuguese VIP Dispatch Formatting
    const dispatchPt = formatVipPostApprovalDispatch({
      mandateId: 'MND-SOV-30M-HENRIQUES',
      investorName: 'Dr. Afonso Henriques',
      corridorName: 'Dubai South & Al Maktoum International',
      corridorKey: 'DUBAI_SOUTH_DWC',
      allocationAed: 30000000,
      ownershipVehicle: 'Direta Individual Freehold',
      briefId: 'PIB-HENRIQUES-002',
      documentSha256: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      locale: 'pt',
    });

    assert.strictEqual(dispatchPt.success, true);
    assert.strictEqual(dispatchPt.locale, 'pt');
    assert.match(dispatchPt.subject, /Aprovação Executiva Concedida: Mandato Soberano MND-SOV-30M-HENRIQUES/);
    assert.match(dispatchPt.messageText, /DESPACHO EXECUTIVO VIP · EMANUEL RENDAS ADVISORY/);
    assert.match(dispatchPt.messageText, /Prezado\(a\) Dr\. Afonso Henriques,/);
    assert.match(dispatchPt.messageText, /AED 30,000,000/);
    assert.match(dispatchPt.messageText, /Dubai \(GST, UTC\+4\): 10:00 – 19:00 GST/);
    assert.match(dispatchPt.messageText, /Londres \(BST, UTC\+1\): 07:00 – 16:00 BST/);
    assert.match(dispatchPt.messageText, /Nova Iorque \(EST, UTC-5\): 06:00 – 11:00 EST/);
    assert.strictEqual(dispatchPt.messageSha256.length, 64);
  });

});
