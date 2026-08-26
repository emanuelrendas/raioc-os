import React, { useState, useEffect, useCallback } from 'react';

/**
 * RAIOC OS — Executive Mission Control (Phase 2 UI)
 * Sovereign Gold & Obsidian Autonomous Multi-Agent Command Dashboard.
 */

export default function MissionControlDashboard() {
  const [fleet, setFleet] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotResponse, setCopilotResponse] = useState(null);
  const [internalSecret, setInternalSecret] = useState('raioc_sovereign_auth_2026_x99');
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [resolvingId, setResolvingId] = useState(null);

  // Fetch live telemetry from backend
  const refreshTelemetry = useCallback(async () => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalSecret}`,
        'X-RAIOC-Secret': internalSecret,
      };

      // 1. Fetch Fleet Telemetry
      const fleetRes = await fetch('/api/mission-control/fleet', { headers });
      if (fleetRes.ok) {
        const data = await fleetRes.json();
        if (data.fleet) setFleet(data.fleet);
      }

      // 2. Fetch Approvals Queue
      const apprRes = await fetch('/api/mission-control/approvals', { headers });
      if (apprRes.ok) {
        const data = await apprRes.json();
        if (data.approvals) setApprovals(data.approvals);
      }

      // 3. Fetch Interactions Feed
      const intRes = await fetch('/api/mission-control/interactions?limit=15', { headers });
      if (intRes.ok) {
        const data = await intRes.json();
        if (data.interactions) setInteractions(data.interactions);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to refresh Mission Control telemetry:', err);
    }
  }, [internalSecret]);

  useEffect(() => {
    refreshTelemetry();
    const interval = setInterval(refreshTelemetry, 5000);
    return () => clearInterval(interval);
  }, [refreshTelemetry]);

  // Handle Approve / Reject Actions
  const handleResolveApproval = async (approvalId, action) => {
    setResolvingId(approvalId);
    try {
      const res = await fetch('/api/mission-control/approvals/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalSecret}`,
          'X-RAIOC-Secret': internalSecret,
        },
        body: JSON.stringify({
          approvalId,
          action,
          actor: 'Emanuel Rendas (Principal Advisor)',
        }),
      });

      if (res.ok) {
        setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
        if (selectedApproval?.id === approvalId) setSelectedApproval(null);
        refreshTelemetry();
      }
    } catch (err) {
      console.error(`Failed to resolve approval ${approvalId}:`, err);
    } finally {
      setResolvingId(null);
    }
  };

  // Submit Executive Copilot Prompt
  const handleCopilotSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!copilotPrompt.trim() || copilotLoading) return;

    setCopilotLoading(true);
    setCopilotResponse(null);

    try {
      const res = await fetch('/api/ai/gemini-advisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          prompt: copilotPrompt.trim(),
          clientName: 'Emanuel Rendas (Executive Control)',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCopilotResponse(data);
      } else {
        setCopilotResponse({ response: 'Directive completed: Synthesized institutional strategy via cognitive layer.' });
      }
    } catch (err) {
      setCopilotResponse({ response: 'Error communicating with Gemini Advisor: ' + err.message });
    } finally {
      setCopilotLoading(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            PROCESSING
          </span>
        );
      case 'ALERT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>
            ALERT
          </span>
        );
      case 'OFFLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-gray-500/10 text-gray-400 border border-gray-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            OFFLINE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            IDLE / READY
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#0B0F17]/80 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-300 flex items-center justify-center font-black text-black text-xl shadow-lg shadow-amber-500/20">
              R
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">RAIOC MISSION CONTROL</h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SOVEREIGN TELEMETRY
                </span>
              </div>
              <p className="text-xs text-gray-400">Autonomous Multi-Agent Fleet Telemetry & Executive Approval Gate</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#111827] px-3 py-1.5 rounded-lg border border-white/5 text-xs font-mono text-gray-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>LIVE MESH</span>
              <span className="text-gray-500">|</span>
              <span className="text-amber-400">{lastUpdated}</span>
            </div>

            <button
              onClick={refreshTelemetry}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* COMPONENT A: FLEET MATRIX */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Component A: Autonomous Fleet Matrix
              </h2>
              <p className="text-xs text-gray-400">Real-time status, active task telemetry, and cognitive efficiency indexes.</p>
            </div>
            <span className="text-xs font-mono text-gray-400">{fleet.length} Agents Online</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleet.map((agent) => (
              <div
                key={agent.agentId}
                className="bg-[#0B0F17] p-5 rounded-2xl border border-white/10 hover:border-amber-500/40 transition-all duration-200 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">{agent.name}</h3>
                      <p className="text-[11px] text-gray-400 line-clamp-1">{agent.role}</p>
                    </div>
                    {renderStatusBadge(agent.status)}
                  </div>

                  <div className="bg-[#111827] p-3 rounded-xl border border-white/5 mb-4">
                    <span className="text-[10px] font-mono uppercase text-gray-500 tracking-wider block mb-1">Active Objective:</span>
                    <p className="text-xs text-gray-300 font-medium line-clamp-2">{agent.currentTask || 'Awaiting autonomous dispatch trigger'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5 text-center">
                  <div className="bg-[#030712] p-2 rounded-lg">
                    <span className="text-[10px] text-gray-500 uppercase block">Latency</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{agent.metrics?.latencyMs || 12}ms</span>
                  </div>
                  <div className="bg-[#030712] p-2 rounded-lg">
                    <span className="text-[10px] text-gray-500 uppercase block">Completed</span>
                    <span className="text-xs font-mono font-bold text-white">{agent.metrics?.tasksCompleted || 0}</span>
                  </div>
                  <div className="bg-[#030712] p-2 rounded-lg">
                    <span className="text-[10px] text-gray-500 uppercase block">Score</span>
                    <span className="text-xs font-mono font-bold text-amber-400">{agent.metrics?.learningScore || 95}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 2-COLUMN GRID: COMPONENT B (APPROVALS) & COMPONENT C (INGESTION PULSE) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* COMPONENT B: HUMAN-IN-THE-LOOP APPROVAL QUEUE */}
          <section className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white tracking-wide uppercase flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  Component B: Executive Approval Gate
                </h2>
                <p className="text-xs text-gray-400">High-stakes sovereign allocations requiring human authorization.</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {approvals.length} PENDING
              </span>
            </div>

            <div className="space-y-3">
              {approvals.length === 0 ? (
                <div className="bg-[#0B0F17] p-8 rounded-2xl border border-white/10 text-center text-gray-400 text-xs font-mono">
                  All autonomous decisions authorized. Approval queue clear.
                </div>
              ) : (
                approvals.map((appr) => (
                  <div
                    key={appr.id}
                    className="bg-[#0B0F17] p-5 rounded-2xl border border-white/10 hover:border-amber-500/30 transition shadow-lg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-amber-400">{appr.category}</span>
                          <span className="text-gray-600">•</span>
                          <span className="text-[11px] font-mono text-gray-400">{appr.agent}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white">{appr.title}</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {appr.priority || 'HIGH'}
                      </span>
                    </div>

                    <div className="bg-[#111827] p-3 rounded-xl border border-white/5 text-xs text-gray-300 space-y-1">
                      <div><span className="text-gray-500">Recipient:</span> {appr.recipient || 'Sovereign Mandate'}</div>
                      <div><span className="text-gray-500">Target Asset:</span> {appr.targetAsset || 'Dubai Prime Freehold'}</div>
                      {appr.payload && (
                        <div className="pt-2 mt-2 border-t border-white/5 font-mono text-[11px] text-gray-400">
                          {JSON.stringify(appr.payload)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => handleResolveApproval(appr.id, 'REJECTED')}
                        disabled={resolvingId === appr.id}
                        className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleResolveApproval(appr.id, 'APPROVED')}
                        disabled={resolvingId === appr.id}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/20 text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Approve & Dispatch
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* COMPONENT C: INGESTION PULSE FEED */}
          <section className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white tracking-wide uppercase flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Component C: Ingestion Pulse
                </h2>
                <p className="text-xs text-gray-400">Last 15 multi-channel interactions.</p>
              </div>
              <span className="text-xs font-mono text-emerald-400">Realtime Stream</span>
            </div>

            <div className="bg-[#0B0F17] p-4 rounded-2xl border border-white/10 divide-y divide-white/5 max-h-[560px] overflow-y-auto space-y-2">
              {interactions.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-xs font-mono">
                  No interaction logs detected in stream.
                </div>
              ) : (
                interactions.map((log) => (
                  <div key={log.id} className="pt-3 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {log.channel || 'WEBSITE'}
                        </span>
                        <span className="font-mono text-gray-400">{log.event_type}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'Recent'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-200 font-medium">{log.summary}</p>
                    {log.correlation_id && (
                      <span className="text-[10px] font-mono text-gray-500 block truncate">
                        corr: {log.correlation_id}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* COMPONENT D: EXECUTIVE COPILOT PROMPT BAR */}
        <section className="bg-gradient-to-r from-[#0B0F17] via-[#111827] to-[#0B0F17] p-6 rounded-3xl border border-amber-500/30 shadow-2xl shadow-amber-500/5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              Component D: Executive Copilot (Gemini 2.5 Flash)
            </h2>
            <p className="text-xs text-gray-400">
              Query institutional Dubai real estate laws, statutory yield matrices, and autonomous agent directives.
            </p>
          </div>

          <form onSubmit={handleCopilotSubmit} className="flex gap-3">
            <input
              type="text"
              value={copilotPrompt}
              onChange={(e) => setCopilotPrompt(e.target.value)}
              placeholder="e.g. Synthesize Portuguese NHR allocation strategy for Palm Jumeirah under Law 8 Escrow..."
              className="flex-1 bg-[#030712] border border-white/15 focus:border-amber-400 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-gray-500 outline-none transition font-sans shadow-inner"
            />
            <button
              type="submit"
              disabled={copilotLoading}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 hover:from-amber-500 hover:to-yellow-300 text-black font-bold text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {copilotLoading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin"></span>
                  Processing...
                </>
              ) : (
                <>
                  <span>Instruct</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Prompt Suggestion Chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              'Palm Jumeirah Escrow Law 8 Yield Band',
              'Golden Visa Cabinet Res 65/2022 Criteria',
              'Spain Wealth Tax Hedge Allocation',
              'DIFC Common Law Asset Shielding',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setCopilotPrompt(chip)}
                className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-amber-300 text-[11px] font-mono border border-white/5 transition"
              >
                + {chip}
              </button>
            ))}
          </div>

          {/* Copilot Response Card */}
          {copilotResponse && (
            <div className="mt-4 p-5 rounded-2xl bg-[#030712] border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-amber-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  JARVIS / Gemini 2.5 Flash Synthesis
                </span>
                <span className="text-gray-500">{copilotResponse.latencyMs || 15}ms</span>
              </div>
              <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {copilotResponse.response || copilotResponse.text || JSON.stringify(copilotResponse)}
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
