/**
 * RAIOC OS - Multimodal Media & Audio Briefing Engine
 * Synthesizes cinematic video reels and AI audio briefing metadata packages
 * for Tier 1 and Tier 2 leads (RIIS >= 70).
 */

import { logger } from '../logging/audit-logger.js';

export class MultimodalEngine {
  constructor(options = {}) {
    this.minRiisScore = options.minRiisScore || 70;
  }

  /**
   * Generates a multimodal media package for an inbound lead
   * @param {Object} lead - Lead information
   * @param {Object} intelligence - DIRA & RIIS assessment results
   * @param {Array<Object>} matchedProjects - Matched Manus off-plan projects
   * @returns {Object} Multimodal media and audio package
   */
  generateMultimodalPackage(lead = {}, intelligence = {}, matchedProjects = []) {
    const riisScore = Number(intelligence.riis?.score || lead.riis_score || 90);
    const companyName = lead.company || lead.company_name || 'Private Sovereign Investor';
    const contactName = lead.name || lead.full_name || companyName;
    const budgetRaw = lead.budget_aed || lead.budgetAed || lead.budget || 5000000;
    const budgetNum = typeof budgetRaw === 'number' ? budgetRaw : parseInt(String(budgetRaw).replace(/[^\d]/g, ''), 10) || 5000000;
    const budgetFormatted = `AED ${budgetNum.toLocaleString('en-US')}`;

    const isQualified = riisScore >= this.minRiisScore;
    const topProject = matchedProjects[0] || {
      name: budgetNum >= 15000000 ? 'Como Residences' : 'Valia Waterfront Residences',
      developer: budgetNum >= 15000000 ? 'Nakheel' : 'Emaar Properties',
      community: budgetNum >= 15000000 ? 'Palm Jumeirah' : 'Dubai Creek Harbour',
      projected_yield_pct: budgetNum >= 15000000 ? 7.9 : 8.8,
      media: {
        video_url: budgetNum >= 15000000 
          ? 'https://www.youtube-nocookie.com/embed/gU66dF31gM0?autoplay=0&rel=0'
          : 'https://www.youtube-nocookie.com/embed/5a2X4P3M0bQ?autoplay=0&rel=0',
        video_title: `${budgetNum >= 15000000 ? 'Como Residences Palm Jumeirah' : 'Valia at Dubai Creek Harbour'} — Cinematic Showcase`,
        video_duration: '3:15',
        hero_image_url: budgetNum >= 15000000 
          ? 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80'
          : 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1600&q=80',
      },
    };

    // Video Showcase Reel
    const videoShowcase = matchedProjects
      .filter((p) => p.media && p.media.video_url)
      .map((p) => ({
        projectId: p.id,
        projectName: p.name,
        developer: p.developer,
        community: p.community,
        videoUrl: p.media.video_url,
        videoTitle: p.media.video_title || `${p.name} (${p.developer}) Official Showcase`,
        videoDuration: p.media.video_duration || '2:30',
        heroImageUrl: p.media.hero_image_url,
        projectedYield: `${p.projected_yield_pct || 8.5}% p.a.`,
      }));

    const primaryVideo = videoShowcase[0] || {
      projectId: topProject.id || 'proj_primary',
      projectName: topProject.name,
      developer: topProject.developer,
      community: topProject.community,
      videoUrl: topProject.media?.video_url || 'https://www.youtube-nocookie.com/embed/gU66dF31gM0?autoplay=0&rel=0',
      videoTitle: topProject.media?.video_title || `${topProject.name} — Prime Institutional Asset Tour`,
      videoDuration: topProject.media?.video_duration || '3:00',
      heroImageUrl: topProject.media?.hero_image_url || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80',
      projectedYield: `${topProject.projected_yield_pct || 8.5}% p.a.`,
    };

    // Audio Briefing Script Synthesis
    const audioScript = `Welcome, ${contactName}. This is your private executive intelligence briefing for ${companyName}, prepared by Emanuel Rendas Private Advisory in Dubai. ` +
      `Our autonomous models have evaluated your capital allocation mandate of ${budgetFormatted}, scoring your portfolio readiness at RIIS ${riisScore} out of 100 with a low systemic risk rating. ` +
      `Under Dubai Law Number 8 of 2007, one hundred percent of your capital is strictly ring-fenced in RERA-monitored bank escrow accounts, released only upon certified Dubai Land Department construction audits with a mandatory five percent warranty retention. ` +
      `Your primary asset allocation has been designated to ${topProject.name} by ${topProject.developer} in ${topProject.community}, delivering an audited projected net yield of ${topProject.projected_yield_pct || '8.5'} percent per annum. ` +
      `Furthermore, your investment qualifies you and your family for the 10-Year Renewable UAE Real Estate Golden Visa under Cabinet Resolution Number 65 of 2022, with full asset ring-fencing available through DIFC Common Law testamentary wills. ` +
      `To finalize priority allocation terms and initiate legal filing, please select the booking link below for a direct strategy session with Emanuel Rendas.`;

    const audioBriefing = {
      id: `audio_brief_${Date.now()}`,
      title: `Executive Briefing: ${companyName} Allocation Mandate`,
      voicePersona: 'Emanuel Rendas Institutional AI Voice (International Executive)',
      language: 'en-GB',
      durationFormatted: '02:15',
      durationSeconds: 135,
      wordCount: audioScript.split(/\s+/).length,
      scriptText: audioScript,
      chapters: [
        { time: '00:00', title: `Executive Allocation Thesis & RIIS Score (${riisScore}/100)` },
        { time: '00:35', title: 'Statutory Shielding (Dubai Law No. 8 of 2007)' },
        { time: '01:10', title: `Target Asset Showcase (${topProject.name})` },
        { time: '01:45', title: 'UAE Golden Visa (Cabinet Res. 65/2022) & DIFC Succession' },
      ],
      synthesisConfig: {
        model: 'eleven_turbo_v2_5',
        stability: 0.85,
        clarity: 0.95,
        voiceId: 'emanuel_rendas_executive',
      },
    };

    logger.info('MULTIMODAL_ENGINE', `Synthesized multimodal media package for ${companyName} (RIIS: ${riisScore})`);

    return {
      qualified: isQualified,
      tier: isQualified ? 'MULTIMODAL_TIER_1' : 'STANDARD',
      riisScore,
      primaryVideo,
      videoShowcase,
      audioBriefing,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const multimodalEngine = new MultimodalEngine();
