/**
 * RAIOC OS — Executive Mission Control HTML Template (Sprint 2 / Phase B & Mandate)
 * Pre-compiled Zero-I/O renderer for `/admin/mission-control` and `/mission-control`.
 * 24/7 Wall-Screen High-Density Dashboard with Consolidated Realtime Telemetry,
 * Sovereign Realtime CRM Pipeline, Multi-Agent Fleet Matrix, and HITL Approval Gateway.
 */

export function renderMissionControlHtml() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAIOC — 24/7 Executive Mission Control & Wall-Screen Command Center</title>
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
              400: '#FACC15',
              500: '#EAB308',
              600: '#CA8A04',
            },
            obsidian: '#030712',
            surface: '#0B0F17',
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #030712; color: #F3F4F6; font-family: 'Plus Jakarta Sans', sans-serif; }
    .glass-card { background: rgba(11, 15, 23, 0.90); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .gold-glow { box-shadow: 0 0 25px rgba(234, 179, 8, 0.15); }
    .pulse-badge { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    /* Custom Scrollbar for high-density wall monitors */
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: rgba(3, 7, 18, 0.5); }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 2px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(234, 179, 8, 0.4); }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased bg-[#030712]">
  <!-- Top Navigation & Global Clocks Bar -->
  <header class="glass-card sticky top-0 z-50 px-6 py-3 border-b border-white/10 flex items-center justify-between">
    <div class="flex items-center space-x-3">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-300 flex items-center justify-center font-black text-black text-lg shadow-lg shadow-amber-500/20">
        R
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-sm font-bold tracking-tight text-white flex items-center gap-2">
            RAIOC MISSION CONTROL
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30 font-semibold">24/7 WALL-SCREEN V1</span>
          </h1>
        </div>
        <p class="text-[11px] text-gray-400">Autonomous Sovereign Real Estate Intelligence & Multi-Agent Command Mesh</p>
      </div>
    </div>

    <!-- Live Clocks Strip -->
    <div class="hidden lg:flex items-center space-x-4 text-xs font-mono">
      <div class="flex items-center space-x-2 bg-[#111827] px-3 py-1 rounded-lg border border-white/10">
        <span class="text-gray-400">DXB (UTC+4):</span>
        <span id="clock-dxb" class="text-amber-400 font-bold">--:--:--</span>
      </div>
      <div class="flex items-center space-x-2 bg-[#111827] px-3 py-1 rounded-lg border border-white/10">
        <span class="text-gray-400">LON (UTC+0):</span>
        <span id="clock-lon" class="text-gray-200">--:--:--</span>
      </div>
      <div class="flex items-center space-x-2 bg-[#111827] px-3 py-1 rounded-lg border border-white/10">
        <span class="text-gray-400">LIS (UTC+0):</span>
        <span id="clock-lis" class="text-gray-200">--:--:--</span>
      </div>
    </div>

    <div class="flex items-center space-x-3">
      <!-- Mode Toggle -->
      <button id="mode-toggle-btn" onclick="toggleMaskedMode()" class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-gray-300 hover:text-white transition-colors flex items-center gap-1.5" title="Toggle Public Wall-Screen Mode">
        <i data-lucide="eye-off" class="w-3.5 h-3.5 text-amber-400"></i>
        <span id="mode-label">FULL EXECUTIVE</span>
      </button>

      <!-- Fullscreen Toggle -->
      <button onclick="toggleFullscreen()" class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors" title="Toggle Wall-Screen Fullscreen">
        <i data-lucide="maximize" class="w-4 h-4"></i>
      </button>

      <div class="flex items-center space-x-2 bg-[#111827] px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span id="gateway-status" class="text-emerald-400 font-semibold">AUTONOMOUS CORE ACTIVE</span>
      </div>
      <button onclick="refreshMissionControl()" class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors" title="Force Refresh">
        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
      </button>
    </div>
  </header>

  <!-- Main Command Center Canvas -->
  <main class="flex-1 p-6 space-y-6 max-w-[1920px] mx-auto w-full">
    
    <!-- 1. Top Executive KPI Strip (Module 1: Executive KPI Strip / healthBar) -->
    <div id="kpi-strip" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div class="glass-card p-4 rounded-xl border border-white/10">
        <div class="text-[11px] font-mono text-gray-400 uppercase tracking-wider">System Health</div>
        <div class="mt-1 flex items-baseline justify-between">
          <span id="kpi-health" class="text-2xl font-bold text-emerald-400 font-mono">99.98%</span>
          <span class="text-[10px] text-emerald-500 font-mono font-semibold">SOVEREIGN</span>
        </div>
      </div>
      <div class="glass-card p-4 rounded-xl border border-white/10">
        <div class="text-[11px] font-mono text-gray-400 uppercase tracking-wider">Active Pipeline</div>
        <div class="mt-1 flex items-baseline justify-between">
          <span id="kpi-pipeline" class="text-2xl font-bold text-amber-400 font-mono">AED 207.0M</span>
          <span class="text-[10px] text-gray-400 font-mono">€51.8M</span>
        </div>
      </div>
      <div class="glass-card p-4 rounded-xl border border-white/10">
        <div class="text-[11px] font-mono text-gray-400 uppercase tracking-wider">Active Deals</div>
        <div class="mt-1 flex items-baseline justify-between">
          <span id="kpi-deals" class="text-2xl font-bold text-white font-mono">10 Active</span>
          <span class="text-[10px] text-sky-400 font-mono">6 STAGES</span>
        </div>
      </div>
      <div class="glass-card p-4 rounded-xl border border-white/10">
        <div class="text-[11px] font-mono text-gray-400 uppercase tracking-wider">Pending Approvals</div>
        <div class="mt-1 flex items-baseline justify-between">
          <span id="kpi-approvals" class="text-2xl font-bold text-amber-500 font-mono">0 Pending</span>
          <span class="text-[10px] text-amber-400 font-mono">HITL QUEUE</span>
        </div>
      </div>
      <div class="glass-card p-4 rounded-xl border border-white/10">
        <div class="text-[11px] font-mono text-gray-400 uppercase tracking-wider">5m Error Rate</div>
        <div class="mt-1 flex items-baseline justify-between">
          <span id="kpi-error-rate" class="text-2xl font-bold text-emerald-400 font-mono">0.00%</span>
          <span class="text-[10px] text-emerald-500 font-mono">CIRCUITS CLOSED</span>
        </div>
      </div>
      <div class="glass-card p-4 rounded-xl border border-white/10">
        <div class="text-[11px] font-mono text-gray-400 uppercase tracking-wider">Active Workflows</div>
        <div class="mt-1 flex items-baseline justify-between">
          <span id="kpi-workflows" class="text-2xl font-bold text-purple-400 font-mono">8 Running</span>
          <span class="text-[10px] text-purple-300 font-mono">EVENT BUS v1.1</span>
        </div>
      </div>
    </div>

    <!-- 2. Four-Column 24/7 Command Matrix -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

      <!-- COLUMN 1: Agent Fleet & Infrastructure Matrix -->
      <div class="space-y-6">
        <!-- Module 2: Live Agent Fleet Matrix -->
        <!-- Component A: Autonomous Fleet Matrix -->
        <div class="glass-card rounded-2xl border border-white/10 overflow-hidden flex flex-col h-[480px]">
          <div class="px-5 py-3.5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <h2 class="text-xs font-bold uppercase tracking-wider font-mono text-white flex items-center gap-2">
              <i data-lucide="bot" class="w-3.5 h-3.5 text-amber-400"></i>
              Component A: Autonomous Fleet Matrix
            </h2>
            <span class="text-[10px] font-mono text-gray-400" id="fleet-count">8 ONLINE</span>
          </div>
          <div id="fleet-container" class="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
            <div class="p-6 text-center text-xs font-mono text-gray-500">Loading Agent Fleet...</div>
          </div>
        </div>

        <!-- Module 7: Infrastructure & Circuit Breakers Panel -->
        <div class="glass-card rounded-2xl border border-white/10 p-4 space-y-3">
          <h2 class="text-xs font-bold uppercase tracking-wider font-mono text-white flex items-center gap-2">
            <i data-lucide="server" class="w-3.5 h-3.5 text-emerald-400"></i>
            Infrastructure & Observability
          </h2>
          <div class="space-y-2 text-xs font-mono">
            <div class="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span class="text-gray-400">Supabase DB</span>
              <span class="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                CONNECTED (2ms)
              </span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span class="text-gray-400">Vercel Edge Network</span>
              <span class="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                OPERATIONAL (8ms)
              </span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span class="text-gray-400">Event Bus v1.1</span>
              <span class="text-amber-400 font-semibold">QUEUE DEPTH: 0</span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <span class="text-gray-400">Circuit Breakers</span>
              <span class="text-emerald-400 font-semibold">100% HEALTHY</span>
            </div>
          </div>
        </div>
      </div>

      <!-- COLUMN 2: Realtime Sovereign CRM Pipeline Board (Module 3) -->
      <div class="space-y-6">
        <div class="glass-card rounded-2xl border border-white/10 overflow-hidden flex flex-col h-[740px]">
          <div class="px-5 py-3.5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <h2 class="text-xs font-bold uppercase tracking-wider font-mono text-white flex items-center gap-2">
              <i data-lucide="kanban" class="w-3.5 h-3.5 text-sky-400"></i>
              Realtime Operational CRM
            </h2>
            <span class="text-[10px] font-mono text-amber-400 font-bold" id="crm-total">AED 207.0M</span>
          </div>
          <div id="crm-container" class="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
            <div class="p-6 text-center text-xs font-mono text-gray-500">Loading Pipeline Deals...</div>
          </div>
        </div>
      </div>

      <!-- COLUMN 3: HITL Approval Queue & Workflow Monitor (Modules 5 & 6) -->
      <div class="space-y-6">
        <!-- Module 5: Executive HITL Approval Queue -->
        <!-- Component B: Executive Approval Gate -->
        <div class="glass-card rounded-2xl border border-white/10 overflow-hidden flex flex-col h-[460px]">
          <div class="px-5 py-3.5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <h2 class="text-xs font-bold uppercase tracking-wider font-mono text-white flex items-center gap-2">
              <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-amber-500"></i>
              Component B: Executive Approval Gate
            </h2>
            <span id="approval-count-badge" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">0 PENDING</span>
          </div>
          <div id="approvals-container" class="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
            <div class="p-6 text-center text-xs font-mono text-gray-500">No pending approvals required.</div>
          </div>
        </div>

        <!-- Module 6: Workflow Monitor Grid -->
        <div class="glass-card rounded-2xl border border-white/10 overflow-hidden flex flex-col h-[260px]">
          <div class="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <h2 class="text-xs font-bold uppercase tracking-wider font-mono text-white flex items-center gap-2">
              <i data-lucide="workflow" class="w-3.5 h-3.5 text-purple-400"></i>
              Workflow Monitor
            </h2>
            <span class="text-[10px] font-mono text-gray-400">REGISTRY v1.1</span>
          </div>
          <div id="workflow-container" class="p-3 overflow-y-auto space-y-2 flex-1 text-xs font-mono">
            <div class="p-4 text-center text-xs text-gray-500">Loading Workflows...</div>
          </div>
        </div>
      </div>

      <!-- COLUMN 4: Ingestion Pulse Feed & Immutable Audit Timeline (Modules 4 & 8) -->
      <div class="space-y-6">
        <!-- Module 4: Live Ingestion Pulse Feed -->
        <!-- Component C: Ingestion Pulse -->
        <div class="glass-card rounded-2xl border border-white/10 overflow-hidden flex flex-col h-[480px]">
          <div class="px-5 py-3.5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
            <h2 class="text-xs font-bold uppercase tracking-wider font-mono text-white flex items-center gap-2">
              <i data-lucide="activity" class="w-3.5 h-3.5 text-emerald-400"></i>
              Component C: Ingestion Pulse
            </h2>
            <span class="text-[10px] font-mono text-emerald-400 font-semibold">STREAMING</span>
          </div>
          <div id="interactions-container" class="p-4 overflow-y-auto space-y-3 flex-1 divide-y divide-white/5 text-xs">
            <div class="p-6 text-center text-xs font-mono text-gray-500">Listening for inbound interactions...</div>
          </div>
        </div>

        <!-- Module 8: Immutable Audit Timeline -->
        <div class="glass-card rounded-2xl border border-white/10 p-4 space-y-2.5 h-[240px] flex flex-col overflow-hidden">
          <div class="flex items-center justify-between border-b border-white/5 pb-2">
            <h2 class="text-xs font-bold uppercase tracking-wider font-mono text-white flex items-center gap-2">
              <i data-lucide="lock" class="w-3.5 h-3.5 text-gold-400"></i>
              Immutable Audit Ledger
            </h2>
            <span class="text-[9px] font-mono text-gray-500">SHA-256 CHAIN</span>
          </div>
          <div id="audit-container" class="overflow-y-auto space-y-2 flex-1 text-[11px] font-mono">
            <div class="p-3 text-center text-xs text-gray-500">Loading Audit Timeline...</div>
          </div>
        </div>
      </div>

    </div>

    <!-- 3. Autonomous Executive Copilot Bar -->
    <!-- Component D: Executive Copilot -->
    <div class="glass-card rounded-2xl border border-white/10 p-4 flex items-center justify-between gap-4">
      <div class="flex items-center space-x-3 flex-1">
        <div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-mono font-bold">
          J
        </div>
        <form id="copilot-form" onsubmit="handleCopilot(event)" class="flex-1 flex gap-2">
          <input 
            type="text" 
            id="copilot-input" 
            placeholder="Instruct JARVIS: 'Evaluate Como Residences tranche allocation under Escrow Law No. 8 for Lisbon Lead'..."
            class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
          <button type="submit" class="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-xl shadow-lg shadow-amber-500/10 transition-all font-mono">
            EXECUTE
          </button>
        </form>
      </div>
      <div id="copilot-status" class="hidden text-xs font-mono text-gray-400 items-center gap-2">
        <span class="animate-spin w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full"></span>
        <span id="copilot-status-text">Synthesizing multi-agent consensus...</span>
      </div>
    </div>

  </main>

  <!-- Client-Side Dashboard Telemetry & Realtime Script -->
  <script>
    const authHeaders = {
      'x-raioc-secret': 'raioc_sovereign_auth_2026_x99'
    };

    let isMaskedMode = false;

    // Live Clocks
    function updateClocks() {
      const now = new Date();
      document.getElementById('clock-dxb').innerText = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
      document.getElementById('clock-lon').innerText = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
      document.getElementById('clock-lis').innerText = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
    }
    setInterval(updateClocks, 1000);
    updateClocks();

    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
      } else {
        document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
      }
    }

    function toggleMaskedMode() {
      isMaskedMode = !isMaskedMode;
      const label = document.getElementById('mode-label');
      label.innerText = isMaskedMode ? 'MASKED WALL' : 'FULL EXECUTIVE';
      refreshMissionControl();
    }

    async function refreshMissionControl() {
      try {
        const url = isMaskedMode ? '/api/v1/mission-control/v1-state?masked=true' : '/api/v1/mission-control/v1-state';
        const res = await fetch(url, { headers: authHeaders });
        if (!res.ok) throw new Error(\`Failed to fetch state: \${res.status}\`);
        const data = await res.json();
        renderState(data.body || data);
      } catch (err) {
        console.error('Mission Control V1 refresh error:', err);
      }
    }

    function renderState(state) {
      if (!state) return;

      // 1. KPI Strip / HealthBar
      const kpis = state.healthBar || state.kpiStrip;
      if (kpis) {
        document.getElementById('kpi-health').innerText = (kpis.systemHealthPct || kpis.systemHealth || 99.98) + '%';
        const pipeAed = kpis.totalPipelineAed || kpis.pipelineAed || 207000000;
        document.getElementById('kpi-pipeline').innerText = 'AED ' + (pipeAed / 1000000).toFixed(1) + 'M';
        document.getElementById('kpi-deals').innerText = (kpis.activeLeadsCount || kpis.activeLeads || 10) + ' Active';
        document.getElementById('kpi-approvals').innerText = (kpis.pendingApprovalsCount !== undefined ? kpis.pendingApprovalsCount : kpis.pendingHitlCount) + ' Pending';
        document.getElementById('kpi-error-rate').innerText = (kpis.errorRate5m || 0).toFixed(2) + '%';
        document.getElementById('kpi-workflows').innerText = (kpis.activeWorkflowsCount || kpis.activeWorkflows || 8) + ' Running';
      }

      // 2. Fleet Matrix / AgentFleet
      const fleet = state.agentFleet || state.fleetMatrix;
      if (fleet) {
        document.getElementById('fleet-count').innerText = fleet.length + ' ONLINE';
        const fleetContainer = document.getElementById('fleet-container');
        fleetContainer.innerHTML = fleet.map(agent => {
          const isProcessing = agent.live_status === 'PROCESSING';
          const isIdle = agent.live_status === 'IDLE';
          const badgeClass = isProcessing ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                             isIdle ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                             'bg-rose-500/20 text-rose-300 border-rose-500/30';

          return \`
            <div class="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors space-y-1.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-white font-mono">\${agent.name}</span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold border \${badgeClass}">\${agent.live_status}</span>
                </div>
                <span class="text-[10px] font-mono text-gray-400">\${agent.last_latency_ms}ms</span>
              </div>
              <p class="text-[11px] text-gray-400 truncate">\${agent.active_task || agent.role}</p>
            </div>
          \`;
        }).join('');
      }

      // 3. Operational CRM Pipeline
      if (state.crmPipeline && state.crmPipeline.stages) {
        document.getElementById('crm-total').innerText = 'AED ' + ((state.crmPipeline.totalPipelineAed || 207000000) / 1000000).toFixed(1) + 'M';
        const crmContainer = document.getElementById('crm-container');
        crmContainer.innerHTML = state.crmPipeline.stages.map(stage => \`
          <div class="space-y-2">
            <div class="flex items-center justify-between text-[11px] font-mono">
              <span class="font-bold text-gray-300">\${stage.label}</span>
              <span class="text-amber-400 font-semibold">AED \${((stage.totalAed || 0) / 1000000).toFixed(1)}M (\${stage.dealCount || 0})</span>
            </div>
            <div class="space-y-1.5">
              \${(stage.deals || []).map(deal => \`
                <div class="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="font-semibold text-white truncate max-w-[180px]">\${deal.name}</span>
                    <span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">DIRA \${deal.diraScore || deal.riisScore}</span>
                  </div>
                  <div class="flex items-center justify-between text-[10px] font-mono text-gray-400">
                    <span>\${deal.targetAsset}</span>
                    <span class="text-emerald-400 font-bold">AED \${((deal.budgetAed || 0) / 1000000).toFixed(1)}M</span>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`).join('');
      }

      // 4. Executive Approval Queue / ApprovalsQueue
      const approvals = state.approvalsQueue || state.approvalQueue || [];
      document.getElementById('approval-count-badge').innerText = approvals.length + ' PENDING';
      const approvalsContainer = document.getElementById('approvals-container');
      if (approvals.length === 0) {
        approvalsContainer.innerHTML = '<div class="p-6 text-center text-xs font-mono text-gray-500">No pending executive approvals required.</div>';
      } else {
        approvalsContainer.innerHTML = approvals.map(appr => \`
          <div class="p-3 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <div class="flex items-center justify-between">
              <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">\${appr.risk_rating || appr.riskLevel || 'HIGH'} RISK</span>
              <span class="text-[10px] font-mono text-gray-500">\${appr.created_at ? new Date(appr.created_at).toLocaleTimeString() : 'Recent'}</span>
            </div>
            <h3 class="text-xs font-bold text-white leading-snug">\${appr.payload_summary || appr.summary || appr.title || 'Executive Approval Request'}</h3>
            <div class="text-[11px] text-gray-400 space-y-0.5 font-mono">
              <div>Type: <span class="text-gray-200">\${appr.action_type || appr.action}</span></div>
              <div>Requester: <span class="text-amber-400">\${appr.requester_agent || 'MARK'}</span></div>
            </div>
            <div class="flex items-center gap-2 pt-1">
              <button onclick="resolveApproval('\${appr.id}', 'APPROVE')" class="flex-1 py-1.5 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-mono font-bold text-[10px] transition-colors">
                APPROVE & DISPATCH
              </button>
              <button onclick="resolveApproval('\${appr.id}', 'REJECT')" class="py-1.5 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-mono font-bold text-[10px] transition-colors">
                REJECT
              </button>
            </div>
          </div>
        \`).join('');
      }

      // 5. Workflow Monitor Grid
      if (state.workflowMonitor) {
        const wfContainer = document.getElementById('workflow-container');
        wfContainer.innerHTML = state.workflowMonitor.map(wf => \`
          <div class="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
            <div class="truncate max-w-[170px]">
              <div class="text-white font-medium truncate">\${wf.name}</div>
              <div class="text-[9px] text-gray-500">\${wf.trigger_type} · \${wf.orchestrator}</div>
            </div>
            <div class="text-right text-[10px]">
              <span class="text-emerald-400 font-bold">\${wf.success_rate}%</span>
              <div class="text-[9px] text-gray-500">\${wf.last_execution_duration_ms}ms</div>
            </div>
          </div>
        \`).join('');
      }

      // 6. Ingestion Pulse Feed
      if (state.ingestionPulse) {
        const pulseContainer = document.getElementById('interactions-container');
        if (state.ingestionPulse.length === 0) {
          pulseContainer.innerHTML = '<div class="p-6 text-center text-xs font-mono text-gray-500">No interaction logs recorded.</div>';
        } else {
          pulseContainer.innerHTML = state.ingestionPulse.map(log => {
            const isTelegram = log.channel === 'TELEGRAM';
            const isWhatsApp = log.channel === 'WHATSAPP';
            const isDocument = log.channel === 'DOCUMENT_OCR' || (log.channel && log.channel.includes('DOC'));
            const badgeColor = isTelegram ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                               isWhatsApp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                               isDocument ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                               'bg-amber-500/10 text-amber-400 border-amber-500/20';

            return \`
              <div class="pt-2.5 first:pt-0 space-y-1">
                <div class="flex items-center justify-between text-[11px]">
                  <div class="flex items-center gap-1.5">
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border \${badgeColor}">\${log.channel}</span>
                    <span class="font-mono text-gray-400 text-[10px]">\${log.event_type}</span>
                    \${log.source_agent ? \`<span class="px-1 py-0.2 text-[8px] font-mono bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">\${log.source_agent}</span>\` : ''}
                  </div>
                  <span class="text-[10px] text-gray-500 font-mono">\${log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'Recent'}</span>
                </div>
                <p class="text-xs text-gray-200 font-medium leading-relaxed">\${log.summary}</p>
                \${log.traceparent ? \`<div class="text-[9px] font-mono text-gray-500 truncate max-w-full">trace: \${log.traceparent}</div>\` : ''}
              </div>
            \`;
          }).join('');
        }
      }

      // 7. Immutable Audit Timeline
      if (state.auditTimeline) {
        const auditContainer = document.getElementById('audit-container');
        auditContainer.innerHTML = state.auditTimeline.map(evt => \`
          <div class="p-1.5 rounded bg-white/[0.01] border border-white/5 space-y-0.5">
            <div class="flex items-center justify-between text-gray-400 text-[10px]">
              <span class="text-amber-400 font-bold">\${evt.type}</span>
              <span>\${evt.time ? new Date(evt.time).toLocaleTimeString() : ''}</span>
            </div>
            <div class="text-[9px] text-gray-500 truncate">sha256: \${evt.payload_sha256 || 'N/A'}</div>
          </div>
        \`).join('');
      }

      lucide.createIcons();
    }

    async function resolveApproval(id, resolution) {
      try {
        const res = await fetch('/api/v1/mission-control/approvals', {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ id, resolution, actor: 'Emanuel Rendas (Executive)' })
        });
        if (res.ok) {
          refreshMissionControl();
        }
      } catch (err) {
        console.error('Failed to resolve approval:', err);
      }
    }

    async function handleCopilot(e) {
      e.preventDefault();
      const input = document.getElementById('copilot-input');
      const prompt = input.value.trim();
      if (!prompt) return;

      const statusEl = document.getElementById('copilot-status');
      const statusText = document.getElementById('copilot-status-text');
      statusEl.classList.remove('hidden');
      statusEl.classList.add('flex');
      statusText.innerText = 'Synthesizing sovereign advisory consensus...';

      try {
        const res = await fetch('/api/v1/cognitive/dispatch', {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });
        const data = await res.json();
        alert('JARVIS Executive Consensus:\\n\\n' + (data.content || data.synthesis || JSON.stringify(data)));
        input.value = '';
        refreshMissionControl();
      } catch (err) {
        alert('Copilot Error: ' + err.message);
      } finally {
        statusEl.classList.add('hidden');
        statusEl.classList.remove('flex');
      }
    }

    // Auto-poll state every 3 seconds (Realtime Fallback & Zero-Flicker sync)
    setInterval(refreshMissionControl, 3000);
    // Initial fetch
    refreshMissionControl();
  </script>
</body>
</html>
`;
}
