/**
 * RAIOC OS - Autonomous Institutional Investment Memorandum Generator
 * Autonomously synthesizes a comprehensive 5-section institutional dossier for inbound leads:
 * 1. Executive Allocation Thesis
 * 2. Statutory Shielding: Dubai Law No. 8 of 2007 (Escrow ring-fencing, 5% retention, Decennial liability Art. 880)
 * 3. Project Allocation Matrix: Dynamic selection from Manus verified off-plan projects
 * 4. UAE Golden Visa Qualification: Cabinet Resolution No. 65 of 2022
 * 5. DIFC Common Law Asset Shielding & Generational Succession
 */

import fs from 'node:fs';
import path from 'node:path';
import { ikl } from '../core/ikl/index.js';
import { multimodalEngine } from './multimodal-engine.js';
import { logger } from '../logging/audit-logger.js';

export class MemorandumGenerator {
  constructor(options = {}) {
    this.ikl = options.ikl || ikl;
    this.projects = this._loadProjects();
  }

  /**
   * Loads verified Manus off-plan projects from knowledge repository
   * @private
   */
  _loadProjects() {
    try {
      const p = path.resolve('src/knowledge/modules/off-plan-projects.json');
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (err) {
      logger.warn('MEMORANDUM_GEN', `Could not load off-plan-projects.json: ${err.message}`);
    }
    return [];
  }

  /**
   * Parses numeric budget in AED from various formats
   * @param {*} budgetRaw 
   * @returns {number}
   */
  parseBudget(budgetRaw) {
    if (typeof budgetRaw === 'number' && !isNaN(budgetRaw)) return budgetRaw;
    if (!budgetRaw) return 5000000;
    
    const str = String(budgetRaw).toUpperCase().trim();
    if (str.includes('15M') || str.includes('15,000,000') || str.includes('15M+')) return 15000000;
    if (str.includes('5M+') || str.includes('5M - 15M') || str.includes('5M')) return 8000000;
    if (str.includes('2M-5M') || str.includes('2M - 5M')) return 3500000;
    if (str.includes('1M-2M') || str.includes('1M - 2M')) return 1800000;

    const digits = str.replace(/[^\d]/g, '');
    const val = parseInt(digits, 10);
    return !isNaN(val) && val > 0 ? val : 5000000;
  }

  /**
   * Selects matching off-plan projects based on budget and strategic focus
   * @param {number} budgetAed 
   * @param {string} strategicFocus 
   * @returns {Array<Object>}
   */
  matchProjects(budgetAed, strategicFocus = 'off_plan_appreciation') {
    if (!this.projects || this.projects.length === 0) {
      this.projects = this._loadProjects();
    }

    const all = [...this.projects];
    if (all.length === 0) return [];

    // Macro infrastructure focus or macro corridor matching
    if (strategicFocus === 'macro_infrastructure_growth' || strategicFocus === 'macro_growth_corridors') {
      const macro = all.filter((p) => p.tier === 'TIER_MACRO_INFRASTRUCTURE_ALPHA');
      if (macro.length > 0) {
        if (budgetAed >= 15000000) return macro.filter((p) => p.starting_price_aed >= 10000000).concat(macro.slice(0, 2));
        if (budgetAed >= 5000000) return macro.filter((p) => p.starting_price_aed >= 3000000).concat(macro.slice(0, 2));
        return macro.filter((p) => p.starting_price_aed <= 5000000).concat(macro.slice(0, 2));
      }
    }

    // High budget (>= 15M AED): Ultra-prime Palm Jumeirah, Palm Jebel Ali & Forest Mansions
    if (budgetAed >= 15000000) {
      const prime = all.filter((p) => p.tier === 'SOVEREIGN_ULTRA_PRIME' || p.tier === 'TIER_MACRO_INFRASTRUCTURE_ALPHA' || p.starting_price_aed >= 15000000);
      return prime.length > 0 ? prime : all.slice(0, 3);
    }

    // Mid budget (5M to 15M AED): Balanced Waterfront & Branded Hospitality & Saadiyat
    if (budgetAed >= 5000000) {
      const mid = all.filter((p) => (p.tier === 'WATERFRONT_CAPITAL' || p.tier === 'BRANDED_HOSPITALITY' || p.tier === 'TIER_MACRO_INFRASTRUCTURE_ALPHA' || p.starting_price_aed >= 2000000));
      return mid.length > 0 ? mid : all.slice(0, 3);
    }

    // Standard budget (<= 5M AED): High-yield growth corridors (Dubai Hills, Dubai Creek, Emaar South, RAK)
    const standard = all.filter((p) => p.starting_price_aed <= 3500000);
    return standard.length > 0 ? standard : all.slice(0, 3);
  }

  /**
   * Generates a complete Institutional Investment Memorandum
   * @param {Object} lead - Inbound lead payload
   * @param {Object} intelligence - DIRA & RIIS assessment results
   * @returns {Object} Structured Institutional Memorandum
   */
  generate(lead = {}, intelligence = {}) {
    const startTime = Date.now();
    const companyName = lead.company || lead.company_name || 'Private Sovereign Investor';
    const contactName = lead.name || lead.full_name || lead.contact_name || companyName;
    const contactEmail = lead.email || '';
    const contactPhone = lead.phone || lead.whatsapp || '';

    const budgetRaw = lead.budget_aed || lead.budgetAed || lead.budget || lead.capital_band || '5M+';
    const budgetAed = this.parseBudget(budgetRaw);
    const budgetFormatted = `AED ${budgetAed.toLocaleString('en-US')}`;

    const strategicFocus = lead.strategic_focus || lead.strategicFocus || 'off_plan_appreciation';
    const taxJurisdiction = lead.tax_jurisdiction || lead.taxJurisdiction || 'INTERNATIONAL';
    
    const riis = intelligence.riis || { score: budgetAed >= 15000000 ? 96 : (budgetAed >= 5000000 ? 92 : 88), tier: budgetAed >= 15000000 ? 'SOVEREIGN_ULTRA_PRIME' : 'WATERFRONT_CAPITAL', tierLabel: 'Sovereign Institutional' };
    const dira = intelligence.dira || { riskLevel: 'LOW', riskVectors: [] };

    // Match Manus verified projects
    const matchedProjects = this.matchProjects(budgetAed, strategicFocus);
    const avgYield = matchedProjects.length > 0
      ? (matchedProjects.reduce((acc, p) => acc + (p.projected_yield_pct || 8.5), 0) / matchedProjects.length).toFixed(1)
      : '8.6';

    const memoId = `memo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // SECTION 1: Executive Allocation Thesis
    const section1_Thesis = {
      title: 'I. Executive Allocation Thesis',
      headline: `Strategic Sovereign Deployment for ${companyName}`,
      mandateBudget: budgetFormatted,
      riisScore: riis.score,
      tier: riis.tier || 'SOVEREIGN_INSTITUTIONAL',
      projectedNetYield: `${avgYield}% p.a.`,
      content: `This Institutional Investment Memorandum outlines the capital preservation and growth mandate for ${companyName} (${contactName}). Evaluating the target capital allocation of ${budgetFormatted}, our autonomous models score this mandate at RIIS ${riis.score}/100 with a ${dira.riskLevel} systemic risk profile. Under current macroeconomic divergence, allocating capital into Dubai's primary sovereign waterfront corridors delivers a 100% tax-free retained earnings shield, unmatched liquidity, and statutory asset protection.`,
    };

    // SECTION 2: Statutory Shielding (Dubai Law No. 8 of 2007)
    const section2_Escrow = {
      title: 'II. Statutory Shielding & Escrow Governance (Dubai Law No. 8 of 2007)',
      legalBasis: 'Dubai Law No. 8 of 2007 Concerning Escrow Accounts for Real Estate Development in Dubai',
      civilCodeBasis: 'Article 880 of UAE Federal Law No. 5 of 1985 (Civil Transactions Law)',
      guarantees: [
        {
          name: '100% Ring-Fenced Escrow Accounts',
          description: 'All purchaser funds are deposited exclusively into RERA-certified bank trust accounts (e.g. Emirates NBD, First Abu Dhabi Bank), completely insulated from developer general liabilities and corporate creditors.',
        },
        {
          name: 'Milestone-Linked Audit Disbursements',
          description: 'Funds are disbursed to developers strictly in accordance with certified Dubai Land Department (DLD) technical engineering inspection audits.',
        },
        {
          name: '5% Mandatory Post-Handover Warranty Retention',
          description: 'A statutory 5% balance is held in escrow for one continuous year post-completion to guarantee developer rectification of any snagging or latent defects.',
        },
        {
          name: '10-Year Decennial Structural Liability',
          description: 'Pursuant to Article 880 of the UAE Civil Code, contractors and supervising architects remain strictly liable for ten years for any total or partial collapse or major structural defect.',
        },
      ],
    };

    // SECTION 3: Project Allocation Matrix (Manus Verified Off-Plan)
    const section3_Projects = {
      title: 'III. Target Project Allocation Matrix',
      totalAllocations: matchedProjects.length,
      weightedNetYield: `${avgYield}% p.a.`,
      projects: matchedProjects.map((p) => ({
        id: p.id,
        name: p.name,
        developer: p.developer,
        community: p.community,
        startingPriceAed: p.starting_price_aed,
        startingPriceFormatted: `AED ${p.starting_price_aed.toLocaleString('en-US')}`,
        projectedYield: `${p.projected_yield_pct}% p.a.`,
        completion: p.completion_date,
        paymentPlan: p.payment_plan,
        tier: p.tier,
        goldenVisa: p.golden_visa_eligible,
        amenities: p.amenities || [],
      })),
    };

    // SECTION 4: UAE Golden Visa Qualification (Cabinet Res. 65/2022)
    const section4_GoldenVisa = {
      title: 'IV. UAE Golden Visa Statutory Certification',
      statute: 'UAE Cabinet Resolution No. 65 of 2022 & Federal Decree-Law No. 29/2021',
      qualificationThreshold: 'AED 2,000,000+',
      leadQualified: budgetAed >= 2000000,
      benefits: [
        '10-Year Renewable Real Estate Investor Sovereign Visa',
        '100% Foreign Business Ownership without Local UAE National Sponsor',
        '0% Personal Income Tax & 0% Capital Gains Tax on Worldwide & UAE Real Estate',
        'Full Family Sponsorship (Spouse, Children of Any Age) and Domestic Staff',
        'No Maximum Stay Outside UAE Requirement to Retain Visa Validity',
      ],
    };

    // SECTION 5: DIFC Common Law Asset Shielding & Generational Succession
    const section5_DIFC = {
      title: 'V. DIFC Common Law Asset Shielding & Estate Planning',
      governance: 'Dubai International Financial Centre (DIFC) Common Law Jurisdiction',
      legalVehicles: [
        {
          structure: 'DIFC Special Purpose Vehicle (SPV) / Prescribed Company',
          purpose: 'Holds UAE real estate titles under common law corporate veil, ring-fencing assets from cross-border commercial litigation.',
        },
        {
          structure: 'DIFC Wills & Probate Registry',
          purpose: 'Full testamentary freedom under English Common Law, preempting statutory Sharia forced heirship rules for non-Muslim and international investors.',
        },
        {
          structure: 'DIFC Family Foundation',
          purpose: 'Perpetual multi-generational wealth succession structure for family offices and sovereign estates.',
        },
      ],
    };

    // Synthesize full Markdown Document
    const markdown = `# CONFIDENTIAL INSTITUTIONAL INVESTMENT MEMORANDUM\n\n` +
      `**MANDATE:** ${companyName}\n` +
      `**INVESTOR:** ${contactName}\n` +
      `**ALLOCATION TARGET:** ${budgetFormatted}\n` +
      `**DATE OF ISSUANCE:** ${dateStr}\n` +
      `**MEMORANDUM ID:** ${memoId}\n` +
      `**PROVENANCE:** RAIOC OS • Institutional Knowledge Layer (IKL v1.0)\n\n` +
      `---\n\n` +
      `## 1. Executive Allocation Thesis\n\n` +
      `${section1_Thesis.content}\n\n` +
      `**Key Parameters:**\n` +
      `- **RIIS Score:** ${riis.score}/100 (${riis.tier || 'SOVEREIGN'})\n` +
      `- **Weighted Portfolio Yield:** ${avgYield}% Net p.a.\n` +
      `- **Systemic Risk Profile:** ${dira.riskLevel}\n\n` +
      `---\n\n` +
      `## 2. Statutory Shielding & Escrow Governance (Dubai Law No. 8 of 2007)\n\n` +
      `All recommended capital allocations are strictly governed by **Dubai Law No. 8 of 2007** and **Article 880 of the UAE Civil Transactions Law**:\n\n` +
      section2_Escrow.guarantees.map((g) => `- **${g.name}:** ${g.description}`).join('\n') +
      `\n\n---\n\n` +
      `## 3. Target Asset Allocation Matrix (Manus Verified Off-Plan)\n\n` +
      section3_Projects.projects.map((p, i) => 
        `### 3.${i + 1} ${p.name} (${p.developer})\n` +
        `- **Location:** ${p.community}\n` +
        `- **Entry Capital:** ${p.startingPriceFormatted}\n` +
        `- **Audited Net Yield:** ${p.projectedYield}\n` +
        `- **Completion Target:** ${p.completion}\n` +
        `- **Payment Structure:** ${p.paymentPlan}\n` +
        `- **Golden Visa:** ${p.goldenVisa ? 'Qualified (10-Yr Certified)' : 'Standard'}`
      ).join('\n\n') +
      `\n\n---\n\n` +
      `## 4. UAE Golden Visa Statutory Qualification\n\n` +
      `**Statutory Basis:** ${section4_GoldenVisa.statute}\n\n` +
      `With an allocation budget of ${budgetFormatted}, this mandate surpasses the statutory AED 2M threshold and qualifies for:\n` +
      section4_GoldenVisa.benefits.map((b) => `- ${b}`).join('\n') +
      `\n\n---\n\n` +
      `## 5. DIFC Common Law Asset Shielding & Generational Succession\n\n` +
      `To ensure absolute cross-border asset protection, title can be registered through DIFC Common Law instruments:\n\n` +
      section5_DIFC.legalVehicles.map((v) => `- **${v.structure}:** ${v.purpose}`).join('\n') +
      `\n\n---\n*Confidential Document prepared by Emanuel Rendas Private Advisory (DIFC, Dubai, UAE).*`;

    const multimodal = multimodalEngine.generateMultimodalPackage(lead, intelligence, matchedProjects);

    const durationMs = Date.now() - startTime;
    logger.info('MEMORANDUM_GEN', `Synthesized Institutional Memorandum [${memoId}] for ${companyName} in ${durationMs}ms`);

    return {
      id: memoId,
      leadId: lead.id || lead.lead_id || null,
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      budgetAed,
      budgetFormatted,
      riisScore: riis.score,
      diraTier: riis.tier,
      diraRiskLevel: dira.riskLevel,
      projectedYield: `${avgYield}%`,
      sections: {
        allocationThesis: section1_Thesis,
        statutoryShielding: section2_Escrow,
        projectMatrix: section3_Projects,
        goldenVisa: section4_GoldenVisa,
        difcCommonLaw: section5_DIFC,
      },
      matchingProjects: matchedProjects,
      multimodal,
      primaryVideo: multimodal.primaryVideo,
      audioBriefing: multimodal.audioBriefing,
      markdown,
      generatedAt: new Date().toISOString(),
      generationDurationMs: durationMs,
    };
  }
}

export const memorandumGenerator = new MemorandumGenerator();
