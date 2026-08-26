-- ============================================================================
-- RAIOC OS - Supabase Database Migration 003
-- File: src/database/migrations/003_enterprise_core_registries.sql
-- Description: Foundational Enterprise Core: Agent Registry, Tool Registry,
--              Workflow Registry, and Enterprise Knowledge Graph (Nodes & Edges).
-- ============================================================================

-- 1. Core Agent Registry Table
CREATE TABLE IF NOT EXISTS public.core_agent_registry (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    role VARCHAR(255) NOT NULL,
    model VARCHAR(64) NOT NULL DEFAULT 'gemini-2.5-flash',
    capabilities JSONB DEFAULT '[]'::jsonb,
    permissions JSONB DEFAULT '[]'::jsonb,
    cost_budget JSONB DEFAULT '{"monthly_limit_usd": 500, "current_spend_usd": 0, "currency": "USD"}'::jsonb,
    version VARCHAR(32) DEFAULT '1.0.0',
    owner VARCHAR(64) DEFAULT 'CTO',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'DEPRECATED', 'PROVISIONING'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Core Tool Registry Table
CREATE TABLE IF NOT EXISTS public.core_tool_registry (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL, -- 'AI_MODEL', 'DATABASE', 'ORCHESTRATION', 'HOSTING', 'CALCULATOR', 'MULTIMEDIA', 'COMMUNICATION'
    health_status VARCHAR(32) NOT NULL DEFAULT 'HEALTHY', -- 'HEALTHY', 'DEGRADED', 'OUTAGE', 'MAINTENANCE'
    latency_ms INTEGER NOT NULL DEFAULT 15,
    quota_limits JSONB DEFAULT '{"rate_limit_per_min": 120, "daily_quota": 20000}'::jsonb,
    dependencies JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Core Workflow Registry Table
CREATE TABLE IF NOT EXISTS public.core_workflow_registry (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    orchestrator VARCHAR(64) NOT NULL, -- 'n8n', 'temporal', 'raioc_event_bus', 'cloud_functions'
    trigger_type VARCHAR(64) NOT NULL, -- 'WEBHOOK', 'SCHEDULED', 'EVENT', 'MANUAL'
    input_schema JSONB DEFAULT '{}'::jsonb,
    output_schema JSONB DEFAULT '{}'::jsonb,
    owner VARCHAR(64) DEFAULT 'CTO',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version VARCHAR(32) DEFAULT '1.0.0',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enterprise Knowledge Graph - Nodes Table
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
    id VARCHAR(128) PRIMARY KEY,
    entity_type VARCHAR(64) NOT NULL, -- 'FRAMEWORK', 'REGULATION', 'PROPERTY_ASSET', 'INVESTOR_PROFILE', 'AGENT', 'MARKET_ZONE'
    label VARCHAR(255) NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enterprise Knowledge Graph - Relational Edges Table
CREATE TABLE IF NOT EXISTS public.knowledge_edges (
    id VARCHAR(128) PRIMARY KEY,
    source_node_id VARCHAR(128) NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
    target_node_id VARCHAR(128) NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(64) NOT NULL, -- 'GOVERNS', 'ALLOCATED_IN', 'QUALIFIES_UNDER', 'ANALYZED_BY', 'LINKED_TO', 'SHIELDED_BY'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Indexes for High-Velocity Relational Queries & Graph Traversal
CREATE INDEX IF NOT EXISTS idx_core_agent_status ON public.core_agent_registry(status);
CREATE INDEX IF NOT EXISTS idx_core_tool_category ON public.core_tool_registry(category);
CREATE INDEX IF NOT EXISTS idx_core_tool_health ON public.core_tool_registry(health_status);
CREATE INDEX IF NOT EXISTS idx_core_workflow_active ON public.core_workflow_registry(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_type ON public.knowledge_nodes(entity_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source ON public.knowledge_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target ON public.knowledge_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_rel ON public.knowledge_edges(relationship_type);

-- 7. Seed Initial Enterprise Core Data
-- 7a. Seed Core Agents
INSERT INTO public.core_agent_registry (id, name, role, model, capabilities, permissions, cost_budget, version, owner, status)
VALUES
    ('jarvis_executive_brain', 'JARVIS', 'Chief Autonomous Orchestration Agent & Executive Brain', 'gemini-2.5-flash', '["workflow_orchestration", "cognitive_synthesis", "cross_agent_triage", "autonomous_dispatch"]'::jsonb, '["admin:all", "execute:pipeline", "resolve:approvals"]'::jsonb, '{"monthly_limit_usd": 1500, "current_spend_usd": 42.50, "currency": "USD"}'::jsonb, '2.5.0', 'CTO', 'ACTIVE'),
    ('mark_lead_triage', 'MARK', 'Lead Triage, Segmentation & Risk Intelligence Specialist', 'gemini-2.5-flash', '["dira_scoring", "riis_evaluation", "crm_segmentation", "inbound_triage"]'::jsonb, '["read:leads", "write:crm", "score:dira"]'::jsonb, '{"monthly_limit_usd": 600, "current_spend_usd": 18.20, "currency": "USD"}'::jsonb, '2.1.0', 'CTO', 'ACTIVE'),
    ('atlas_opal_calculator', 'ATLAS', 'Real Estate & Opal ROI Modeling Specialist', 'gemini-2.5-flash', '["opal_roi_calculation", "dld_index_valuation", "yield_forecasting", "sqft_benchmarking"]'::jsonb, '["read:dld", "execute:calculators", "model:yield"]'::jsonb, '{"monthly_limit_usd": 500, "current_spend_usd": 12.80, "currency": "USD"}'::jsonb, '2.0.0', 'CTO', 'ACTIVE'),
    ('aida_flow_mixboard', 'AIDA', 'Client Relations & Cinematic Media Teaser Specialist', 'gemini-2.5-flash', '["flow_teaser_generation", "mixboard_composition", "whatsapp_dispatch", "memorandum_drafting"]'::jsonb, '["dispatch:brief", "generate:media", "send:whatsapp"]'::jsonb, '{"monthly_limit_usd": 750, "current_spend_usd": 24.10, "currency": "USD"}'::jsonb, '2.0.0', 'CTO', 'ACTIVE'),
    ('lex_compliance_legal', 'LEX', 'Compliance, Statutory Tax & Golden Visa Specialist', 'gemini-2.5-flash', '["golden_visa_audit", "law8_escrow_compliance", "difc_structuring", "tax_shielding"]'::jsonb, '["audit:compliance", "verify:escrow", "check:visa"]'::jsonb, '{"monthly_limit_usd": 500, "current_spend_usd": 8.40, "currency": "USD"}'::jsonb, '2.0.0', 'CTO', 'ACTIVE'),
    ('sentinel_devops_qa', 'SENTINEL', 'QA, DevOps & Autonomous System Health Guardian', 'gemini-2.5-flash', '["health_monitoring", "gateway_verification", "latency_auditing", "self_healing"]'::jsonb, '["monitor:system", "restart:adapters", "alert:ops"]'::jsonb, '{"monthly_limit_usd": 400, "current_spend_usd": 5.90, "currency": "USD"}'::jsonb, '2.2.0', 'CTO', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    capabilities = EXCLUDED.capabilities,
    status = EXCLUDED.status,
    updated_at = NOW();

-- 7b. Seed Core Tools
INSERT INTO public.core_tool_registry (id, name, category, health_status, latency_ms, quota_limits, dependencies)
VALUES
    ('gemini_api', 'Google Gemini 2.5 Flash API', 'AI_MODEL', 'HEALTHY', 18, '{"rate_limit_per_min": 300, "daily_quota": 50000}'::jsonb, '[]'::jsonb),
    ('supabase_database', 'Supabase PostgreSQL & Realtime', 'DATABASE', 'HEALTHY', 12, '{"pool_size": 20, "max_connections": 100}'::jsonb, '[]'::jsonb),
    ('vercel_gateway', 'Vercel Serverless Edge Gateway', 'HOSTING', 'HEALTHY', 8, '{"max_concurrency": 1000, "timeout_sec": 60}'::jsonb, '[]'::jsonb),
    ('n8n_orchestration', 'n8n Workflow Automation Hub', 'ORCHESTRATION', 'HEALTHY', 25, '{"rate_limit_per_min": 120, "concurrency": 10}'::jsonb, '["gemini_api", "supabase_database"]'::jsonb),
    ('opal_engine', 'Google Opal ROI & Visa Calculator', 'CALCULATOR', 'HEALTHY', 5, '{"rate_limit_per_min": 600, "cache_ttl_sec": 300}'::jsonb, '[]'::jsonb),
    ('flow_engine', 'Flow Cinematic Video Hook Engine', 'MULTIMEDIA', 'HEALTHY', 35, '{"rate_limit_per_min": 60, "video_renders_per_day": 500}'::jsonb, '["gemini_api"]'::jsonb),
    ('mixboard_engine', 'Mixboard Visual Concept Board Generator', 'MULTIMEDIA', 'HEALTHY', 30, '{"rate_limit_per_min": 60, "boards_per_day": 500}'::jsonb, '["gemini_api"]'::jsonb),
    ('youtube_data_api', 'YouTube Data API v3 Feed Engine', 'COMMUNICATION', 'HEALTHY', 45, '{"rate_limit_per_min": 100, "daily_quota": 10000}'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    health_status = EXCLUDED.health_status,
    latency_ms = EXCLUDED.latency_ms,
    updated_at = NOW();

-- 7c. Seed Core Workflows
INSERT INTO public.core_workflow_registry (id, name, orchestrator, trigger_type, input_schema, output_schema, owner, is_active, version)
VALUES
    ('wf_google_tools_orchestration', 'Google Tools & Multi-Agent Orchestration', 'n8n', 'EVENT', '{"type": "object", "properties": {"event": {"type": "string"}}}'::jsonb, '{"type": "object", "properties": {"success": {"type": "boolean"}}}'::jsonb, 'CTO', TRUE, '1.0.0'),
    ('wf_lead_ingestion_triage', 'Multi-Channel Ingestion & DIRA Scoring Pipeline', 'raioc_event_bus', 'WEBHOOK', '{"type": "object", "properties": {"lead": {"type": "object"}}}'::jsonb, '{"type": "object", "properties": {"riis": {"type": "number"}}}'::jsonb, 'CTO', TRUE, '1.2.0'),
    ('wf_outbound_dispatch', 'Encrypted Executive Brief & WhatsApp Dispatch', 'raioc_event_bus', 'EVENT', '{"type": "object", "properties": {"briefId": {"type": "string"}}}'::jsonb, '{"type": "object", "properties": {"dispatched": {"type": "boolean"}}}'::jsonb, 'CTO', TRUE, '1.1.0'),
    ('wf_golden_visa_audit', 'Golden Visa & Escrow Law 8 Compliance Audit', 'cloud_functions', 'MANUAL', '{"type": "object", "properties": {"propertyValueAed": {"type": "number"}}}'::jsonb, '{"type": "object", "properties": {"qualified": {"type": "boolean"}}}'::jsonb, 'CTO', TRUE, '1.0.0')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 7d. Seed Enterprise Knowledge Graph (Nodes)
INSERT INTO public.knowledge_nodes (id, entity_type, label, properties)
VALUES
    ('node_uae_law8_escrow', 'REGULATION', 'UAE Law No. 8 of 2007 (Escrow Account Framework)', '{"jurisdiction": "Dubai", "authority": "RERA / DLD", "escrow_retention_pct": 5, "statutory_protection": "STRICT"}'::jsonb),
    ('node_golden_visa_res65_2022', 'REGULATION', 'UAE Cabinet Resolution No. 65 of 2022 (Golden Visa)', '{"minimum_investment_aed": 2000000, "duration_years": 10, "mortgage_permitted": true}'::jsonb),
    ('node_palm_jumeirah', 'MARKET_ZONE', 'Palm Jumeirah Prime Freehold Zone', '{"avg_yield_pct": 7.4, "capital_appreciation_yoy_pct": 16.2, "freehold_status": true}'::jsonb),
    ('node_como_residences', 'PROPERTY_ASSET', 'Como Residences by Nakheel (Palm Jumeirah)', '{"developer": "Nakheel", "starting_price_aed": 21000000, "escrow_number": "ESC-2024-COMO", "projected_yield_pct": 7.8}'::jsonb),
    ('node_pt_nhr_investor_profile', 'INVESTOR_PROFILE', 'Portuguese NHR & Family Office Investor Thesis', '{"target_yield_min": 7.0, "currency_hedge": "AED_USD_PEGGED", "tax_arbitrage_focus": "ZERO_CAP_GAINS"}'::jsonb),
    ('node_difc_foundation_shield', 'FRAMEWORK', 'DIFC Foundation & Wealth Shielding Structure', '{"governance": "Common Law", "asset_protection": "SOVEREIGN", "regulatory_body": "DFSA"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label,
    properties = EXCLUDED.properties,
    updated_at = NOW();

-- 7e. Seed Enterprise Knowledge Graph (Edges)
INSERT INTO public.knowledge_edges (id, source_node_id, target_node_id, relationship_type, metadata)
VALUES
    ('edge_law8_governs_como', 'node_uae_law8_escrow', 'node_como_residences', 'GOVERNS', '{"escrow_verified": true, "guarantee_held": "100% Ringfenced"}'::jsonb),
    ('edge_gv_qualifies_pt_nhr', 'node_como_residences', 'node_golden_visa_res65_2022', 'QUALIFIES_UNDER', '{"threshold_exceeded_by_pct": 950}'::jsonb),
    ('edge_como_located_palm', 'node_como_residences', 'node_palm_jumeirah', 'ALLOCATED_IN', '{"prime_waterfront": true}'::jsonb),
    ('edge_difc_shields_pt_nhr', 'node_difc_foundation_shield', 'node_pt_nhr_investor_profile', 'SHIELDED_BY', '{"trust_structure": "Institutional Family Trust"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    relationship_type = EXCLUDED.relationship_type,
    metadata = EXCLUDED.metadata;

-- 8. Enable Row-Level Security (RLS)
ALTER TABLE public.core_agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_tool_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_workflow_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies: Service Role full administrative access & read policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_core_agents') THEN
        CREATE POLICY service_role_all_core_agents ON public.core_agent_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_core_tools') THEN
        CREATE POLICY service_role_all_core_tools ON public.core_tool_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_core_workflows') THEN
        CREATE POLICY service_role_all_core_workflows ON public.core_workflow_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_knowledge_nodes') THEN
        CREATE POLICY service_role_all_knowledge_nodes ON public.knowledge_nodes FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_knowledge_edges') THEN
        CREATE POLICY service_role_all_knowledge_edges ON public.knowledge_edges FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 10. Realtime Publication Subscriptions
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'core_agent_registry') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.core_agent_registry;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'core_tool_registry') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.core_tool_registry;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'core_workflow_registry') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.core_workflow_registry;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'knowledge_nodes') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_nodes;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'knowledge_edges') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_edges;
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        -- If publication supabase_realtime does not exist in standard postgres, create it
        CREATE PUBLICATION supabase_realtime FOR TABLE 
            public.core_agent_registry, 
            public.core_tool_registry, 
            public.core_workflow_registry, 
            public.knowledge_nodes, 
            public.knowledge_edges;
END $$;
