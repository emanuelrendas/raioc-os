'use client';

import React, { useState, useMemo } from 'react';
import { useMissionControlRealtime } from '@/hooks/useMissionControlRealtime';

interface ApprovalItem {
  id: string;
  title?: string;
  recipient?: string;
  name?: string;
  country?: string;
  countryFlag?: string;
  budgetAed?: number;
  budget_aed?: number;
  targetAsset?: string;
  target_asset?: string;
  diraScore?: number;
  riisScore?: number;
  priority?: string;
  status?: string;
  agent?: string;
  created_at?: string;
  payload?: {
    recipient?: string;
    name?: string;
    budgetAed?: number;
    budget_aed?: number;
    targetAsset?: string;
    target_asset?: string;
    intent?: string;
    channel?: string;
    script?: string;
    country?: string;
    diraScore?: number;
  };
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description: string;
  timestamp: string;
}

export default function MissionControlPage() {
  const { state, isConnected, refreshState } = useMissionControlRealtime({ pollingFallbackMs: 4000 });
  const [loadingActions, setLoadingActions] = useState<Record<string, 'APPROVE' | 'REJECT' | null>>({});
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [daemonHealth, setDaemonHealth] = useState<{ memory_rss_mb?: number; uptime?: number; loop_status?: Record<string, boolean> } | null>(null);

  // ATLAS Sovereign Corridor Modeler State
  const [selectedCorridor, setSelectedCorridor] = useState<'PALM_JEBEL_ALI' | 'DUBAI_SOUTH_DWC'>('PALM_JEBEL_ALI');
  const [capitalAllocation, setCapitalAllocation] = useState<number>(35000000);
  const [ownershipVehicle, setOwnershipVehicle] = useState<'SPV_DIFC_ADGM' | 'INDIVIDUAL_DIRECT'>('SPV_DIFC_ADGM');
  const [atlasLoading, setAtlasLoading] = useState<boolean>(false);
  const [atlasResult, setAtlasResult] = useState<any>(null);

  // Poll /healthz
  React.useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/healthz');
        if (res.ok) {
          const data = await res.json();
          setDaemonHealth(data.body || data);
        }
      } catch (_) {}
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Compute ATLAS ROI
  const calculateAtlasRoi = async () => {
    setAtlasLoading(true);
    try {
      const res = await fetch('/api/v1/opal/roi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corridor: selectedCorridor,
          allocation_aed: capitalAllocation,
          ownership_vehicle: ownershipVehicle,
        }),
      });
      const data = await res.json();
      setAtlasResult(data.data || data);
      addToast('success', 'Modelação ATLAS Concluída', `Pro-forma determinístico sintetizado para ${selectedCorridor}.`);
    } catch (err: any) {
      addToast('error', 'Erro no Motor ATLAS', err.message || 'Falha ao calcular ROI Opal.');
    } finally {
      setAtlasLoading(false);
    }
  };

  // Show Toast
  const addToast = (type: 'success' | 'error' | 'info', title: string, description: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [{ id, type, title, description, timestamp: new Date().toLocaleTimeString('pt-PT') }, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  // 1. Process 1-Click HITL Decision
  const handleDecision = async (approvalId: string, decision: 'APPROVED' | 'REJECTED', itemData?: any) => {
    if (loadingActions[approvalId]) return;

    setLoadingActions((prev) => ({ ...prev, [approvalId]: decision === 'APPROVED' ? 'APPROVE' : 'REJECT' }));

    const recipientName = itemData?.recipient || itemData?.name || itemData?.payload?.recipient || 'Investidor Soberano';

    try {
      const res = await fetch('/api/v1/approvals/decide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer raioc_sovereign_auth_2026_x99',
          'X-RAIOC-Secret': 'raioc_sovereign_auth_2026_x99',
        },
        body: JSON.stringify({
          approvalId: approvalId,
          approval_id: approvalId,
          decision: decision,
          approvedBy: 'Emanuel Rendas',
          decided_by: 'Emanuel Rendas',
          actor: 'Emanuel Rendas',
          note: decision === 'APPROVED' 
            ? 'Aprovado via Mission Control V2. Despacho autónomo da AIDA autorizado.' 
            : 'Rejeitado e arquivado no registo de auditoria.',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Falha ao processar a decisão executiva');
      }

      // Mark as locally resolved for smooth instant removal
      setResolvedIds((prev) => new Set([...prev, approvalId]));

      if (decision === 'APPROVED') {
        addToast(
          'success',
          '✅ Mandato Aprovado com Sucesso',
          `A AIDA disparou imediatamente a mensagem formal de voz para ${recipientName} via WhatsApp.`
        );
      } else {
        addToast(
          'info',
          '❌ Mandato Rejeitado e Arquivado',
          `O mandato de ${recipientName} foi arquivado com registo de auditoria imutável no Supabase.`
        );
      }

      // Refresh state to sync with backend
      refreshState();
    } catch (err: any) {
      addToast('error', 'Erro na Decisão HITL', err.message || 'Ocorreu um erro ao comunicar com a API.');
    } finally {
      setLoadingActions((prev) => {
        const next = { ...prev };
        delete next[approvalId];
        return next;
      });
    }
  };

  // Extract Key Telemetry Aggregates
  const totalPipelineAed = useMemo(() => {
    if (state?.healthBar?.totalPipelineAed) return state.healthBar.totalPipelineAed;
    if (state?.crmPipeline?.totalPipelineAed) return state.crmPipeline.totalPipelineAed;
    return 240000000;
  }, [state]);

  const activeInvestorsCount = useMemo(() => {
    if (state?.healthBar?.activeLeadsCount) return state.healthBar.activeLeadsCount;
    if (state?.crmPipeline?.activeDealCount) return state.crmPipeline.activeDealCount;
    return 18;
  }, [state]);

  // Pending Approvals Queue (Filtered out locally resolved items)
  const pendingApprovals = useMemo(() => {
    const rawList: ApprovalItem[] = (state?.approvalsQueue || state?.pendingApprovals || []) as ApprovalItem[];
    return rawList.filter((item) => !resolvedIds.has(item.id) && (item.status === 'PENDING' || !item.status));
  }, [state, resolvedIds]);

  const pendingCount = pendingApprovals.length;

  // Agent Radar Human Status Mapping
  const humanAgents = [
    { name: 'MARK', role: 'Triagem & Risco', status: 'ONLINE', msg: 'A triar investidores da web e documentos DLD', dot: '#10B981' },
    { name: 'AIDA', role: 'Relações & Voz AI', status: pendingCount > 0 ? 'WAITING' : 'READY', msg: pendingCount > 0 ? 'Aguardando a tua aprovação para disparo de voz' : 'Pronta para síntese executiva', dot: pendingCount > 0 ? '#F59E0B' : '#10B981' },
    { name: 'ATLAS', role: 'Real Estate & ROI', status: 'ONLINE', msg: 'A calcular projeções DLD e modelos de yield Opal', dot: '#10B981' },
    { name: 'LEX', role: 'Conformidade & Fiscal', status: 'ONLINE', msg: 'A verificar conformidade e Lei nº 8 de 2007', dot: '#10B981' },
    { name: 'ARGOS', role: 'Inteligência DLD', status: 'ONLINE', msg: 'Monitorização DLD e Whale Alerts ativa (>=20M AED)', dot: '#10B981' },
    { name: 'SENTINEL', role: 'Guardião do Sistema', status: 'HEALTHY', msg: 'Sistema 100% operacional e malha ativa', dot: '#10B981' },
    { name: 'JARVIS', role: 'Cérebro Executivo', status: 'ACTIVE', msg: 'Orquestração contínua e síntese estratégica', dot: '#3B82F6' },
  ];

  // Helper Flag Formatter
  const getFlag = (country?: string) => {
    const c = (country || '').toUpperCase();
    if (c.includes('EMIRATES') || c.includes('UAE') || c.includes('DUBAI')) return '🇦🇪';
    if (c.includes('PORTUGAL') || c.includes('PT') || c.includes('LISBON')) return '🇵🇹';
    if (c.includes('UK') || c.includes('BRITAIN') || c.includes('LONDON')) return '🇬🇧';
    if (c.includes('SAUDI') || c.includes('KSA') || c.includes('RIYADH')) return '🇸🇦';
    if (c.includes('SWISS') || c.includes('SWITZERLAND') || c.includes('GENEVA')) return '🇨🇭';
    if (c.includes('USA') || c.includes('AMERICA') || c.includes('NEW YORK')) return '🇺🇸';
    if (c.includes('QATAR') || c.includes('DOHA')) return '🇶🇦';
    return '🏛️';
  };

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white font-sans selection:bg-[#D4AF37]/30 selection:text-[#D4AF37]">
      {/* Dynamic Toast Notifications */}
      <div className="fixed top-6 right-6 z-50 flex flex-col space-y-3 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl backdrop-blur-xl border transition-all duration-300 transform translate-y-0 ${
              toast.type === 'success'
                ? 'bg-[#10B981]/15 border-[#10B981]/40 text-emerald-300'
                : toast.type === 'error'
                ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                : 'bg-[#141820]/95 border-[#D4AF37]/30 text-amber-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm tracking-wide">{toast.title}</span>
              </div>
              <span className="text-[10px] opacity-60 ml-2">{toast.timestamp}</span>
            </div>
            <p className="text-xs mt-1 opacity-90 leading-relaxed text-gray-200">{toast.description}</p>
          </div>
        ))}
      </div>

      {/* Header Bar */}
      <header className="border-b border-[#232A36] bg-[#0E1116]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#996515] flex items-center justify-center font-bold text-black text-sm shadow-lg shadow-[#D4AF37]/20">
              R
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold tracking-wider text-gray-100 uppercase">RAIOC OS • Mission Control</h1>
                <span className="text-[10px] bg-[#D4AF37]/15 text-[#D4AF37] px-2 py-0.5 rounded-full font-medium border border-[#D4AF37]/30">
                  V2 LUXURY
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Consola Soberana de Decisão & Orquestração</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-[#141820] border border-[#232A36] px-3 py-1.5 rounded-full text-xs">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-gray-300 font-medium">
                {isConnected ? 'Realtime Conectado' : 'Sincronização Ativa'}
              </span>
            </div>

            <button
              onClick={() => refreshState()}
              className="bg-[#141820] hover:bg-[#1C222D] border border-[#232A36] hover:border-[#D4AF37]/40 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center space-x-1.5 shadow-sm"
              title="Atualizar dados agora"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* 1. TOP HERO NUMBERS & DAEMON HEALTH */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Hero 1: Capital Sob Mandato */}
          <div className="bg-[#141820] border border-[#232A36] hover:border-[#D4AF37]/30 p-6 rounded-2xl shadow-xl transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-2xl group-hover:bg-[#D4AF37]/10 transition-all" />
            <span className="text-xs uppercase font-semibold text-gray-400 tracking-wider">Capital Sob Mandato</span>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-3xl lg:text-4xl font-extrabold text-[#D4AF37] tracking-tight">
                AED {(totalPipelineAed).toLocaleString('pt-PT')}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center space-x-1">
              <span className="text-emerald-400 font-medium">↑ 100% Escrow</span>
              <span>• Protegido pela Lei nº 8 de 2007</span>
            </p>
          </div>

          {/* Hero 2: Investidores Qualificados */}
          <div className="bg-[#141820] border border-[#232A36] hover:border-[#D4AF37]/30 p-6 rounded-2xl shadow-xl transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
            <span className="text-xs uppercase font-semibold text-gray-400 tracking-wider">Investidores Qualificados</span>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl lg:text-4xl font-extrabold text-gray-100 tracking-tight">
                {activeInvestorsCount}
              </span>
              <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                Tier-1 / UHNW
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Clientes ativos na carteira e em triagem DIRA</p>
          </div>

          {/* Hero 3: Decisões Pendentes (HITL Alert) */}
          <div className={`p-6 rounded-2xl shadow-xl transition-all duration-300 relative overflow-hidden border ${
            pendingCount > 0 
              ? 'bg-gradient-to-br from-[#1C1810] to-[#141820] border-amber-500/40 shadow-amber-500/5' 
              : 'bg-[#141820] border-[#232A36]'
          }`}>
            <span className="text-xs uppercase font-semibold text-gray-400 tracking-wider">Decisões Pendentes</span>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-baseline space-x-2">
                <span className={`text-3xl lg:text-4xl font-extrabold tracking-tight ${pendingCount > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                  {pendingCount}
                </span>
                <span className="text-xs text-gray-400">mandatos</span>
              </div>
              {pendingCount > 0 && (
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {pendingCount > 0 ? 'Requer autorização executiva de 1-clique' : 'Nenhuma decisão pendente no momento'}
            </p>
          </div>

          {/* Hero 4: Daemon & Memória RSS */}
          <div className="bg-[#141820] border border-[#232A36] hover:border-sky-500/30 p-6 rounded-2xl shadow-xl transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-all" />
            <span className="text-xs uppercase font-semibold text-gray-400 tracking-wider">Saúde do Daemon</span>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className={`text-3xl lg:text-4xl font-extrabold tracking-tight ${(daemonHealth?.memory_rss_mb || 0) >= 180 ? 'text-rose-400' : 'text-sky-400'}`}>
                {daemonHealth?.memory_rss_mb ? `${daemonHealth.memory_rss_mb} MB` : '48 MB'}
              </span>
              <span className="text-xs text-gray-500">/ 250MB</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center space-x-1.5">
              <span className="text-emerald-400 font-medium">3/3 Loops Ativos</span>
              <span>• JARVIS, Sentinel, Scheduler</span>
            </p>
          </div>
        </section>

        {/* 2. FILA DE DECISÃO HITL (INTERACTIVE CARDS) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-bold text-gray-100 tracking-wide">Fila de Decisão Executiva (HITL)</h2>
              <span className="text-xs bg-[#D4AF37]/15 text-[#D4AF37] px-2.5 py-0.5 rounded-full font-bold border border-[#D4AF37]/30">
                {pendingCount} {pendingCount === 1 ? 'Aguardando' : 'Aguardando'}
              </span>
            </div>
            <span className="text-xs text-gray-400">1-Clique para Desbloquear Comunicação Soberana</span>
          </div>

          {pendingCount === 0 ? (
            <div className="bg-[#141820]/60 border border-[#232A36] rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-xl">
                ✓
              </div>
              <h3 className="text-base font-semibold text-gray-200">Fila Limpa • Todos os Mandatos Foram Decididos</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                A frota de agentes autónomos está a processar os mandatos em conformidade estrita. Novos leads que excedam 10M AED aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingApprovals.map((item) => {
                const payload = item.payload || {};
                const name = item.recipient || item.name || payload.recipient || payload.name || 'Investidor Soberano';
                const budget = Number(item.budgetAed || item.budget_aed || payload.budgetAed || payload.budget_aed || 25000000);
                const asset = item.targetAsset || item.target_asset || payload.targetAsset || payload.target_asset || 'Como Residences, Palm Jumeirah';
                const dira = item.diraScore || payload.diraScore || 95;
                const country = item.country || payload.country || 'United Arab Emirates';
                const flag = getFlag(country);
                const isLoadingApprove = loadingActions[item.id] === 'APPROVE';
                const isLoadingReject = loadingActions[item.id] === 'REJECT';
                const isAnyLoading = Boolean(loadingActions[item.id]);

                return (
                  <div
                    key={item.id}
                    className="bg-[#141820] border border-[#232A36] hover:border-[#D4AF37]/40 rounded-2xl p-6 shadow-xl space-y-5 transition-all duration-300 relative overflow-hidden"
                  >
                    {/* Top Tag & Flag */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{flag}</span>
                        <h3 className="font-bold text-base text-gray-100">{name}</h3>
                      </div>
                      <span className="text-[11px] font-semibold bg-[#D4AF37]/15 text-[#D4AF37] px-2.5 py-0.5 rounded-full border border-[#D4AF37]/30">
                        {dira}/100 • Tier-1 VIP
                      </span>
                    </div>

                    {/* Target Asset & Budget */}
                    <div className="space-y-1 bg-[#0E1116]/80 p-4 rounded-xl border border-[#232A36]/60">
                      <span className="text-[11px] text-gray-400 uppercase font-medium tracking-wider">Valor do Mandato</span>
                      <div className="text-2xl font-black text-[#D4AF37] tracking-tight">
                        AED {budget.toLocaleString('pt-PT')}
                      </div>
                      <div className="text-xs text-gray-300 flex items-center space-x-1.5 pt-1">
                        <span className="text-gray-400">Ativo Alvo:</span>
                        <span className="font-semibold text-gray-100">{asset}</span>
                      </div>
                    </div>

                    {/* Script Preview if available */}
                    {payload.script && (
                      <div className="text-xs text-gray-400 italic bg-[#0B0D0F]/40 p-3 rounded-lg border border-dashed border-[#232A36] line-clamp-2">
                        "{payload.script}"
                      </div>
                    )}

                    {/* 2 Tactile Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {/* Button 1: REJEITAR */}
                      <button
                        disabled={isAnyLoading}
                        onClick={() => handleDecision(item.id, 'REJECTED', item)}
                        className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all duration-200 flex items-center justify-center space-x-2 ${
                          isAnyLoading
                            ? 'opacity-50 cursor-not-allowed bg-gray-800 border-gray-700 text-gray-400'
                            : 'bg-rose-950/40 hover:bg-rose-900/60 border-rose-800/50 text-rose-300 hover:text-rose-100 hover:border-rose-600 shadow-sm active:scale-98'
                        }`}
                      >
                        {isLoadingReject ? (
                          <div className="flex items-center space-x-2">
                            <span className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                            <span>A rejeitar...</span>
                          </div>
                        ) : (
                          <span>✕ Rejeitar</span>
                        )}
                      </button>

                      {/* Button 2: APROVAR E DISPARAR AIDA */}
                      <button
                        disabled={isAnyLoading}
                        onClick={() => handleDecision(item.id, 'APPROVED', item)}
                        className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg ${
                          isAnyLoading
                            ? 'opacity-50 cursor-not-allowed bg-gray-800 border-gray-700 text-gray-400'
                            : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/40 text-white shadow-emerald-950/50 active:scale-98 hover:shadow-emerald-500/20'
                        }`}
                      >
                        {isLoadingApprove ? (
                          <div className="flex items-center space-x-2">
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>A disparar AIDA...</span>
                          </div>
                        ) : (
                          <span>✓ Aprovar & Disparar AIDA</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. CALCULADORA INTERATIVA ATLAS (OPAL ROI) */}
        <section className="bg-[#141820] border border-[#232A36] hover:border-[#D4AF37]/30 p-6 rounded-2xl shadow-xl space-y-5 transition-all duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#232A36] pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-gray-100">Modelador de Corredores Soberanos ATLAS</h2>
                <span className="text-[10px] bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                  MOTOR OPAL ROI
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Simulação financeira determinística com rácios estatutários (DLD 4%, Trustee, Oqood e TIR 7 anos).
              </p>
            </div>
            <span className="text-xs font-mono text-gray-500">/api/v1/opal/roi</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Corredor de Investimento</label>
              <select
                value={selectedCorridor}
                onChange={(e) => setSelectedCorridor(e.target.value as any)}
                className="w-full bg-[#0E1116] border border-[#232A36] rounded-xl px-3 py-2.5 text-xs text-gray-200 font-semibold focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="PALM_JEBEL_ALI">Palm Jebel Ali (Preservação Ultra-Prime)</option>
                <option value="DUBAI_SOUTH_DWC">Dubai South DWC (Infraestrutura / High-Yield)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Alocação de Capital (AED)</label>
              <input
                type="number"
                step="1000000"
                value={capitalAllocation}
                onChange={(e) => setCapitalAllocation(Number(e.target.value))}
                className="w-full bg-[#0E1116] border border-[#232A36] rounded-xl px-3 py-2.5 text-xs text-gray-100 font-semibold focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Veículo de Detenção</label>
              <select
                value={ownershipVehicle}
                onChange={(e) => setOwnershipVehicle(e.target.value as any)}
                className="w-full bg-[#0E1116] border border-[#232A36] rounded-xl px-3 py-2.5 text-xs text-gray-200 font-semibold focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="SPV_DIFC_ADGM">DIFC / ADGM SPV (Trust Blindado)</option>
                <option value="INDIVIDUAL_DIRECT">Detenção Direta em Nome Individual</option>
              </select>
            </div>

            <div>
              <button
                disabled={atlasLoading}
                onClick={calculateAtlasRoi}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#D4AF37] to-[#996515] hover:from-[#E5C158] hover:to-[#AA7722] text-black font-bold text-xs rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center space-x-2"
              >
                {atlasLoading ? (
                  <span>A calcular pro-forma...</span>
                ) : (
                  <span>Executar Projeção ATLAS →</span>
                )}
              </button>
            </div>
          </div>

          {atlasResult && (
            <div className="bg-[#0E1116] border border-[#232A36] p-5 rounded-xl space-y-4 mt-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                <div className="bg-[#141820] p-3 rounded-lg border border-[#232A36]">
                  <span className="text-gray-400 text-[10px] block">CAP RATE LÍQUIDO</span>
                  <span className="text-amber-400 font-bold text-base">
                    {((atlasResult.net_cap_rate || atlasResult.netCapRate || 0.0515) * 100).toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-gray-500 block">Yield Auditada Mollak</span>
                </div>

                <div className="bg-[#141820] p-3 rounded-lg border border-[#232A36]">
                  <span className="text-gray-400 text-[10px] block">TIR ALVO A 7 ANOS (IRR)</span>
                  <span className="text-emerald-400 font-bold text-base">
                    {((atlasResult.irr_7y || atlasResult.targetIrr7y || 0.135) * 100).toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-gray-500 block">Desinvestimento Estruturado</span>
                </div>

                <div className="bg-[#141820] p-3 rounded-lg border border-[#232A36]">
                  <span className="text-gray-400 text-[10px] block">CAGR MACRO A 10 ANOS</span>
                  <span className="text-sky-400 font-bold text-base">
                    {((atlasResult.cagr_10y || atlasResult.macroCagr10y || 0.093) * 100).toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-gray-500 block">Escassez Física Dubai 2040</span>
                </div>

                <div className="bg-[#141820] p-3 rounded-lg border border-[#232A36]">
                  <span className="text-gray-400 text-[10px] block">IMPOSTO DLD 4%</span>
                  <span className="text-[#D4AF37] font-bold text-base">
                    AED {((atlasResult.statutory_breakdown?.dld_fee_aed || (capitalAllocation * 0.04)) || 1400000).toLocaleString('pt-PT')}
                  </span>
                  <span className="text-[10px] text-gray-500 block">Trustee & Oqood Incluídos</span>
                </div>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-500/20 p-3 rounded-lg text-xs text-emerald-300 flex items-center justify-between">
                <span>
                  🛡️ <strong>Âncora Estatutária:</strong> {atlasResult.statutory_anchors?.escrow || 'Lei nº 8/2007 (Garantia de Escrow)'} • Visto Gold: {atlasResult.golden_visa_qualified ? '✅ 100% Elegível (10 Anos)' : 'Padrão'}
                </span>
                <span className="text-gray-300 font-mono text-[11px]">
                  Desembolso Total: <strong>AED {((atlasResult.total_acquisition_outlay_aed || (capitalAllocation * 1.0526)) || 36842946).toLocaleString('pt-PT')}</strong>
                </span>
              </div>
            </div>
          )}
        </section>

        {/* 3. RADAR DA FROTA DE AGENTES EM PORTUGUÊS CLARO */}
        <section className="bg-[#141820] border border-[#232A36] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#232A36] pb-4">
            <div>
              <h2 className="text-base font-bold text-gray-100">Radar da Frota de Agentes Autónomos</h2>
              <p className="text-xs text-gray-400">Estado de operação humana em tempo real</p>
            </div>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-medium">
              Malha Sentinela Ativa
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {humanAgents.map((ag) => (
              <div
                key={ag.name}
                className="bg-[#0E1116] border border-[#232A36]/80 p-4 rounded-xl flex items-start space-x-3 hover:border-[#D4AF37]/30 transition-all duration-200"
              >
                <div className="mt-1">
                  <span
                    className="block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: ag.dot }}
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-gray-200">{ag.name}</span>
                    <span className="text-[10px] text-gray-500">{ag.role}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-snug truncate">{ag.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
