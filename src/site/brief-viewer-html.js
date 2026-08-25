/**
 * RAIOC OS - Dynamic Executive Brief Public Viewer (Landing Page Generator)
 * Renders an institutional, dark-mode, high-converting public viewer for executive briefs at /brief/:id.
 * Aesthetic: #0B0F17 deep luxury canvas, #10B981 emerald accents, and #F59E0B gold Golden Visa badge.
 */

/**
 * Escapes HTML entities
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Compiles and renders the complete standalone HTML page for an Executive Brief
 * @param {Object} briefRecord - Executive Brief database record or generator output
 * @returns {string} Full HTML document string
 */
export function renderExecutiveBriefHtml(briefRecord = {}) {
  const payload = briefRecord.raw_payload || briefRecord;
  const briefId = briefRecord.id || payload.id || `brief_${Date.now()}`;
  const leadId = briefRecord.lead_id || payload.leadId || 'N/A';
  const companyName = briefRecord.company_name || payload.companyName || payload.company || 'Private Sovereign Client';
  const contactName = payload.contactName || payload.name || payload.contact_name || companyName;
  const contactEmail = payload.contactEmail || payload.email || 'confidential@sovereign-advisory.ae';
  const contactPhone = payload.contactPhone || payload.phone || '+971 50 000 0000';
  
  const riisScore = Number(briefRecord.riis_score || payload.riisScore || (payload.riis && payload.riis.score) || 92);
  const diraTier = briefRecord.dira_tier || payload.diraTier || (payload.riis && payload.riis.tierLabel) || 'SOVEREIGN_INSTITUTIONAL';
  const diraRisk = payload.diraRiskLevel || (payload.dira && payload.dira.riskLevel) || 'LOW';
  
  const executiveSummary = briefRecord.executive_summary || payload.executiveSummary || payload.executive_summary || 
    `Institutional capital allocation brief for ${companyName}. RIIS score rated at ${riisScore}/100 with ${diraRisk} operational risk profile and full UAE Golden Visa eligibility.`;

  const budgetRaw = payload.budgetAed || payload.budget_aed || payload.budget || 25000000;
  const budgetFormatted = typeof budgetRaw === 'number' 
    ? `AED ${budgetRaw.toLocaleString('en-US')}` 
    : String(budgetRaw).startsWith('AED') ? budgetRaw : `AED ${budgetRaw}`;

  const generatedDate = briefRecord.created_at 
    ? new Date(briefRecord.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Action plan items
  let actionPlan = briefRecord.action_plan || payload.actionPlan || [];
  if (!Array.isArray(actionPlan) || actionPlan.length === 0) {
    actionPlan = [
      {
        title: 'Sovereign Asset Allocation & Off-Plan Reservation',
        timeframe: 'Days 1 - 7',
        description: 'Direct priority allocation in tier-1 waterfront developments with developer price lock and institutional payment terms.',
      },
      {
        title: 'UAE Golden Visa Legal Filing (Cabinet Res. 65/2022)',
        timeframe: 'Days 8 - 14',
        description: 'Submission of 10-Year residency dossier under executive property investor stream with zero corporate tax drag.',
      },
      {
        title: 'Autonomous Portfolio Intelligence & Yield Activation',
        timeframe: 'Days 15 - 30',
        description: 'Onboarding to RAIOC OS intelligence center for real-time asset tracking, rental yields, and secondary market liquidity.',
      },
    ];
  }

  // Matched Projects from Memorandum or Tiered Allocation
  const memorandum = briefRecord.memorandum || payload.memorandum || (payload.sections ? payload : null);
  let matchedProjects = (memorandum && memorandum.matchingProjects && memorandum.matchingProjects.length > 0)
    ? memorandum.matchingProjects
    : (briefRecord.matchingProjects || payload.matchingProjects || []);

  if (!Array.isArray(matchedProjects) || matchedProjects.length === 0) {
    const budgetNum = typeof budgetRaw === 'number' ? budgetRaw : parseInt(String(budgetRaw).replace(/[^\d]/g, ''), 10) || 5000000;
    if (budgetNum >= 15000000) {
      matchedProjects = [
        {
          name: 'Como Residences',
          developer: 'Nakheel',
          community: 'Palm Jumeirah',
          starting_price_aed: 21000000,
          projected_yield_pct: 7.9,
          payment_plan: '80/20 (20% Booking, 60% Construction, 20% Handover)',
          tier: 'SOVEREIGN_ULTRA_PRIME',
          golden_visa_eligible: true
        },
        {
          name: 'Armani Beach Residences',
          developer: 'Arada',
          community: 'Palm Jumeirah',
          starting_price_aed: 25000000,
          projected_yield_pct: 7.5,
          payment_plan: '60/40 (25% Booking, 35% Construction, 40% Handover)',
          tier: 'SOVEREIGN_ULTRA_PRIME',
          golden_visa_eligible: true
        },
        {
          name: 'Sobha Estates',
          developer: 'Sobha Realty',
          community: 'Sobha Hartland II',
          starting_price_aed: 22500000,
          projected_yield_pct: 7.8,
          payment_plan: '60/40 (20% Booking, 40% Construction, 40% Handover)',
          tier: 'SOVEREIGN_ULTRA_PRIME',
          golden_visa_eligible: true
        }
      ];
    } else {
      matchedProjects = [
        {
          name: 'Palace Creek Blue',
          developer: 'Emaar Properties',
          community: 'Dubai Creek Harbour',
          starting_price_aed: 2450000,
          projected_yield_pct: 9.1,
          payment_plan: '80/20 on Handover',
          tier: 'BRANDED_HOSPITALITY',
          golden_visa_eligible: true
        },
        {
          name: 'Valia',
          developer: 'Emaar Properties',
          community: 'Dubai Creek Harbour',
          starting_price_aed: 2100000,
          projected_yield_pct: 8.8,
          payment_plan: '80/20 on Handover',
          tier: 'WATERFRONT_CAPITAL',
          golden_visa_eligible: true
        },
        {
          name: 'Rosehill',
          developer: 'Emaar Properties',
          community: 'Dubai Hills Estate',
          starting_price_aed: 1650000,
          projected_yield_pct: 8.4,
          payment_plan: '80/20 on Handover',
          tier: 'PREMIUM_GROWTH',
          golden_visa_eligible: true
        }
      ];
    }
  }

  // Multimodal Media Assets (Cinematic Video Reel & Audio Briefing)
  const primaryVideo = payload.primaryVideo || (payload.multimodal && payload.multimodal.primaryVideo) || {
    videoUrl: matchedProjects[0]?.media?.video_url || 'https://www.youtube-nocookie.com/embed/gU66dF31gM0?autoplay=0&rel=0',
    videoTitle: matchedProjects[0]?.media?.video_title || `${matchedProjects[0]?.name || 'Sovereign Ultra-Prime'} — Cinematic Masterplan Tour`,
    videoDuration: matchedProjects[0]?.media?.video_duration || '3:15',
    heroImageUrl: matchedProjects[0]?.media?.hero_image_url || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80',
    projectName: matchedProjects[0]?.name || 'Como Residences',
    developer: matchedProjects[0]?.developer || 'Nakheel / Emaar',
    community: matchedProjects[0]?.community || 'Palm Jumeirah',
    projectedYield: `${matchedProjects[0]?.projected_yield_pct || 8.5}% p.a.`,
  };

  const audioBriefing = payload.audioBriefing || (payload.multimodal && payload.multimodal.audioBriefing) || {
    title: `Executive Briefing: ${companyName} Allocation Mandate`,
    voicePersona: 'Emanuel Rendas Institutional AI Voice (International Executive)',
    durationFormatted: '02:15',
    durationSeconds: 135,
    scriptText: `Welcome, ${contactName}. This is your private executive intelligence briefing for ${companyName}, prepared by Emanuel Rendas Private Advisory in Dubai. Our autonomous models have evaluated your capital allocation mandate of ${budgetFormatted}, scoring your portfolio readiness at RIIS ${riisScore} out of 100 with a low systemic risk rating. Under Dubai Law Number 8 of 2007, one hundred percent of your capital is strictly ring-fenced in RERA-monitored bank escrow accounts. Furthermore, your investment qualifies you for the 10-Year Renewable UAE Real Estate Golden Visa under Cabinet Resolution Number 65 of 2022 with DIFC Common Law asset protection.`,
    chapters: [
      { time: '00:00', title: `Executive Allocation Thesis & RIIS Score (${riisScore}/100)` },
      { time: '00:35', title: 'Statutory Shielding (Dubai Law No. 8 of 2007)' },
      { time: '01:10', title: `Target Asset Showcase (${matchedProjects[0]?.name || 'Waterfront Assets'})` },
      { time: '01:45', title: 'UAE Golden Visa (Cabinet Res. 65/2022) & DIFC Succession' },
    ],
  };

  // Radial Gauge Calculations
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (riisScore / 100) * circumference;

  // WhatsApp concierge pre-filled message
  const waMessage = encodeURIComponent(
    `Hello Emanuel, I have reviewed my RAIOC Executive Brief (${briefId}) for ${companyName} (RIIS Score: ${riisScore}/100). I would like to schedule a private advisory session regarding off-plan allocations and the UAE Golden Visa framework.`
  );

  return `<!DOCTYPE html>
<html lang="en" class="dark scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Executive Brief: ${escapeHtml(companyName)} | Emanuel Rendas Private Advisory</title>
  <meta name="description" content="Confidential Sovereign Intelligence Brief for ${escapeHtml(companyName)}. RIIS Score: ${riisScore}/100. UAE Golden Visa Qualified.">
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          },
          colors: {
            brand: {
              50: '#ecfdf5',
              400: '#34d399',
              500: '#10b981',
              600: '#059669',
              900: '#064e3b',
            },
            gold: {
              400: '#fbbf24',
              500: '#f59e0b',
              600: '#d97706',
              700: '#b45309',
            },
            surface: {
              canvas: '#0B0F17',
              card: '#111827',
              border: '#1F2937',
              accent: '#1E293B',
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #0B0F17;
      color: #F3F4F6;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .glass-panel {
      background: rgba(17, 24, 39, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .glass-card {
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .gold-badge-glow {
      box-shadow: 0 0 25px rgba(245, 158, 11, 0.25);
    }
    .emerald-glow {
      box-shadow: 0 0 35px rgba(16, 185, 129, 0.15);
    }
    .radial-circle-bg {
      stroke: rgba(255, 255, 255, 0.08);
    }
    .radial-circle-progress {
      stroke: #10B981;
      stroke-linecap: round;
      transition: stroke-dashoffset 1.5s ease-out;
    }
    .gold-shimmer {
      background: linear-gradient(135deg, #F59E0B 0%, #FCD34D 50%, #D97706 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .emerald-shimmer {
      background: linear-gradient(135deg, #10B981 0%, #6EE7B7 50%, #059669 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  </style>
</head>
<body class="min-h-screen antialiased selection:bg-brand-500 selection:text-black">

  <!-- Top Sticky VIP Header -->
  <header class="sticky top-0 z-50 glass-panel border-b border-surface-border">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20 font-bold text-black text-xl tracking-wider">
          ER
        </div>
        <div>
          <span class="text-xs uppercase tracking-widest text-emerald-400 font-semibold font-mono block">EMANUEL RENDAS</span>
          <span class="text-sm font-bold text-white tracking-wide">PRIVATE ADVISORY</span>
        </div>
      </div>

      <div class="hidden md:flex items-center space-x-4">
        <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-950/50 border border-red-500/30 text-red-400 text-xs font-mono font-medium">
          <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span>STRICTLY CONFIDENTIAL // VIP DOSSIER</span>
        </div>
        <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-surface-accent/70 border border-surface-border text-slate-300 text-xs font-mono">
          <span>IKL v1.0 CERTIFIED</span>
        </div>
      </div>

      <div>
        <a href="#booking" class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-slate-950 font-bold text-sm shadow-lg shadow-brand-500/20 transition-all duration-200 transform hover:-translate-y-0.5">
          <span>Schedule Allocation Call</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </a>
      </div>
    </div>
  </header>

  <!-- Main Executive Brief Container -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">

    <!-- SECTION 1: Client Dossier Header -->
    <section class="glass-card rounded-3xl p-8 md:p-12 relative overflow-hidden emerald-glow border border-emerald-500/20">
      <div class="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute bottom-0 left-0 -ml-16 -mb-16 w-80 h-80 bg-gold-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
        <div class="space-y-4 max-w-2xl">
          <div class="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold tracking-wider uppercase">
            <span>● PROVENANCE KEY: STRATEGY_${escapeHtml(diraTier).toUpperCase()}</span>
          </div>
          <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Executive Intelligence Brief:<br>
            <span class="emerald-shimmer">${escapeHtml(companyName)}</span>
          </h1>
          <p class="text-slate-400 text-base md:text-lg leading-relaxed">
            Prepared exclusively for <strong class="text-white">${escapeHtml(contactName)}</strong>. Tailored sovereign asset portfolio, off-plan capital allocations, and UAE Golden Visa qualification dossier.
          </p>
        </div>

        <!-- Meta Snapshot Box -->
        <div class="glass-panel p-6 rounded-2xl border border-white/10 space-y-3 min-w-[280px]">
          <div class="flex justify-between items-center text-xs text-slate-400 pb-2 border-b border-surface-border">
            <span>Dossier ID:</span>
            <span class="font-mono text-emerald-400 font-bold">${escapeHtml(briefId)}</span>
          </div>
          <div class="flex justify-between items-center text-xs text-slate-400 pb-2 border-b border-surface-border">
            <span>Evaluation Date:</span>
            <span class="font-mono text-white">${escapeHtml(generatedDate)}</span>
          </div>
          <div class="flex justify-between items-center text-xs text-slate-400 pb-2 border-b border-surface-border">
            <span>Capital Allocation:</span>
            <span class="font-mono text-gold-400 font-extrabold text-sm">${escapeHtml(budgetFormatted)}</span>
          </div>
          <div class="flex justify-between items-center text-xs text-slate-400">
            <span>Status:</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-brand-500/20 text-brand-400 border border-brand-500/30">
              ACTIVE ALLOCATION
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 2: RIIS Score Radial Gauge & Intelligence Overview -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- Radial Gauge Card -->
      <div class="glass-card rounded-3xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden border border-white/10">
        <h3 class="text-xs uppercase tracking-widest text-slate-400 font-mono font-bold mb-6">REAL ESTATE READINESS SCORE (RIIS)</h3>
        
        <div class="relative flex items-center justify-center">
          <svg class="w-48 h-48 transform -rotate-90" viewBox="0 0 160 160">
            <circle class="radial-circle-bg" cx="80" cy="80" r="${radius}" stroke-width="12" fill="transparent" />
            <circle class="radial-circle-progress" cx="80" cy="80" r="${radius}" stroke-width="12" fill="transparent"
              stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-5xl font-black text-white font-mono tracking-tight">${riisScore}</span>
            <span class="text-xs text-slate-400 font-mono uppercase tracking-wider">/ 100 INDEX</span>
          </div>
        </div>

        <div class="mt-6 space-y-1">
          <div class="inline-block px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-emerald-400 font-mono font-bold text-xs">
            ${escapeHtml(diraTier.replace(/_/g, ' '))}
          </div>
          <p class="text-xs text-slate-400 mt-2">Optimal Capital Deployment Alignment</p>
        </div>
      </div>

      <!-- DIRA Risk & Composite Vectors -->
      <div class="lg:col-span-2 glass-card rounded-3xl p-8 md:p-10 flex flex-col justify-between border border-white/10 space-y-6">
        <div>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-white tracking-wide">Autonomous Assessment Matrix</h3>
            <span class="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-xs font-semibold">
              DIRA LEVEL: ${escapeHtml(diraRisk)} RISK
            </span>
          </div>
          <p class="text-slate-300 text-sm md:text-base leading-relaxed bg-surface-canvas/60 p-5 rounded-2xl border border-white/5">
            "${escapeHtml(executiveSummary)}"
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-surface-border">
          <div class="p-4 rounded-xl bg-surface-canvas/40 border border-white/5">
            <span class="text-xs text-slate-400 block mb-1">Capital Liquidity</span>
            <span class="text-lg font-bold text-emerald-400 font-mono">Immediate</span>
            <span class="text-[10px] text-slate-500 block">T+1 Execution</span>
          </div>
          <div class="p-4 rounded-xl bg-surface-canvas/40 border border-white/5">
            <span class="text-xs text-slate-400 block mb-1">Tax Drag Reduction</span>
            <span class="text-lg font-bold text-emerald-400 font-mono">100.0%</span>
            <span class="text-[10px] text-slate-500 block">0% Income & Capital Gains</span>
          </div>
          <div class="p-4 rounded-xl bg-surface-canvas/40 border border-white/5">
            <span class="text-xs text-slate-400 block mb-1">Golden Visa Status</span>
            <span class="text-lg font-bold text-gold-400 font-mono">10-Yr Certified</span>
            <span class="text-[10px] text-slate-500 block">Cabinet Res. 65/2022</span>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 2.5: Executive Briefing Audio Summary (Multimodal AI Voice Player) -->
    <section class="glass-card rounded-3xl p-6 sm:p-8 border-2 border-emerald-500/30 relative overflow-hidden emerald-glow bg-gradient-to-r from-surface-card via-brand-950/20 to-surface-canvas space-y-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center space-x-4">
          <!-- Play / Pause Button -->
          <button id="audio-play-btn" onclick="toggleAudioBriefing()" class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-500 to-brand-400 hover:from-brand-400 hover:to-brand-300 text-slate-950 flex items-center justify-center shadow-xl shadow-brand-500/30 transition-all duration-200 transform hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer">
            <svg id="play-icon" class="w-8 h-8 ml-1 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            <svg id="pause-icon" class="w-8 h-8 fill-current hidden" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <div class="space-y-1">
            <div class="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
              <span>● MULTIMODAL AUDIO BRIEFING</span>
            </div>
            <h3 class="text-lg sm:text-xl font-black text-white tracking-wide">
              Executive Briefing Audio Summary
            </h3>
            <p class="text-xs text-slate-400">
              Narrated by <strong class="text-slate-200">Emanuel Rendas AI Voice</strong> • Duration: ${escapeHtml(audioBriefing.durationFormatted || '02:15')}
            </p>
          </div>
        </div>

        <div class="flex items-center space-x-3 self-end md:self-center">
          <div class="flex items-center space-x-1" id="audio-waveform">
            <span class="w-1 h-3 bg-emerald-400/40 rounded-full animate-pulse"></span>
            <span class="w-1 h-6 bg-emerald-400/60 rounded-full animate-pulse delay-75"></span>
            <span class="w-1 h-8 bg-emerald-400 rounded-full animate-pulse delay-150"></span>
            <span class="w-1 h-4 bg-emerald-400/50 rounded-full animate-pulse delay-100"></span>
            <span class="w-1 h-2 bg-emerald-400/30 rounded-full animate-pulse"></span>
          </div>
          <span id="audio-time-display" class="font-mono text-xs text-emerald-400 font-bold">00:00 / ${escapeHtml(audioBriefing.durationFormatted || '02:15')}</span>
        </div>
      </div>

      <!-- Scrubber & Chapters -->
      <div class="space-y-3 pt-2 border-t border-white/5">
        <div class="w-full bg-surface-canvas/80 h-2 rounded-full overflow-hidden relative cursor-pointer" onclick="seekAudio(event)">
          <div id="audio-progress-bar" class="bg-gradient-to-r from-emerald-500 to-brand-400 h-full w-0 transition-all duration-200"></div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
          ${(audioBriefing.chapters || []).map((ch, i) => `
          <button onclick="jumpChapter(${i})" class="p-2 rounded-lg bg-surface-canvas/50 hover:bg-emerald-500/10 border border-white/5 text-left text-slate-300 hover:text-white transition-colors cursor-pointer">
            <span class="text-emerald-400 font-bold block">${escapeHtml(ch.time)}</span>
            <span class="truncate block">${escapeHtml(ch.title)}</span>
          </button>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- SECTION 3: Golden Visa Legal Stamp (Cabinet Res. 65/2022) & Statutory Escrow Guarantees (Law 8/2007) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      <!-- Golden Visa Stamp -->
      <section class="glass-card rounded-3xl p-8 border-2 border-gold-500/30 relative overflow-hidden gold-badge-glow bg-gradient-to-br from-gold-950/30 via-surface-card to-surface-canvas flex flex-col justify-between">
        <div class="flex items-start space-x-5">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-700 p-0.5 shadow-xl shadow-gold-500/20 flex-shrink-0">
            <div class="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center p-2 text-center">
              <svg class="w-7 h-7 text-gold-400 mb-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clip-rule="evenodd"/></svg>
              <span class="text-[7px] font-mono font-extrabold text-gold-400 uppercase tracking-tighter">GOLDEN VISA</span>
            </div>
          </div>
          <div class="space-y-1.5">
            <div class="inline-flex items-center space-x-2 text-gold-400 text-xs font-mono font-bold tracking-widest uppercase">
              <span>★ OFFICIAL UAE STATUTORY COMPLIANCE</span>
            </div>
            <h3 class="text-xl font-black text-white tracking-wide">
              UAE Cabinet Resolution No. 65 of 2022 Certified
            </h3>
            <p class="text-slate-300 text-xs leading-relaxed">
              Qualifies for the 10-Year Renewable Real Estate Investor Golden Visa under Cabinet Resolution No. 65 of 2022. Grants 100% foreign business ownership, zero personal and corporate capital gains taxes, and unrestricted family sponsorship.
            </p>
          </div>
        </div>

        <div class="mt-6 pt-4 border-t border-gold-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span class="text-[10px] text-slate-400 font-mono">Executive Regulations of Federal Decree-Law No. 29/2021</span>
          <div class="px-3 py-1 rounded-full bg-gold-500/20 border border-gold-500/40 text-gold-300 font-mono font-bold text-xs">
            10-YEAR SOVEREIGN RESIDENCY
          </div>
        </div>
      </section>

      <!-- Statutory Escrow Guarantee (Law No. 8 of 2007) -->
      <section class="glass-card rounded-3xl p-8 border-2 border-emerald-500/30 relative overflow-hidden emerald-glow bg-gradient-to-br from-brand-950/30 via-surface-card to-surface-canvas flex flex-col justify-between">
        <div class="flex items-start space-x-5">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 p-0.5 shadow-xl shadow-brand-500/20 flex-shrink-0">
            <div class="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center p-2 text-center">
              <svg class="w-7 h-7 text-brand-400 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <span class="text-[7px] font-mono font-extrabold text-brand-400 uppercase tracking-tighter">ESCROW LAW</span>
            </div>
          </div>
          <div class="space-y-1.5">
            <div class="inline-flex items-center space-x-2 text-emerald-400 text-xs font-mono font-bold tracking-widest uppercase">
              <span>🛡 DUBAI LAW NO. 8 OF 2007</span>
            </div>
            <h3 class="text-xl font-black text-white tracking-wide">
              Statutory Escrow & Investor Protection
            </h3>
            <p class="text-slate-300 text-xs leading-relaxed">
              100% of investor capital is safeguarded in RERA-monitored bank trust accounts pursuant to Law 8 of 2007. Funds are released strictly upon verified DLD engineering milestones with a 5% warranty retention and 10-Year Decennial Structural Warranty.
            </p>
          </div>
        </div>

        <div class="mt-6 pt-4 border-t border-brand-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span class="text-[10px] text-slate-400 font-mono">Dubai Land Department & RERA Regulatory Compliance</span>
          <div class="px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-300 font-mono font-bold text-xs">
            100% CAPITAL PROTECTED
          </div>
        </div>
      </section>

    </div>

    <!-- SECTION 3.5: Cinematic Masterplan & Asset Video Showcase -->
    <section class="glass-card rounded-3xl p-6 sm:p-8 md:p-10 border-2 border-emerald-500/20 relative overflow-hidden space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span class="text-xs uppercase font-mono font-bold tracking-widest text-emerald-400 block mb-1">CINEMATIC MASTERPLAN TOUR</span>
          <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">4K Architectural & Masterplan Showcase</h2>
        </div>
        <div class="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <span class="px-2.5 py-1 rounded-full bg-surface-canvas border border-white/10 text-emerald-400 font-bold">4K ULTRA HD</span>
          <span>${escapeHtml(primaryVideo.videoDuration || '3:00')}</span>
        </div>
      </div>

      <div class="relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-white/10 shadow-2xl aspect-video">
        <iframe 
          class="w-full h-full border-0" 
          src="${escapeHtml(primaryVideo.videoUrl)}" 
          title="${escapeHtml(primaryVideo.videoTitle || 'Cinematic Asset Tour')}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          allowfullscreen>
        </iframe>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-xs font-mono text-slate-400">
        <span class="text-slate-300 font-semibold">${escapeHtml(primaryVideo.videoTitle || 'Institutional Asset Video Showcase')}</span>
        <span class="text-emerald-400 font-bold">Projected Net Yield: ${escapeHtml(primaryVideo.projectedYield || '8.5% p.a.')}</span>
      </div>
    </section>

    <!-- SECTION 4: Target Asset Cards (Manus Off-Plan Projects) -->
    <section class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span class="text-xs uppercase font-mono font-bold tracking-widest text-emerald-400 block mb-1">CURATED ALLOCATION PIPELINE</span>
          <h2 class="text-3xl font-extrabold text-white tracking-tight">Prime Institutional Assets (Manus Off-Plan)</h2>
        </div>
        <p class="text-xs text-slate-400 max-w-md sm:text-right">
          Direct institutional allocation rights pre-secured via developer off-market inventory.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${matchedProjects.slice(0, 3).map((p, idx) => {
          const isPrimary = idx === (matchedProjects.length > 1 ? 1 : 0);
          const priceFormatted = p.startingPriceFormatted || (p.starting_price_aed ? `AED ${p.starting_price_aed.toLocaleString('en-US')}` : 'AED 2,500,000');
          const yieldFormatted = p.projectedYield || (p.projected_yield_pct ? `${p.projected_yield_pct}% p.a.` : '8.6% p.a.');
          const paymentPlan = p.paymentPlan || p.payment_plan || '80/20 on Handover';
          const community = p.community || 'Dubai Waterfront';
          const name = p.name || 'Prime Waterfront Residence';
          const developer = p.developer || 'Emaar / Nakheel';

          return `
          <div class="glass-card rounded-3xl p-6 flex flex-col justify-between ${isPrimary ? 'border-2 border-emerald-500/40 relative overflow-hidden emerald-glow' : 'border border-white/10 hover:border-emerald-500/40'} transition-all duration-300 group">
            ${isPrimary ? `
            <div class="absolute top-0 right-0 bg-gradient-to-l from-emerald-500 to-brand-600 text-black text-[10px] font-extrabold uppercase font-mono px-4 py-1 rounded-bl-xl tracking-wider">
              PRIMARY RECOMMENDATION
            </div>` : ''}

            <div class="space-y-4 ${isPrimary ? 'mt-2' : ''}">
              <div class="relative h-48 rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-700 overflow-hidden border border-white/10 flex items-center justify-center text-center p-4">
                <div class="absolute inset-0 bg-brand-900/20 group-hover:bg-brand-900/10 transition-colors"></div>
                <div class="relative z-10">
                  <span class="text-xs font-mono text-emerald-400 uppercase tracking-widest font-bold block mb-1">${escapeHtml(community.toUpperCase())}</span>
                  <h4 class="text-xl font-bold text-white">${escapeHtml(name)}</h4>
                  <span class="text-xs text-slate-400 font-mono mt-1 block">${escapeHtml(developer)}</span>
                </div>
                <div class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-gold-500/20 border border-gold-500/40 text-gold-300 text-[10px] font-mono font-bold">
                  10-YR VISA
                </div>
              </div>

              <div>
                <div class="flex justify-between items-baseline mb-2">
                  <span class="text-xs text-slate-400">Entry Allocation:</span>
                  <span class="text-lg font-black text-white font-mono">${escapeHtml(priceFormatted)}</span>
                </div>
                <div class="flex justify-between items-baseline text-xs text-slate-400 pb-3 border-b border-surface-border">
                  <span>Payment Plan:</span>
                  <span class="font-mono text-emerald-400 font-semibold">${escapeHtml(paymentPlan)}</span>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 text-xs font-mono">
                <div class="p-2.5 rounded-xl bg-surface-canvas/60 border border-white/5">
                  <span class="text-slate-500 text-[10px] block">PROJ. NET YIELD</span>
                  <span class="text-emerald-400 font-bold">${escapeHtml(yieldFormatted)}</span>
                </div>
                <div class="p-2.5 rounded-xl bg-surface-canvas/60 border border-white/5">
                  <span class="text-slate-500 text-[10px] block">ESCROW LAW 8/07</span>
                  <span class="text-emerald-400 font-bold">100% PROTECTED</span>
                </div>
              </div>
            </div>

            <a href="#booking" class="mt-6 w-full py-3 rounded-xl ${isPrimary ? 'bg-brand-500 hover:bg-brand-400 text-black font-extrabold' : 'bg-surface-accent/60 hover:bg-emerald-500 hover:text-black text-slate-200 font-bold'} text-xs tracking-wider uppercase text-center transition-all duration-200 border border-white/10">
              ${isPrimary ? 'Lock Allocation Priority' : 'Request Full Prospectus'}
            </a>
          </div>
          `;
        }).join('')}
      </div>
    </section>

    <!-- SECTION 5: DIFC Common Law Asset Shielding & Generational Succession -->
    <section class="glass-card rounded-3xl p-8 md:p-10 border-2 border-blue-500/30 relative overflow-hidden bg-gradient-to-br from-blue-950/30 via-surface-card to-surface-canvas space-y-6">
      <div class="flex items-start space-x-5">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-700 p-0.5 shadow-xl shadow-blue-500/20 flex-shrink-0">
          <div class="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center p-2 text-center">
            <svg class="w-6 h-6 text-blue-400 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            <span class="text-[7px] font-mono font-extrabold text-blue-400 uppercase tracking-tighter">DIFC LAW</span>
          </div>
        </div>
        <div class="space-y-1.5">
          <div class="inline-flex items-center space-x-2 text-blue-400 text-xs font-mono font-bold tracking-widest uppercase">
            <span>🏛 DIFC COMMON LAW JURISDICTION & ASSET SHIELDING</span>
          </div>
          <h3 class="text-xl font-black text-white tracking-wide">
            DIFC Special Purpose Vehicles (SPV) & Testamentary Wills
          </h3>
          <p class="text-slate-300 text-xs leading-relaxed">
            Assets held under DIFC Common Law structures are ring-fenced from international civil litigation and statutory forced heirship. DIFC Wills & Probate Registry guarantees 100% testamentary freedom and seamless multi-generational wealth succession.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div class="p-4 rounded-xl bg-surface-canvas/60 border border-white/5 space-y-1">
          <span class="text-xs font-bold text-white block">DIFC SPV / Prescribed Co.</span>
          <span class="text-[11px] text-slate-400 block">Corporate veil holding real estate titles with zero commercial liability exposure.</span>
        </div>
        <div class="p-4 rounded-xl bg-surface-canvas/60 border border-white/5 space-y-1">
          <span class="text-xs font-bold text-white block">DIFC Wills & Probate</span>
          <span class="text-[11px] text-slate-400 block">Full English Common Law probate registry ensuring zero delay and direct inheritance.</span>
        </div>
        <div class="p-4 rounded-xl bg-surface-canvas/60 border border-white/5 space-y-1">
          <span class="text-xs font-bold text-white block">DIFC Family Foundation</span>
          <span class="text-[11px] text-slate-400 block">Perpetual estate planning structure for family offices and sovereign estates.</span>
        </div>
      </div>
    </section>

    <!-- SECTION 6: Net Yield Matrix & Sovereign Tax Shield -->
    <section class="glass-card rounded-3xl p-8 md:p-12 border border-white/10 space-y-8">
      <div class="space-y-2">
        <span class="text-xs uppercase font-mono font-bold tracking-widest text-emerald-400 block">SOVEREIGN WEALTH PRESERVATION</span>
        <h2 class="text-3xl font-extrabold text-white">Net Yield & Jurisdiction Tax Shield Matrix</h2>
        <p class="text-sm text-slate-400">Comparing 5-year retained earnings in Dubai vs. traditional Western financial capitals.</p>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-surface-border text-xs font-mono uppercase text-slate-400">
              <th class="py-4 px-4 font-bold">Jurisdiction Tax Vector</th>
              <th class="py-4 px-4 font-bold text-emerald-400 bg-emerald-500/10 rounded-t-xl">UAE Sovereign Advantage</th>
              <th class="py-4 px-4">London (UK)</th>
              <th class="py-4 px-4">New York (USA)</th>
              <th class="py-4 px-4">Frankfurt (EU)</th>
            </tr>
          </thead>
          <tbody class="text-sm divide-y divide-surface-border font-mono">
            <tr>
              <td class="py-4 px-4 text-slate-300 font-sans font-medium">Personal Income Tax on Rental</td>
              <td class="py-4 px-4 text-emerald-400 font-bold bg-emerald-500/10">0.0%</td>
              <td class="py-4 px-4 text-slate-400">45.0%</td>
              <td class="py-4 px-4 text-slate-400">37.0% + State</td>
              <td class="py-4 px-4 text-slate-400">45.0%</td>
            </tr>
            <tr>
              <td class="py-4 px-4 text-slate-300 font-sans font-medium">Capital Gains Tax on Property Sale</td>
              <td class="py-4 px-4 text-emerald-400 font-bold bg-emerald-500/10">0.0%</td>
              <td class="py-4 px-4 text-slate-400">20.0%</td>
              <td class="py-4 px-4 text-slate-400">20.0% + State</td>
              <td class="py-4 px-4 text-slate-400">26.375%</td>
            </tr>
            <tr>
              <td class="py-4 px-4 text-slate-300 font-sans font-medium">Wealth / Annual Property Tax</td>
              <td class="py-4 px-4 text-emerald-400 font-bold bg-emerald-500/10">0.0%</td>
              <td class="py-4 px-4 text-slate-400">Council Tax Drag</td>
              <td class="py-4 px-4 text-slate-400">1.8% - 2.5% p.a.</td>
              <td class="py-4 px-4 text-slate-400">0.5% - 1.5%</td>
            </tr>
            <tr>
              <td class="py-4 px-4 text-slate-300 font-sans font-medium">Inheritance & Estate Tax</td>
              <td class="py-4 px-4 text-emerald-400 font-bold bg-emerald-500/10">0.0% (DIFC Wills)</td>
              <td class="py-4 px-4 text-slate-400">40.0%</td>
              <td class="py-4 px-4 text-slate-400">40.0%</td>
              <td class="py-4 px-4 text-slate-400">30.0%</td>
            </tr>
            <tr class="bg-surface-canvas/80 text-base font-extrabold">
              <td class="py-5 px-4 text-white font-sans">5-Year Retained Net Wealth</td>
              <td class="py-5 px-4 text-emerald-400 font-bold bg-emerald-500/20 rounded-b-xl">100.0% RETAINED</td>
              <td class="py-5 px-4 text-red-400">54.2% Retained</td>
              <td class="py-5 px-4 text-red-400">58.6% Retained</td>
              <td class="py-5 px-4 text-red-400">52.8% Retained</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- SECTION 6: Action Plan Roadmap -->
    <section class="glass-card rounded-3xl p-8 md:p-12 border border-white/10 space-y-6">
      <div class="space-y-2">
        <span class="text-xs uppercase font-mono font-bold tracking-widest text-emerald-400 block">STRATEGIC ROADMAP</span>
        <h2 class="text-3xl font-extrabold text-white">Execution & Allocation Protocol</h2>
      </div>

      <div class="space-y-4">
        ${actionPlan.map((step, idx) => `
        <div class="p-6 rounded-2xl bg-surface-canvas/60 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-start space-x-4">
            <div class="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/40 text-emerald-400 font-mono font-bold flex items-center justify-center flex-shrink-0">
              0${idx + 1}
            </div>
            <div>
              <h4 class="text-lg font-bold text-white">${escapeHtml(step.title)}</h4>
              <p class="text-sm text-slate-300 mt-1">${escapeHtml(step.description)}</p>
            </div>
          </div>
          <span class="px-4 py-1.5 rounded-full bg-surface-accent border border-surface-border text-xs font-mono font-bold text-slate-300 self-start md:self-center flex-shrink-0">
            ${escapeHtml(step.timeframe)}
          </span>
        </div>
        `).join('')}
      </div>
    </section>

    <!-- SECTION 7: 1-Click Meeting Booking & VIP Concierge (ClickFunnels Style) -->
    <section id="booking" class="glass-card rounded-3xl p-8 md:p-14 border-2 border-emerald-500/40 relative overflow-hidden emerald-glow text-center space-y-8 bg-gradient-to-b from-surface-card to-surface-canvas">
      <div class="max-w-3xl mx-auto space-y-4">
        <div class="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-brand-500/20 border border-brand-500/40 text-emerald-400 text-xs font-mono font-bold uppercase tracking-widest">
          <span>PRIORITY ADVISORY SLOT RESERVED</span>
        </div>
        <h2 class="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
          Initiate Allocation & Golden Visa Filing
        </h2>
        <p class="text-slate-300 text-base md:text-lg">
          Schedule a direct 1-on-1 private strategy session with <strong class="text-white">Emanuel Rendas</strong> to lock off-plan allocation rights and begin the expedited Golden Visa filing under Cabinet Resolution 65/2022.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <!-- 1-Click Calendar Booking -->
        <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" class="w-full sm:w-auto flex-1 px-8 py-5 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-slate-950 font-extrabold text-base shadow-xl shadow-brand-500/30 transition-all duration-200 transform hover:-translate-y-1 flex items-center justify-center space-x-3">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span>Book Private Briefing</span>
        </a>

        <!-- Direct WhatsApp Concierge -->
        <a href="https://wa.me/971509876543?text=${waMessage}" target="_blank" rel="noopener noreferrer" class="w-full sm:w-auto flex-1 px-8 py-5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-black font-extrabold text-base shadow-xl shadow-green-500/25 transition-all duration-200 transform hover:-translate-y-1 flex items-center justify-center space-x-3">
          <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
          <span>WhatsApp VIP Concierge</span>
        </a>
      </div>

      <div class="pt-4 text-xs font-mono text-slate-500">
        Direct Line: +971 (0) 50 987 6543 • Private Office: Dubai International Financial Centre (DIFC)
      </div>
    </section>

  </main>

  <!-- Footer -->
  <footer class="border-t border-surface-border mt-20 py-10 glass-panel">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
      <div>
        © 2026 EMANUEL RENDAS PRIVATE ADVISORY. ALL RIGHTS RESERVED.
      </div>
      <div>
        POWERED BY RAIOC OS • INSTITUTIONAL KNOWLEDGE LAYER (IKL v1.0)
      </div>
    </div>
  </footer>

  <!-- Audio Briefing Voice Synthesis & Playback Script -->
  <script>
    const audioScriptText = ${JSON.stringify(audioBriefing.scriptText || '')};
    let isAudioPlaying = false;
    let synthUtterance = null;
    let progressInterval = null;
    let elapsedSeconds = 0;
    const totalSeconds = ${audioBriefing.durationSeconds || 135};

    function toggleAudioBriefing() {
      if (!isAudioPlaying) {
        startAudio();
      } else {
        pauseAudio();
      }
    }

    function startAudio() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        synthUtterance = new SpeechSynthesisUtterance(audioScriptText);
        synthUtterance.rate = 0.96;
        synthUtterance.pitch = 0.98;
        synthUtterance.lang = 'en-GB';

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('en-GB') || v.name.includes('UK') || v.name.includes('Daniel') || v.name.includes('Arthur') || v.name.includes('George'));
        if (preferredVoice) synthUtterance.voice = preferredVoice;

        synthUtterance.onend = () => {
          pauseAudio();
          elapsedSeconds = 0;
          updateProgressUI();
        };

        window.speechSynthesis.speak(synthUtterance);
      }

      isAudioPlaying = true;
      document.getElementById('play-icon')?.classList.add('hidden');
      document.getElementById('pause-icon')?.classList.remove('hidden');

      clearInterval(progressInterval);
      progressInterval = setInterval(() => {
        if (elapsedSeconds < totalSeconds) {
          elapsedSeconds++;
          updateProgressUI();
        } else {
          pauseAudio();
        }
      }, 1000);
    }

    function pauseAudio() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.pause();
      }
      isAudioPlaying = false;
      document.getElementById('play-icon')?.classList.remove('hidden');
      document.getElementById('pause-icon')?.classList.add('hidden');
      clearInterval(progressInterval);
    }

    function updateProgressUI() {
      const pct = Math.min(100, (elapsedSeconds / totalSeconds) * 100);
      const bar = document.getElementById('audio-progress-bar');
      if (bar) bar.style.width = pct + '%';
      
      const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
      const secs = String(elapsedSeconds % 60).padStart(2, '0');
      const disp = document.getElementById('audio-time-display');
      if (disp) disp.innerText = mins + ':' + secs + ' / ${escapeHtml(audioBriefing.durationFormatted || '02:15')}';
    }

    function jumpChapter(index) {
      const offsets = [0, 35, 70, 105];
      elapsedSeconds = offsets[index] || 0;
      updateProgressUI();
      if (!isAudioPlaying) startAudio();
    }
  </script>

</body>
</html>`;
}
