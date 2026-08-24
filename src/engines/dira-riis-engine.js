/**
 * RAIOC OS - DIRA & RIIS Intelligence Engine
 * DIRA: Deep Intelligence Risk Analysis
 * RIIS: Rendas Intelligence Index System
 */

export class DiraRiisEngine {
  /**
   * Computes the RIIS (Rendas Intelligence Index Score) from lead and assessment inputs
   * @param {Object} input - Assessment or lead answers
   * @returns {Object} RIIS computation result
   */
  evaluateRiis(input = {}) {
    let score = 50; // Base score
    const factors = [];

    // Factor 1: Company Size / Revenue Scale
    const companySize = (input.company_size || input.employees || '').toString().toLowerCase();
    if (companySize.includes('500+') || companySize.includes('enterprise') || companySize.includes('100-500')) {
      score += 20;
      factors.push({ name: 'Enterprise Scale', impact: '+20' });
    } else if (companySize.includes('20-99') || companySize.includes('50-200')) {
      score += 12;
      factors.push({ name: 'Mid-Market Scale', impact: '+12' });
    } else if (companySize.includes('1-19') || companySize.includes('startup')) {
      score += 5;
      factors.push({ name: 'Startup / Lean Scale', impact: '+5' });
    }

    // Factor 2: AI & Automation Maturity
    const maturity = (input.ai_maturity || input.automation_level || '').toString().toLowerCase();
    if (maturity.includes('advanced') || maturity.includes('in_production')) {
      score += 15;
      factors.push({ name: 'Advanced AI Infrastructure', impact: '+15' });
    } else if (maturity.includes('piloting') || maturity.includes('experimenting')) {
      score += 10;
      factors.push({ name: 'Active AI Pilot Phase', impact: '+10' });
    } else if (maturity.includes('manual') || maturity.includes('none')) {
      score += 5;
      factors.push({ name: 'High Green-Field Potential', impact: '+5' });
    }

    // Factor 3: Operational Bottlenecks / Complexity
    const bottlenecks = (input.bottlenecks || input.challenges || '').toString().toLowerCase();
    if (bottlenecks.includes('scale') || bottlenecks.includes('data') || bottlenecks.includes('latency')) {
      score += 10;
      factors.push({ name: 'High-Impact Scale Bottleneck', impact: '+10' });
    }

    // Factor 4: Budget / Timeline Urgency
    const timeline = (input.timeline || input.urgency || '').toString().toLowerCase();
    if (timeline.includes('immediate') || timeline.includes('1_month') || timeline.includes('asap')) {
      score += 15;
      factors.push({ name: 'Immediate Deployment Priority', impact: '+15' });
    } else if (timeline.includes('quarter') || timeline.includes('3_months')) {
      score += 8;
      factors.push({ name: 'Q1 Target Priority', impact: '+8' });
    }

    // Clamp score to 0 - 100
    const finalScore = Math.min(100, Math.max(0, score));

    let tier = 'TIER_4_EXPLORATORY';
    let tierLabel = 'Exploratory Candidate';
    if (finalScore >= 80) {
      tier = 'TIER_1_STRATEGIC';
      tierLabel = 'Strategic Enterprise Operating Candidate';
    } else if (finalScore >= 65) {
      tier = 'TIER_2_ACCELERATOR';
      tierLabel = 'Growth Acceleration Candidate';
    } else if (finalScore >= 50) {
      tier = 'TIER_3_FOUNDATION';
      tierLabel = 'Foundational Modernization Candidate';
    }

    return {
      score: finalScore,
      tier,
      tierLabel,
      factors,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Computes DIRA (Deep Intelligence Risk Analysis)
   * @param {Object} input - Lead data & assessment details
   * @param {Object} riis - Computed RIIS score
   * @returns {Object} DIRA Risk evaluation
   */
  evaluateDira(input = {}, riis = {}) {
    const riskVectors = [];
    let riskPoints = 0;

    // Vector 1: Data Architecture Risk
    const dataStack = (input.data_stack || input.tech_stack || '').toString().toLowerCase();
    if (!dataStack || dataStack.includes('spreadsheets') || dataStack.includes('legacy')) {
      riskPoints += 30;
      riskVectors.push({
        vector: 'Data Silo & Fragmentation',
        severity: 'HIGH',
        recommendation: 'Deploy automated Supabase ingestion pipeline and centralized ETL normalization.',
      });
    } else {
      riskVectors.push({
        vector: 'Modern Cloud Architecture',
        severity: 'LOW',
        recommendation: 'Directly hook into existing cloud event bus.',
      });
    }

    // Vector 2: Process Latency & Manual Overhead
    const manualWork = (input.manual_hours || input.operational_overhead || '').toString().toLowerCase();
    if (manualWork.includes('high') || manualWork.includes('40+') || manualWork.includes('critical')) {
      riskPoints += 25;
      riskVectors.push({
        vector: 'Manual Process Bottleneck',
        severity: 'CRITICAL',
        recommendation: 'Automate high-frequency decision loops via RAIOC autonomous agents.',
      });
    }

    // Vector 3: Security & Governance Compliance
    const compliance = (input.compliance || input.industry || '').toString().toLowerCase();
    if (compliance.includes('fintech') || compliance.includes('healthcare') || compliance.includes('banking')) {
      riskPoints += 20;
      riskVectors.push({
        vector: 'Regulatory & Data Governance',
        severity: 'MODERATE',
        recommendation: 'Enforce end-to-end telemetry and immutable audit logging on every cycle.',
      });
    }

    let riskLevel = 'LOW';
    if (riskPoints >= 50) riskLevel = 'CRITICAL';
    else if (riskPoints >= 30) riskLevel = 'HIGH';
    else if (riskPoints >= 15) riskLevel = 'MODERATE';

    return {
      riskScore: riskPoints,
      riskLevel,
      riskVectors,
      readinessGrade: riis.score >= 75 ? 'A+' : riis.score >= 50 ? 'B' : 'C',
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Full comprehensive analysis combining RIIS and DIRA
   */
  analyze(leadOrAssessment = {}) {
    const riis = this.evaluateRiis(leadOrAssessment);
    const dira = this.evaluateDira(leadOrAssessment, riis);
    return {
      riis,
      dira,
      compositeScore: Math.round((riis.score + (100 - dira.riskScore)) / 2),
      recommendedTrack: riis.score >= 70 ? 'ENTERPRISE_AUTONOMOUS_OS' : 'RAPID_INTELLIGENCE_DEPLOYMENT',
      analyzedAt: new Date().toISOString(),
    };
  }
}

export const diraRiisEngine = new DiraRiisEngine();
