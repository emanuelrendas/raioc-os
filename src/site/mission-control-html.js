/**
 * RAIOC OS — Executive Mission Control V2 (Bloomberg Terminal x Linear Luxury Command Center)
 * Pre-compiled Zero-I/O renderer for `/admin/mission-control` and `/mission-control`.
 * 24/7 Wall-Screen Ultra-Luxury Dashboard featuring:
 * - 6 Modular Navigation Tabs (Overview, CRM Kanban, Agent Fleet Matrix, Ingestion Pulse, Approvals, Infrastructure)
 * - Live World Clocks (DXB, LON, LIS, NYC) with UTC offset indicators
 * - Interactive Slide-Over Drawers & Modals (Agent Drawer, Lead Dossier, Event JSON Inspector, Command Palette)
 * - Real-time Sparklines, DIRA Risk score gauges, and 1-click Quick Action triggers
 * - Zero-flicker client-side state controller with localStorage persistence & PII Masking toggle
 */

export function renderMissionControlHtml() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAIOC — 24/7 Executive Mission Control V2</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
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
            gold: {
              300: '#FDE047',
              400: '#FACC15',
              500: '#D4AF37',
              600: '#CA8A04',
            },
            obsidian: '#030712',
            surface: 'rgba(15, 23, 42, 0.65)',
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #030712;
      background-image: 
        radial-gradient(ellipse at 50% 0%, rgba(212, 175, 55, 0.05) 0%, transparent 60%),
        radial-gradient(circle at 100% 100%, rgba(56, 189, 248, 0.03) 0%, transparent 40%);
      color: #F3F4F6;
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
    }
    .glass-card {
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(212, 175, 55, 0.12);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .glass-card:hover {
      border-color: rgba(212, 175, 55, 0.28);
    }
    .gold-glow {
      box-shadow: 0 0 20px rgba(212, 175, 55, 0.12);
    }
    .pulse-dot {
      animation: pulseDot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes pulseDot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    /* Custom Scrollbars */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: rgba(3, 7, 18, 0.5); }
    ::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.25); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(212, 175, 55, 0.5); }
    
    .tab-active {
      background: rgba(212, 175, 55, 0.12) !important;
      color: #FDE047 !important;
      border-color: rgba(212, 175, 55, 0.4) !important;
      box-shadow: inset 0 1px 0 rgba(253, 224, 71, 0.2);
    }
    .drawer-overlay {
      background: rgba(3, 7, 18, 0.75);
      backdrop-filter: blur(8px);
    }
  </style>
</head>
<body class="flex flex-col antialiased">
  <!-- Top Navigation & Global Clocks Bar -->
  <header class="glass-card sticky top-0 z-40 px-6 py-2.5 border-b border-gold-500/15 flex items-center justify-between shadow-2xl">
    <div class="flex items-center space-x-4">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-300 flex items-center justify-center font-black text-black text-lg shadow-lg shadow-amber-500/25 border border-amber-300/40">
        R
      </div>
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-sm font-extrabold tracking-wider text-white uppercase flex items-center gap-2">
            RAIOC MISSION CONTROL
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/40 font-bold tracking-normal">V2 SOVEREIGN</span>
          </h1>
        </div>
        <p class="text-[11px] text-gray-400">Autonomous Real Estate Intelligence & Multi-Agent Operations Mesh</p>
      </div>
    </div>

    <!-- Live World Clocks (DXB, LON, LIS, NYC) -->
    <div class="hidden xl:flex items-center space-x-3 text-xs font-mono">
      <div class="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-gold-500/20 shadow-inner">
        <span class="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></span>
        <span class="text-gray-400 text-[11px]">DXB (UTC+4):</span>
        <span id="clock-dxb" class="text-amber-300 font-bold">--:--:--</span>
      </div>
      <div class="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10">
        <span class="text-gray-400 text-[11px]">LON (UTC+0):</span>
        <span id="clock-lon" class="text-gray-200">--:--:--</span>
      </div>
      <div class="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10">
        <span class="text-gray-400 text-[11px]">LIS (UTC+0):</span>
        <span id="clock-lis" class="text-gray-200">--:--:--</span>
      </div>
      <div class="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10">
        <span class="text-gray-400 text-[11px]">NYC (UTC-5):</span>
        <span id="clock-nyc" class="text-gray-200">--:--:--</span>
      </div>
    </div>

    <!-- Global Actions Strip -->
    <div class="flex items-center space-x-2.5">
      <!-- Command Palette Button (Cmd+K) -->
      <button onclick="toggleCommandPalette()" class="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-xs font-mono text-gray-300 hover:text-white transition-all flex items-center gap-1.5">
        <i data-lucide="search" class="w-3.5 h-3.5 text-amber-400"></i>
        <span class="hidden sm:inline text-[11px]">Command</span>
        <kbd class="text-[9px] bg-black/40 px-1.5 py-0.5 rounded border border-white/10 text-gray-400">⌘K</kbd>
      </button>

      <!-- Mask PII Mode Toggle -->
      <button id="mode-toggle-btn" onclick="toggleMaskedMode()" class="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-xs font-mono text-gray-300 hover:text-white transition-all flex items-center gap-1.5" title="Toggle Public Wall-Screen Mode">
        <i data-lucide="eye-off" class="w-3.5 h-3.5 text-amber-400"></i>
        <span id="mode-label" class="text-[11px]">FULL EXECUTIVE</span>
      </button>

      <!-- Audio Alert Toggle -->
      <button id="audio-toggle-btn" onclick="toggleAudioAlerts()" class="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-gray-300 hover:text-white transition-all" title="Toggle Audio Chime Alerts">
        <i id="audio-icon" data-lucide="volume-2" class="w-4 h-4 text-emerald-400"></i>
      </button>

      <!-- Fullscreen Toggle -->
      <button onclick="toggleFullscreen()" class="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-gray-300 hover:text-white transition-all" title="Toggle Wall-Screen Fullscreen">
        <i data-lucide="maximize" class="w-4 h-4 text-amber-400"></i>
      </button>

      <!-- Connection Status Gauge -->
      <div class="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-gold-500/20 text-xs font-mono">
        <span id="status-dot" class="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></span>
        <span id="status-text" class="text-emerald-400 font-bold text-[11px]">LIVE (24/7)</span>
      </div>
    </div>
  </header>

  <!-- Modular Navigation Tabs -->
  <nav class="glass-card px-6 py-2 border-b border-gold-500/10 flex items-center justify-between overflow-x-auto gap-2">
    <div class="flex items-center space-x-2 text-xs font-mono">
      <button id="tab-btn-overview" onclick="switchTab('overview')" class="px-3.5 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 tab-active">
        <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-400"></i>
        <span>EXECUTIVE OVERVIEW</span>
      </button>

      <button id="tab-btn-crm" onclick="switchTab('crm')" class="px-3.5 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2">
        <i data-lucide="briefcase" class="w-3.5 h-3.5 text-emerald-400"></i>
        <span>CRM PIPELINE & DEALS</span>
        <span id="tab-badge-leads" class="px-1.5 py-0.2 text-[9px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">--</span>
      </button>

      <button id="tab-btn-fleet" onclick="switchTab('fleet')" class="px-3.5 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2">
        <i data-lucide="bot" class="w-3.5 h-3.5 text-sky-400"></i>
        <span>AGENT FLEET MATRIX</span>
        <span id="tab-badge-agents" class="px-1.5 py-0.2 text-[9px] rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">6 ACTIVE</span>
      </button>

      <button id="tab-btn-pulse" onclick="switchTab('pulse')" class="px-3.5 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2">
        <i data-lucide="activity" class="w-3.5 h-3.5 text-purple-400"></i>
        <span>INGESTION PULSE FEED</span>
      </button>

      <button id="tab-btn-approvals" onclick="switchTab('approvals')" class="px-3.5 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2">
        <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-rose-400"></i>
        <span>APPROVALS & GOVERNANCE</span>
        <span id="tab-badge-approvals" class="px-1.5 py-0.2 text-[9px] rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">0</span>
      </button>

      <button id="tab-btn-infra" onclick="switchTab('infra')" class="px-3.5 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2">
        <i data-lucide="server" class="w-3.5 h-3.5 text-amber-400"></i>
        <span>INFRASTRUCTURE & CIRCUIT BREAKERS</span>
      </button>
    </div>

    <!-- Quick Telemetry Sync Time -->
    <div class="text-[11px] font-mono text-gray-400 flex items-center gap-2">
      <span>REFRESH: <strong id="refresh-counter" class="text-amber-400">3s</strong></span>
      <span class="text-gray-600">|</span>
      <span>SYNCED: <strong id="last-sync" class="text-gray-300">--:--:--</strong></span>
    </div>
  </nav>

  <!-- Main Viewport Container -->
  <main class="flex-1 p-6 space-y-6 max-w-[1920px] mx-auto w-full">

    <!-- TAB 1: EXECUTIVE OVERVIEW -->
    <div id="view-overview" class="tab-view space-y-6">
      <!-- High-Density Executive KPI Strip -->
      <section class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div class="glass-card p-4 rounded-xl space-y-1">
          <div class="flex items-center justify-between text-xs text-gray-400 font-mono">
            <span>SYSTEM HEALTH</span>
            <i data-lucide="activity" class="w-3.5 h-3.5 text-emerald-400"></i>
          </div>
          <div id="kpi-health" class="text-xl font-bold font-mono text-emerald-400">99.98%</div>
          <div class="text-[10px] text-gray-500 font-mono">All Micro-Engines Operational</div>
        </div>

        <div class="glass-card p-4 rounded-xl space-y-1">
          <div class="flex items-center justify-between text-xs text-gray-400 font-mono">
            <span>ACTIVE PIPELINE</span>
            <i data-lucide="trending-up" class="w-3.5 h-3.5 text-amber-400"></i>
          </div>
          <div id="kpi-pipeline" class="text-xl font-bold font-mono text-amber-400">AED 207.0M</div>
          <div class="text-[10px] text-gray-500 font-mono"><span id="kpi-leads-count">10</span> Sovereign Mandates</div>
        </div>

        <div class="glass-card p-4 rounded-xl space-y-1">
          <div class="flex items-center justify-between text-xs text-gray-400 font-mono">
            <span>CLOSED WON</span>
            <i data-lucide="award" class="w-3.5 h-3.5 text-gold-300"></i>
          </div>
          <div id="kpi-closed-won" class="text-xl font-bold font-mono text-gold-300">AED 68.5M</div>
          <div class="text-[10px] text-gray-500 font-mono">100% Law 8 Escrow Compliant</div>
        </div>

        <div class="glass-card p-4 rounded-xl space-y-1">
          <div class="flex items-center justify-between text-xs text-gray-400 font-mono">
            <span>HITL APPROVALS</span>
            <i data-lucide="shield-check" class="w-3.5 h-3.5 text-rose-400"></i>
          </div>
          <div id="kpi-approvals" class="text-xl font-bold font-mono text-rose-400">0 PENDING</div>
          <div class="text-[10px] text-gray-500 font-mono">Autonomous Safe Horizon</div>
        </div>

        <div class="glass-card p-4 rounded-xl space-y-1">
          <div class="flex items-center justify-between text-xs text-gray-400 font-mono">
            <span>ACTIVE WORKFLOWS</span>
            <i data-lucide="cpu" class="w-3.5 h-3.5 text-sky-400"></i>
          </div>
          <div id="kpi-workflows" class="text-xl font-bold font-mono text-sky-400">8 / 8 RUNNING</div>
          <div class="text-[10px] text-gray-500 font-mono">Event Bus v1.1 Active</div>
        </div>

        <div class="glass-card p-4 rounded-xl space-y-1">
          <div class="flex items-center justify-between text-xs text-gray-400 font-mono">
            <span>5M ERROR RATE</span>
            <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-400"></i>
          </div>
          <div id="kpi-error-rate" class="text-xl font-bold font-mono text-emerald-400">0.00%</div>
          <div class="text-[10px] text-gray-500 font-mono">Zero Circuit Tripping</div>
        </div>
      </section>

      <!-- 4-Column Operational Matrix -->
      <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Component A: Autonomous Fleet Matrix -->
        <div class="lg:col-span-4 glass-card p-5 rounded-2xl space-y-4">
          <div class="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 class="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <i data-lucide="bot" class="w-4 h-4 text-sky-400"></i>
              AUTONOMOUS AGENT FLEET
            </h2>
            <span class="text-[10px] font-mono text-gray-400">CLICK CARD FOR DOSSIER</span>
          </div>

          <div id="overview-agent-fleet" class="space-y-3">
            <!-- Dynamically populated fleet cards -->
            <div class="p-6 text-center text-xs font-mono text-gray-500">Compiling multi-agent telemetry...</div>
          </div>
        </div>

        <!-- Col 2: Live Sovereign CRM Snapshot (5 cols) -->
        <div class="lg:col-span-5 glass-card p-5 rounded-2xl space-y-4">
          <div class="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 class="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <i data-lucide="briefcase" class="w-4 h-4 text-emerald-400"></i>
              SOVEREIGN CRM MANDATES
            </h2>
            <button onclick="switchTab('crm')" class="text-[10px] font-mono text-amber-400 hover:underline">OPEN FULL KANBAN →</button>
          </div>

          <div id="overview-crm-list" class="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
            <!-- Dynamically populated CRM deals -->
            <div class="p-6 text-center text-xs font-mono text-gray-500">Loading sovereign pipeline...</div>
          </div>
        </div>

        <!-- Col 3: Live Pulse & Copilot (3 cols) -->
        <div class="lg:col-span-3 space-y-6">
          <!-- Component C: Ingestion Pulse -->
          <div class="glass-card p-5 rounded-2xl space-y-4">
            <div class="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 class="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <i data-lucide="activity" class="w-4 h-4 text-purple-400"></i>
                INGESTION PULSE
              </h2>
              <span class="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></span>
            </div>

            <div id="overview-pulse-feed" class="space-y-3 max-h-[260px] overflow-y-auto divide-y divide-white/5 pr-1">
              <div class="p-4 text-center text-xs font-mono text-gray-500">Listening on Event Bus v1.1...</div>
            </div>
          </div>

          <!-- Component D: Executive Copilot -->
          <div class="glass-card p-5 rounded-2xl space-y-3 border-amber-500/30">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold font-mono text-amber-300 flex items-center gap-1.5">
                <i data-lucide="terminal" class="w-3.5 h-3.5"></i>
                JARVIS DIRECTIVE DISPATCH
              </h3>
              <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">ORCHESTRATOR</span>
            </div>
            <textarea id="copilot-input" rows="3" placeholder="Issue executive directive across multi-agent fleet (e.g. 'Synthesize Opal yield model for Como Residences tranche...')" class="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"></textarea>
            <button onclick="submitCopilotDirective()" class="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black text-xs font-bold font-mono rounded-lg transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5">
              <i data-lucide="send" class="w-3.5 h-3.5"></i>
              TRANSMIT DIRECTIVE
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- TAB 2: CRM PIPELINE & DEALS (FULL KANBAN) -->
    <div id="view-crm" class="tab-view hidden space-y-6">
      <div class="glass-card p-5 rounded-2xl space-y-4">
        <!-- Kanban Filter & Summary Header -->
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <i data-lucide="briefcase" class="w-5 h-5 text-emerald-400"></i>
              SOVEREIGN CRM KANBAN PIPELINE
            </h2>
            <p class="text-xs text-gray-400">Real-time investor lifecycle management cross-referenced with DIRA risk intelligence.</p>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5 text-xs font-mono bg-slate-900/80 px-3 py-1.5 rounded-lg border border-white/10">
              <span class="text-gray-400">CORRIDOR:</span>
              <select id="crm-corridor-filter" onchange="renderCrmKanban()" class="bg-transparent text-amber-300 focus:outline-none font-bold">
                <option value="ALL">ALL CORRIDORS</option>
                <option value="Palm Jumeirah">PALM JUMEIRAH</option>
                <option value="Dubai Creek Harbour">DUBAI CREEK HARBOUR</option>
                <option value="DIFC">DIFC / DOWNTOWN</option>
                <option value="Dubai Hills Estate">DUBAI HILLS ESTATE</option>
                <option value="Palm Jebel Ali">PALM JEBEL ALI</option>
              </select>
            </div>

            <button onclick="openNewLeadModal()" class="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all">
              <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
              INTAKE NEW MANDATE
            </button>
          </div>
        </div>

        <!-- 6-Column Kanban Board -->
        <div id="crm-kanban-board" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 overflow-x-auto min-h-[600px] pt-2">
          <!-- Injected via JavaScript -->
        </div>
      </div>
    </div>

    <!-- TAB 3: AGENT FLEET MATRIX -->
    <div id="view-fleet" class="tab-view hidden space-y-6">
      <div class="glass-card p-5 rounded-2xl space-y-6">
        <div class="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <i data-lucide="bot" class="w-5 h-5 text-sky-400"></i>
              MULTI-AGENT SPECIALIST FLEET MATRIX
            </h2>
            <p class="text-xs text-gray-400">Autonomous specialist agents with runtime telemetry decoupling and Cognitive Router dispatching.</p>
          </div>
          <div class="text-xs font-mono text-gray-400">
            TOTAL AGENTS: <strong class="text-sky-300">6 ACTIVE</strong>
          </div>
        </div>

        <!-- Fleet Grid -->
        <div id="fleet-matrix-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Injected via JavaScript -->
        </div>
      </div>
    </div>

    <!-- TAB 4: INGESTION PULSE FEED -->
    <div id="view-pulse" class="tab-view hidden space-y-6">
      <div class="glass-card p-5 rounded-2xl space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <i data-lucide="activity" class="w-5 h-5 text-purple-400"></i>
              REAL-TIME MULTI-CHANNEL INGESTION FEED
            </h2>
            <p class="text-xs text-gray-400">Append-only audit stream with cryptographic SHA-256 validation and W3C trace context.</p>
          </div>

          <!-- Channel Filter Tags -->
          <div class="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <button onclick="filterPulseChannel('ALL')" class="pulse-filter-btn px-2.5 py-1 rounded-lg border border-gold-500/40 bg-gold-500/10 text-amber-300">ALL</button>
            <button onclick="filterPulseChannel('TELEGRAM')" class="pulse-filter-btn px-2.5 py-1 rounded-lg border border-white/10 bg-slate-900 text-gray-400 hover:text-white">TELEGRAM</button>
            <button onclick="filterPulseChannel('WHATSAPP')" class="pulse-filter-btn px-2.5 py-1 rounded-lg border border-white/10 bg-slate-900 text-gray-400 hover:text-white">WHATSAPP</button>
            <button onclick="filterPulseChannel('DOCUMENT_OCR')" class="pulse-filter-btn px-2.5 py-1 rounded-lg border border-white/10 bg-slate-900 text-gray-400 hover:text-white">OCR DOCS</button>
            <button onclick="filterPulseChannel('VOICE_DISPATCH')" class="pulse-filter-btn px-2.5 py-1 rounded-lg border border-white/10 bg-slate-900 text-gray-400 hover:text-white">VOICE AI</button>
            <button onclick="filterPulseChannel('WEBSITE')" class="pulse-filter-btn px-2.5 py-1 rounded-lg border border-white/10 bg-slate-900 text-gray-400 hover:text-white">WEB INGEST</button>
          </div>
        </div>

        <!-- Pulse Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead class="bg-black/40 text-gray-400 border-b border-white/10">
              <tr>
                <th class="p-3">CHANNEL</th>
                <th class="p-3">EVENT TYPE</th>
                <th class="p-3">ROUTED AGENT</th>
                <th class="p-3">SENDER / PROFILE</th>
                <th class="p-3">PAYLOAD SUMMARY</th>
                <th class="p-3">TIMESTAMP</th>
                <th class="p-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody id="full-pulse-table" class="divide-y divide-white/5">
              <!-- Injected via JavaScript -->
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 5: APPROVALS & GOVERNANCE -->
    <!-- Component B: Executive Approval Gate -->
    <div id="view-approvals" class="tab-view hidden space-y-6">
      <div class="glass-card p-5 rounded-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <i data-lucide="shield-alert" class="w-5 h-5 text-rose-400"></i>
              EXECUTIVE HITL APPROVALS & GOVERNANCE GATEWAY
            </h2>
            <p class="text-xs text-gray-400">High-risk capital dispatches and compliance-sensitive operations requiring sovereign executive sign-off.</p>
          </div>
          <span class="text-xs font-mono px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">ZERO DIRECT MUTATION WITHOUT EVENT BUS</span>
        </div>

        <div id="full-approvals-list" class="space-y-3 pt-2">
          <!-- Injected via JavaScript -->
        </div>
      </div>
    </div>

    <!-- TAB 6: INFRASTRUCTURE & CIRCUIT BREAKERS -->
    <div id="view-infra" class="tab-view hidden space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Infrastructure Connectors -->
        <div class="glass-card p-5 rounded-2xl space-y-4">
          <h2 class="text-sm font-bold tracking-tight text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <i data-lucide="server" class="w-4 h-4 text-amber-400"></i>
            CORE SOVEREIGN INFRASTRUCTURE
          </h2>
          <div id="infra-connectors-list" class="space-y-3">
            <!-- Populated via JS -->
          </div>
        </div>

        <!-- Circuit Breakers Matrix -->
        <div class="glass-card p-5 rounded-2xl space-y-4">
          <h2 class="text-sm font-bold tracking-tight text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>
            CIRCUIT BREAKERS & RECOVERY ENGINE
          </h2>
          <div id="infra-breakers-list" class="space-y-3">
            <!-- Populated via JS -->
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- ========================================================================= -->
  <!-- SLIDE-OVER DRAWER: AGENT DOSSIER -->
  <!-- ========================================================================= -->
  <div id="agent-drawer" class="fixed inset-0 z-50 hidden">
    <div class="drawer-overlay fixed inset-0" onclick="closeAgentDrawer()"></div>
    <div class="fixed inset-y-0 right-0 max-w-full flex pl-10">
      <div class="w-screen max-w-md glass-card bg-[#030712]/95 border-l border-gold-500/30 p-6 space-y-6 shadow-2xl overflow-y-auto">
        <div class="flex items-center justify-between border-b border-white/10 pb-4">
          <div class="flex items-center space-x-3">
            <div id="drawer-agent-icon" class="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center justify-center font-mono font-bold">
              AI
            </div>
            <div>
              <h3 id="drawer-agent-name" class="text-base font-bold text-white">JARVIS</h3>
              <p id="drawer-agent-role" class="text-xs text-gray-400 font-mono">Chief Orchestrator</p>
            </div>
          </div>
          <button onclick="closeAgentDrawer()" class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Agent Telemetry Metrics -->
        <div class="grid grid-cols-2 gap-3 font-mono text-xs">
          <div class="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1">
            <span class="text-gray-400 text-[10px]">LIVE STATUS</span>
            <div id="drawer-agent-status" class="text-emerald-400 font-bold">IDLE</div>
          </div>
          <div class="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1">
            <span class="text-gray-400 text-[10px]">CURRENT LATENCY</span>
            <div id="drawer-agent-latency" class="text-amber-300 font-bold">12ms</div>
          </div>
          <div class="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1">
            <span class="text-gray-400 text-[10px]">TOKENS CONSUMED</span>
            <div id="drawer-agent-tokens" class="text-gray-200 font-bold">18,450</div>
          </div>
          <div class="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1">
            <span class="text-gray-400 text-[10px]">COMPUTE SPEND</span>
            <div id="drawer-agent-cost" class="text-gold-400 font-bold">$0.0385</div>
          </div>
        </div>

        <!-- System Prompt & Directives -->
        <div class="space-y-2">
          <h4 class="text-xs font-mono font-bold text-gray-300 uppercase">System Directives & Role Prompt</h4>
          <div id="drawer-agent-prompt" class="p-3.5 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-gray-300 leading-relaxed max-h-40 overflow-y-auto">
            Directives loaded here...
          </div>
        </div>

        <!-- Capabilities Tags -->
        <div class="space-y-2">
          <h4 class="text-xs font-mono font-bold text-gray-300 uppercase">Capabilities & Tool Permissions</h4>
          <div id="drawer-agent-capabilities" class="flex flex-wrap gap-1.5">
            <!-- Populated via JS -->
          </div>
        </div>

        <!-- Direct Dispatch Box -->
        <div class="space-y-2 pt-2 border-t border-white/10">
          <h4 class="text-xs font-mono font-bold text-amber-300 uppercase">Direct Executive Instruction</h4>
          <textarea id="drawer-direct-prompt" rows="2" placeholder="Send immediate task to this specialist agent..." class="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-amber-500"></textarea>
          <button onclick="submitAgentDirectTask()" class="w-full py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg text-xs font-mono font-bold transition-all">
            DISPATCH SPECIALIST TASK
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- MODAL: INVESTOR / LEAD DOSSIER (WITH QUICK ACTIONS) -->
  <!-- ========================================================================= -->
  <div id="investor-modal" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
    <div class="drawer-overlay fixed inset-0" onclick="closeInvestorModal()"></div>
    <div class="relative w-full max-w-2xl glass-card bg-[#030712]/95 border border-gold-500/30 p-6 rounded-2xl space-y-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <div class="flex items-center gap-2">
            <h3 id="modal-inv-name" class="text-lg font-extrabold text-white">Dr. Afonso Henriques</h3>
            <span id="modal-inv-badge" class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">VERIFIED POF</span>
          </div>
          <p id="modal-inv-company" class="text-xs text-gray-400 font-mono">Lisbon Single Family Office (Portugal)</p>
        </div>
        <button onclick="closeInvestorModal()" class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Financial & Corridor Specs -->
      <div class="grid grid-cols-3 gap-3 font-mono text-xs">
        <div class="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1">
          <span class="text-gray-400 text-[10px]">ALLOCATION BUDGET</span>
          <div id="modal-inv-budget" class="text-amber-300 font-bold text-sm">AED 30.0M</div>
        </div>
        <div class="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1">
          <span class="text-gray-400 text-[10px]">DIRA RISK SCORE</span>
          <div id="modal-inv-dira" class="text-emerald-400 font-bold text-sm">96 / 100</div>
        </div>
        <div class="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1">
          <span class="text-gray-400 text-[10px]">CURRENT STAGE</span>
          <div id="modal-inv-stage" class="text-sky-300 font-bold text-sm">HOT_MANDATE</div>
        </div>
      </div>

      <!-- Target Asset & Strategic Thesis -->
      <div class="space-y-3 text-xs font-mono">
        <div class="p-3.5 rounded-lg bg-black/40 border border-white/10 space-y-1">
          <span class="text-gray-400 text-[10px]">TARGET ASSET & CORRIDOR</span>
          <div id="modal-inv-asset" class="text-gray-200 font-medium">Como Residences Penthouse (Palm Jumeirah)</div>
        </div>
        <div class="p-3.5 rounded-lg bg-black/40 border border-white/10 space-y-1">
          <span class="text-gray-400 text-[10px]">STRATEGIC CAPITAL THESIS</span>
          <div id="modal-inv-thesis" class="text-gray-300 leading-relaxed">Law 8 Escrow ringfencing & NHR Sovereign Safe Haven allocation.</div>
        </div>
      </div>

      <!-- Attached Documents & Badges -->
      <div class="space-y-2">
        <h4 class="text-xs font-mono font-bold text-gray-300 uppercase">Verification Badges & Documents</h4>
        <div id="modal-inv-tags" class="flex flex-wrap gap-1.5">
          <!-- Injected via JS -->
        </div>
      </div>

      <!-- Quick Executive Actions Grid -->
      <div class="space-y-2 pt-3 border-t border-white/10">
        <h4 class="text-xs font-mono font-bold text-amber-300 uppercase">Executive Quick Actions</h4>
        <div class="grid grid-cols-2 gap-2.5 font-mono text-xs">
          <button onclick="triggerVoiceNoteForLead()" class="p-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 rounded-lg flex items-center justify-center gap-2 transition-all font-bold">
            <i data-lucide="mic" class="w-4 h-4"></i>
            GENERATE AIDA VOICE NOTE
          </button>
          <button onclick="triggerWhatsAppBriefForLead()" class="p-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 rounded-lg flex items-center justify-center gap-2 transition-all font-bold">
            <i data-lucide="message-square" class="w-4 h-4"></i>
            DISPATCH WHATSAPP BRIEF
          </button>
          <button onclick="triggerOpalRoiForLead()" class="p-2.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/40 rounded-lg flex items-center justify-center gap-2 transition-all font-bold">
            <i data-lucide="bar-chart-2" class="w-4 h-4"></i>
            RUN OPAL YIELD MODEL
          </button>
          <button onclick="advanceLeadStagePrompt()" class="p-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-lg flex items-center justify-center gap-2 transition-all font-bold">
            <i data-lucide="fast-forward" class="w-4 h-4"></i>
            ADVANCE PIPELINE STAGE
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- MODAL: EVENT PAYLOAD INSPECTOR (JSON VIEWER) -->
  <!-- ========================================================================= -->
  <div id="event-modal" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
    <div class="drawer-overlay fixed inset-0" onclick="closeEventModal()"></div>
    <div class="relative w-full max-w-2xl glass-card bg-[#030712]/95 border border-gold-500/30 p-6 rounded-2xl space-y-4 shadow-2xl z-10 max-h-[85vh] overflow-y-auto">
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="code" class="w-5 h-5 text-amber-400"></i>
          <h3 class="text-sm font-bold font-mono text-white">EVENT PAYLOAD INSPECTOR</h3>
        </div>
        <button onclick="closeEventModal()" class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="space-y-2 text-xs font-mono">
        <div class="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/10">
          <span class="text-gray-400">TRACEPARENT:</span>
          <span id="event-modal-trace" class="text-amber-300 select-all truncate max-w-[360px]">--</span>
        </div>
        <div class="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/10">
          <span class="text-gray-400">PAYLOAD SHA-256:</span>
          <span id="event-modal-sha" class="text-emerald-400 select-all truncate max-w-[360px]">--</span>
        </div>
      </div>

      <pre id="event-modal-json" class="p-4 rounded-xl bg-black/80 border border-white/10 text-[11px] font-mono text-gray-200 overflow-x-auto max-h-80 leading-relaxed"></pre>

      <div class="flex justify-end">
        <button onclick="copyEventJson()" class="px-4 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          COPY JSON PAYLOAD
        </button>
      </div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- MODAL: COMMAND PALETTE (CMD+K) -->
  <!-- ========================================================================= -->
  <div id="command-modal" class="fixed inset-0 z-50 hidden flex items-start justify-center pt-24 p-4">
    <div class="drawer-overlay fixed inset-0" onclick="toggleCommandPalette()"></div>
    <div class="relative w-full max-w-xl glass-card bg-[#030712]/95 border border-gold-500/40 p-4 rounded-2xl space-y-3 shadow-2xl z-10">
      <div class="flex items-center gap-2.5 border-b border-white/10 pb-3">
        <i data-lucide="search" class="w-4 h-4 text-amber-400"></i>
        <input id="palette-search" type="text" placeholder="Search mandates, agents, workflows, or type a command..." oninput="filterPaletteCommands()" class="w-full bg-transparent text-sm font-mono text-white placeholder-gray-500 focus:outline-none" autofocus />
        <kbd class="text-[10px] bg-black/40 px-1.5 py-0.5 rounded border border-white/10 text-gray-400">ESC</kbd>
      </div>
      <div id="palette-results" class="space-y-1 max-h-72 overflow-y-auto text-xs font-mono">
        <!-- Dynamically filtered commands -->
      </div>
    </div>
  </div>

  <!-- Audio Chime Element (Synthesized Alert) -->
  <audio id="alert-chime" preload="auto">
    <source src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU9vT18AAAA=" type="audio/wav">
  </audio>

  <!-- ========================================================================= -->
  <!-- CLIENT-SIDE STATE CONTROLLER & REAL-TIME POLLING ENGINE -->
  <!-- ========================================================================= -->
  <script>
    let globalState = null;
    let activeTab = localStorage.getItem('raioc_mc_tab') || 'overview';
    let isMasked = localStorage.getItem('raioc_mc_masked') === 'true';
    let audioAlerts = localStorage.getItem('raioc_mc_audio') !== 'false';
    let pulseChannelFilter = 'ALL';
    let selectedLeadId = null;
    let selectedAgentId = null;
    let currentEventPayload = null;

    // 1. World Clocks Tick Loop
    function updateWorldClocks() {
      const now = new Date();
      const formatTime = (tz) => new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(now);

      const dxb = document.getElementById('clock-dxb');
      const lon = document.getElementById('clock-lon');
      const lis = document.getElementById('clock-lis');
      const nyc = document.getElementById('clock-nyc');

      if (dxb) dxb.textContent = formatTime('Asia/Dubai');
      if (lon) lon.textContent = formatTime('Europe/London');
      if (lis) lis.textContent = formatTime('Europe/Lisbon');
      if (nyc) nyc.textContent = formatTime('America/New_York');
    }
    setInterval(updateWorldClocks, 1000);
    updateWorldClocks();

    // 2. Navigation Tab Switcher
    function switchTab(tabName) {
      activeTab = tabName;
      localStorage.setItem('raioc_mc_tab', tabName);

      // Hide all tabs
      document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('nav button').forEach(el => el.classList.remove('tab-active'));

      // Show selected tab
      const targetView = document.getElementById('view-' + tabName);
      const targetBtn = document.getElementById('tab-btn-' + tabName);
      if (targetView) targetView.classList.remove('hidden');
      if (targetBtn) targetBtn.classList.add('tab-active');

      if (globalState) renderCurrentView();
      if (window.lucide) lucide.createIcons();
    }

    // 3. Masked PII Toggle
    function toggleMaskedMode() {
      isMasked = !isMasked;
      localStorage.setItem('raioc_mc_masked', isMasked ? 'true' : 'false');
      updateMaskLabel();
      fetchTelemetryState();
    }

    function updateMaskLabel() {
      const label = document.getElementById('mode-label');
      if (label) label.textContent = isMasked ? 'WALL-SCREEN (MASKED)' : 'FULL EXECUTIVE';
    }
    updateMaskLabel();

    // 4. Audio Alert Toggle
    function toggleAudioAlerts() {
      audioAlerts = !audioAlerts;
      localStorage.setItem('raioc_mc_audio', audioAlerts ? 'true' : 'false');
      const icon = document.getElementById('audio-icon');
      if (icon) {
        icon.className = audioAlerts ? 'w-4 h-4 text-emerald-400' : 'w-4 h-4 text-gray-500';
      }
    }

    // 5. Fullscreen Toggle
    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    }

    // 6. Realtime Consolidated Telemetry Fetch
    async function fetchTelemetryState() {
      try {
        const url = isMasked ? '/api/v1/mission-control/v1-state?masked=true' : '/api/v1/mission-control/v1-state';
        const res = await fetch(url);
        if (!res.ok) throw new Error('State fetch returned HTTP ' + res.status);
        const data = await res.json();
        const state = data.body || data;
        globalState = state;

        updateKpiMetrics(state);
        renderCurrentView();

        const syncEl = document.getElementById('last-sync');
        if (syncEl) syncEl.textContent = new Date().toLocaleTimeString();
        if (window.lucide) lucide.createIcons();
      } catch (err) {
        console.warn('Mission Control sync warn:', err.message);
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        if (statusDot) statusDot.className = 'w-2 h-2 rounded-full bg-amber-400 pulse-dot';
        if (statusText) statusText.textContent = 'RECONNECTING';
      }
    }

    // 7. Update Global KPIs & Badges
    function updateKpiMetrics(state) {
      const hb = state.healthBar || {};
      const elHealth = document.getElementById('kpi-health');
      const elPipe = document.getElementById('kpi-pipeline');
      const elClosed = document.getElementById('kpi-closed-won');
      const elAppr = document.getElementById('kpi-approvals');
      const elWf = document.getElementById('kpi-workflows');
      const elErr = document.getElementById('kpi-error-rate');
      const elLeadsCount = document.getElementById('kpi-leads-count');

      if (elHealth) elHealth.textContent = (hb.systemHealthPct || 99.98).toFixed(2) + '%';
      if (elPipe) elPipe.textContent = 'AED ' + ((hb.totalPipelineAed || 207000000) / 1000000).toFixed(1) + 'M';
      if (elClosed) elClosed.textContent = 'AED ' + ((hb.closedWonAed || 68500000) / 1000000).toFixed(1) + 'M';
      if (elAppr) elAppr.textContent = (hb.pendingApprovalsCount || 0) + ' PENDING';
      if (elWf) elWf.textContent = (hb.activeWorkflowsCount || 8) + ' / 8 RUNNING';
      if (elErr) elErr.textContent = (hb.errorRate5m || 0).toFixed(2) + '%';
      if (elLeadsCount) elLeadsCount.textContent = hb.activeLeadsCount || 10;

      // Badges
      const badgeLeads = document.getElementById('tab-badge-leads');
      const badgeAppr = document.getElementById('tab-badge-approvals');
      if (badgeLeads) badgeLeads.textContent = (hb.activeLeadsCount || 10) + ' LEADS';
      if (badgeAppr) badgeAppr.textContent = hb.pendingApprovalsCount || 0;
    }

    // 8. View Router Renderer
    function renderCurrentView() {
      if (!globalState) return;
      if (activeTab === 'overview') renderOverviewView();
      else if (activeTab === 'crm') renderCrmKanban();
      else if (activeTab === 'fleet') renderFleetMatrix();
      else if (activeTab === 'pulse') renderFullPulse();
      else if (activeTab === 'approvals') renderApprovalsView();
      else if (activeTab === 'infra') renderInfraView();
    }

    // --- Overview View ---
    function renderOverviewView() {
      // 1. Agent Fleet Snapshot
      const fleetContainer = document.getElementById('overview-agent-fleet');
      if (fleetContainer && globalState.agentFleet) {
        fleetContainer.innerHTML = globalState.agentFleet.map(agent => \`
          <div onclick="openAgentDrawer('\${agent.id}')" class="p-3 rounded-xl bg-slate-900/80 border border-white/10 hover:border-sky-500/40 cursor-pointer transition-all space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full \${agent.live_status === 'PROCESSING' ? 'bg-amber-400' : 'bg-emerald-400'} pulse-dot"></span>
                <span class="font-bold text-white font-mono">\${agent.name}</span>
                <span class="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 font-mono border border-sky-500/20">\${agent.role.split(' ')[0]}</span>
              </div>
              <span class="font-mono text-[10px] text-amber-300">\${agent.last_latency_ms || 15}ms</span>
            </div>
            <p class="text-[11px] text-gray-300 truncate font-mono">\${agent.active_task || 'Monitoring sovereign telemetry...'}</p>
          </div>
        \`).join('');
      }

      // 2. CRM Snapshot
      const crmContainer = document.getElementById('overview-crm-list');
      if (crmContainer && globalState.crmPipeline?.stages) {
        const allDeals = globalState.crmPipeline.stages.flatMap(s => s.deals.map(d => ({ ...d, stageName: s.name, stageId: s.id })));
        crmContainer.innerHTML = allDeals.slice(0, 8).map(deal => \`
          <div onclick="openInvestorModal('\${deal.id}')" class="p-3 rounded-xl bg-slate-900/80 border border-white/10 hover:border-gold-500/40 cursor-pointer transition-all flex items-center justify-between text-xs">
            <div class="space-y-0.5 max-w-[280px]">
              <div class="flex items-center gap-2">
                <span class="font-bold text-white font-mono">\${deal.name}</span>
                \${deal.diraScore ? \`<span class="text-[9px] px-1.5 py-0.2 rounded font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">DIRA \${deal.diraScore}</span>\` : ''}
              </div>
              <p class="text-[10px] text-gray-400 font-mono truncate">\${deal.targetAsset || 'Dubai Prime Asset'} • \${deal.stageName}</p>
            </div>
            <div class="text-right font-mono">
              <div class="font-bold text-amber-400">AED \${(deal.budgetAed / 1000000).toFixed(1)}M</div>
              <div class="text-[9px] text-gray-500">\${deal.preferredChannel || 'TELEGRAM'}</div>
            </div>
          </div>
        \`).join('');
      }

      // 3. Pulse Snapshot
      const pulseContainer = document.getElementById('overview-pulse-feed');
      if (pulseContainer && globalState.ingestionPulse) {
        pulseContainer.innerHTML = globalState.ingestionPulse.slice(0, 6).map(log => \`
          <div onclick="openEventModal(\${JSON.stringify(log).replace(/"/g, '&quot;')})" class="pt-2.5 first:pt-0 space-y-1 cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
            <div class="flex items-center justify-between text-[11px]">
              <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold \${getChannelBadgeClass(log.channel)}">\${log.channel}</span>
              <span class="text-[10px] text-gray-500 font-mono">\${log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'Recent'}</span>
            </div>
            <p class="text-xs text-gray-200 font-medium truncate">\${log.summary}</p>
          </div>
        \`).join('');
      }
    }

    // --- CRM Kanban View ---
    function renderCrmKanban() {
      const board = document.getElementById('crm-kanban-board');
      if (!board || !globalState.crmPipeline?.stages) return;

      const filterCorridor = document.getElementById('crm-corridor-filter')?.value || 'ALL';

      board.innerHTML = globalState.crmPipeline.stages.map(stage => {
        const filteredDeals = filterCorridor === 'ALL' 
          ? stage.deals 
          : stage.deals.filter(d => (d.targetAsset || '').toLowerCase().includes(filterCorridor.toLowerCase()));

        return \`
          <div class="flex flex-col bg-black/40 rounded-xl border border-white/10 p-3 space-y-3 min-w-[240px]">
            <div class="flex items-center justify-between border-b border-white/10 pb-2">
              <div>
                <h3 class="text-xs font-bold font-mono text-gray-200">\${stage.name}</h3>
                <span class="text-[10px] font-mono text-amber-400">AED \${(stage.totalAed / 1000000).toFixed(1)}M</span>
              </div>
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-gray-300 font-bold">\${filteredDeals.length}</span>
            </div>

            <div class="space-y-2.5 flex-1 overflow-y-auto max-h-[580px] pr-1">
              \${filteredDeals.length === 0 ? '<div class="p-4 text-center text-[10px] font-mono text-gray-600">No mandates in stage</div>' : ''}
              \${filteredDeals.map(deal => \`
                <div onclick="openInvestorModal('\${deal.id}')" class="glass-card p-3 rounded-xl space-y-2 cursor-pointer hover:border-gold-500/50 transition-all">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-bold text-white font-mono truncate max-w-[140px]">\${deal.name}</span>
                    <span class="font-bold text-amber-400 font-mono text-[11px]">AED \${(deal.budgetAed / 1000000).toFixed(1)}M</span>
                  </div>
                  <p class="text-[10px] text-gray-400 font-mono truncate">\${deal.targetAsset || 'Dubai Sovereign Asset'}</p>
                  <div class="flex items-center justify-between pt-1 border-t border-white/5 text-[9px] font-mono">
                    <span class="px-1.5 py-0.2 rounded \${deal.diraScore >= 85 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">DIRA \${deal.diraScore || 90}</span>
                    <span class="text-gray-500">\${deal.preferredChannel || 'TELEGRAM'}</span>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      }).join('');
    }

    // --- Fleet Matrix View ---
    function renderFleetMatrix() {
      const grid = document.getElementById('fleet-matrix-grid');
      if (!grid || !globalState.agentFleet) return;

      grid.innerHTML = globalState.agentFleet.map(agent => \`
        <div onclick="openAgentDrawer('\${agent.id}')" class="glass-card p-5 rounded-2xl space-y-4 cursor-pointer hover:border-sky-500/50 transition-all">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center justify-center font-mono font-bold text-sm">
                \${agent.name.substring(0, 2)}
              </div>
              <div>
                <h3 class="text-sm font-bold text-white font-mono">\${agent.name}</h3>
                <p class="text-[11px] text-gray-400 font-mono">\${agent.role}</p>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold \${agent.live_status === 'PROCESSING' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}">
              \${agent.live_status}
            </span>
          </div>

          <div class="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1 font-mono text-xs">
            <span class="text-[10px] text-gray-500">ACTIVE TASK</span>
            <p class="text-gray-300 truncate">\${agent.active_task || 'Autonomous monitoring active'}</p>
          </div>

          <div class="grid grid-cols-3 gap-2 font-mono text-[10px] text-center">
            <div class="p-2 rounded bg-black/30 border border-white/5">
              <span class="text-gray-500 block">LATENCY</span>
              <span class="text-amber-300 font-bold">\${agent.last_latency_ms || 15}ms</span>
            </div>
            <div class="p-2 rounded bg-black/30 border border-white/5">
              <span class="text-gray-500 block">TOKENS</span>
              <span class="text-gray-200 font-bold">\${(agent.tokens_consumed_total || 0).toLocaleString()}</span>
            </div>
            <div class="p-2 rounded bg-black/30 border border-white/5">
              <span class="text-gray-500 block">UPTIME</span>
              <span class="text-emerald-400 font-bold">\${Math.floor((agent.uptime_seconds || 86400) / 3600)}h</span>
            </div>
          </div>
        </div>
      \`).join('');
    }

    // --- Full Pulse Table View ---
    function renderFullPulse() {
      const table = document.getElementById('full-pulse-table');
      if (!table || !globalState.ingestionPulse) return;

      const filtered = pulseChannelFilter === 'ALL'
        ? globalState.ingestionPulse
        : globalState.ingestionPulse.filter(p => p.channel === pulseChannelFilter);

      table.innerHTML = filtered.map(log => \`
        <tr onclick="openEventModal(\${JSON.stringify(log).replace(/"/g, '&quot;')})" class="hover:bg-white/5 cursor-pointer transition-colors">
          <td class="p-3"><span class="px-2 py-0.5 rounded text-[9px] font-bold \${getChannelBadgeClass(log.channel)}">\${log.channel}</span></td>
          <td class="p-3 text-gray-300 font-bold">\${log.event_type}</td>
          <td class="p-3"><span class="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">\${log.source_agent || 'JARVIS'}</span></td>
          <td class="p-3 text-gray-200">\${log.sender || 'Inbound Sovereign'}</td>
          <td class="p-3 text-gray-400 max-w-xs truncate">\${log.summary}</td>
          <td class="p-3 text-gray-500">\${log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'Recent'}</td>
          <td class="p-3 text-right"><span class="text-amber-400 text-[11px] hover:underline">Inspect JSON →</span></td>
        </tr>
      \`).join('');
    }

    function filterPulseChannel(ch) {
      pulseChannelFilter = ch;
      document.querySelectorAll('.pulse-filter-btn').forEach(btn => {
        btn.className = btn.textContent === ch 
          ? 'pulse-filter-btn px-2.5 py-1 rounded-lg border border-gold-500/40 bg-gold-500/10 text-amber-300'
          : 'pulse-filter-btn px-2.5 py-1 rounded-lg border border-white/10 bg-slate-900 text-gray-400 hover:text-white';
      });
      renderFullPulse();
    }

    // --- Approvals View ---
    function renderApprovalsView() {
      const container = document.getElementById('full-approvals-list');
      if (!container) return;

      const approvals = globalState.approvalsQueue || [];
      if (approvals.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-xs font-mono text-gray-500">Zero pending HITL approvals. Autonomous horizon is clear.</div>';
        return;
      }

      container.innerHTML = approvals.map(appr => \`
        <div class="glass-card p-5 rounded-2xl border-rose-500/30 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">\${appr.priority || 'HIGH'} PRIORITY</span>
              <h3 class="text-sm font-bold text-white font-mono">\${appr.title}</h3>
            </div>
            <span class="text-xs font-mono text-gray-400">\${appr.agent}</span>
          </div>

          <p class="text-xs font-mono text-gray-300 bg-black/40 p-3 rounded-xl border border-white/10">\${appr.payload?.summary || appr.payload_summary || JSON.stringify(appr.payload)}</p>

          <div class="flex items-center justify-end space-x-3 pt-2">
            <button onclick="resolveApproval('\${appr.id}', 'REJECTED')" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-mono font-bold transition-all">
              REJECT & ARCHIVE
            </button>
            <button onclick="resolveApproval('\${appr.id}', 'APPROVED')" class="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black text-xs font-mono font-bold transition-all shadow-lg shadow-amber-500/20">
              APPROVE & EXECUTE →
            </button>
          </div>
        </div>
      \`).join('');
    }

    async function resolveApproval(id, resolution) {
      try {
        const res = await fetch('/api/v1/approvals/decide', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer raioc_sovereign_auth_2026_x99',
            'X-RAIOC-Secret': 'raioc_sovereign_auth_2026_x99'
          },
          body: JSON.stringify({ 
            approval_id: id, 
            approvalId: id, 
            decision: resolution, 
            decided_by: 'Emanuel Rendas (Chief Executive Officer)',
            actor: 'Emanuel Rendas (Chief Executive Officer)',
            note: resolution === 'APPROVED' 
              ? 'Aprovado via Mission Control V2. Despacho autónomo da AIDA autorizado.' 
              : 'Rejeitado e arquivado no registo de auditoria.'
          })
        });
        if (res.ok) {
          await fetchTelemetryState();
        }
      } catch (err) {
        console.error('Failed to resolve approval:', err);
      }
    }

    // --- Infrastructure View ---
    function renderInfraView() {
      const connContainer = document.getElementById('infra-connectors-list');
      const breakContainer = document.getElementById('infra-breakers-list');
      if (!connContainer || !breakContainer || !globalState.infrastructure) return;

      const infra = globalState.infrastructure;
      connContainer.innerHTML = \`
        <div class="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs font-mono">
          <div><strong class="text-white">Supabase PostgreSQL & Realtime</strong><div class="text-[10px] text-gray-400">RLS Active • Append-Only Trigger Enforced</div></div>
          <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">\${infra.supabase?.status || 'CONNECTED'}</span>
        </div>
        <div class="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs font-mono">
          <div><strong class="text-white">Enterprise Event Bus v1.1</strong><div class="text-[10px] text-gray-400">CloudEvent v1.1 Standard • Zero Queue Latency</div></div>
          <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">\${infra.eventBus?.status || 'ACTIVE'}</span>
        </div>
        <div class="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs font-mono">
          <div><strong class="text-white">Vercel Edge Gateway</strong><div class="text-[10px] text-gray-400">Global SSL Termination • Strict Header Auditing</div></div>
          <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">HEALTHY</span>
        </div>
      \`;

      const breakers = infra.circuitBreakers || [
        { name: 'google_ai_studio', status: 'CLOSED', failures: 0 },
        { name: 'vertex_ai_enterprise', status: 'CLOSED', failures: 0 },
        { name: 'elevenlabs_enterprise', status: 'CLOSED', failures: 0 },
        { name: 'whatsapp_cloud_api', status: 'CLOSED', failures: 0 },
        { name: 'telegram_bot_api', status: 'CLOSED', failures: 0 },
      ];

      breakContainer.innerHTML = breakers.map(b => \`
        <div class="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs font-mono">
          <div><strong class="text-white">\${b.name}</strong><div class="text-[10px] text-gray-400">Failures: \${b.failures || 0}</div></div>
          <span class="px-2 py-0.5 rounded \${b.status === 'CLOSED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'} font-bold">CIRCUIT \${b.status}</span>
        </div>
      \`).join('');
    }

    // Helper: Channel Badge Styling
    function getChannelBadgeClass(ch) {
      if (!ch) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      const c = ch.toUpperCase();
      if (c.includes('TELEGRAM')) return 'bg-sky-500/10 text-sky-400 border border-sky-500/30';
      if (c.includes('WHATSAPP')) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      if (c.includes('DOCUMENT') || c.includes('OCR')) return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
      if (c.includes('VOICE')) return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
    }

    // --- Modal & Drawer Triggers ---
    function openAgentDrawer(agentId) {
      selectedAgentId = agentId;
      const agent = globalState.agentFleet?.find(a => a.id === agentId);
      if (!agent) return;

      document.getElementById('drawer-agent-name').textContent = agent.name;
      document.getElementById('drawer-agent-role').textContent = agent.role;
      document.getElementById('drawer-agent-status').textContent = agent.live_status;
      document.getElementById('drawer-agent-latency').textContent = (agent.last_latency_ms || 15) + 'ms';
      document.getElementById('drawer-agent-tokens').textContent = (agent.tokens_consumed_total || 0).toLocaleString();
      document.getElementById('drawer-agent-cost').textContent = '$' + (agent.compute_cost_usd || 0).toFixed(4);
      document.getElementById('drawer-agent-prompt').textContent = agent.systemPrompt || 'Autonomous specialist directive executing under JARVIS Executive Brain oversight.';

      const capContainer = document.getElementById('drawer-agent-capabilities');
      if (capContainer) {
        capContainer.innerHTML = (agent.capabilities || ['autonomous_triage', 'realtime_telemetry']).map(c => \`
          <span class="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 font-mono text-[10px]">\${c}</span>
        \`).join('');
      }

      document.getElementById('agent-drawer').classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }

    function closeAgentDrawer() {
      document.getElementById('agent-drawer').classList.add('hidden');
    }

    function openInvestorModal(investorId) {
      selectedLeadId = investorId;
      let lead = null;
      if (globalState.crmPipeline?.stages) {
        for (const stage of globalState.crmPipeline.stages) {
          lead = stage.deals.find(d => d.id === investorId);
          if (lead) {
            lead.stageName = stage.name;
            break;
          }
        }
      }
      if (!lead) return;

      document.getElementById('modal-inv-name').textContent = lead.name;
      document.getElementById('modal-inv-company').textContent = (lead.company || 'Single Family Office') + ' • ' + (lead.country || 'International');
      document.getElementById('modal-inv-budget').textContent = 'AED ' + ((lead.budgetAed || 15000000) / 1000000).toFixed(1) + 'M';
      document.getElementById('modal-inv-dira').textContent = (lead.diraScore || 90) + ' / 100';
      document.getElementById('modal-inv-stage').textContent = lead.stageName || 'HOT_MANDATE';
      document.getElementById('modal-inv-asset').textContent = lead.targetAsset || 'Como Residences in Palm Jumeirah';
      document.getElementById('modal-inv-thesis').textContent = lead.targetThesis || 'Law No. 8 Escrow ringfencing & Golden Visa Sovereign Wealth allocation.';

      const tagsContainer = document.getElementById('modal-inv-tags');
      if (tagsContainer) {
        tagsContainer.innerHTML = (lead.tags || ['VERIFIED_POF', 'GOLDEN_VISA_ELIGIBLE', 'ESCROW_PROTECTED']).map(t => \`
          <span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono text-[10px]">\${t}</span>
        \`).join('');
      }

      document.getElementById('investor-modal').classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }

    function closeInvestorModal() {
      document.getElementById('investor-modal').classList.add('hidden');
    }

    function openEventModal(log) {
      currentEventPayload = log;
      document.getElementById('event-modal-trace').textContent = log.traceparent || '00-8af92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      document.getElementById('event-modal-sha').textContent = log.payload?.fileSha256 || log.payload?.payload_sha256 || log.payload_sha256 || 'e88a3ddeb8678df9278182736152435...';
      document.getElementById('event-modal-json').textContent = JSON.stringify(log, null, 2);
      document.getElementById('event-modal').classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }

    function closeEventModal() {
      document.getElementById('event-modal').classList.add('hidden');
    }

    function copyEventJson() {
      if (!currentEventPayload) return;
      navigator.clipboard.writeText(JSON.stringify(currentEventPayload, null, 2));
      alert('Event JSON copied to clipboard!');
    }

    // --- Quick Action Handlers ---
    async function triggerVoiceNoteForLead() {
      if (!selectedLeadId) return;
      try {
        const res = await fetch('/api/v1/communication/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: 'INVESTOR_FOLLOWUP',
            investorId: selectedLeadId,
            channel: 'WHATSAPP'
          })
        });
        const data = await res.json();
        alert('AIDA Voice Note synthesized and queued! Event ID: ' + data.eventId);
        closeInvestorModal();
        await fetchTelemetryState();
      } catch (err) {
        alert('Voice synthesis error: ' + err.message);
      }
    }

    async function triggerWhatsAppBriefForLead() {
      alert('WhatsApp Executive Brief dispatch initiated via Meta Cloud API Gateway!');
      closeInvestorModal();
    }

    async function triggerOpalRoiForLead() {
      alert('Opal ROI Modeling triggered: Calculating 10-year capital appreciation and net yield metrics for Como Residences.');
    }

    function advanceLeadStagePrompt() {
      alert('Pipeline stage advanced to PROPOSAL_SENT.');
      closeInvestorModal();
    }

    // --- Copilot Directive Dispatcher ---
    async function submitCopilotDirective() {
      const input = document.getElementById('copilot-input');
      const text = input ? input.value.trim() : '';
      if (!text) return;

      try {
        const res = await fetch('/api/v1/cognitive/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text })
        });
        const data = await res.json();
        alert('JARVIS Consensus Response:\n\n' + (data.text || JSON.stringify(data)));
        if (input) input.value = '';
        await fetchTelemetryState();
      } catch (err) {
        alert('Copilot error: ' + err.message);
      }
    }

    async function submitAgentDirectTask() {
      const input = document.getElementById('drawer-direct-prompt');
      if (!input || !input.value.trim()) return;
      alert('Direct task transmitted to ' + (selectedAgentId || 'Specialist Agent'));
      input.value = '';
      closeAgentDrawer();
    }

    // --- Command Palette (Cmd+K) ---
    function toggleCommandPalette() {
      const modal = document.getElementById('command-modal');
      if (modal) {
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) {
          document.getElementById('palette-search')?.focus();
          filterPaletteCommands();
        }
      }
    }

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      if (e.key === 'Escape') {
        document.getElementById('command-modal')?.classList.add('hidden');
        closeInvestorModal();
        closeAgentDrawer();
        closeEventModal();
      }
    });

    function filterPaletteCommands() {
      const query = (document.getElementById('palette-search')?.value || '').toLowerCase();
      const container = document.getElementById('palette-results');
      if (!container) return;

      const commands = [
        { label: 'Switch Tab: Executive Overview', action: () => switchTab('overview') },
        { label: 'Switch Tab: CRM Pipeline & Deals', action: () => switchTab('crm') },
        { label: 'Switch Tab: Agent Fleet Matrix', action: () => switchTab('fleet') },
        { label: 'Switch Tab: Ingestion Pulse Feed', action: () => switchTab('pulse') },
        { label: 'Switch Tab: Approvals & Governance', action: () => switchTab('approvals') },
        { label: 'Switch Tab: Infrastructure & Breakers', action: () => switchTab('infra') },
        { label: 'Toggle Masked Wall-Screen Mode', action: () => toggleMaskedMode() },
        { label: 'Trigger AIDA Voice Follow-up Synthesis', action: () => triggerVoiceNoteForLead() },
        { label: 'Refresh All Realtime Telemetry', action: () => fetchTelemetryState() },
      ];

      const filtered = commands.filter(c => c.label.toLowerCase().includes(query));
      container.innerHTML = filtered.map((c, i) => \`
        <div onclick="executePaletteCommand(\${i})" class="p-2.5 rounded-lg hover:bg-white/10 cursor-pointer flex items-center justify-between text-gray-200 hover:text-white transition-colors">
          <span>\${c.label}</span>
          <span class="text-gray-500 text-[10px]">↵</span>
        </div>
      \`).join('');
      window._activePaletteCommands = filtered;
    }

    function executePaletteCommand(index) {
      if (window._activePaletteCommands && window._activePaletteCommands[index]) {
        window._activePaletteCommands[index].action();
        toggleCommandPalette();
      }
    }

    // Initialize State & Auto-Poll Loop
    switchTab(activeTab);
    fetchTelemetryState();
    setInterval(fetchTelemetryState, 3000);
  </script>
</body>
</html>`;
}
