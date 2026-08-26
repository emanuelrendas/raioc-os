import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

/**
 * RAIOC OS — Mission Control Realtime WebSocket Hook
 * Hook: useMissionControlRealtime
 * 
 * Provides live WebSocket streaming via Supabase Realtime Channels for:
 * - CRM Investor Pipeline updates (`investors`)
 * - HITL Approvals Queue (`executive_approvals`)
 * - Multi-Agent Runtime Telemetry (`runtime_agent_telemetry`)
 * - Ingestion Pulse Feed (`interaction_logs`)
 */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://tovfnshstqxmwwlllthj.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  '';

const internalSecret =
  process.env.NEXT_PUBLIC_RAIOC_INTERNAL_SECRET ||
  process.env.RAIOC_INTERNAL_SECRET ||
  'raioc_sovereign_auth_2026_x99';

export interface MissionControlState {
  healthBar: {
    systemHealthPct: number;
    totalPipelineAed: number;
    closedWonAed: number;
    activeLeadsCount: number;
    pendingApprovalsCount: number;
    errorRate5m: number;
    activeWorkflowsCount: number;
  };
  agentFleet: Array<{
    id: string;
    name: string;
    role: string;
    model: string;
    capabilities: string[];
    live_status: string;
    active_task: string;
    tokens_consumed_total: number;
    compute_cost_usd: number;
    error_rate_5m: number;
    last_latency_ms: number;
    uptime_seconds: number;
    last_heartbeat: string;
  }>;
  crmPipeline: {
    stages: Array<{
      id: string;
      label: string;
      totalAed: number;
      deals: Array<{
        id: string;
        name: string;
        company: string;
        budgetAed: number;
        targetAsset: string;
        stage: string;
        diraScore: number;
        preferredChannel: string;
      }>;
    }>;
    totalPipelineAed: number;
    closedWonAed: number;
    activeDealCount: number;
  };
  approvalsQueue: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    agent: string;
    payload_summary: string;
    created_at: string;
  }>;
  ingestionPulse: Array<{
    id: string;
    channel: string;
    event_type: string;
    source_agent: string;
    summary: string;
    sender: string;
    traceparent?: string;
    payload_sha256?: string;
    created_at: string;
  }>;
  infrastructure: {
    supabase: { status: string; latency_ms: number };
    eventBus: { status: string; queue_latency_ms: number };
    circuitBreakers: Array<{ name: string; status: string }>;
  };
}

export type ConnectionStatus = 'CONNECTING' | 'SUBSCRIBED' | 'DISCONNECTED' | 'ERROR';

export interface RealtimeEventPayload {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  timestamp: string;
  record: Record<string, unknown>;
}

export function useMissionControlRealtime(options: { isMasked?: boolean; pollingFallbackMs?: number } = {}) {
  const { isMasked = false, pollingFallbackMs = 4000 } = options;

  const [state, setState] = useState<MissionControlState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [lastEvent, setLastEvent] = useState<RealtimeEventPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toISOString());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient(supabaseUrl, supabaseAnonKey));

  // 1. Initial State Fetch & Full Synchronizer
  const fetchState = useCallback(async () => {
    try {
      const url = isMasked
        ? '/api/v1/mission-control/v1-state?masked=true'
        : '/api/v1/mission-control/v1-state';

      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalSecret}`,
          'X-RAIOC-Secret': internalSecret,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch Mission Control state: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      setState(data.body || data);
      setLastSyncedAt(new Date().toISOString());
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during state sync';
      setError(msg);
      console.warn('[useMissionControlRealtime] State fetch warning:', msg);
    }
  }, [isMasked]);

  // 2. Establish Realtime WebSocket Channel
  useEffect(() => {
    fetchState();

    const client = supabaseRef.current;
    setConnectionStatus('CONNECTING');

    const channel = client
      .channel('raioc-mission-control-mesh')
      // A. Listen to CRM Pipeline Updates
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investors' },
        (payload) => {
          setLastEvent({
            table: 'investors',
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            timestamp: new Date().toISOString(),
            record: (payload.new || payload.old || {}) as Record<string, unknown>,
          });
          fetchState();
        }
      )
      // B. Listen to HITL Executive Approvals
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'executive_approvals' },
        (payload) => {
          setLastEvent({
            table: 'executive_approvals',
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            timestamp: new Date().toISOString(),
            record: (payload.new || payload.old || {}) as Record<string, unknown>,
          });
          fetchState();
        }
      )
      // C. Listen to Dynamic Agent Telemetry
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'runtime_agent_telemetry' },
        (payload) => {
          setLastEvent({
            table: 'runtime_agent_telemetry',
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            timestamp: new Date().toISOString(),
            record: (payload.new || {}) as Record<string, unknown>,
          });
          fetchState();
        }
      )
      // D. Listen to Multi-Channel Ingestion Logs
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'interaction_logs' },
        (payload) => {
          setLastEvent({
            table: 'interaction_logs',
            eventType: 'INSERT',
            timestamp: new Date().toISOString(),
            record: payload.new as Record<string, unknown>,
          });
          fetchState();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('SUBSCRIBED');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('ERROR');
        }
      });

    channelRef.current = channel;

    // Polling fallback to guarantee 100% telemetry consistency
    const pollInterval = setInterval(() => {
      fetchState();
    }, pollingFallbackMs);

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        client.removeChannel(channelRef.current);
      }
    };
  }, [fetchState, pollingFallbackMs]);

  return {
    state,
    isConnected: connectionStatus === 'SUBSCRIBED',
    connectionStatus,
    lastEvent,
    lastSyncedAt,
    error,
    refreshState: fetchState,
  };
}
