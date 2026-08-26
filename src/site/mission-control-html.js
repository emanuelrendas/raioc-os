/**
 * RAIOC OS — Executive Mission Control HTML Template
 * Pre-compiled Zero-I/O renderer for `/admin/mission-control` and `/mission-control`.
 */

export function renderMissionControlHtml() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAIOC — Executive Mission Control & Fleet Telemetry</title>
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
    .glass-card { background: rgba(11, 15, 23, 0.85); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .gold-glow { box-shadow: 0 0 25px rgba(234, 179, 8, 0.15); }
    .pulse-badge { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased">
  <!-- Top Navigation Bar -->
  <header class="glass-card sticky top-0 z-50 px-6 py-4 border-b border-white/10 flex items-center justify-between">
    <div class="flex items-center space-x-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-300 flex items-center justify-center font-black text-black text-xl shadow-lg shadow-amber-500/20">
        R
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
            RAIOC MISSION CONTROL
            <span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">FLEET TELEMETRY</span>
          </h1>
        </div>
        <p class="text-xs text-gray-400">Autonomous Multi-Agent Telemetry & Sovereign Approval Gateway</p>
      </div>
    </div>

    <div class="flex items-center space-x-4">
      <div class="flex items-center space-x-2 bg-[#111827] px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span class="text-emerald-400 font-semibold">REALTIME MESH</span>
        <span class="text-gray-600">|</span>
        <span id="clock" class="text-gray-300">--:--:-- GST</span>
      </div>

      <button onclick="refreshAll()" class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10 transition" title="Refresh Telemetry">
        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
      </button>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-7xl w-full mx-auto px-6 py-8 space-y-8 flex-1">
    
    <!-- Component A: Fleet Matrix -->
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            Component A: Autonomous Fleet Matrix
          </h2>
          <p class="text-xs text-gray-400">Active agent heartbeat, cognitive workloads, and latency telemetry.</p>
        </div>
        <span id="fleet-count" class="text-xs font-mono text-gray-400">Loading fleet...</span>
      </div>

      <div id="fleet-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Dynamic Fleet Cards Rendered Here -->
      </div>
    </section>

    <!-- 2-Column Section: Component B & Component C -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      <!-- Component B: Executive Approval Queue -->
      <section class="lg:col-span-7 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-rose-400"></span>
              Component B: Executive Approval Gate (HITL)
            </h2>
            <p class="text-xs text-gray-400">Pending high-value actions requiring principal authorization.</p>
          </div>
          <span id="approvals-badge" class="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">0 PENDING</span>
        </div>

        <div id="approvals-container" class="space-y-3">
          <!-- Dynamic Approvals Rendered Here -->
        </div>
      </section>

      <!-- Component C: Ingestion Pulse Feed -->
      <section class="lg:col-span-5 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              Component C: Ingestion Pulse Feed
            </h2>
            <p class="text-xs text-gray-400">Last 15 multi-channel interactions.</p>
          </div>
          <span class="text-xs font-mono text-emerald-400">Live Pulse</span>
        </div>

        <div id="interactions-container" class="glass-card p-4 rounded-2xl divide-y divide-white/5 max-h-[520px] overflow-y-auto space-y-2">
          <!-- Dynamic Interaction Stream Rendered Here -->
        </div>
      </section>
    </div>

    <!-- Component D: Executive Copilot Input -->
    <section class="glass-card p-6 rounded-3xl border border-amber-500/30 space-y-4 gold-glow">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-yellow-400"></span>
            Component D: Executive Copilot (Gemini 2.5 Flash)
          </h2>
          <p class="text-xs text-gray-400">Query institutional Escrow frameworks, yield models, and autonomous directives.</p>
        </div>
        <span class="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">GEMINI PROPRIETARY</span>
      </div>

      <form id="copilot-form" onsubmit="handleCopilot(event)" class="flex gap-3">
        <input
          id="copilot-input"
          type="text"
          placeholder="e.g. Synthesize Portuguese NHR allocation strategy for Palm Jumeirah under Law 8 Escrow..."
          class="flex-1 bg-[#030712] border border-white/15 focus:border-amber-400 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-gray-500 outline-none transition font-sans shadow-inner"
        />
        <button
          type="submit"
          id="copilot-btn"
          class="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 hover:from-amber-500 hover:to-yellow-300 text-black font-bold text-sm transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
        >
          <span>Instruct</span>
          <i data-lucide="send" class="w-4 h-4"></i>
        </button>
      </form>

      <div class="flex flex-wrap gap-2">
        <button type="button" onclick="setPrompt('Palm Jumeirah Escrow Law 8 Yield Band')" class="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-amber-300 text-[11px] font-mono border border-white/5">+ Palm Jumeirah Escrow</button>
        <button type="button" onclick="setPrompt('Golden Visa Cabinet Res 65/2022 Criteria')" class="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-amber-300 text-[11px] font-mono border border-white/5">+ Golden Visa Decree</button>
        <button type="button" onclick="setPrompt('Spain Wealth Tax Hedge Allocation')" class="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-amber-300 text-[11px] font-mono border border-white/5">+ Spain Tax Hedge</button>
        <button type="button" onclick="setPrompt('DIFC Common Law Asset Shielding')" class="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-amber-300 text-[11px] font-mono border border-white/5">+ DIFC Asset Shield</button>
      </div>

      <div id="copilot-output" class="hidden p-5 rounded-2xl bg-[#030712] border border-amber-500/30 space-y-2">
        <div class="flex items-center justify-between text-xs font-mono">
          <span class="text-amber-400 font-bold flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            JARVIS / Gemini 2.5 Flash Output
          </span>
          <span id="copilot-latency" class="text-gray-500">12ms</span>
        </div>
        <p id="copilot-text" class="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap"></p>
      </div>
    </section>
  </main>

  <script>
    const SECRET = 'raioc_sovereign_auth_2026_x99';
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SECRET,
      'X-RAIOC-Secret': SECRET,
    };

    function updateClock() {
      const now = new Date();
      document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Dubai', hour12: false }) + ' GST';
    }
    setInterval(updateClock, 1000);
    updateClock();

    async function loadFleet() {
      try {
        const res = await fetch('/api/v1/mission-control/fleet', { headers: authHeaders });
        const data = await res.json();
        const container = document.getElementById('fleet-container');
        document.getElementById('fleet-count').textContent = (data.fleet?.length || 0) + ' Agents Online';

        if (!data.fleet || data.fleet.length === 0) {
          container.innerHTML = '<p class="text-gray-500 text-xs font-mono p-4">No agents found.</p>';
          return;
        }

        container.innerHTML = data.fleet.map(agent => {
          const isProcessing = agent.status === 'PROCESSING';
          const isAlert = agent.status === 'ALERT';
          const badgeClass = isProcessing ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                             isAlert ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                             'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
          const dotClass = isProcessing ? 'bg-amber-400' : isAlert ? 'bg-rose-400' : 'bg-emerald-400';

          return \`
            <div class="glass-card p-5 rounded-2xl border border-white/10 hover:border-amber-500/30 transition flex flex-col justify-between">
              <div>
                <div class="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 class="text-sm font-bold text-white">\${agent.name}</h3>
                    <p class="text-[11px] text-gray-400 truncate max-w-[200px]">\${agent.role}</p>
                  </div>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border \${badgeClass}">
                    <span class="w-1.5 h-1.5 rounded-full \${dotClass} animate-pulse"></span>
                    \${agent.status}
                  </span>
                </div>
                <div class="bg-[#111827] p-3 rounded-xl border border-white/5 mb-4">
                  <span class="text-[9px] font-mono uppercase text-gray-500 block mb-1">Active Objective:</span>
                  <p class="text-xs text-gray-300 line-clamp-2">\${agent.currentTask || 'Autonomous standby'}</p>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2 pt-3 border-t border-white/5 text-center text-xs">
                <div class="bg-[#030712] p-2 rounded-lg"><span class="text-[9px] text-gray-500 uppercase block">Latency</span><span class="font-mono text-emerald-400 font-bold">\${agent.metrics?.latencyMs || 10}ms</span></div>
                <div class="bg-[#030712] p-2 rounded-lg"><span class="text-[9px] text-gray-500 uppercase block">Completed</span><span class="font-mono text-white font-bold">\${agent.metrics?.tasksCompleted || 0}</span></div>
                <div class="bg-[#030712] p-2 rounded-lg"><span class="text-[9px] text-gray-500 uppercase block">Score</span><span class="font-mono text-amber-400 font-bold">\${agent.metrics?.learningScore || 95}%</span></div>
              </div>
            </div>
          \`;
        }).join('');
      } catch (err) {
        console.error('loadFleet error:', err);
      }
    }

    async function loadApprovals() {
      try {
        const res = await fetch('/api/v1/mission-control/approvals', { headers: authHeaders });
        const data = await res.json();
        const container = document.getElementById('approvals-container');
        document.getElementById('approvals-badge').textContent = (data.approvals?.length || 0) + ' PENDING';

        if (!data.approvals || data.approvals.length === 0) {
          container.innerHTML = '<div class="glass-card p-6 rounded-2xl text-center text-xs font-mono text-gray-500">All autonomous decisions cleared. No pending actions.</div>';
          return;
        }

        container.innerHTML = data.approvals.map(appr => \`
          <div class="glass-card p-5 rounded-2xl border border-white/10 hover:border-amber-500/30 transition space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <span class="text-[10px] font-mono text-amber-400 font-bold">\${appr.category}</span>
                <h4 class="text-sm font-bold text-white">\${appr.title}</h4>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">\${appr.priority || 'HIGH'}</span>
            </div>
            <div class="bg-[#111827] p-3 rounded-xl text-xs text-gray-300 space-y-1">
              <div><span class="text-gray-500">Recipient:</span> \${appr.recipient || 'Private Investor'}</div>
              <div><span class="text-gray-500">Target Asset:</span> \${appr.targetAsset || 'Palm Jumeirah Prime'}</div>
              <pre class="pt-2 text-[10px] font-mono text-gray-400 whitespace-pre-wrap overflow-x-auto">\${JSON.stringify(appr.payload, null, 2)}</pre>
            </div>
            <div class="flex items-center justify-end gap-3 pt-2">
              <button onclick="resolveApproval('\${appr.id}', 'REJECTED')" class="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold">Reject</button>
              <button onclick="resolveApproval('\${appr.id}', 'APPROVED')" class="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20">Approve & Dispatch</button>
            </div>
          </div>
        \`).join('');
      } catch (err) {
        console.error('loadApprovals error:', err);
      }
    }

    async function resolveApproval(id, action) {
      try {
        const res = await fetch('/api/v1/mission-control/approvals/resolve', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ approvalId: id, action, actor: 'Emanuel Rendas' })
        });
        if (res.ok) {
          loadApprovals();
          loadInteractions();
        }
      } catch (err) {
        console.error('resolveApproval error:', err);
      }
    }

    async function loadInteractions() {
      try {
        const res = await fetch('/api/v1/mission-control/interactions?limit=15', { headers: authHeaders });
        const data = await res.json();
        const container = document.getElementById('interactions-container');

        if (!data.interactions || data.interactions.length === 0) {
          container.innerHTML = '<div class="p-6 text-center text-xs font-mono text-gray-500">No interaction logs recorded.</div>';
          return;
        }

        container.innerHTML = data.interactions.map(log => {
          const isTelegram = (log.channel || '').toUpperCase() === 'TELEGRAM';
          const isWhatsApp = (log.channel || '').toUpperCase() === 'WHATSAPP';
          const badgeColor = isTelegram ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                             isWhatsApp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                             'bg-amber-500/10 text-amber-400 border-amber-500/20';

          return \`
          <div class="pt-3 first:pt-0 space-y-1">
            <div class="flex items-center justify-between text-[11px]">
              <div class="flex items-center gap-1.5">
                <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border \${badgeColor}">\${log.channel || 'WEBSITE'}</span>
                <span class="font-mono text-gray-400">\${log.event_type}</span>
                \${log.source_agent ? \`<span class="px-1 py-0.2 text-[8px] font-mono bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">\${log.source_agent}</span>\` : ''}
              </div>
              <span class="text-[10px] text-gray-500 font-mono">\${log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'Recent'}</span>
            </div>
            <p class="text-xs text-gray-200 font-medium">\${log.summary}</p>
            \${log.traceparent ? \`<div class="text-[9px] font-mono text-gray-500 truncate max-w-full">trace: \${log.traceparent}</div>\` : ''}
          </div>
        \`;
        }).join('');
      } catch (err) {
        console.error('loadInteractions error:', err);
      }
    }

    async function handleCopilot(e) {
      e.preventDefault();
      const input = document.getElementById('copilot-input');
      const prompt = input.value.trim();
      if (!prompt) return;

      const btn = document.getElementById('copilot-btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="animate-spin mr-2">⏳</span> Processing...';

      try {
        const res = await fetch('/api/v1/cognitive/dispatch', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ prompt, clientName: 'Emanuel Rendas' })
        });
        const data = await res.json();
        document.getElementById('copilot-output').classList.remove('hidden');
        document.getElementById('copilot-text').textContent = data.response || data.text || JSON.stringify(data);
        document.getElementById('copilot-latency').textContent = (data.latencyMs || 15) + 'ms';
      } catch (err) {
        document.getElementById('copilot-output').classList.remove('hidden');
        document.getElementById('copilot-text').textContent = 'Error: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Instruct</span> <i data-lucide="send" class="w-4 h-4"></i>';
        lucide.createIcons();
      }
    }

    function setPrompt(p) {
      document.getElementById('copilot-input').value = p;
    }

    function refreshAll() {
      loadFleet();
      loadApprovals();
      loadInteractions();
    }

    refreshAll();
    setInterval(refreshAll, 5000);
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 300);
  </script>
</body>
</html>`;
}
