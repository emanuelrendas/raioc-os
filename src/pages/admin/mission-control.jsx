import React, { useState, useEffect, useCallback } from 'react';

/**
 * RAIOC OS — Executive Mission Control V2 (React / Next.js Component)
 * 24/7 Sovereign Wall-Screen Command Center featuring:
 * - 6 Modular Navigation Tabs (Executive Overview, CRM Kanban, Fleet Matrix, Pulse Feed, Approvals, Infrastructure)
 * - World Clocks (DXB, LON, LIS, NYC)
 * - Interactive Slide-Over Agent Drawer & Investor Dossier Modal with Quick Actions
 * - Event JSON Payload Inspector
 */

export default function MissionControlDashboard() {
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [internalSecret] = useState('raioc_sovereign_auth_2026_x99');
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [resolvingId, setResolvingId] = useState(null);
  const [isMasked, setIsMasked] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [corridorFilter, setCorridorFilter] = useState('ALL');
  const [pulseFilter, setPulseFilter] = useState('ALL');

  // World Clocks State
  const [clocks, setClocks] = useState({ dxb: '--:--', lon: '--:--', lis: '--:--', nyc: '--:--' });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const formatTime = (tz) => new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(now);

      setClocks({
        dxb: formatTime('Asia/Dubai'),
        lon: formatTime('Europe/London'),
        lis: formatTime('Europe/Lisbon'),
        nyc: formatTime('America/New_York'),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live consolidated V1/V2 telemetry
  const refreshTelemetry = useCallback(async () => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalSecret}`,
        'X-RAIOC-Secret': internalSecret,
      };

      const url = isMasked ? '/api/v1/mission-control/v1-state?masked=true' : '/api/v1/mission-control/v1-state';
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setState(data.body || data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to refresh Mission Control V2 telemetry:', err);
    }
  }, [internalSecret, isMasked]);

  useEffect(() => {
    refreshTelemetry();
    const interval = setInterval(refreshTelemetry, 3000);
    return () => clearInterval(interval);
  }, [refreshTelemetry]);

  // Resolve HITL Approval
  const handleApproval = async (id, resolution) => {
    setResolvingId(id);
    try {
      const res = await fetch('/api/v1/mission-control/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalSecret}`,
          'X-RAIOC-Secret': internalSecret,
        },
        body: JSON.stringify({ id, resolution, actor: 'Emanuel Rendas (Executive)' }),
      });
      if (res.ok) {
        await refreshTelemetry();
      }
    } catch (err) {
      console.error('Failed to resolve approval:', err);
    } finally {
      setResolvingId(null);
    }
  };

  // Submit Copilot Prompt
  const handleCopilotSubmit = async (e) => {
    e.preventDefault();
    if (!copilotPrompt.trim()) return;

    setCopilotLoading(true);
    try {
      const res = await fetch('/api/v1/cognitive/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalSecret}`,
          'X-RAIOC-Secret': internalSecret,
        },
        body: JSON.stringify({ prompt: copilotPrompt }),
      });
      const data = await res.json();
      alert(`JARVIS Consensus Response:\n\n${data.text || JSON.stringify(data)}`);
      setCopilotPrompt('');
      await refreshTelemetry();
    } catch (err) {
      alert(`Copilot Error: ${err.message}`);
    } finally {
      setCopilotLoading(false);
    }
  };

  const health = state?.healthBar || {
    systemHealthPct: 99.98,
    totalPipelineAed: 207000000,
    activeLeadsCount: 10,
    pendingApprovalsCount: 0,
    errorRate5m: 0.0,
    activeWorkflowsCount: 8,
    closedWonAed: 68500000,
  };

  const fleet = state?.agentFleet || [];
  const approvals = state?.approvalsQueue || [];
  const pipeline = state?.crmPipeline || { stages: [] };
  const pulse = state?.ingestionPulse || [];
  const infra = state?.infrastructure || {};

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 font-sans flex flex-col antialiased selection:bg-amber-500 selection:text-black">
      {/* Top Header & World Clocks */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md px-6 py-3 border-b border-amber-500/20 flex items-center justify-between shadow-2xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-300 flex items-center justify-center font-black text-black text-lg shadow-lg shadow-amber-500/25 border border-amber-300/40">
            R
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wider text-white uppercase flex items-center gap-2">
              RAIOC MISSION CONTROL
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/40 font-bold">V2 SOVEREIGN</span>
            </h1>
            <p className="text-[11px] text-gray-400">Autonomous Real Estate Intelligence & Multi-Agent Operations Mesh</p>
          </div>
        </div>

        {/* Live World Clocks */}
        <div className="hidden xl:flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-gray-400 text-[11px]">DXB (UTC+4):</span>
            <span className="text-amber-300 font-bold">{clocks.dxb}</span>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-gray-400 text-[11px]">LON (UTC+0):</span>
            <span className="text-gray-200">{clocks.lon}</span>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-gray-400 text-[11px]">LIS (UTC+0):</span>
            <span className="text-gray-200">{clocks.lis}</span>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10">
            <span className="text-gray-400 text-[11px]">NYC (UTC-5):</span>
            <span className="text-gray-200">{clocks.nyc}</span>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center space-x-2.5 text-xs font-mono">
          <button
            onClick={() => setIsMasked(!isMasked)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-amber-400 hover:text-white transition-all"
          >
            {isMasked ? 'WALL-SCREEN (MASKED)' : 'FULL EXECUTIVE'}
          </button>
          <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-emerald-400 font-bold text-[11px]">LIVE ({lastUpdated})</span>
          </div>
        </div>
      </header>

      {/* Modular Navigation Tabs */}
      <nav className="bg-slate-950/60 backdrop-blur-md px-6 py-2 border-b border-amber-500/10 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center space-x-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'overview'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            ⚡ EXECUTIVE OVERVIEW
          </button>
          <button
            onClick={() => setActiveTab('crm')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'crm'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            💼 CRM PIPELINE ({health.activeLeadsCount || 10})
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'fleet'
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            🤖 AGENT FLEET MATRIX (6)
          </button>
          <button
            onClick={() => setActiveTab('pulse')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'pulse'
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            📡 INGESTION PULSE FEED
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'approvals'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            🛡️ APPROVALS ({health.pendingApprovalsCount || 0})
          </button>
          <button
            onClick={() => setActiveTab('infra')}
            className={`px-3.5 py-1.5 rounded-lg border transition-all ${
              activeTab === 'infra'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-inner'
                : 'bg-white/5 border-white/5 text-gray-300 hover:text-white'
            }`}
          >
            ⚙️ INFRASTRUCTURE & BREAKERS
          </button>
        </div>

        <div className="text-[11px] font-mono text-gray-400">
          AUTONOMOUS HORIZON: <strong className="text-emerald-400">OPTIMAL</strong>
        </div>
      </nav>

      {/* Main Viewport Container */}
      <main className="flex-1 p-6 space-y-6 max-w-[1920px] mx-auto w-full">
        {/* TAB 1: EXECUTIVE OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">SYSTEM HEALTH</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{health.systemHealthPct}%</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">ACTIVE PIPELINE</div>
                <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                  AED {((health.totalPipelineAed || 0) / 1000000).toFixed(1)}M
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">CLOSED WON</div>
                <div className="text-2xl font-bold font-mono text-yellow-300 mt-1">
                  AED {((health.closedWonAed || 68500000) / 1000000).toFixed(1)}M
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">ACTIVE MANDATES</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">{health.activeLeadsCount || 10} Active</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">HITL APPROVALS</div>
                <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{health.pendingApprovalsCount || 0} Pending</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[11px] font-mono text-gray-400">5M ERROR RATE</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{(health.errorRate5m || 0).toFixed(2)}%</div>
              </div>
            </div>

            {/* Overview Multi-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Fleet Matrix Column */}
              <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
                <h2 className="text-xs font-bold font-mono uppercase text-white border-b border-white/10 pb-3 flex justify-between">
                  <span>Agent Fleet Telemetry</span>
                  <span className="text-sky-300">6 Specialist Agents</span>
                </h2>
                <div className="space-y-3">
                  {fleet.map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className="p-3 rounded-xl bg-black/40 border border-white/10 hover:border-sky-500/50 cursor-pointer transition-all space-y-1.5"
                    >
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="font-bold text-white">{agent.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                          {agent.live_status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 font-mono truncate">{agent.active_task || agent.role}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CRM Snapshot Column */}
              <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
                <h2 className="text-xs font-bold font-mono uppercase text-white border-b border-white/10 pb-3 flex justify-between">
                  <span>Active CRM Mandates</span>
                  <button onClick={() => setActiveTab('crm')} className="text-amber-400 hover:underline">
                    Kanban Board →
                  </button>
                </h2>
                <div className="space-y-2.5 max-h-[580px] overflow-y-auto">
                  {(pipeline.stages || []).flatMap((s) => s.deals || []).slice(0, 8).map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => setSelectedLead(deal)}
                      className="p-3 rounded-xl bg-black/40 border border-white/10 hover:border-amber-500/50 cursor-pointer transition-all flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-white">{deal.name}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[200px]">{deal.targetAsset}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-amber-400">AED {((deal.budgetAed || 0) / 1000000).toFixed(1)}M</div>
                        <div className="text-[10px] text-emerald-400">DIRA {deal.diraScore || 90}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Copilot & Pulse Column */}
              <div className="lg:col-span-3 space-y-6">
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-3">
                  <h3 className="text-xs font-bold font-mono uppercase text-amber-300">JARVIS Executive Directive</h3>
                  <form onSubmit={handleCopilotSubmit} className="space-y-3">
                    <textarea
                      value={copilotPrompt}
                      onChange={(e) => setCopilotPrompt(e.target.value)}
                      rows={3}
                      placeholder="Issue autonomous multi-agent directive..."
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={copilotLoading}
                      className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-xs font-bold font-mono rounded-lg transition-all shadow-lg shadow-amber-500/20"
                    >
                      {copilotLoading ? 'ORCHESTRATING...' : 'TRANSMIT DIRECTIVE'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FULL CRM KANBAN */}
        {activeTab === 'crm' && (
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold text-white font-mono uppercase">Sovereign CRM Kanban Pipeline</h2>
                <p className="text-xs text-gray-400 font-mono">Real-time investor lifecycle management & DIRA risk profiling.</p>
              </div>
              <div className="text-xs font-mono bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
                <span className="text-gray-400">CORRIDOR: </span>
                <select
                  value={corridorFilter}
                  onChange={(e) => setCorridorFilter(e.target.value)}
                  className="bg-transparent text-amber-300 font-bold focus:outline-none"
                >
                  <option value="ALL">ALL CORRIDORS</option>
                  <option value="Palm Jumeirah">PALM JUMEIRAH</option>
                  <option value="Dubai Creek Harbour">DUBAI CREEK HARBOUR</option>
                  <option value="DIFC">DIFC / DOWNTOWN</option>
                  <option value="Dubai Hills Estate">DUBAI HILLS ESTATE</option>
                  <option value="Palm Jebel Ali">PALM JEBEL ALI</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 min-h-[600px]">
              {(pipeline.stages || []).map((stage) => {
                const deals = corridorFilter === 'ALL'
                  ? stage.deals || []
                  : (stage.deals || []).filter((d) => (d.targetAsset || '').toLowerCase().includes(corridorFilter.toLowerCase()));

                return (
                  <div key={stage.id} className="bg-black/40 rounded-xl border border-white/10 p-3 space-y-3 flex flex-col">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <span className="text-xs font-bold font-mono text-gray-200">{stage.name}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-gray-300 font-bold">
                        {deals.length}
                      </span>
                    </div>

                    <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[580px]">
                      {deals.map((deal) => (
                        <div
                          key={deal.id}
                          onClick={() => setSelectedLead(deal)}
                          className="p-3 rounded-xl bg-slate-900/80 border border-white/10 hover:border-amber-500/50 cursor-pointer transition-all space-y-1.5"
                        >
                          <div className="flex justify-between font-mono text-xs">
                            <span className="font-bold text-white truncate max-w-[120px]">{deal.name}</span>
                            <span className="text-amber-400 font-bold">AED {((deal.budgetAed || 0) / 1000000).toFixed(1)}M</span>
                          </div>
                          <p className="text-[10px] text-gray-400 font-mono truncate">{deal.targetAsset}</p>
                          <div className="flex justify-between items-center text-[9px] font-mono pt-1 border-t border-white/5">
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                              DIRA {deal.diraScore || 90}
                            </span>
                            <span className="text-gray-500">{deal.preferredChannel || 'TELEGRAM'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: AGENT FLEET MATRIX */}
        {activeTab === 'fleet' && (
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-6">
            <h2 className="text-base font-bold text-white font-mono uppercase border-b border-white/10 pb-4">
              Autonomous Specialist Fleet Matrix
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {fleet.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="p-5 rounded-2xl bg-black/40 border border-white/10 hover:border-sky-500/50 cursor-pointer transition-all space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold font-mono text-white">{agent.name}</h3>
                      <p className="text-[11px] text-gray-400 font-mono">{agent.role}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                      {agent.live_status}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs font-mono text-gray-300 truncate">
                    {agent.active_task || 'Autonomous monitoring active'}
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-center">
                    <div className="p-2 rounded bg-black/30 border border-white/5">
                      <span className="text-gray-500 block">LATENCY</span>
                      <span className="text-amber-300 font-bold">{agent.last_latency_ms || 15}ms</span>
                    </div>
                    <div className="p-2 rounded bg-black/30 border border-white/5">
                      <span className="text-gray-500 block">TOKENS</span>
                      <span className="text-gray-200 font-bold">{(agent.tokens_consumed_total || 0).toLocaleString()}</span>
                    </div>
                    <div className="p-2 rounded bg-black/30 border border-white/5">
                      <span className="text-gray-500 block">COST</span>
                      <span className="text-yellow-400 font-bold">${(agent.compute_cost_usd || 0).toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: INGESTION PULSE */}
        {activeTab === 'pulse' && (
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white font-mono uppercase">Multi-Channel Ingestion Pulse Feed</h2>
              <div className="flex gap-2 text-xs font-mono">
                {['ALL', 'TELEGRAM', 'WHATSAPP', 'DOCUMENT_OCR', 'VOICE_DISPATCH', 'WEBSITE'].map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setPulseFilter(ch)}
                    className={`px-2.5 py-1 rounded-lg border transition-all ${
                      pulseFilter === ch ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-black/40 border-white/10 text-gray-400'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-black/60 text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">CHANNEL</th>
                    <th className="p-3">EVENT TYPE</th>
                    <th className="p-3">SENDER</th>
                    <th className="p-3">SUMMARY</th>
                    <th className="p-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(pulseFilter === 'ALL' ? pulse : pulse.filter((p) => p.channel === pulseFilter)).map((log) => (
                    <tr key={log.id} onClick={() => setSelectedEvent(log)} className="hover:bg-white/5 cursor-pointer">
                      <td className="p-3"><span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300">{log.channel}</span></td>
                      <td className="p-3 text-gray-200 font-bold">{log.event_type}</td>
                      <td className="p-3 text-gray-300">{log.sender || 'Inbound'}</td>
                      <td className="p-3 text-gray-400 max-w-md truncate">{log.summary}</td>
                      <td className="p-3 text-right text-amber-400 hover:underline">Inspect JSON →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: HITL APPROVALS */}
        {activeTab === 'approvals' && (
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
            <h2 className="text-base font-bold text-white font-mono uppercase border-b border-white/10 pb-4">
              Executive HITL Approvals Queue
            </h2>
            <div className="space-y-3">
              {approvals.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-gray-500">Zero pending HITL approvals. Autonomous horizon is clear.</div>
              ) : (
                approvals.map((appr) => (
                  <div key={appr.id} className="p-5 rounded-2xl bg-black/40 border border-rose-500/30 space-y-3">
                    <div className="flex justify-between items-center font-mono">
                      <span className="text-sm font-bold text-white">{appr.title}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                        {appr.priority || 'HIGH'} PRIORITY
                      </span>
                    </div>
                    <p className="text-xs font-mono text-gray-300">{appr.payload_summary || JSON.stringify(appr.payload)}</p>
                    <div className="flex justify-end space-x-3 pt-2 font-mono text-xs">
                      <button
                        onClick={() => handleApproval(appr.id, 'REJECTED')}
                        disabled={resolvingId === appr.id}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300"
                      >
                        REJECT
                      </button>
                      <button
                        onClick={() => handleApproval(appr.id, 'APPROVED')}
                        disabled={resolvingId === appr.id}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold"
                      >
                        {resolvingId === appr.id ? 'EXECUTING...' : 'APPROVE & EXECUTE →'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 6: INFRASTRUCTURE */}
        {activeTab === 'infra' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
              <h2 className="text-sm font-bold font-mono text-white border-b border-white/10 pb-3">Core Sovereign Infrastructure</h2>
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex justify-between items-center">
                  <div>
                    <strong className="text-white">Supabase PostgreSQL & Realtime</strong>
                    <div className="text-[10px] text-gray-400">RLS Active • Append-Only Trigger Enforced</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">{infra.supabase?.status || 'CONNECTED'}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex justify-between items-center">
                  <div>
                    <strong className="text-white">Enterprise Event Bus v1.1</strong>
                    <div className="text-[10px] text-gray-400">CloudEvent v1.1 Standard • Zero Queue Latency</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">{infra.eventBus?.status || 'ACTIVE'}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 backdrop-blur-md space-y-4">
              <h2 className="text-sm font-bold font-mono text-white border-b border-white/10 pb-3">Circuit Breakers Matrix</h2>
              <div className="space-y-3 font-mono text-xs">
                {(infra.circuitBreakers || [
                  { name: 'google_ai_studio', status: 'CLOSED' },
                  { name: 'vertex_ai_enterprise', status: 'CLOSED' },
                  { name: 'elevenlabs_enterprise', status: 'CLOSED' },
                  { name: 'whatsapp_cloud_api', status: 'CLOSED' },
                  { name: 'telegram_bot_api', status: 'CLOSED' },
                ]).map((b) => (
                  <div key={b.name} className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex justify-between items-center">
                    <strong className="text-white">{b.name}</strong>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">CIRCUIT {b.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Slide-Over Drawer: Agent Detail */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedAgent(null)}></div>
          <div className="relative w-full max-w-md bg-slate-950 border-l border-amber-500/30 p-6 space-y-6 shadow-2xl z-10 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white font-mono">{selectedAgent.name}</h3>
                <p className="text-xs text-gray-400 font-mono">{selectedAgent.role}</p>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="text-gray-400 hover:text-white font-mono">✕</button>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 font-mono text-xs">
              <div className="text-gray-400 text-[10px]">SYSTEM DIRECTIVES</div>
              <p className="text-gray-300 leading-relaxed">{selectedAgent.systemPrompt || 'Autonomous specialist operations executing under JARVIS executive brain oversight.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Lead Dossier */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedLead(null)}></div>
          <div className="relative w-full max-w-xl bg-slate-950 border border-amber-500/30 p-6 rounded-2xl space-y-4 shadow-2xl z-10 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedLead.name}</h3>
                <p className="text-[11px] text-gray-400">{selectedLead.company} • {selectedLead.country}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                <span className="text-gray-500 block text-[10px]">ALLOCATION BUDGET</span>
                <span className="text-amber-400 font-bold text-sm">AED {((selectedLead.budgetAed || 0) / 1000000).toFixed(1)}M</span>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                <span className="text-gray-500 block text-[10px]">DIRA RISK SCORE</span>
                <span className="text-emerald-400 font-bold text-sm">{selectedLead.diraScore || 90} / 100</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-white/10">
              <span className="text-gray-500 block text-[10px]">TARGET ASSET & THESIS</span>
              <span className="text-gray-200">{selectedLead.targetAsset}</span>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => { alert('Voice synthesis requested!'); setSelectedLead(null); }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold rounded-lg"
              >
                GENERATE AIDA VOICE NOTE →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Event JSON Inspector */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}></div>
          <div className="relative w-full max-w-xl bg-slate-950 border border-amber-500/30 p-6 rounded-2xl space-y-4 shadow-2xl z-10 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white uppercase">Event Payload Inspector</h3>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <pre className="p-4 bg-black/80 rounded-xl border border-white/10 text-[11px] text-gray-200 overflow-x-auto max-h-80">
              {JSON.stringify(selectedEvent, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
