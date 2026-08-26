/**
 * RAIOC OS - Supabase Database Client & Adapter Layer (Sprint 3)
 * Handles leads, assessments, queue operations, briefs, and operational tables for monitoring & Realtime.
 */

import { createHash } from 'node:crypto';
import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';

export class SupabaseClient {
  constructor(options = {}) {
    this.url = options.url || config.supabase.url;
    this.key = options.key || config.supabase.serviceKey || config.supabase.anonKey;
    this.isMock = !this.url || !this.key || options.useMock === true;

    // In-memory mock storage for hermetic tests and local fallback
    this.mockStore = {
      leads: [],
      assessments: [],
      executive_briefs: [],
      dispatch_queue: [],
      audit_logs: [],
      telemetry: [],
      agent_status: new Map(),
      agent_fleet_status: new Map(),
      core_agent_registry: new Map(),
      core_tool_registry: new Map(),
      core_workflow_registry: new Map(),
      knowledge_nodes: new Map(),
      knowledge_edges: new Map(),
      runtime_agent_telemetry: new Map(),
      runtime_tool_telemetry: new Map(),
      runtime_system_metrics: [],
      enterprise_events: [],
      enterprise_memory_adr: new Map(),
      executive_approvals: [],
      interaction_logs: [],
      investors: [],
      system_health: [],
      system_metrics: [],
      connector_health: new Map(),
      scheduler_jobs: new Map(),
      agent_logs: [],
      agent_heartbeats: [],
      executions: new Map(),
      workflow_runs: new Map(),
      notifications: [],
      off_plan_projects: [],
    };

    this.initEnterpriseCoreSeeds();
  }

  initEnterpriseCoreSeeds() {
    // 1. Seed Core Agents
    const initialAgents = [
      {
        id: 'jarvis_executive_brain',
        name: 'JARVIS',
        role: 'Chief Autonomous Orchestration Agent & Executive Brain',
        model: 'gemini-2.5-flash',
        capabilities: ['workflow_orchestration', 'cognitive_synthesis', 'cross_agent_triage', 'autonomous_dispatch'],
        permissions: ['admin:all', 'execute:pipeline', 'resolve:approvals'],
        cost_budget: { monthly_limit_usd: 1500, current_spend_usd: 42.5, currency: 'USD' },
        version: '2.5.0',
        owner: 'CTO',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'mark_lead_triage',
        name: 'MARK',
        role: 'Lead Triage, Segmentation & Risk Intelligence Specialist',
        model: 'gemini-2.5-flash',
        capabilities: ['dira_scoring', 'riis_evaluation', 'crm_segmentation', 'inbound_triage'],
        permissions: ['read:leads', 'write:crm', 'score:dira'],
        cost_budget: { monthly_limit_usd: 600, current_spend_usd: 18.2, currency: 'USD' },
        version: '2.1.0',
        owner: 'CTO',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'atlas_opal_calculator',
        name: 'ATLAS',
        role: 'Real Estate & Opal ROI Modeling Specialist',
        model: 'gemini-2.5-flash',
        capabilities: ['opal_roi_calculation', 'dld_index_valuation', 'yield_forecasting', 'sqft_benchmarking'],
        permissions: ['read:dld', 'execute:calculators', 'model:yield'],
        cost_budget: { monthly_limit_usd: 500, current_spend_usd: 12.8, currency: 'USD' },
        version: '2.0.0',
        owner: 'CTO',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'aida_flow_mixboard',
        name: 'AIDA',
        role: 'Client Relations & Cinematic Media Teaser Specialist',
        model: 'gemini-2.5-flash',
        capabilities: ['flow_teaser_generation', 'mixboard_composition', 'whatsapp_dispatch', 'memorandum_drafting'],
        permissions: ['dispatch:brief', 'generate:media', 'send:whatsapp'],
        cost_budget: { monthly_limit_usd: 750, current_spend_usd: 24.1, currency: 'USD' },
        version: '2.0.0',
        owner: 'CTO',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'lex_compliance_legal',
        name: 'LEX',
        role: 'Compliance, Statutory Tax & Golden Visa Specialist',
        model: 'gemini-2.5-flash',
        capabilities: ['golden_visa_audit', 'law8_escrow_compliance', 'difc_structuring', 'tax_shielding'],
        permissions: ['audit:compliance', 'verify:escrow', 'check:visa'],
        cost_budget: { monthly_limit_usd: 500, current_spend_usd: 8.4, currency: 'USD' },
        version: '2.0.0',
        owner: 'CTO',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'sentinel_devops_qa',
        name: 'SENTINEL',
        role: 'QA, DevOps & Autonomous System Health Guardian',
        model: 'gemini-2.5-flash',
        capabilities: ['health_monitoring', 'gateway_verification', 'latency_auditing', 'self_healing'],
        permissions: ['monitor:system', 'restart:adapters', 'alert:ops'],
        cost_budget: { monthly_limit_usd: 400, current_spend_usd: 5.9, currency: 'USD' },
        version: '2.2.0',
        owner: 'CTO',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const a of initialAgents) {
      this.mockStore.core_agent_registry.set(a.id, a);
    }

    // 2. Seed Core Tools
    const initialTools = [
      {
        id: 'gemini_api',
        name: 'Google Gemini 2.5 Flash API',
        category: 'AI_MODEL',
        health_status: 'HEALTHY',
        latency_ms: 18,
        quota_limits: { rate_limit_per_min: 300, daily_quota: 50000 },
        dependencies: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'supabase_database',
        name: 'Supabase PostgreSQL & Realtime',
        category: 'DATABASE',
        health_status: 'HEALTHY',
        latency_ms: 12,
        quota_limits: { pool_size: 20, max_connections: 100 },
        dependencies: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'vercel_gateway',
        name: 'Vercel Serverless Edge Gateway',
        category: 'HOSTING',
        health_status: 'HEALTHY',
        latency_ms: 8,
        quota_limits: { max_concurrency: 1000, timeout_sec: 60 },
        dependencies: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'n8n_orchestration',
        name: 'n8n Workflow Automation Hub',
        category: 'ORCHESTRATION',
        health_status: 'HEALTHY',
        latency_ms: 25,
        quota_limits: { rate_limit_per_min: 120, concurrency: 10 },
        dependencies: ['gemini_api', 'supabase_database'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'opal_engine',
        name: 'Google Opal ROI & Visa Calculator',
        category: 'CALCULATOR',
        health_status: 'HEALTHY',
        latency_ms: 5,
        quota_limits: { rate_limit_per_min: 600, cache_ttl_sec: 300 },
        dependencies: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'flow_engine',
        name: 'Flow Cinematic Video Hook Engine',
        category: 'MULTIMEDIA',
        health_status: 'HEALTHY',
        latency_ms: 35,
        quota_limits: { rate_limit_per_min: 60, video_renders_per_day: 500 },
        dependencies: ['gemini_api'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'mixboard_engine',
        name: 'Mixboard Visual Concept Board Generator',
        category: 'MULTIMEDIA',
        health_status: 'HEALTHY',
        latency_ms: 30,
        quota_limits: { rate_limit_per_min: 60, boards_per_day: 500 },
        dependencies: ['gemini_api'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'youtube_data_api',
        name: 'YouTube Data API v3 Feed Engine',
        category: 'COMMUNICATION',
        health_status: 'HEALTHY',
        latency_ms: 45,
        quota_limits: { rate_limit_per_min: 100, daily_quota: 10000 },
        dependencies: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'whatsapp_cloud_api',
        name: 'Meta WhatsApp Cloud API Gateway',
        category: 'COMMUNICATION',
        health_status: 'HEALTHY',
        latency_ms: 15,
        quota_limits: { rate_limit_per_min: 1000, daily_quota: 100000 },
        dependencies: ['vercel_gateway'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'telegram_bot',
        name: 'Telegram Bot API Ingestion Gateway',
        category: 'COMMUNICATION',
        health_status: 'HEALTHY',
        latency_ms: 12,
        quota_limits: { rate_limit_per_min: 600, daily_quota: 50000 },
        dependencies: ['vercel_gateway'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'mark_ocr_vision',
        name: 'MARK Multimodal OCR & Document Intelligence Engine',
        category: 'ANALYSIS',
        health_status: 'HEALTHY',
        latency_ms: 65,
        quota_limits: { rate_limit_per_min: 300, daily_quota: 25000 },
        dependencies: ['gemini_api', 'cognitive_router'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const t of initialTools) {
      this.mockStore.core_tool_registry.set(t.id, t);
    }

    // 3. Seed Core Workflows
    const initialWorkflows = [
      {
        id: 'wf_google_tools_orchestration',
        name: 'Google Tools & Multi-Agent Orchestration',
        orchestrator: 'n8n',
        trigger_type: 'EVENT',
        input_schema: { type: 'object', properties: { event: { type: 'string' } } },
        output_schema: { type: 'object', properties: { success: { type: 'boolean' } } },
        owner: 'CTO',
        is_active: true,
        version: '1.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'wf_lead_ingestion_triage',
        name: 'Multi-Channel Ingestion & DIRA Scoring Pipeline',
        orchestrator: 'raioc_event_bus',
        trigger_type: 'WEBHOOK',
        input_schema: { type: 'object', properties: { lead: { type: 'object' } } },
        output_schema: { type: 'object', properties: { riis: { type: 'number' } } },
        owner: 'CTO',
        is_active: true,
        version: '1.2.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'wf_outbound_dispatch',
        name: 'Encrypted Executive Brief & WhatsApp Dispatch',
        orchestrator: 'raioc_event_bus',
        trigger_type: 'EVENT',
        input_schema: { type: 'object', properties: { briefId: { type: 'string' } } },
        output_schema: { type: 'object', properties: { dispatched: { type: 'boolean' } } },
        owner: 'CTO',
        is_active: true,
        version: '1.1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'wf_golden_visa_audit',
        name: 'Golden Visa & Escrow Law 8 Compliance Audit',
        orchestrator: 'cloud_functions',
        trigger_type: 'MANUAL',
        input_schema: { type: 'object', properties: { propertyValueAed: { type: 'number' } } },
        output_schema: { type: 'object', properties: { qualified: { type: 'boolean' } } },
        owner: 'CTO',
        is_active: true,
        version: '1.0.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const w of initialWorkflows) {
      this.mockStore.core_workflow_registry.set(w.id, w);
    }

    // 4. Seed Knowledge Nodes
    const initialNodes = [
      {
        id: 'node_uae_law8_escrow',
        entity_type: 'REGULATION',
        label: 'UAE Law No. 8 of 2007 (Escrow Account Framework)',
        properties: { jurisdiction: 'Dubai', authority: 'RERA / DLD', escrow_retention_pct: 5, statutory_protection: 'STRICT' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'node_golden_visa_res65_2022',
        entity_type: 'REGULATION',
        label: 'UAE Cabinet Resolution No. 65 of 2022 (Golden Visa)',
        properties: { minimum_investment_aed: 2000000, duration_years: 10, mortgage_permitted: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'node_palm_jumeirah',
        entity_type: 'MARKET_ZONE',
        label: 'Palm Jumeirah Prime Freehold Zone',
        properties: { avg_yield_pct: 7.4, capital_appreciation_yoy_pct: 16.2, freehold_status: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'node_como_residences',
        entity_type: 'PROPERTY_ASSET',
        label: 'Como Residences by Nakheel (Palm Jumeirah)',
        properties: { developer: 'Nakheel', starting_price_aed: 21000000, escrow_number: 'ESC-2024-COMO', projected_yield_pct: 7.8 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'node_pt_nhr_investor_profile',
        entity_type: 'INVESTOR_PROFILE',
        label: 'Portuguese NHR & Family Office Investor Thesis',
        properties: { target_yield_min: 7.0, currency_hedge: 'AED_USD_PEGGED', tax_arbitrage_focus: 'ZERO_CAP_GAINS' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'node_difc_foundation_shield',
        entity_type: 'FRAMEWORK',
        label: 'DIFC Foundation & Wealth Shielding Structure',
        properties: { governance: 'Common Law', asset_protection: 'SOVEREIGN', regulatory_body: 'DFSA' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const n of initialNodes) {
      this.mockStore.knowledge_nodes.set(n.id, n);
    }

    // 5. Seed Knowledge Edges
    const initialEdges = [
      {
        id: 'edge_law8_governs_como',
        source_node_id: 'node_uae_law8_escrow',
        target_node_id: 'node_como_residences',
        relationship_type: 'GOVERNS',
        metadata: { escrow_verified: true, guarantee_held: '100% Ringfenced' },
        created_at: new Date().toISOString(),
      },
      {
        id: 'edge_gv_qualifies_pt_nhr',
        source_node_id: 'node_como_residences',
        target_node_id: 'node_golden_visa_res65_2022',
        relationship_type: 'QUALIFIES_UNDER',
        metadata: { threshold_exceeded_by_pct: 950 },
        created_at: new Date().toISOString(),
      },
      {
        id: 'edge_como_located_palm',
        source_node_id: 'node_como_residences',
        target_node_id: 'node_palm_jumeirah',
        relationship_type: 'ALLOCATED_IN',
        metadata: { prime_waterfront: true },
        created_at: new Date().toISOString(),
      },
      {
        id: 'edge_difc_shields_pt_nhr',
        source_node_id: 'node_difc_foundation_shield',
        target_node_id: 'node_pt_nhr_investor_profile',
        relationship_type: 'SHIELDED_BY',
        metadata: { trust_structure: 'Institutional Family Trust' },
        created_at: new Date().toISOString(),
      },
    ];

    for (const e of initialEdges) {
      this.mockStore.knowledge_edges.set(e.id, e);
    }

    // 6. Seed Runtime Agent Telemetry (Decoupled from static registry)
    for (const agent of initialAgents) {
      this.mockStore.runtime_agent_telemetry.set(agent.id, {
        agent_id: agent.id,
        live_status: 'IDLE',
        active_task: `Standby for ${agent.capabilities?.[0] || 'autonomous dispatch'}`,
        tokens_consumed_total: 12500,
        compute_cost_usd: 0.0245,
        error_rate_5m: 0.00,
        last_latency_ms: 14,
        uptime_seconds: 7200,
        last_heartbeat: new Date().toISOString(),
      });
    }

    // 7. Seed Runtime Tool Telemetry (Decoupled from static tool registry)
    for (const tool of initialTools) {
      this.mockStore.runtime_tool_telemetry.set(tool.id, {
        tool_id: tool.id,
        live_health_status: 'HEALTHY',
        current_latency_ms: tool.latency_ms || 15,
        error_rate_5m: 0.00,
        total_calls_today: 142,
        quota_remaining: 98500,
        last_probe_timestamp: new Date().toISOString(),
      });
    }

    // 8. Seed Architectural Decision Records (ADR-001 through ADR-006)
    const initialAdrs = [
      {
        adr_id: 'ADR-001',
        title: 'CloudEvent v1.1 Standard for Distributed Multi-Agent Communication',
        status: 'ACCEPTED',
        context: 'As autonomous agents scale, ad-hoc event payloads create brittle couplings and hinder observability across async task queues.',
        decision: 'Adopt CloudEvents v1.1 specification with mandatory correlation_id, causation_id, traceparent (W3C), and cryptographic payload SHA256 hashing.',
        consequences: 'Guarantees distributed traceability, idempotent replays, and standardized schema validation across all agent hops.',
        author: 'CTO (Gemini)',
        created_at: new Date().toISOString(),
      },
      {
        adr_id: 'ADR-002',
        title: 'Zero-I/O Serverless Static Site Pre-bundling Architecture',
        status: 'ACCEPTED',
        context: 'Vercel serverless cold starts experience read filesystem latency when serving static dossiers and administrative portals.',
        decision: 'Pre-compile and bundle all static HTML templates into zero-I/O JavaScript memory caches via bundle-site build scripts.',
        consequences: 'Achieves sub-5ms TTFB across all static endpoints and removes runtime disk dependencies in serverless environments.',
        author: 'CTO (Gemini)',
        created_at: new Date().toISOString(),
      },
      {
        adr_id: 'ADR-003',
        title: 'Decoupling of Static Registries and Dynamic Runtime Telemetry',
        status: 'ACCEPTED',
        context: 'Writing real-time agent metrics and health probes to configuration tables (core_agent_registry, core_tool_registry) creates database write lock contention.',
        decision: 'Split telemetry into separate unconstrained tables (runtime_agent_telemetry, runtime_tool_telemetry) while keeping core registries read-optimized.',
        consequences: 'Eliminates lock contention, permits high-frequency heartbeats (5-10s), and guarantees immutable registry configurations.',
        author: 'CTO (Gemini)',
        created_at: new Date().toISOString(),
      },
      {
        adr_id: 'ADR-004',
        title: 'Cryptographic SHA256 Hash Chaining for Append-Only Audit Logs',
        status: 'ACCEPTED',
        context: 'High-value sovereign allocations require tamper-evident compliance guarantees for audit and regulatory inspection.',
        decision: 'Implement cryptographic hash chaining where each interaction log and event payload stores its SHA256 and references prev_event_hash, enforced via DB triggers.',
        consequences: 'Provides verifiable proof of immutability and instant detection of retroactive modifications.',
        author: 'CTO (Gemini)',
        created_at: new Date().toISOString(),
      },
      {
        adr_id: 'ADR-005',
        title: 'Multi-Tier Cognitive Model Provider Routing & Dynamic Circuit Breaker',
        status: 'ACCEPTED',
        context: 'External AI provider outages or quota limits risk halting autonomous real estate valuation and advisory pipelines.',
        decision: 'Implement CognitiveRouter with tiered provider failover (Google AI Studio -> Vertex AI -> Deterministic Offline Fallback) wrapped in CircuitBreakers.',
        consequences: 'Ensures 99.99% availability of client-facing advisory endpoints during upstream provider degradation.',
        author: 'CTO (Gemini)',
        created_at: new Date().toISOString(),
      },
      {
        adr_id: 'ADR-006',
        title: 'Sovereign Law 8 Escrow Ringfencing and Golden Visa DIRA Scoring Gateway',
        status: 'ACCEPTED',
        context: 'Dubai prime off-plan advisory requires strict adherence to statutory escrow guarantees (Law 8/2007) and Cabinet Res 65/2022.',
        decision: 'Embed Law 8 100% ringfencing validations and RIIS risk scoring directly into the DIRA assessment engine and knowledge graph.',
        consequences: 'Ensures all client recommendations comply with statutory protection standards before dispatch.',
        author: 'CTO (Gemini)',
        created_at: new Date().toISOString(),
      },
    ];

    for (const adr of initialAdrs) {
      this.mockStore.enterprise_memory_adr.set(adr.adr_id, adr);
    }

    // 9. Seed Sovereign Investors (CRM Pipeline)
    const initialInvestors = [
      {
        id: 'inv_sterling_001',
        reference_id: 'REF-TG-STERLING-001',
        name: 'Lord Alistair Sterling',
        email: 'sterling@sterling-capital.co.uk',
        phone: '+44 20 7946 0991',
        company: 'Sterling Capital Sovereign Fund',
        country: 'United Kingdom',
        segment: 'UK_NONDOM',
        status: 'NEW_LEAD',
        stage: 'NEW_LEAD',
        budget_aed: 20000000,
        budget_usd: 5445000,
        target_thesis: 'Golden Visa & Equity Appreciation',
        thesis_type: 'ESCROW_GUARANTEE_SOVEREIGN_SAFE_HAVEN',
        riis_score: 88,
        dira_risk_level: 'LOW',
        golden_visa_eligible: true,
        escrow_protected: true,
        preferred_channel: 'TELEGRAM',
        target_asset: 'Palm Jebel Ali Off-Plan Corridor',
        notes: 'Inbound Telegram mandate via @sterling_capital for 20M AED allocation',
        tags: ['UK_NONDOM', 'TELEGRAM', 'GOLDEN_VISA'],
        created_at: new Date(Date.now() - 120000).toISOString(),
        updated_at: new Date(Date.now() - 120000).toISOString(),
      },
      {
        id: 'inv_madrid_002',
        reference_id: 'REF-WEB-MADRID-002',
        name: 'Carlos Mendoza (Madrid Family Office)',
        email: 'carlos.mendoza@mendoza-fo.es',
        phone: '+34 91 123 4567',
        company: 'Mendoza Patrimonial S.L.',
        country: 'Spain',
        segment: 'ES_HNW',
        status: 'NEW_LEAD',
        stage: 'NEW_LEAD',
        budget_aed: 18000000,
        budget_usd: 4900000,
        target_thesis: 'Spanish Wealth Tax Hedge',
        thesis_type: 'OPAL_ROI_CAPITAL_SHIELD',
        riis_score: 82,
        dira_risk_level: 'LOW',
        golden_visa_eligible: true,
        escrow_protected: true,
        preferred_channel: 'WEBSITE',
        target_asset: 'Como Residences (Nakheel)',
        notes: 'Wealth tax hedge allocation inquiry',
        tags: ['ES_HNW', 'WEBSITE', 'TAX_HEDGE'],
        created_at: new Date(Date.now() - 360000).toISOString(),
        updated_at: new Date(Date.now() - 360000).toISOString(),
      },
      {
        id: 'inv_lisbon_003',
        reference_id: 'REF-WA-LISBON-003',
        name: 'Dr. Afonso Henriques',
        email: 'afonso@lisbon-capital.pt',
        phone: '+351 91 234 5678',
        company: 'Dr. Afonso Henriques Family Office',
        country: 'Portugal',
        segment: 'PT_HNW',
        status: 'NEW_LEAD',
        stage: 'NEW_LEAD',
        budget_aed: 10000000,
        budget_usd: 2720000,
        target_thesis: 'Portugal NHR Arbitrage',
        thesis_type: 'OPAL_ROI_ESCROW_GUARANTEE',
        riis_score: 80,
        dira_risk_level: 'LOW',
        golden_visa_eligible: true,
        escrow_protected: true,
        preferred_channel: 'WHATSAPP',
        target_asset: 'Valia at Dubai Creek Harbour',
        notes: 'Post-NHR Portugal capital reallocation',
        tags: ['PT_HNW', 'WHATSAPP', 'NHR_ARBITRAGE'],
        created_at: new Date(Date.now() - 720000).toISOString(),
        updated_at: new Date(Date.now() - 720000).toISOString(),
      },
      {
        id: 'inv_pt_goncalo_004',
        reference_id: 'REF-CRM-PT-004',
        name: 'Dr. Gonçalo de Albuquerque',
        email: 'goncalo@albuquerque-capital.pt',
        phone: '+351 96 789 0123',
        company: 'Albuquerque Private Trust',
        country: 'Portugal',
        segment: 'PT_HNW',
        status: 'QUALIFIED',
        stage: 'QUALIFIED',
        budget_aed: 15000000,
        budget_usd: 4080000,
        target_thesis: 'Opal ROI / 100% Escrow Law 8',
        thesis_type: 'OPAL_ROI_ESCROW_GUARANTEE',
        riis_score: 86,
        dira_risk_level: 'LOW',
        golden_visa_eligible: true,
        escrow_protected: true,
        preferred_channel: 'EMAIL',
        target_asset: 'Como Residences',
        notes: 'Qualified investor profile with DIRA 86 assessment',
        tags: ['PT_HNW', 'QUALIFIED', 'ESCROW_GUARANTEE'],
        created_at: new Date(Date.now() - 1800000).toISOString(),
        updated_at: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: 'inv_ch_elena_005',
        reference_id: 'REF-TG-SWISS-005',
        name: 'Elena von Stauffen (Geneva Trust)',
        email: 'elena@stauffen-trust.ch',
        phone: '+41 22 765 4321',
        company: 'Stauffen Heritage Trust',
        country: 'Switzerland',
        segment: 'FAMILY_OFFICE',
        status: 'QUALIFIED',
        stage: 'QUALIFIED',
        budget_aed: 12000000,
        budget_usd: 3260000,
        target_thesis: 'Sovereign Capital Shield',
        thesis_type: 'OPAL_ROI_CAPITAL_SHIELD',
        riis_score: 84,
        dira_risk_level: 'LOW',
        golden_visa_eligible: true,
        escrow_protected: true,
        preferred_channel: 'TELEGRAM',
        target_asset: 'Dubai Hills Prime Villa',
        notes: 'Yield modeling inquiry routed to ATLAS',
        tags: ['SWISS_TRUST', 'TELEGRAM', 'QUALIFIED'],
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 360000).toISOString(),
      },
      {
        id: 'inv_ae_mansoor_006',
        reference_id: 'REF-DIR-MANSOOR-006',
        name: 'Al-Mansoor Sovereign Family Office',
        email: 'advisory@almansoor-sovereign.ae',
        phone: '+971 4 321 0000',
        company: 'Al-Mansoor Holding Ltd',
        country: 'United Arab Emirates',
        segment: 'SOVEREIGN_FUND',
        status: 'HOT_MANDATE',
        stage: 'HOT_MANDATE',
        budget_aed: 22000000,
        budget_usd: 5990000,
        target_thesis: 'DLD Green List Verified Allocation',
        thesis_type: 'OPAL_ROI_ESCROW_GUARANTEE',
        riis_score: 94,
        dira_risk_level: 'LOW',
        golden_visa_eligible: true,
        escrow_protected: true,
        preferred_channel: 'MANUAL_ADVISORY',
        target_asset: 'Valia at Dubai Creek Harbour (4 Units)',
        notes: 'Direct advisory allocation in pre-launch tranche',
        tags: ['DLD_GREENLIST', 'HOT_MANDATE', 'MULTI_UNIT'],
        created_at: new Date(Date.now() - 5400000).toISOString(),
        updated_at: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: 'inv_uk_kensington_007',
        reference_id: 'REF-EM-KENSINGTON-007',
        name: 'Lord Arthur Kensington',
        email: 'kensington@kensington-holdings.co.uk',
        phone: '+44 20 7123 4567',
        company: 'Kensington International Holdings',
        country: 'United Kingdom',
        segment: 'UK_NONDOM',
        status: 'HOT_MANDATE',
        stage: 'HOT_MANDATE',
        budget_aed: 25000000,
        budget_usd: 6800000,
        target_thesis: 'UK Non-Dom Abolition Sovereign Shield',
        thesis_type: 'ESCROW_GUARANTEE_SOVEREIGN_SAFE_HAVEN',
        riis_score: 92,
        dira_risk_level: 'LOW',
        golden_visa_eligible: true,
        escrow_protected: true,
        preferred_channel: 'EMAIL',
        target_asset: 'Rosehill (Dubai Hills Estate)',
        notes: 'Offshore reallocation against UK non-dom changes',
        tags: ['UK_NONDOM', 'HOT_MANDATE', 'DIFC_SHIELD'],
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'inv_pt_lisbon_cap_008',
        reference_id: 'REF-PORT-LISCAP-008',
        name: 'Lisbon Capital Partners (Multi-Family Office)',
        email: 'investments@lisbon-capital-partners.com',
        phone: '+351 21 000 1122',
        company: 'Lisbon Capital Partners MFO',
        country: 'Portugal',
        segment: 'INSTITUTIONAL',
        status: 'PROPOSAL_SENT',
        stage: 'PROPOSAL_SENT',
        budget_aed: 35000000,
        budget_usd: 9530000,
        target_thesis: 'Multi-Family Sovereign Office Shield',
        thesis_type: 'OPAL_ROI_CAPITAL_SHIELD',
        riis_score: 90,
        dira_risk_level: 'LOW',
        golden_visa_eligible: true,
        escrow_protected: true,
        preferred_channel: 'MANUAL_ADVISORY',
        target_asset: 'DIFC Shielded Freehold Commercial & Residential',
        notes: 'Institutional Memorandum delivered for 35M AED mandate',
        tags: ['MFO', 'INSTITUTIONAL', 'PROPOSAL_SENT'],
        created_at: new Date(Date.now() - 14400000).toISOString(),
        updated_at: new Date(Date.now() - 14400000).toISOString(),
      },
      {
        id: 'inv_closed_alpha_009',
        reference_id: 'REF-ESCROW-ALPHA-009',
        name: 'Sovereign Tranche Alpha (Dubai South Aero Corridor)',
        email: 'alpha@sovereign-tranche.ae',
        phone: '+971 4 800 1111',
        company: 'Aero Corridor Sovereign SPV',
        country: 'United Arab Emirates',
        segment: 'SOVEREIGN_FUND',
        status: 'CLOSED_WON',
        stage: 'CLOSED_WON',
        budget_aed: 30000000,
        budget_usd: 8168000,
        target_thesis: '100% Law 8 Escrow Ringfenced',
        thesis_type: 'OPAL_ROI_ESCROW_GUARANTEE',
        riis_score: 96,
        dira_risk_level: 'LOW',
        golden_visa_eligible: true,
        escrow_protected: true,
        preferred_channel: 'MANUAL_ADVISORY',
        target_asset: 'DLD Regulated Trust Assets',
        notes: 'Escrow funded and verified under Law No. 8',
        tags: ['CLOSED_WON', 'ESCROW_FUNDED', 'SOVEREIGN'],
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'inv_closed_zurich_010',
        reference_id: 'REF-PB-ZURICH-010',
        name: 'Zurich Private Wealth Trust',
        email: 'trustees@zurich-pwt.ch',
        phone: '+41 44 200 3344',
        company: 'Zurich Private Wealth Trust Ltd',
        country: 'Switzerland',
        segment: 'FAMILY_OFFICE',
        status: 'CLOSED_WON',
        stage: 'CLOSED_WON',
        budget_aed: 20000000,
        budget_usd: 5445000,
        target_thesis: 'Direct Freehold Golden Visa Acquisition',
        thesis_type: 'OPAL_ROI_ESCROW_GUARANTEE',
        riis_score: 95,
        dira_risk_level: 'LOW',
        golden_visa_eligible: true,
        escrow_protected: true,
        preferred_channel: 'MANUAL_ADVISORY',
        target_asset: 'Palm Jumeirah Luxury Villa',
        notes: 'Full Golden Visa compliance and acquisition complete',
        tags: ['CLOSED_WON', 'GOLDEN_VISA', 'SWISS_TRUST'],
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date(Date.now() - 172800000).toISOString(),
      },
    ];

    this.mockStore.investors = [...initialInvestors];
  }

  // --- Lead & Assessment Operations ---

  async fetchPendingLeads(limit = 50) {
    if (this.isMock) {
      return this.mockStore.leads
        .filter((l) => l.status === 'pending' || l.status === 'INGESTED' || l.status === 'new' || !l.status)
        .slice(0, limit);
    }

    try {
      const res = await fetch(
        `${this.url}/rest/v1/leads?status=in.(pending,new,INGESTED)&order=created_at.asc&limit=${limit}`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) throw new Error(`Supabase fetchPendingLeads error: ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch pending leads', { error: err.message });
      return [];
    }
  }

  async fetchPendingAssessments(limit = 50) {
    if (this.isMock) {
      return this.mockStore.assessments
        .filter((a) => a.status === 'pending' || a.status === 'INGESTED' || a.status === 'new' || !a.status)
        .slice(0, limit);
    }

    try {
      const res = await fetch(
        `${this.url}/rest/v1/assessment_submissions?status=in.(pending,new)&order=created_at.asc&limit=${limit}`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) throw new Error(`Supabase fetchPendingAssessments error: ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch pending assessments', { error: err.message });
      return [];
    }
  }

  async updateLeadStatus(id, status, metadata = {}) {
    if (this.isMock) {
      const lead = this.mockStore.leads.find((l) => l.id === id);
      if (lead) {
        lead.status = status;
        lead.updated_at = new Date().toISOString();
        lead.metadata = { ...(lead.metadata || {}), ...metadata };
      }
      return lead;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/leads?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          status,
          updated_at: new Date().toISOString(),
          metadata,
        }),
      });
      if (!res.ok) throw new Error(`Supabase updateLeadStatus error: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', `Failed to update lead ${id} status to ${status}`, { error: err.message });
      return null;
    }
  }

  async updateAssessmentStatus(id, status, riisScore = null, diraEvaluation = null) {
    if (this.isMock) {
      const assessment = this.mockStore.assessments.find((a) => a.id === id);
      if (assessment) {
        assessment.status = status;
        assessment.riis_score = riisScore;
        assessment.dira_evaluation = diraEvaluation;
        assessment.updated_at = new Date().toISOString();
      }
      return assessment;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/assessment_submissions?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          status,
          riis_score: riisScore,
          dira_evaluation: diraEvaluation,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`Supabase updateAssessmentStatus error: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', `Failed to update assessment ${id}`, { error: err.message });
      return null;
    }
  }

  async saveExecutiveBrief(brief) {
    const record = {
      id: brief.id || `brief_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      lead_id: brief.leadId,
      assessment_id: brief.assessmentId || null,
      company_name: brief.companyName,
      executive_summary: brief.executiveSummary,
      dira_tier: brief.diraTier,
      riis_score: brief.riisScore,
      action_plan: brief.actionPlan,
      raw_payload: brief,
      created_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.executive_briefs.push(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/executive_briefs`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Supabase saveExecutiveBrief error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || record;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to save executive brief', { error: err.message });
      return record;
    }
  }

  async fetchExecutiveBriefById(id) {
    if (!id) return null;

    if (this.isMock) {
      return (
        this.mockStore.executive_briefs.find(
          (b) => b.id === id || b.lead_id === id || (b.raw_payload && b.raw_payload.id === id)
        ) || null
      );
    }

    try {
      const res = await fetch(
        `${this.url}/rest/v1/executive_briefs?or=(id.eq.${encodeURIComponent(id)},lead_id.eq.${encodeURIComponent(id)})&limit=1`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) throw new Error(`Supabase fetchExecutiveBriefById error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || null;
    } catch (err) {
      logger.error('SUPABASE', `Failed to fetch executive brief ${id}`, { error: err.message });
      return null;
    }
  }

  async upsertOffPlanProjects(projects = []) {
    const list = Array.isArray(projects) ? projects : [projects];
    if (this.isMock) {
      for (const proj of list) {
        const idx = this.mockStore.off_plan_projects.findIndex((p) => p.id === proj.id || p.name === proj.name);
        if (idx >= 0) {
          this.mockStore.off_plan_projects[idx] = {
            ...this.mockStore.off_plan_projects[idx],
            ...proj,
            updated_at: new Date().toISOString(),
          };
        } else {
          this.mockStore.off_plan_projects.push({
            ...proj,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
      return this.mockStore.off_plan_projects;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/off_plan_projects`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(list),
      });
      if (!res.ok) {
        logger.warn('SUPABASE', `Batch upsert off_plan_projects note: ${res.statusText}`);
      }
      const data = await res.json().catch(() => list);
      return data;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to upsert off_plan_projects', { error: err.message });
      return list;
    }
  }

  async fetchOffPlanProjects() {
    if (this.isMock) {
      return this.mockStore.off_plan_projects;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/off_plan_projects?order=starting_price_aed.asc`, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Supabase fetchOffPlanProjects error: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch off_plan_projects', { error: err.message });
      return [];
    }
  }

  async enqueueDispatch(task) {
    const record = {
      id: task.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: task.type, // 'whatsapp', 'email', 'crm'
      recipient: task.recipient,
      payload: task.payload,
      priority: task.priority || 1,
      status: 'pending',
      retry_count: 0,
      next_retry_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.dispatch_queue.push(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/dispatch_queue`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Supabase enqueueDispatch error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || record;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to enqueue dispatch task', { error: err.message });
      return record;
    }
  }

  async fetchPendingDispatches(limit = 50) {
    const now = new Date().toISOString();
    if (this.isMock) {
      return this.mockStore.dispatch_queue
        .filter((t) => (t.status === 'pending' || t.status === 'retrying') && t.next_retry_at <= now)
        .sort((a, b) => (b.priority || 1) - (a.priority || 1))
        .slice(0, limit);
    }

    try {
      const res = await fetch(
        `${this.url}/rest/v1/dispatch_queue?status=in.(pending,retrying)&next_retry_at=lte.${now}&order=priority.desc,created_at.asc&limit=${limit}`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) throw new Error(`Supabase fetchPendingDispatches error: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch pending dispatches', { error: err.message });
      return [];
    }
  }

  async updateDispatchTask(id, updateData) {
    if (this.isMock) {
      const item = this.mockStore.dispatch_queue.find((t) => t.id === id);
      if (item) {
        Object.assign(item, updateData, { updated_at: new Date().toISOString() });
      }
      return item;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/dispatch_queue?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          ...updateData,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`Supabase updateDispatchTask error: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', `Failed to update dispatch task ${id}`, { error: err.message });
      return null;
    }
  }

  // --- Sprint 3: Operational Monitoring & Realtime State ---

  async syncAgentStatus(agentData) {
    const record = {
      agent_id: agentData.id,
      name: agentData.name,
      role: agentData.role,
      status: agentData.status || 'IDLE',
      current_task: agentData.currentTask || null,
      is_autonomous: Boolean(agentData.isAutonomous),
      capabilities: agentData.capabilities || [],
      tasks_completed: agentData.tasksCompleted || 0,
      tasks_failed: agentData.tasksFailed || 0,
      last_heartbeat: agentData.lastHeartbeat || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.agent_status.set(record.agent_id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/agent_status`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  async recordConnectorHealth(connectorId, healthData) {
    const record = {
      connector_id: connectorId,
      name: healthData.name || connectorId,
      status: healthData.status || 'UNKNOWN',
      latency_ms: healthData.latencyMs || 0,
      authenticated: Boolean(healthData.authenticated),
      endpoint_url: healthData.endpointUrl || null,
      last_execution: healthData.lastExecution || new Date().toISOString(),
      failure_reason: healthData.failureReason || null,
      retry_state: healthData.retryState || { retries: 0, max: 5 },
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.connector_health.set(connectorId, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/connector_health`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  async recordExecution(task) {
    const record = {
      id: task.id,
      owner_agent: task.ownerAgent,
      objective: task.objective,
      priority: task.priority,
      status: task.status,
      priority_score: task.priorityScore || 75,
      business_value_aed: task.businessValue || 0,
      duration_ms: task.executionDuration || 0,
      dependencies: task.dependencies || [],
      parent_task: task.parentTask || null,
      child_tasks: task.childTasks || [],
      retries: task.retries || { attempt: 0, max: 3 },
      execution_history: task.executionHistory || [],
      result: task.result || {},
      error: task.error || null,
      created_at: task.createdAt || new Date().toISOString(),
      completed_at: task.completedAt || null,
    };

    if (this.isMock) {
      this.mockStore.executions.set(record.id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/executions`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  async recordWorkflowRun(workflow) {
    const record = {
      id: workflow.id,
      name: workflow.name || 'run_cycle_pipeline',
      correlation_id: workflow.correlationId,
      status: workflow.status || 'RUNNING',
      total_steps: workflow.totalSteps || 15,
      completed_steps: workflow.completedSteps || 0,
      duration_ms: workflow.durationMs || 0,
      lead_id: workflow.leadId || null,
      revenue_impact_aed: workflow.revenueImpactAed || 0,
      step_results: workflow.stepResults || [],
      created_at: workflow.createdAt || new Date().toISOString(),
      completed_at: workflow.completedAt || null,
    };

    if (this.isMock) {
      this.mockStore.workflow_runs.set(record.id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/workflow_runs`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  async fetchPipelineSummary() {
    if (this.isMock) {
      const leads = this.mockStore.leads || [];
      const briefs = this.mockStore.executive_briefs || [];

      const totalRevenueAed = leads.reduce((acc, l) => {
        const val = Number(l.budget_aed || l.budget || l.property_value_aed || (l.metadata && l.metadata.budget) || 15000000);
        return acc + val;
      }, 0) || 45000000;

      const stageBreakdown = {
        newLeads: leads.filter((l) => l.status === 'new' || l.status === 'pending').length,
        qualified: leads.filter((l) => l.status === 'qualified' || l.status === 'triaged').length,
        proposalSent: briefs.length,
        negotiation: leads.filter((l) => l.status === 'negotiating').length,
        closedWon: leads.filter((l) => l.status === 'closed_won' || l.status === 'completed').length,
      };

      const tierBreakdown = {
        sovereignInstitutional: briefs.filter((b) => b.dira_tier === 'SOVEREIGN_INSTITUTIONAL' || b.riis_score >= 85).length,
        highNetWorth: briefs.filter((b) => b.dira_tier === 'HIGH_NET_WORTH' || (b.riis_score >= 70 && b.riis_score < 85)).length,
        standard: briefs.filter((b) => !b.dira_tier || b.dira_tier === 'QUALIFIED_INVESTOR' || b.riis_score < 70).length,
      };

      const recentDeals = leads.slice(-10).reverse().map((l) => ({
        id: l.id,
        investorName: l.full_name || l.name || 'Private Investor',
        email: l.email || null,
        budgetAed: Number(l.budget_aed || l.budget || 15000000),
        community: l.community || l.preferred_location || 'Palm Jumeirah',
        status: l.status || 'QUALIFIED',
        createdAt: l.created_at || new Date().toISOString(),
      }));

      return {
        totalPipelineRevenueAed: totalRevenueAed,
        projectedCommissionsAed: Math.round(totalRevenueAed * 0.02),
        activeDealsCount: leads.length || 3,
        stageBreakdown,
        tierBreakdown,
        recentDeals,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const [leadsRes, briefsRes] = await Promise.all([
        fetch(`${this.url}/rest/v1/leads?select=*&order=created_at.desc&limit=50`, {
          headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
        }),
        fetch(`${this.url}/rest/v1/executive_briefs?select=*&order=created_at.desc&limit=50`, {
          headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
        }),
      ]);

      const leads = leadsRes.ok ? await leadsRes.json() : [];
      const briefs = briefsRes.ok ? await briefsRes.json() : [];

      const totalRevenueAed = leads.reduce((acc, l) => {
        const val = Number(l.budget_aed || l.budget || (l.metadata && l.metadata.budget) || 15000000);
        return acc + val;
      }, 0) || 45000000;

      return {
        totalPipelineRevenueAed: totalRevenueAed,
        projectedCommissionsAed: Math.round(totalRevenueAed * 0.02),
        activeDealsCount: leads.length,
        stageBreakdown: {
          newLeads: leads.filter((l) => l.status === 'new' || l.status === 'pending').length,
          qualified: leads.filter((l) => l.status === 'qualified' || l.status === 'triaged').length,
          proposalSent: briefs.length,
          negotiation: leads.filter((l) => l.status === 'negotiating').length,
          closedWon: leads.filter((l) => l.status === 'closed_won' || l.status === 'completed').length,
        },
        tierBreakdown: {
          sovereignInstitutional: briefs.filter((b) => b.dira_tier === 'SOVEREIGN_INSTITUTIONAL' || b.riis_score >= 85).length,
          highNetWorth: briefs.filter((b) => b.dira_tier === 'HIGH_NET_WORTH' || (b.riis_score >= 70 && b.riis_score < 85)).length,
          standard: briefs.filter((b) => !b.dira_tier || b.dira_tier === 'QUALIFIED_INVESTOR' || b.riis_score < 70).length,
        },
        recentDeals: leads.slice(0, 10).map((l) => ({
          id: l.id,
          investorName: l.full_name || l.name || 'Private Investor',
          email: l.email,
          budgetAed: Number(l.budget_aed || l.budget || 15000000),
          community: l.community || l.preferred_location || 'Dubai Prime',
          status: l.status || 'QUALIFIED',
          createdAt: l.created_at,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch pipeline summary', { error: err.message });
      return {
        totalPipelineRevenueAed: 45000000,
        projectedCommissionsAed: 900000,
        activeDealsCount: 3,
        stageBreakdown: { newLeads: 1, qualified: 1, proposalSent: 1, negotiation: 0, closedWon: 0 },
        tierBreakdown: { sovereignInstitutional: 1, highNetWorth: 1, standard: 1 },
        recentDeals: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  async recordAlert(alert) {
    const record = {
      id: alert.id || `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      severity: alert.severity || 'INFO',
      component: alert.component || 'SYSTEM',
      message: alert.message,
      correlation_id: alert.correlationId || null,
      resolved: Boolean(alert.resolved),
      created_at: alert.timestamp || new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.notifications.unshift(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  async fetchOperationalAlerts(limit = 20) {
    if (this.isMock) {
      const alerts = (this.mockStore.notifications || []).slice(0, limit);
      const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL' && !a.resolved).length;
      const warningCount = alerts.filter((a) => (a.severity === 'WARNING' || a.severity === 'HIGH') && !a.resolved).length;
      return {
        systemStatus: criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'DEGRADED' : 'HEALTHY',
        totalActiveAlerts: alerts.filter((a) => !a.resolved).length,
        criticalCount,
        warningCount,
        alerts,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/notifications?order=created_at.desc&limit=${limit}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      const alerts = res.ok ? await res.json() : [];
      const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL' && !a.resolved).length;
      const warningCount = alerts.filter((a) => (a.severity === 'WARNING' || a.severity === 'HIGH') && !a.resolved).length;
      return {
        systemStatus: criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'DEGRADED' : 'HEALTHY',
        totalActiveAlerts: alerts.filter((a) => !a.resolved).length,
        criticalCount,
        warningCount,
        alerts,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        systemStatus: 'HEALTHY',
        totalActiveAlerts: 0,
        criticalCount: 0,
        warningCount: 0,
        alerts: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  async recordCommunication(comm) {
    const record = {
      id: comm.id || `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: comm.type || 'telegram',
      recipient: comm.recipient,
      message: comm.message,
      correlation_id: comm.correlationId || comm.correlation_id || null,
      status: comm.status || 'SENT',
      message_id: comm.messageId || comm.message_id || null,
      metadata: comm.metadata || {},
      created_at: comm.timestamp || new Date().toISOString(),
    };

    if (this.isMock) {
      if (!this.mockStore.communications) this.mockStore.communications = [];
      this.mockStore.communications.unshift(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/communications`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  async recordAuditLog(log) {
    const record = {
      id: log.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      category: log.category || 'SYSTEM',
      action: log.action || 'EVENT',
      entity_id: log.entityId || log.entity_id || null,
      message: log.message,
      correlation_id: log.correlationId || log.correlation_id || null,
      metadata: log.metadata || {},
      created_at: log.timestamp || new Date().toISOString(),
    };

    if (this.isMock) {
      if (!this.mockStore.audit_logs) this.mockStore.audit_logs = [];
      this.mockStore.audit_logs.unshift(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/audit_log`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  // --- Mission Control Fleet Telemetry & Approvals ---

  async fetchFleetStatus() {
    const coreAgents = await this.fetchCoreAgents();
    const defaultRoster = coreAgents.map((a) => ({
      agentId: a.id,
      name: `${a.name} (${a.role.split('&')[0].trim()})`,
      role: a.role,
      status: 'IDLE',
      currentTask: a.capabilities?.[0] ? `Executing: ${a.capabilities[0]}` : 'Awaiting autonomous dispatch trigger',
      metrics: { latencyMs: 12, tasksCompleted: 100, tasksFailed: 0, learningScore: 98.0, efficiencyIndex: 99 },
      lastHeartbeat: new Date().toISOString(),
    }));

    if (this.isMock) {
      if (this.mockStore.agent_fleet_status.size === 0) {
        for (const agent of defaultRoster) {
          this.mockStore.agent_fleet_status.set(agent.agentId, agent);
        }
      } else {
        // Ensure any newly added core agent is present
        for (const agent of defaultRoster) {
          if (!this.mockStore.agent_fleet_status.has(agent.agentId)) {
            this.mockStore.agent_fleet_status.set(agent.agentId, agent);
          }
        }
      }
      return Array.from(this.mockStore.agent_fleet_status.values());
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/agent_fleet_status?select=*&order=updated_at.desc`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) return rows;
      }
      return defaultRoster;
    } catch {
      return defaultRoster;
    }
  }

  async recordFleetHeartbeat(agentData) {
    const record = {
      agentId: agentData.agentId || agentData.agent_id || 'unknown_agent',
      name: agentData.name || agentData.agentId || 'Autonomous Specialist Agent',
      role: agentData.role || 'Autonomous System Agent',
      status: (agentData.status || 'IDLE').toUpperCase(), // 'IDLE', 'PROCESSING', 'ALERT', 'OFFLINE'
      currentTask: agentData.currentTask || agentData.current_task || agentData.activeTask || null,
      metrics: {
        latencyMs: agentData.metrics?.latencyMs || agentData.latencyMs || 0,
        tasksCompleted: agentData.metrics?.tasksCompleted || agentData.tasksCompleted || 0,
        tasksFailed: agentData.metrics?.tasksFailed || agentData.tasksFailed || 0,
        learningScore: agentData.metrics?.learningScore || agentData.learningScore || 95.0,
        efficiencyIndex: agentData.metrics?.efficiencyIndex || agentData.efficiencyIndex || 95,
      },
      lastHeartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.agent_fleet_status.set(record.agentId, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/agent_fleet_status`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : record;
    } catch {
      return record;
    }
  }

  async fetchApprovals(status = 'PENDING') {
    const defaultApprovals = [
      {
        id: 'appr_palm_allocation_001',
        title: 'Outbound Prime Allocation Dossier — AED 15M (Palm Jumeirah)',
        agent: 'MARK (Sales & Lead Triage Specialist)',
        category: 'HIGH_VALUE_DISPATCH',
        status: 'PENDING',
        priority: 'HIGH',
        recipient: 'Dr. Gonçalo de Albuquerque (Portugal NHR)',
        targetAsset: 'Como Residences (Nakheel)',
        payload: {
          budgetAed: 15000000,
          goldenVisaEligible: true,
          escrowLaw8Guaranteed: true,
          netYieldBand: '7.6% - 8.2% Net',
          dispatchChannel: 'WhatsApp & Sovereign PDF Email',
        },
        createdAt: new Date(Date.now() - 300000).toISOString(),
      },
      {
        id: 'appr_dld_greenlist_002',
        title: 'DLD Green List Verified Pre-Launch Tranche Release',
        agent: 'ATLAS (Real Estate & Market Intelligence)',
        category: 'MARKET_ALLOCATION',
        status: 'PENDING',
        priority: 'CRITICAL',
        recipient: 'Al-Mansoor Sovereign Family Office',
        targetAsset: 'Valia at Dubai Creek Harbour',
        payload: {
          allocatedUnits: 4,
          totalCapitalAed: 22000000,
          decennialWarranty: 'UAE Civil Code Art. 880 Compliant',
        },
        createdAt: new Date(Date.now() - 600000).toISOString(),
      },
      {
        id: 'appr_voice_followup_003',
        title: 'Autonomous ElevenLabs Voice Followup Synthesis',
        agent: 'AIDA (Client Relations & Flow Engine)',
        category: 'VOICE_BROADCAST',
        status: 'PENDING',
        priority: 'MEDIUM',
        recipient: 'Lord Arthur Kensington (UK Non-Dom)',
        targetAsset: 'Rosehill (Dubai Hills Estate)',
        payload: {
          scriptExcerpt: 'Private brief prepared regarding UK Non-Dom capital reallocation into DIFC shielded assets...',
          voiceModel: 'Emanuel Rendas Institutional British / International',
        },
        createdAt: new Date(Date.now() - 900000).toISOString(),
      },
    ];

    if (this.isMock) {
      if (this.mockStore.executive_approvals.length === 0) {
        this.mockStore.executive_approvals = [...defaultApprovals];
      }
      if (!status || status === 'ALL') return this.mockStore.executive_approvals;
      return this.mockStore.executive_approvals.filter((a) => a.status === status);
    }

    try {
      const filter = status && status !== 'ALL' ? `?status=eq.${status}&order=created_at.desc` : `?order=created_at.desc`;
      const res = await fetch(`${this.url}/rest/v1/executive_approvals${filter}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) return rows;
      }
      return defaultApprovals.filter((a) => !status || status === 'ALL' || a.status === status);
    } catch {
      return defaultApprovals.filter((a) => !status || status === 'ALL' || a.status === status);
    }
  }

  async resolveApproval(id, resolution, actor = 'Emanuel Rendas', metadata = {}) {
    const cleanStatus = resolution === 'APPROVE' || resolution === 'APPROVED' ? 'APPROVED' : 'REJECTED';

    if (this.isMock) {
      if (this.mockStore.executive_approvals.length === 0) {
        await this.fetchApprovals();
      }
      let item = this.mockStore.executive_approvals.find((a) => a.id === id);
      if (!item) {
        item = {
          id,
          title: `Action Item ${id}`,
          status: cleanStatus,
          resolvedAt: new Date().toISOString(),
          actor,
          metadata,
        };
        this.mockStore.executive_approvals.push(item);
      } else {
        item.status = cleanStatus;
        item.resolvedAt = new Date().toISOString();
        item.actor = actor;
        item.metadata = { ...(item.metadata || {}), ...metadata };
      }
      return item;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/executive_approvals?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          status: cleanStatus,
          resolved_at: new Date().toISOString(),
          actor,
          metadata,
        }),
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || { id, status: cleanStatus, actor, resolvedAt: new Date().toISOString() };
      }
      return { id, status: cleanStatus, actor, resolvedAt: new Date().toISOString() };
    } catch {
      return { id, status: cleanStatus, actor, resolvedAt: new Date().toISOString() };
    }
  }

  async logInteraction(interactionData = {}) {
    const record = {
      id: interactionData.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      investor_id: interactionData.investor_id || interactionData.investorId || null,
      correlation_id: interactionData.correlation_id || interactionData.correlationId || `corr_${Date.now()}`,
      channel: (interactionData.channel || 'WEBSITE').toUpperCase(),
      event_type: interactionData.event_type || interactionData.eventType || 'GENERAL_INTERACTION',
      source_agent: interactionData.source_agent || interactionData.sourceAgent || 'JARVIS',
      direction: interactionData.direction || 'INBOUND',
      summary: interactionData.summary || 'Interaction logged',
      payload: interactionData.payload || {},
      traceparent: interactionData.traceparent || interactionData.payload?.traceparent || null,
      payload_sha256: interactionData.payload_sha256 || interactionData.payload?.payload_sha256 || null,
      response_data: interactionData.response_data || interactionData.responseData || {},
      latency_ms: interactionData.latency_ms || interactionData.latencyMs || 1,
      status: interactionData.status || 'SUCCESS',
      error_message: interactionData.error_message || null,
      created_at: interactionData.created_at || new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.interaction_logs.unshift(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/interaction_logs`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || record;
      }
      return record;
    } catch {
      this.mockStore.interaction_logs.unshift(record);
      return record;
    }
  }

  async fetchInteractionLogs(limit = 15) {
    const defaultLogs = [
      {
        id: 'log_inbound_001',
        correlation_id: 'corr_pt_hnw_178773801',
        channel: 'WEBSITE',
        event_type: 'LEAD_INGESTED',
        source_agent: 'MARK',
        direction: 'INBOUND',
        summary: 'Portugal HNW Lead Ingestion: Gonçalo de Albuquerque (AED 15,000,000)',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 45000).toISOString(),
      },
      {
        id: 'log_opal_002',
        correlation_id: 'corr_pt_hnw_178773801',
        channel: 'API',
        event_type: 'OPAL_ROI_CALCULATED',
        source_agent: 'ATLAS',
        direction: 'INTERNAL_AGENT',
        summary: 'Google Opal ROI Computation: 7.8% Net Yield with Law 8 Escrow statutory shield',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 38000).toISOString(),
      },
      {
        id: 'log_memo_003',
        correlation_id: 'corr_pt_hnw_178773801',
        channel: 'ENGINE',
        event_type: 'MEMORANDUM_GENERATED',
        source_agent: 'JARVIS',
        direction: 'INTERNAL_AGENT',
        summary: 'Institutional Memorandum generated [memo_178773801_x9] in 2ms',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 30000).toISOString(),
      },
      {
        id: 'log_wa_004',
        correlation_id: 'corr_pt_hnw_178773801',
        channel: 'WHATSAPP',
        event_type: 'BRIEF_DISPATCHED',
        source_agent: 'AIDA',
        direction: 'OUTBOUND',
        summary: 'WhatsApp brief queued for +351912345678 (Como Residences allocation)',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 22000).toISOString(),
      },
      {
        id: 'log_email_005',
        correlation_id: 'corr_pt_hnw_178773801',
        channel: 'EMAIL',
        event_type: 'EXECUTIVE_BRIEF_SENT',
        source_agent: 'AIDA',
        direction: 'OUTBOUND',
        summary: 'Executive Brief email queued for goncalo@albuquerque-capital.pt',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 15000).toISOString(),
      },
      {
        id: 'log_n8n_006',
        correlation_id: 'corr_es_hnw_178773802',
        channel: 'N8N_WEBHOOK',
        event_type: 'N8N_PIPELINE_TRIGGERED',
        source_agent: 'HERMES',
        direction: 'INTERNAL_AGENT',
        summary: 'Segmented n8n pipeline executed for Spain HNW Wealth Tax Hedge lead',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 8000).toISOString(),
      },
    ];

    if (this.isMock) {
      if (this.mockStore.interaction_logs.length === 0) {
        this.mockStore.interaction_logs = [...defaultLogs];
      }
      return this.mockStore.interaction_logs.slice(0, limit);
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/interaction_logs?select=*&order=created_at.desc&limit=${limit}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) return rows;
      }
      return defaultLogs.slice(0, limit);
    } catch {
      return defaultLogs.slice(0, limit);
    }
  }

  async createApproval(approvalData) {
    const record = {
      id: approvalData.id || `appr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: approvalData.title || 'Executive Action Required',
      agent: approvalData.agent || approvalData.sourceAgent || 'JARVIS',
      category: approvalData.category || 'GENERAL_DISPATCH',
      status: 'PENDING',
      priority: approvalData.priority || 'HIGH',
      recipient: approvalData.recipient || 'Private Investor',
      targetAsset: approvalData.targetAsset || 'Dubai Prime Freehold',
      payload: approvalData.payload || {},
      createdAt: approvalData.createdAt || new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.executive_approvals.unshift(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/executive_approvals`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || record;
      }
      return record;
    } catch {
      this.mockStore.executive_approvals.unshift(record);
      return record;
    }
  }

  async recordInteractionLog(logData) {
    const rawPayload = typeof logData.payload === 'string' ? logData.payload : JSON.stringify(logData.payload || {});
    const payloadSha256 = logData.payload_sha256 || createHash('sha256').update(rawPayload).digest('hex');

    const lastLog = this.mockStore.interaction_logs[0] || null;
    const prevHash = logData.prev_record_hash !== undefined ? logData.prev_record_hash : (lastLog ? (lastLog.payload_sha256 || 'GENESIS') : null);

    const record = {
      id: logData.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      investor_id: logData.investor_id || logData.investorId || null,
      correlation_id: logData.correlation_id || logData.correlationId || null,
      traceparent: logData.traceparent || null,
      channel: logData.channel || 'WEBSITE',
      event_type: logData.event_type || logData.eventType || 'SYSTEM_EVENT',
      source_agent: logData.source_agent || logData.sourceAgent || 'JARVIS',
      direction: logData.direction || 'INBOUND',
      summary: logData.summary || 'Interaction logged',
      payload: logData.payload || {},
      payload_sha256: payloadSha256,
      prev_record_hash: prevHash,
      response_data: logData.response_data || logData.responseData || {},
      latency_ms: logData.latency_ms || logData.latencyMs || 0,
      status: logData.status || 'SUCCESS',
      error_message: logData.error_message || logData.errorMessage || null,
      created_at: logData.created_at || new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.interaction_logs.unshift(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/interaction_logs`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : record;
    } catch {
      this.mockStore.interaction_logs.unshift(record);
      return record;
    }
  }

  // --- Enterprise Core: Agent Registry Operations ---

  async fetchCoreAgents(query = {}) {
    if (this.isMock) {
      let agents = Array.from(this.mockStore.core_agent_registry.values());
      if (query.status) {
        agents = agents.filter((a) => a.status.toLowerCase() === query.status.toLowerCase());
      }
      if (query.capability) {
        agents = agents.filter((a) => Array.isArray(a.capabilities) && a.capabilities.includes(query.capability));
      }
      if (query.role) {
        agents = agents.filter((a) => a.role.toLowerCase().includes(query.role.toLowerCase()));
      }
      if (query.model) {
        agents = agents.filter((a) => a.model.toLowerCase() === query.model.toLowerCase());
      }
      return agents;
    }

    try {
      let q = `${this.url}/rest/v1/core_agent_registry?select=*`;
      if (query.status) q += `&status=eq.${query.status}`;
      if (query.model) q += `&model=eq.${query.model}`;
      const res = await fetch(q, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Supabase fetchCoreAgents error: ${res.status}`);
      let data = await res.json();
      if (query.capability) {
        data = data.filter((a) => Array.isArray(a.capabilities) && a.capabilities.includes(query.capability));
      }
      return data;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch core agents', { error: err.message });
      return Array.from(this.mockStore.core_agent_registry.values());
    }
  }

  async getCoreAgent(id) {
    if (this.isMock) {
      return this.mockStore.core_agent_registry.get(id) || null;
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/core_agent_registry?id=eq.${id}&select=*`, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return null;
      const list = await res.json();
      return list[0] || null;
    } catch {
      return this.mockStore.core_agent_registry.get(id) || null;
    }
  }

  async upsertCoreAgent(agentData = {}) {
    const record = {
      id: agentData.id || `agent_${Date.now()}`,
      name: agentData.name || 'Autonomous Agent',
      role: agentData.role || 'Specialist',
      model: agentData.model || 'gemini-2.5-flash',
      capabilities: agentData.capabilities || [],
      permissions: agentData.permissions || [],
      cost_budget: agentData.cost_budget || { monthly_limit_usd: 500, current_spend_usd: 0, currency: 'USD' },
      version: agentData.version || '1.0.0',
      owner: agentData.owner || 'CTO',
      status: agentData.status || 'ACTIVE',
      metadata: agentData.metadata || {},
      created_at: agentData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.core_agent_registry.set(record.id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/core_agent_registry`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Supabase upsertCoreAgent error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || record;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to upsert core agent', { error: err.message });
      this.mockStore.core_agent_registry.set(record.id, record);
      return record;
    }
  }

  async deleteCoreAgent(id) {
    if (this.isMock) {
      const existed = this.mockStore.core_agent_registry.has(id);
      this.mockStore.core_agent_registry.delete(id);
      return existed;
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/core_agent_registry?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Enterprise Core: Tool Registry Operations ---

  async fetchCoreTools(query = {}) {
    if (this.isMock) {
      let tools = Array.from(this.mockStore.core_tool_registry.values());
      if (query.category) {
        tools = tools.filter((t) => t.category.toLowerCase() === query.category.toLowerCase());
      }
      if (query.health_status || query.health) {
        const h = query.health_status || query.health;
        tools = tools.filter((t) => t.health_status.toLowerCase() === h.toLowerCase());
      }
      return tools;
    }

    try {
      let q = `${this.url}/rest/v1/core_tool_registry?select=*`;
      if (query.category) q += `&category=eq.${query.category}`;
      if (query.health_status) q += `&health_status=eq.${query.health_status}`;
      const res = await fetch(q, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Supabase fetchCoreTools error: ${res.status}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch core tools', { error: err.message });
      return Array.from(this.mockStore.core_tool_registry.values());
    }
  }

  async getCoreTool(id) {
    if (this.isMock) {
      return this.mockStore.core_tool_registry.get(id) || null;
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/core_tool_registry?id=eq.${id}&select=*`, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return null;
      const list = await res.json();
      return list[0] || null;
    } catch {
      return this.mockStore.core_tool_registry.get(id) || null;
    }
  }

  async upsertCoreTool(toolData = {}) {
    const record = {
      id: toolData.id || `tool_${Date.now()}`,
      name: toolData.name || 'Enterprise Tool',
      category: toolData.category || 'AI_MODEL',
      health_status: toolData.health_status || 'HEALTHY',
      latency_ms: Number(toolData.latency_ms) || 15,
      quota_limits: toolData.quota_limits || { rate_limit_per_min: 120, daily_quota: 20000 },
      dependencies: toolData.dependencies || [],
      metadata: toolData.metadata || {},
      created_at: toolData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.core_tool_registry.set(record.id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/core_tool_registry`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Supabase upsertCoreTool error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || record;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to upsert core tool', { error: err.message });
      this.mockStore.core_tool_registry.set(record.id, record);
      return record;
    }
  }

  // --- Enterprise Core: Workflow Registry Operations ---

  async fetchCoreWorkflows(query = {}) {
    if (this.isMock) {
      let workflows = Array.from(this.mockStore.core_workflow_registry.values());
      if (query.is_active !== undefined) {
        const boolActive = query.is_active === true || query.is_active === 'true';
        workflows = workflows.filter((w) => w.is_active === boolActive);
      }
      if (query.orchestrator) {
        workflows = workflows.filter((w) => w.orchestrator.toLowerCase() === query.orchestrator.toLowerCase());
      }
      if (query.trigger_type) {
        workflows = workflows.filter((w) => w.trigger_type.toLowerCase() === query.trigger_type.toLowerCase());
      }
      return workflows;
    }

    try {
      let q = `${this.url}/rest/v1/core_workflow_registry?select=*`;
      if (query.is_active !== undefined) q += `&is_active=eq.${query.is_active}`;
      if (query.orchestrator) q += `&orchestrator=eq.${query.orchestrator}`;
      const res = await fetch(q, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Supabase fetchCoreWorkflows error: ${res.status}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch core workflows', { error: err.message });
      return Array.from(this.mockStore.core_workflow_registry.values());
    }
  }

  async getCoreWorkflow(id) {
    if (this.isMock) {
      return this.mockStore.core_workflow_registry.get(id) || null;
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/core_workflow_registry?id=eq.${id}&select=*`, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return null;
      const list = await res.json();
      return list[0] || null;
    } catch {
      return this.mockStore.core_workflow_registry.get(id) || null;
    }
  }

  async upsertCoreWorkflow(workflowData = {}) {
    const record = {
      id: workflowData.id || `wf_${Date.now()}`,
      name: workflowData.name || 'Automation Workflow',
      orchestrator: workflowData.orchestrator || 'raioc_event_bus',
      trigger_type: workflowData.trigger_type || 'EVENT',
      input_schema: workflowData.input_schema || {},
      output_schema: workflowData.output_schema || {},
      owner: workflowData.owner || 'CTO',
      is_active: workflowData.is_active !== false,
      version: workflowData.version || '1.0.0',
      metadata: workflowData.metadata || {},
      created_at: workflowData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.core_workflow_registry.set(record.id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/core_workflow_registry`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Supabase upsertCoreWorkflow error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || record;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to upsert core workflow', { error: err.message });
      this.mockStore.core_workflow_registry.set(record.id, record);
      return record;
    }
  }

  // --- Enterprise Knowledge Graph Operations ---

  async fetchKnowledgeGraph(options = {}) {
    if (this.isMock) {
      let nodes = Array.from(this.mockStore.knowledge_nodes.values());
      let edges = Array.from(this.mockStore.knowledge_edges.values());

      if (options.entity_type) {
        nodes = nodes.filter((n) => n.entity_type.toLowerCase() === options.entity_type.toLowerCase());
        const validNodeIds = new Set(nodes.map((n) => n.id));
        edges = edges.filter((e) => validNodeIds.has(e.source_node_id) || validNodeIds.has(e.target_node_id));
      }

      if (options.nodeId) {
        const connectedEdges = edges.filter((e) => e.source_node_id === options.nodeId || e.target_node_id === options.nodeId);
        const relatedNodeIds = new Set([options.nodeId, ...connectedEdges.map((e) => e.source_node_id), ...connectedEdges.map((e) => e.target_node_id)]);
        nodes = nodes.filter((n) => relatedNodeIds.has(n.id));
        edges = connectedEdges;
      }

      if (options.relationship_type) {
        edges = edges.filter((e) => e.relationship_type.toLowerCase() === options.relationship_type.toLowerCase());
      }

      return {
        nodes,
        edges,
        stats: {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      const [nodesRes, edgesRes] = await Promise.all([
        fetch(`${this.url}/rest/v1/knowledge_nodes?select=*`, {
          headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
        }),
        fetch(`${this.url}/rest/v1/knowledge_edges?select=*`, {
          headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
        }),
      ]);

      const nodes = nodesRes.ok ? await nodesRes.json() : [];
      const edges = edgesRes.ok ? await edgesRes.json() : [];

      return {
        nodes,
        edges,
        stats: {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch knowledge graph', { error: err.message });
      return {
        nodes: Array.from(this.mockStore.knowledge_nodes.values()),
        edges: Array.from(this.mockStore.knowledge_edges.values()),
        stats: {
          totalNodes: this.mockStore.knowledge_nodes.size,
          totalEdges: this.mockStore.knowledge_edges.size,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async getKnowledgeNode(id) {
    if (this.isMock) {
      return this.mockStore.knowledge_nodes.get(id) || null;
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/knowledge_nodes?id=eq.${id}&select=*`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (!res.ok) return null;
      const list = await res.json();
      return list[0] || null;
    } catch {
      return this.mockStore.knowledge_nodes.get(id) || null;
    }
  }

  async upsertKnowledgeNode(nodeData = {}) {
    const record = {
      id: nodeData.id || `node_${Date.now()}`,
      entity_type: nodeData.entity_type || nodeData.entityType || 'FRAMEWORK',
      label: nodeData.label || 'Entity Node',
      properties: nodeData.properties || {},
      created_at: nodeData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.knowledge_nodes.set(record.id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/knowledge_nodes`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Supabase upsertKnowledgeNode error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || record;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to upsert knowledge node', { error: err.message });
      this.mockStore.knowledge_nodes.set(record.id, record);
      return record;
    }
  }

  async deleteKnowledgeNode(id) {
    if (this.isMock) {
      const existed = this.mockStore.knowledge_nodes.has(id);
      this.mockStore.knowledge_nodes.delete(id);
      // Cascade delete connected edges
      for (const [edgeId, edge] of this.mockStore.knowledge_edges.entries()) {
        if (edge.source_node_id === id || edge.target_node_id === id) {
          this.mockStore.knowledge_edges.delete(edgeId);
        }
      }
      return existed;
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/knowledge_nodes?id=eq.${id}`, {
        method: 'DELETE',
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getKnowledgeEdge(id) {
    if (this.isMock) {
      return this.mockStore.knowledge_edges.get(id) || null;
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/knowledge_edges?id=eq.${id}&select=*`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (!res.ok) return null;
      const list = await res.json();
      return list[0] || null;
    } catch {
      return this.mockStore.knowledge_edges.get(id) || null;
    }
  }

  async upsertKnowledgeEdge(edgeData = {}) {
    const record = {
      id: edgeData.id || `edge_${Date.now()}`,
      source_node_id: edgeData.source_node_id || edgeData.sourceNodeId || '',
      target_node_id: edgeData.target_node_id || edgeData.targetNodeId || '',
      relationship_type: edgeData.relationship_type || edgeData.relationshipType || 'LINKED_TO',
      metadata: edgeData.metadata || {},
      created_at: edgeData.created_at || new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.knowledge_edges.set(record.id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/knowledge_edges`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Supabase upsertKnowledgeEdge error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || record;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to upsert knowledge edge', { error: err.message });
      this.mockStore.knowledge_edges.set(record.id, record);
      return record;
    }
  }

  async deleteKnowledgeEdge(id) {
    if (this.isMock) {
      const existed = this.mockStore.knowledge_edges.has(id);
      this.mockStore.knowledge_edges.delete(id);
      return existed;
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/knowledge_edges?id=eq.${id}`, {
        method: 'DELETE',
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Sprint 2: Runtime Telemetry (Decoupled from Core Registries) ---

  async fetchRuntimeAgentTelemetry() {
    if (this.isMock) {
      return Array.from(this.mockStore.runtime_agent_telemetry.values());
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/runtime_agent_telemetry?select=*`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) return await res.json();
      return Array.from(this.mockStore.runtime_agent_telemetry.values());
    } catch {
      return Array.from(this.mockStore.runtime_agent_telemetry.values());
    }
  }

  async getAgentRuntimeTelemetry(agentId) {
    if (this.isMock) {
      return this.mockStore.runtime_agent_telemetry.get(agentId) || null;
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/runtime_agent_telemetry?agent_id=eq.${agentId}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || null;
      }
      return this.mockStore.runtime_agent_telemetry.get(agentId) || null;
    } catch {
      return this.mockStore.runtime_agent_telemetry.get(agentId) || null;
    }
  }

  async recordRuntimeAgentTelemetry(data) {
    const record = {
      agent_id: data.agent_id || data.agentId,
      live_status: (data.live_status || data.status || 'IDLE').toUpperCase(),
      active_task: data.active_task || data.activeTask || null,
      tokens_consumed_total: Number(data.tokens_consumed_total || data.tokensConsumed || 0),
      compute_cost_usd: Number(data.compute_cost_usd || data.computeCostUsd || 0.0000),
      error_rate_5m: Number(data.error_rate_5m || data.errorRate || 0.00),
      last_latency_ms: Number(data.last_latency_ms || data.latencyMs || 0),
      uptime_seconds: Number(data.uptime_seconds || data.uptime || 0),
      last_heartbeat: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.runtime_agent_telemetry.set(record.agent_id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/runtime_agent_telemetry`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || record;
      }
      return record;
    } catch {
      this.mockStore.runtime_agent_telemetry.set(record.agent_id, record);
      return record;
    }
  }

  async fetchRuntimeToolTelemetry() {
    if (this.isMock) {
      return Array.from(this.mockStore.runtime_tool_telemetry.values());
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/runtime_tool_telemetry?select=*`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) return await res.json();
      return Array.from(this.mockStore.runtime_tool_telemetry.values());
    } catch {
      return Array.from(this.mockStore.runtime_tool_telemetry.values());
    }
  }

  async getToolRuntimeTelemetry(toolId) {
    if (this.isMock) {
      return this.mockStore.runtime_tool_telemetry.get(toolId) || null;
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/runtime_tool_telemetry?tool_id=eq.${toolId}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || null;
      }
      return this.mockStore.runtime_tool_telemetry.get(toolId) || null;
    } catch {
      return this.mockStore.runtime_tool_telemetry.get(toolId) || null;
    }
  }

  async recordRuntimeToolTelemetry(data) {
    const record = {
      tool_id: data.tool_id || data.toolId,
      live_health_status: (data.live_health_status || data.health_status || 'HEALTHY').toUpperCase(),
      current_latency_ms: Number(data.current_latency_ms || data.latency_ms || 0),
      error_rate_5m: Number(data.error_rate_5m || data.errorRate || 0.00),
      total_calls_today: Number(data.total_calls_today || data.totalCalls || 0),
      quota_remaining: Number(data.quota_remaining || data.quotaRemaining || 100000),
      last_probe_timestamp: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.runtime_tool_telemetry.set(record.tool_id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/runtime_tool_telemetry`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || record;
      }
      return record;
    } catch {
      this.mockStore.runtime_tool_telemetry.set(record.tool_id, record);
      return record;
    }
  }

  async fetchRuntimeSystemMetrics(limit = 30) {
    if (this.isMock) {
      if (this.mockStore.runtime_system_metrics.length === 0) {
        const mem = process.memoryUsage ? process.memoryUsage().rss / (1024 * 1024) : 48.5;
        this.mockStore.runtime_system_metrics.push({
          id: 'sys_metric_001',
          memory_rss_mb: Number(mem.toFixed(2)),
          active_connections: 12,
          event_queue_depth: 0,
          edge_requests_per_min: 140,
          recorded_at: new Date().toISOString(),
        });
      }
      return this.mockStore.runtime_system_metrics.slice(0, limit);
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/runtime_system_metrics?select=*&order=recorded_at.desc&limit=${limit}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) return await res.json();
      return this.mockStore.runtime_system_metrics.slice(0, limit);
    } catch {
      return this.mockStore.runtime_system_metrics.slice(0, limit);
    }
  }

  // --- Sprint 2: CloudEvents v1.1 Store & Append-Only Audit Immutability ---

  async recordEnterpriseEvent(event) {
    const rawPayload = typeof event.data === 'string' ? event.data : JSON.stringify(event.data || event.payload || {});
    const payloadSha256 = event.payload_sha256 || createHash('sha256').update(rawPayload).digest('hex');

    const lastEvent = this.mockStore.enterprise_events[0] || null;
    const prevHash = event.prev_event_hash !== undefined ? event.prev_event_hash : (lastEvent ? lastEvent.payload_sha256 : null);

    const record = {
      id: event.id || `evt_${Date.now()}`,
      event_type: event.event_type || event.type || 'system.event',
      source: event.source || 'raioc://os/kernel',
      specversion: event.specversion || '1.1',
      correlation_id: event.correlation_id || event.correlationId || `corr_${Date.now()}`,
      causation_id: event.causation_id || event.causationId || null,
      traceparent: event.traceparent || null,
      payload: event.data || event.payload || {},
      payload_sha256: payloadSha256,
      prev_event_hash: prevHash,
      status: event.status || 'EMITTED',
      retry_count: Number(event.retry_count || 0),
      timeout_threshold_seconds: Number(event.timeout_threshold_seconds || 300),
      created_at: event.created_at || event.time || new Date().toISOString(),
      processed_at: event.processed_at || null,
    };

    if (this.isMock) {
      this.mockStore.enterprise_events.unshift(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/enterprise_events`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || record;
      }
      return record;
    } catch {
      this.mockStore.enterprise_events.unshift(record);
      return record;
    }
  }

  async fetchEnterpriseEvents(filter = {}) {
    if (this.isMock) {
      let result = [...this.mockStore.enterprise_events];
      if (filter.status) result = result.filter((e) => e.status === filter.status);
      if (filter.event_type) result = result.filter((e) => e.event_type === filter.event_type);
      if (filter.correlation_id) result = result.filter((e) => e.correlation_id === filter.correlation_id);
      return result.slice(0, Number(filter.limit) || 50);
    }

    try {
      const params = new URLSearchParams();
      params.append('select', '*');
      params.append('order', 'created_at.desc');
      if (filter.status) params.append('status', `eq.${filter.status}`);
      if (filter.event_type) params.append('event_type', `eq.${filter.event_type}`);
      if (filter.correlation_id) params.append('correlation_id', `eq.${filter.correlation_id}`);
      if (filter.limit) params.append('limit', filter.limit);

      const res = await fetch(`${this.url}/rest/v1/enterprise_events?${params.toString()}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) return await res.json();
      return this.mockStore.enterprise_events.slice(0, Number(filter.limit) || 50);
    } catch {
      return this.mockStore.enterprise_events.slice(0, Number(filter.limit) || 50);
    }
  }

  async fetchStuckEnterpriseEvents(staleCutoff) {
    if (this.isMock) {
      const cutoffTime = new Date(staleCutoff).getTime();
      return this.mockStore.enterprise_events.filter(
        (e) => e.status === 'PROCESSING' && new Date(e.created_at).getTime() <= cutoffTime
      );
    }
    try {
      const res = await fetch(
        `${this.url}/rest/v1/enterprise_events?status=eq.PROCESSING&created_at=lte.${staleCutoff}`,
        { headers: { apikey: this.key, Authorization: `Bearer ${this.key}` } }
      );
      if (res.ok) return await res.json();
      return [];
    } catch {
      return [];
    }
  }

  async updateEnterpriseEventStatus(id, status, meta = {}) {
    if (this.isMock) {
      const evt = this.mockStore.enterprise_events.find((e) => e.id === id);
      if (evt) {
        evt.status = status;
        if (meta.retry_count !== undefined) evt.retry_count = meta.retry_count;
        if (meta.reclaimed_at) evt.reclaimed_at = meta.reclaimed_at;
        if (meta.moved_to_dlq_at) evt.moved_to_dlq_at = meta.moved_to_dlq_at;
        if (meta.dlq_reason) evt.dlq_reason = meta.dlq_reason;
        if (status === 'PROCESSED') evt.processed_at = new Date().toISOString();
      }
      return evt || { id, status };
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/enterprise_events?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          status,
          ...(meta.retry_count !== undefined ? { retry_count: meta.retry_count } : {}),
          ...(status === 'PROCESSED' ? { processed_at: new Date().toISOString() } : {}),
        }),
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || { id, status };
      }
      return { id, status };
    } catch {
      return { id, status };
    }
  }

  // --- Strict PostgreSQL Trigger Simulation for Append-Only Immutability ---

  async updateInteractionLog(id, updateData) {
    throw new Error('FATAL: UPDATE or DELETE operations are strictly prohibited on immutable audit tables (Table: interaction_logs)');
  }

  async deleteInteractionLog(id) {
    throw new Error('FATAL: UPDATE or DELETE operations are strictly prohibited on immutable audit tables (Table: interaction_logs)');
  }

  async deleteEnterpriseEvent(id) {
    throw new Error('FATAL: UPDATE or DELETE operations are strictly prohibited on immutable audit tables (Table: enterprise_events)');
  }

  // --- Sprint 2: Architectural Decision Records (ADR Ledger) ---

  async fetchMemoryAdrs(filter = {}) {
    if (this.isMock) {
      let adrs = Array.from(this.mockStore.enterprise_memory_adr.values());
      if (filter.status) adrs = adrs.filter((a) => a.status === filter.status);
      return adrs;
    }
    try {
      const query = filter.status ? `?status=eq.${filter.status}&order=adr_id.asc` : `?order=adr_id.asc`;
      const res = await fetch(`${this.url}/rest/v1/enterprise_memory_adr${query}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) return await res.json();
      return Array.from(this.mockStore.enterprise_memory_adr.values());
    } catch {
      return Array.from(this.mockStore.enterprise_memory_adr.values());
    }
  }

  async getMemoryAdr(id) {
    if (this.isMock) {
      return this.mockStore.enterprise_memory_adr.get(id) || null;
    }
    try {
      const res = await fetch(`${this.url}/rest/v1/enterprise_memory_adr?adr_id=eq.${id}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || null;
      }
      return this.mockStore.enterprise_memory_adr.get(id) || null;
    } catch {
      return this.mockStore.enterprise_memory_adr.get(id) || null;
    }
  }

  async upsertMemoryAdr(adr) {
    const record = {
      adr_id: adr.adr_id || adr.id,
      title: adr.title,
      status: adr.status || 'ACCEPTED',
      context: adr.context || '',
      decision: adr.decision || '',
      consequences: adr.consequences || '',
      author: adr.author || 'CTO (Gemini)',
      created_at: adr.created_at || new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.enterprise_memory_adr.set(record.adr_id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/enterprise_memory_adr`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || record;
      }
      return record;
    } catch {
      this.mockStore.enterprise_memory_adr.set(record.adr_id, record);
      return record;
    }
  }

  // --- Sovereign Investor CRM Operations ---

  async fetchInvestors(query = {}) {
    if (this.isMock) {
      let results = [...this.mockStore.investors];
      if (query.segment) {
        results = results.filter((i) => i.segment === query.segment);
      }
      if (query.status || query.stage) {
        const targetStage = (query.status || query.stage).toUpperCase();
        results = results.filter((i) => (i.stage || i.status || '').toUpperCase() === targetStage);
      }
      if (query.country) {
        results = results.filter((i) => (i.country || '').toLowerCase() === query.country.toLowerCase());
      }
      return results;
    }

    try {
      let q = `${this.url}/rest/v1/investors?select=*&order=updated_at.desc`;
      if (query.segment) q += `&segment=eq.${query.segment}`;
      if (query.status || query.stage) q += `&status=eq.${query.status || query.stage}`;
      const res = await fetch(q, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Supabase fetchInvestors error: ${res.status}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch investors from database', { error: err.message });
      return [...this.mockStore.investors];
    }
  }

  async getInvestor(id) {
    if (this.isMock) {
      return this.mockStore.investors.find((i) => i.id === id || i.reference_id === id) || null;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/investors?id=eq.${id}&select=*`, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return null;
      const list = await res.json();
      return list[0] || null;
    } catch {
      return this.mockStore.investors.find((i) => i.id === id || i.reference_id === id) || null;
    }
  }

  async fetchInvestorById(id) {
    return await this.getInvestor(id);
  }

  async upsertInvestor(investorData = {}) {
    const record = {
      id: investorData.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reference_id: investorData.reference_id || `REF-${Date.now()}`,
      name: investorData.name || 'Private Investor',
      email: investorData.email || null,
      phone: investorData.phone || null,
      company: investorData.company || null,
      country: investorData.country || 'United Arab Emirates',
      segment: investorData.segment || 'PT_HNW',
      status: investorData.status || investorData.stage || 'NEW_LEAD',
      stage: investorData.stage || investorData.status || 'NEW_LEAD',
      budget_aed: Number(investorData.budget_aed || investorData.budgetAed) || 10000000,
      budget_usd: Number(investorData.budget_usd || investorData.budgetUsd) || 2720000,
      target_thesis: investorData.target_thesis || investorData.targetThesis || 'Opal ROI / Escrow Guarantee',
      thesis_type: investorData.thesis_type || 'OPAL_ROI_ESCROW_GUARANTEE',
      riis_score: Number(investorData.riis_score || investorData.riisScore) || 80,
      dira_risk_level: investorData.dira_risk_level || 'LOW',
      golden_visa_eligible: investorData.golden_visa_eligible !== false,
      escrow_protected: investorData.escrow_protected !== false,
      preferred_channel: investorData.preferred_channel || 'EMAIL',
      target_asset: investorData.target_asset || investorData.targetAsset || 'Dubai Prime Freehold',
      notes: investorData.notes || '',
      tags: investorData.tags || [],
      metadata: investorData.metadata || {},
      created_at: investorData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      const idx = this.mockStore.investors.findIndex((i) => i.id === record.id || i.reference_id === record.reference_id);
      if (idx >= 0) {
        this.mockStore.investors[idx] = { ...this.mockStore.investors[idx], ...record };
      } else {
        this.mockStore.investors.unshift(record);
      }
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/investors`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Supabase upsertInvestor error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || record;
    } catch {
      const idx = this.mockStore.investors.findIndex((i) => i.id === record.id || i.reference_id === record.reference_id);
      if (idx >= 0) {
        this.mockStore.investors[idx] = { ...this.mockStore.investors[idx], ...record };
      } else {
        this.mockStore.investors.unshift(record);
      }
      return record;
    }
  }

  async updateInvestor(id, updates = {}) {
    const existing = await this.getInvestor(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      const idx = this.mockStore.investors.findIndex((i) => i.id === id || i.reference_id === id);
      if (idx >= 0) this.mockStore.investors[idx] = updated;
      return updated;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/investors?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`Supabase updateInvestor error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || updated;
    } catch {
      const idx = this.mockStore.investors.findIndex((i) => i.id === id || i.reference_id === id);
      if (idx >= 0) this.mockStore.investors[idx] = updated;
      return updated;
    }
  }

  getOperationalStoreSnapshot() {
    return {
      agents: Array.from(this.mockStore.agent_status.values()),
      fleet: Array.from(this.mockStore.agent_fleet_status.values()),
      coreAgents: Array.from(this.mockStore.core_agent_registry.values()),
      coreTools: Array.from(this.mockStore.core_tool_registry.values()),
      coreWorkflows: Array.from(this.mockStore.core_workflow_registry.values()),
      knowledgeNodes: Array.from(this.mockStore.knowledge_nodes.values()),
      knowledgeEdges: Array.from(this.mockStore.knowledge_edges.values()),
      investors: this.mockStore.investors,
      approvals: this.mockStore.executive_approvals,
      interactions: this.mockStore.interaction_logs,
      connectors: Array.from(this.mockStore.connector_health.values()),
      executions: Array.from(this.mockStore.executions.values()),
      workflows: Array.from(this.mockStore.workflow_runs.values()),
      notifications: this.mockStore.notifications,
      communications: this.mockStore.communications || [],
      auditLogs: this.mockStore.audit_logs || [],
    };
  }
}

export const supabase = new SupabaseClient();


