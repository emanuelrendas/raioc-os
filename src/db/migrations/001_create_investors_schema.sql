-- ============================================================================
-- RAIOC OS - Supabase Database Migration 001
-- File: src/db/migrations/001_create_investors_schema.sql
-- Description: Complete Investor CRM, Interaction Logs, Custom Enums,
--              Row-Level Security (RLS), and Realtime Publications.
-- ============================================================================

-- 1. Custom PostgreSQL Enum Types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investor_segment_enum') THEN
        CREATE TYPE public.investor_segment_enum AS ENUM (
            'PT_HNW',
            'ES_HNW',
            'UK_NONDOM',
            'DLD_BUYER',
            'DLD_SELLER',
            'SOVEREIGN_FUND',
            'FAMILY_OFFICE',
            'INSTITUTIONAL'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investor_status_enum') THEN
        CREATE TYPE public.investor_status_enum AS ENUM (
            'NEW',
            'PENDING',
            'INGESTED',
            'QUALIFIED',
            'ENGAGED',
            'PROPOSAL_DELIVERED',
            'CONVERTED',
            'ARCHIVED'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interaction_channel_enum') THEN
        CREATE TYPE public.interaction_channel_enum AS ENUM (
            'WEBSITE',
            'WHATSAPP',
            'EMAIL',
            'TELEGRAM',
            'GOOGLE_CALENDAR',
            'N8N_WEBHOOK',
            'VOICE_AGENT',
            'MANUAL_ADVISORY'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interaction_direction_enum') THEN
        CREATE TYPE public.interaction_direction_enum AS ENUM (
            'INBOUND',
            'OUTBOUND',
            'INTERNAL_AGENT'
        );
    END IF;
END $$;

-- 2. Investors Table
CREATE TABLE IF NOT EXISTS public.investors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id VARCHAR(64) UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(64),
    company VARCHAR(255),
    country VARCHAR(128),
    segment VARCHAR(64) NOT NULL DEFAULT 'PT_HNW',
    status VARCHAR(32) NOT NULL DEFAULT 'NEW',
    budget_aed NUMERIC(15,2) DEFAULT 0.00,
    budget_usd NUMERIC(15,2) DEFAULT 0.00,
    target_thesis VARCHAR(255) DEFAULT 'Opal ROI / Escrow Guarantee',
    thesis_type VARCHAR(64) DEFAULT 'OPAL_ROI_ESCROW_GUARANTEE',
    riis_score INTEGER DEFAULT 75,
    dira_risk_level VARCHAR(32) DEFAULT 'LOW',
    golden_visa_eligible BOOLEAN DEFAULT true,
    escrow_protected BOOLEAN DEFAULT true,
    preferred_channel VARCHAR(32) DEFAULT 'EMAIL',
    assigned_advisor VARCHAR(128) DEFAULT 'Emanuel Rendas Private Advisory',
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ai_profile JSONB DEFAULT '{}'::jsonb,
    financial_metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Interaction Logs Table
CREATE TABLE IF NOT EXISTS public.interaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID REFERENCES public.investors(id) ON DELETE CASCADE,
    correlation_id VARCHAR(128),
    channel VARCHAR(32) NOT NULL DEFAULT 'WEBSITE',
    event_type VARCHAR(64) NOT NULL,
    source_agent VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
    direction VARCHAR(16) NOT NULL DEFAULT 'INBOUND',
    summary TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    response_data JSONB DEFAULT '{}'::jsonb,
    latency_ms INTEGER DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Automatic Timestamp Update Trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_investors_updated_at ON public.investors;
CREATE TRIGGER trigger_investors_updated_at
    BEFORE UPDATE ON public.investors
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_investors_email ON public.investors(email);
CREATE INDEX IF NOT EXISTS idx_investors_phone ON public.investors(phone);
CREATE INDEX IF NOT EXISTS idx_investors_segment ON public.investors(segment);
CREATE INDEX IF NOT EXISTS idx_investors_status ON public.investors(status);
CREATE INDEX IF NOT EXISTS idx_investors_created_at ON public.investors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investors_budget_aed ON public.investors(budget_aed DESC);

CREATE INDEX IF NOT EXISTS idx_interaction_logs_investor_id ON public.interaction_logs(investor_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_correlation_id ON public.interaction_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_channel ON public.interaction_logs(channel);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_event_type ON public.interaction_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_created_at ON public.interaction_logs(created_at DESC);

-- 6. Row Level Security (RLS)
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access on investors" ON public.investors;
CREATE POLICY "Service role full access on investors"
    ON public.investors
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on interaction_logs" ON public.interaction_logs;
CREATE POLICY "Service role full access on interaction_logs"
    ON public.interaction_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to read records
DROP POLICY IF EXISTS "Authenticated users read investors" ON public.investors;
CREATE POLICY "Authenticated users read investors"
    ON public.investors
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users read interaction_logs" ON public.interaction_logs;
CREATE POLICY "Authenticated users read interaction_logs"
    ON public.interaction_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- 7. Supabase Realtime Publication
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'investors'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.investors;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Publication supabase_realtime configuration skipped or already present.';
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'interaction_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.interaction_logs;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Publication supabase_realtime configuration skipped or already present.';
END $$;
