import React, { useState, useEffect, useCallback } from 'react';

/**
 * RAIOC OS — Executive Mission Control V1 (24/7 Wall-Screen Command Center)
 * Sovereign Gold & Obsidian Multi-Agent Telemetry, Realtime CRM, and HITL Approval Gateway.
 */

export default function MissionControlDashboard() {
  const [state, setState] = useState(null);
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [internalSecret, setInternalSecret] = useState('raioc_sovereign_auth_2026_x99');
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [resolvingId, setResolvingId] = useState(null);

  // Fetch live consolidated V1 telemetry
  const refreshTelemetry = useCallback(async () => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internalSecret}`,
        'X-RAIOC-Secret': internalSecret,
      };

      const res = await fetch('/api/v1/mission-control/v1-state', { headers });
      if (res.ok) {
        const data = await res.json();
        setState(data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to refresh Mission Control V1 telemetry:', err);
    }
  }, [internalSecret]);

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
      alert(`JARVIS Executive Consensus:\n\n${data.content || data.synthesis || JSON.stringify(data)}`);
      setCopilotPrompt('');
      await refreshTelemetry();
    } catch (err) {
      alert(`Copilot Error: ${err.message}`);
    } finally {
      setCopilotLoading(false);
    }
  };

  const kpis = state?.kpiStrip || {
    systemHealth: 99.98,
    pipelineAed: 207000000,
    activeLeads: 10,
    pendingHitlCount: 0,
    errorRate5m: 0.0,
    activeWorkflows: 8,
  };

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 font-sans p-6 space-y-6">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-300 flex items-center justify-center font-black text-black text-lg">
            R
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              RAIOC MISSION CONTROL
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                24/7 WALL-SCREEN V1
              </span>
            </h1>
            <p className="text-[11px] text-gray-400">Autonomous Multi-Agent Command Mesh & Realtime CRM</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            LIVE MESH ({lastUpdated})
          </span>
          <button
            onClick={refreshTelemetry}
            className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-gray-300 hover:text-white"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="text-[11px] font-mono text-gray-400">SYSTEM HEALTH</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{kpis.systemHealth}%</div>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="text-[11px] font-mono text-gray-400">ACTIVE PIPELINE</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            AED {(kpis.pipelineAed / 1000000).toFixed(1)}M
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="text-[11px] font-mono text-gray-400">ACTIVE DEALS</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{kpis.activeLeads} Active</div>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="text-[11px] font-mono text-gray-400">PENDING HITL</div>
          <div className="text-2xl font-bold font-mono text-amber-500 mt-1">{kpis.pendingHitlCount} Pending</div>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="text-[11px] font-mono text-gray-400">5M ERROR RATE</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{kpis.errorRate5m.toFixed(2)}%</div>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="text-[11px] font-mono text-gray-400">WORKFLOWS</div>
          <div className="text-2xl font-bold font-mono text-purple-400 mt-1">{kpis.activeWorkflows} Running</div>
        </div>
      </div>

      {/* 4-Column Command Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Column 1: Fleet Matrix */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 h-[600px] flex flex-col">
            <h2 className="text-xs font-bold font-mono uppercase text-white mb-3">Agent Fleet Matrix</h2>
            <div className="space-y-2 overflow-y-auto flex-1">
              {(state?.fleetMatrix || []).map((agent) => (
                <div key={agent.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-white">{agent.name}</span>
                    <span className="text-[10px] text-amber-400 uppercase">{agent.live_status}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate">{agent.active_task || agent.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Operational CRM */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 h-[600px] flex flex-col">
            <h2 className="text-xs font-bold font-mono uppercase text-white mb-3">Realtime CRM Pipeline</h2>
            <div className="space-y-3 overflow-y-auto flex-1">
              {(state?.crmPipeline?.stages || []).map((stage) => (
                <div key={stage.id} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono text-gray-300">
                    <span>{stage.label}</span>
                    <span className="text-amber-400">AED {(stage.totalAed / 1000000).toFixed(1)}M</span>
                  </div>
                  {(stage.deals || []).map((deal) => (
                    <div key={deal.id} className="p-2 rounded bg-white/[0.02] border border-white/5 text-xs">
                      <div className="flex justify-between font-semibold text-white">
                        <span>{deal.name}</span>
                        <span className="text-amber-400">DIRA {deal.diraScore}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 flex justify-between mt-0.5">
                        <span>{deal.targetAsset}</span>
                        <span className="text-emerald-400">AED {(deal.budgetAed / 1000000).toFixed(1)}M</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 3: HITL Approvals & Workflows */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 h-[600px] flex flex-col">
            <h2 className="text-xs font-bold font-mono uppercase text-white mb-3">HITL Executive Approvals</h2>
            <div className="space-y-3 overflow-y-auto flex-1">
              {(state?.approvalQueue || []).length === 0 ? (
                <div className="text-center text-xs text-gray-500 font-mono p-6">No pending approvals.</div>
              ) : (
                (state?.approvalQueue || []).map((appr) => (
                  <div key={appr.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-amber-400 font-bold">{appr.priority} PRIORITY</div>
                    <div className="text-xs font-bold text-white">{appr.title}</div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleApproval(appr.id, 'APPROVE')}
                        disabled={resolvingId === appr.id}
                        className="flex-1 py-1 px-2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => handleApproval(appr.id, 'REJECT')}
                        disabled={resolvingId === appr.id}
                        className="py-1 px-2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold"
                      >
                        REJECT
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Column 4: Ingestion Pulse & Audit */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 h-[600px] flex flex-col">
            <h2 className="text-xs font-bold font-mono uppercase text-white mb-3">Ingestion Pulse & Audit</h2>
            <div className="space-y-2 overflow-y-auto flex-1">
              {(state?.ingestionPulse || []).map((log) => (
                <div key={log.id} className="p-2.5 rounded bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-amber-400 font-bold">{log.channel}</span>
                    <span className="text-gray-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-gray-200">{log.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Copilot Bar */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center">
          J
        </div>
        <form onSubmit={handleCopilotSubmit} className="flex-1 flex gap-2">
          <input
            type="text"
            value={copilotPrompt}
            onChange={(e) => setCopilotPrompt(e.target.value)}
            placeholder="Instruct JARVIS: 'Analyze Como Residences allocation for Lord Alistair'..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={copilotLoading}
            className="px-4 py-2 bg-amber-500 text-black font-bold text-xs rounded-xl font-mono"
          >
            {copilotLoading ? 'PROCESSING...' : 'EXECUTE'}
          </button>
        </form>
      </div>
    </div>
  );
}
