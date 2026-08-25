/**
 * RAIOC OS - Integration Test: Autonomous Institutional Investment Memorandum Generator
 * Validates that an inbound lead of AED 15M generates a full 5-section institutional memorandum
 * with statutory Escrow Law 8 citations, DIFC Common Law asset shielding, and matching luxury assets in under 3 seconds.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { routeApiRequest } from '../../src/api/server.js';
import { memorandumGenerator } from '../../src/engines/memorandum-generator.js';

describe('INTEGRATION: Autonomous Institutional Memorandum Generator', () => {

  test('1. Inbound lead of AED 15M generates a 5-section institutional dossier in under 3 seconds', async () => {
    const startTime = Date.now();
    const payload = {
      name: 'Sheikh Al-Mansoor Family Office',
      email: 'investments@almansoor-holdings.ae',
      phone: '+971501234567',
      company: 'Al-Mansoor Sovereign Capital',
      budget_aed: 15000000,
      strategic_focus: 'off_plan_appreciation',
      tax_jurisdiction: 'UAE_FAMILY_OFFICE',
    };

    const res = await routeApiRequest(
      '/api/assessment',
      'POST',
      payload,
      {},
      { 'x-correlation-id': `corr_test_memo_${Date.now()}` }
    );

    const durationMs = Date.now() - startTime;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.status, 'INGESTED');
    assert.ok(durationMs < 3000, `Memorandum generation took ${durationMs}ms (must be < 3000ms)`);

    const brief = res.body.executiveBrief;
    assert.ok(brief, 'Executive brief must be present');
    assert.ok(brief.memorandum, 'Memorandum must be bound to executive brief');

    const memo = brief.memorandum;
    assert.ok(memo.id.startsWith('memo_'));
    assert.strictEqual(memo.budgetAed, 15000000);

    // Verify all 5 Sections
    const sections = memo.sections;
    assert.ok(sections.allocationThesis, 'Section 1: Allocation Thesis must be present');
    assert.ok(sections.statutoryShielding, 'Section 2: Statutory Shielding must be present');
    assert.ok(sections.projectMatrix, 'Section 3: Project Matrix must be present');
    assert.ok(sections.goldenVisa, 'Section 4: Golden Visa must be present');
    assert.ok(sections.difcCommonLaw, 'Section 5: DIFC Common Law must be present');

    // Verify statutory citations
    assert.ok(sections.statutoryShielding.legalBasis.includes('Law No. 8 of 2007'));
    assert.ok(sections.statutoryShielding.civilCodeBasis.includes('Article 880'));
    assert.ok(sections.goldenVisa.statute.includes('Resolution No. 65 of 2022'));
    assert.ok(sections.difcCommonLaw.governance.includes('DIFC'));

    // Verify luxury matching assets for AED 15M+
    const matchedNames = memo.matchingProjects.map((p) => p.name);
    assert.ok(
      matchedNames.some((n) => n.includes('Como Residences') || n.includes('Armani Beach') || n.includes('Sobha Estates')),
      `Expected ultra-prime assets for AED 15M+, got: ${matchedNames.join(', ')}`
    );

    // Verify Markdown length and citations
    assert.ok(memo.markdown.length > 500);
    assert.ok(memo.markdown.includes('Dubai Law No. 8 of 2007'));
    assert.ok(memo.markdown.includes('DIFC'));
  });

  test('2. Inbound lead of AED 2.5M matches high-yield growth assets with Escrow Law 8 guarantees', async () => {
    const payload = {
      name: 'Dr. Alexander Vance',
      email: 'alex.vance@techinvest.co.uk',
      phone: '+447911123456',
      company: 'Vance Advisory Group',
      budget_aed: 2500000,
      strategic_focus: 'high_net_yield',
    };

    const res = await routeApiRequest('/api/assessment', 'POST', payload);
    assert.strictEqual(res.status, 200);

    const memo = res.body.memorandum;
    assert.ok(memo);
    const matchedNames = memo.matchingProjects.map((p) => p.name);
    assert.ok(
      matchedNames.some((n) => n.includes('Valia') || n.includes('Rosehill') || n.includes('Palace Creek Blue') || n.includes('Sobha Skyscape')),
      `Expected growth assets for AED 2.5M, got: ${matchedNames.join(', ')}`
    );
  });

  test('3. Public viewer /brief/:id renders full Institutional Memorandum HTML', async () => {
    // Generate a brief
    const memo = memorandumGenerator.generate({
      company: 'Sovereign Wealth Holdings',
      name: 'Lord Henry Sterling',
      budget_aed: 25000000,
    });

    const res = await routeApiRequest(`/brief/${memo.id}`, 'GET');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['Content-Type'], 'text/html; charset=utf-8');

    const html = res.body;
    assert.ok(html.includes('DUBAI LAW NO. 8 OF 2007'));
    assert.ok(html.includes('UAE Cabinet Resolution No. 65 of 2022'));
    assert.ok(html.includes('DIFC COMMON LAW JURISDICTION'));
    assert.ok(html.includes('Prime Institutional Assets (Manus Off-Plan)'));
    assert.ok(html.includes('Book Private Briefing'));
  });

  test('4. Direct memorandum generator performance benchmark (< 50ms)', () => {
    const t0 = Date.now();
    const memo = memorandumGenerator.generate({
      company: 'Apex Multi-Family Office',
      budget: '15M+',
    });
    const duration = Date.now() - t0;

    assert.ok(memo.id);
    assert.strictEqual(memo.sections.projectMatrix.totalAllocations > 0, true);
    assert.ok(duration < 50, `Generator took ${duration}ms, expected < 50ms`);
  });

  test('5. Tier 1/2 leads (RIIS >= 70) receive full multimodal video package and audio briefing metadata', async () => {
    const payload = {
      name: 'Princess Ameera Al-Sabah',
      email: 'ameera@alsabah-investments.kw',
      phone: '+96590001234',
      company: 'Al-Sabah Sovereign Holdings',
      budget_aed: 30000000,
      strategic_focus: 'off_plan_appreciation',
    };

    const res = await routeApiRequest('/api/assessment', 'POST', payload);
    assert.strictEqual(res.status, 200);

    const brief = res.body.executiveBrief;
    assert.ok(brief.multimodal, 'Multimodal package must be present');
    assert.strictEqual(brief.multimodal.qualified, true);
    assert.strictEqual(brief.multimodal.tier, 'MULTIMODAL_TIER_1');

    // Video Reel validation
    const primaryVideo = brief.primaryVideo;
    assert.ok(primaryVideo, 'Primary video must be present');
    assert.ok(primaryVideo.videoUrl.includes('youtube') || primaryVideo.videoUrl.includes('http'));
    assert.ok(primaryVideo.videoTitle);
    assert.ok(primaryVideo.videoDuration);

    // Audio Briefing validation
    const audioBriefing = brief.audioBriefing;
    assert.ok(audioBriefing, 'Audio briefing must be present');
    assert.ok(audioBriefing.scriptText.includes('Dubai Law Number 8 of 2007'));
    assert.ok(audioBriefing.scriptText.includes('Resolution Number 65 of 2022'));
    assert.strictEqual(audioBriefing.chapters.length >= 4, true);
  });

  test('6. Public viewer /brief/:id renders multimodal video showcase and audio briefing player', async () => {
    const memo = memorandumGenerator.generate({
      company: 'Emirates Sovereign Capital',
      name: 'His Excellency Mohammed Al-Falasi',
      budget_aed: 22000000,
    });

    const res = await routeApiRequest(`/brief/${memo.id}`, 'GET');
    assert.strictEqual(res.status, 200);

    const html = res.body;
    assert.ok(html.includes('MULTIMODAL AUDIO BRIEFING'));
    assert.ok(html.includes('Executive Briefing Audio Summary'));
    assert.ok(html.includes('CINEMATIC MASTERPLAN TOUR'));
    assert.ok(html.includes('4K Architectural &amp; Masterplan Showcase') || html.includes('4K Architectural & Masterplan Showcase'));
    assert.ok(html.includes('toggleAudioBriefing()'));
  });

});
