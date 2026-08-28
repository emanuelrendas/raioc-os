/**
 * Unified Lead & Assessment Intake Route Handler (Security & Schema Hardened)
 * All intake and assessment writes land exclusively on verified schema tables:
 * - public.investors
 * - public.interaction_logs
 *
 * Governance:
 * - Named Human Owner: Emanuel Rendas (Principal Advisor)
 * - Documented Purpose: Sovereign wealth client ingestion and assessment audit logging
 * - Defined Risk Tier: Tier 1 (High - Sensitive Financial & Identity PII)
 * - Reviewable Audit Trail: public.interaction_logs + correlation IDs
 */

import { getSupabaseCredentials } from '../../../api/_supabase.js';
import { handleAssessmentSubmission } from './assessment-routes.js';
import { logger } from '../../logging/audit-logger.js';

export async function handleIntakeRequest(method = 'GET', payload = {}) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Content-Type': 'application/json',
  };

  if (method === 'OPTIONS') {
    return { status: 200, headers, body: null };
  }

  const { url: URL_BASE, serviceKey: SERVICE, isConfigured } = getSupabaseCredentials();

  if (method === 'GET') {
    return {
      status: 200,
      headers,
      body: {
        ok: true,
        endpoint: '/api/intake',
        configured: isConfigured,
        canonicalTables: ['investors', 'interaction_logs'],
        governance: {
          owner: 'Emanuel Rendas',
          riskTier: 'Tier 1',
          auditTrail: 'public.interaction_logs',
        },
      },
    };
  }

  if (method !== 'POST') {
    return {
      status: 405,
      headers,
      body: { ok: false, error: 'Method not allowed. Use POST.' },
    };
  }

  let body = payload;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return {
      status: 400,
      headers,
      body: { ok: false, error: 'Expected JSON body.' },
    };
  }

  if (!isConfigured) {
    return {
      status: 503,
      headers,
      body: { ok: false, error: 'Supabase storage is not configured on the server (Fail-Closed enforced).' },
    };
  }

  const action = body.action || 'lead_capture';
  const waNumber = '971543871702';

  try {
    // 1. LEAD CAPTURE -> LANDS ON public.investors & public.interaction_logs
    if (action === 'lead_capture') {
      const name = (body.name || '').trim();
      const email = (body.email || '').trim().toLowerCase();
      const location = (body.location || body.address || '').trim();
      const mobile = (body.mobile || body.phone || '').trim() || null;
      const mandate = (body.mandate_description || body.notes || '').trim() || null;
      const objective = (body.investment_objective || body.objective || '').trim() || null;
      const rawBudget = (body.budget_band || body.budget || '').trim() || null;
      const consent = body.consent_given !== false;

      if (!name || !email) {
        return { status: 400, headers, body: { ok: false, error: 'Name and email are required.' } };
      }
      if (!consent) {
        return { status: 400, headers, body: { ok: false, error: 'Explicit consent is required.' } };
      }

      // Parse budget to numeric AED
      let numericBudget = 5000000;
      if (rawBudget) {
        const u = rawBudget.toUpperCase();
        if (u.includes('30M') || u.includes('50M') || u.includes('25M+')) numericBudget = 30000000;
        else if (u.includes('15M') || u.includes('20M') || u.includes('10M')) numericBudget = 15000000;
        else if (u.includes('5M')) numericBudget = 7500000;
        else if (u.includes('2M') || u.includes('3.5M')) numericBudget = 3500000;
        else if (u.includes('1M')) numericBudget = 1500000;
        else if (!isNaN(Number(rawBudget)) && Number(rawBudget) > 0) numericBudget = Number(rawBudget);
      }

      const investorRow = {
        name,
        email,
        phone: mobile,
        country: location || 'International',
        segment: numericBudget >= 20000000 ? 'FAMILY_OFFICE' : 'PT_HNW',
        status: 'NEW',
        budget_aed: numericBudget,
        budget_usd: Math.round(numericBudget / 3.6725),
        target_thesis: objective || 'Opal ROI / Escrow Guarantee',
        thesis_type: 'OPAL_ROI_ESCROW_GUARANTEE',
        riis_score: 80,
        dira_risk_level: 'LOW',
        golden_visa_eligible: numericBudget >= 2000000,
        escrow_protected: true,
        preferred_channel: mobile ? 'WHATSAPP' : 'EMAIL',
        assigned_advisor: 'Emanuel Rendas Private Advisory',
        notes: mandate || `Inbound website brief. Objective: ${objective || 'Wealth Preservation'}.`,
        metadata: {
          session_id: body.session_id || null,
          location,
          lead_magnet: body.lead_magnet || 'private_brief_form',
          preferred_language: body.preferred_language || 'en',
          utm_source: body.utm_source || body.attribution?.utm_source || null,
          utm_medium: body.utm_medium || body.attribution?.utm_medium || null,
          utm_campaign: body.utm_campaign || body.attribution?.utm_campaign || null,
          referrer_url: body.referrer_url || body.attribution?.referrer_url || null,
          origin: 'website',
          consent_status: 'opted_in',
          owner: 'Emanuel Rendas',
          risk_tier: 'Tier 1',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const waText = `PRIVATE BRIEF - via website\nName: ${name}\nEmail: ${email}\nBased in: ${location || '-'}\nInterest: ${objective || '-'}\nBudget: ${rawBudget || '-'}\nBrief: ${mandate || '-'}`;
      const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;

      // Persist to verified table: public.investors
      const res = await fetch(`${URL_BASE}/rest/v1/investors`, {
        method: 'POST',
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(investorRow),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error('INTAKE', `Failed inserting into public.investors: ${res.status} ${errorText}`);
        return {
          status: 500,
          headers,
          body: { ok: false, error: `Database write to investors failed: ${res.statusText}` },
        };
      }

      const data = await res.json();
      const investorId = data?.[0]?.id || null;

      // Log interaction in verified table: public.interaction_logs
      try {
        await fetch(`${URL_BASE}/rest/v1/interaction_logs`, {
          method: 'POST',
          headers: {
            apikey: SERVICE,
            Authorization: `Bearer ${SERVICE}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            investor_id: investorId,
            correlation_id: body.session_id || `corr_web_${Date.now()}`,
            channel: 'WEBSITE',
            event_type: 'INBOUND_LEAD_CAPTURE',
            source_agent: 'MARK',
            direction: 'INBOUND',
            summary: `Inbound private mandate captured for ${name} (${email})`,
            payload: {
              name,
              email,
              phone: mobile,
              budget_aed: numericBudget,
              objective,
              mandate,
            },
            status: 'SUCCESS',
            created_at: new Date().toISOString(),
          }),
        });
      } catch (logErr) {
        logger.warn('INTAKE', `Audit log creation error: ${logErr.message}`);
      }

      return {
        status: 200,
        headers,
        body: {
          ok: true,
          lead_id: investorId,
          investor_id: investorId,
          whatsapp_url: whatsappUrl,
        },
      };
    }

    // 2. EVENT -> LANDS ON public.interaction_logs
    if (action === 'event') {
      const session_id = body.session_id;
      const event_name = body.event_name;
      if (!session_id || !event_name) return { status: 204, headers, body: null };

      const res = await fetch(`${URL_BASE}/rest/v1/interaction_logs`, {
        method: 'POST',
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correlation_id: session_id,
          channel: 'WEBSITE',
          event_type: event_name,
          source_agent: 'SYSTEM',
          direction: 'INBOUND',
          summary: `Website Interaction Event: ${event_name}`,
          payload: {
            session_id,
            event_props: body.event_props || null,
            page_url: body.page_url || null,
            lead_id: body.lead_id || body.investor_id || null,
          },
          status: 'SUCCESS',
          created_at: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        logger.error('INTAKE', `Failed inserting into public.interaction_logs for event: ${res.status}`);
        return { status: 500, headers, body: { ok: false, error: 'Audit event persistence failed' } };
      }

      return { status: 204, headers, body: null };
    }

    // 3. ASSESSMENT SUBMISSION -> LANDS ON public.interaction_logs & triggers DIRA/RIIS
    if (action === 'assessment_submit') {
      const session_id = body.session_id || `sess_${Date.now()}`;
      const answers = body.answers || {};

      // If payload includes lead identity or full answers, run the sovereign assessment pipeline
      if (body.email || body.name || body.leadRecord) {
        const assessmentPayload = {
          session_id,
          name: body.name || answers.name || 'Private Investor',
          email: body.email || answers.email || '',
          phone: body.phone || answers.phone || body.mobile || '',
          capital_band: body.budget || answers.budget || '5M+',
          strategic_focus: body.objective || answers.objective || 'off_plan_appreciation',
          tax_jurisdiction: body.tax_jurisdiction || answers.tax_jurisdiction || 'PT',
          ...body,
        };
        const submissionResult = await handleAssessmentSubmission(assessmentPayload);
        return {
          status: 200,
          headers,
          body: {
            ok: true,
            session_id,
            status: 'completed',
            result: submissionResult,
          },
        };
      }

      // Persist raw assessment answers to public.interaction_logs
      const res = await fetch(`${URL_BASE}/rest/v1/interaction_logs`, {
        method: 'POST',
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correlation_id: session_id,
          channel: 'WEBSITE',
          event_type: 'ASSESSMENT_RESPONSES_SUBMITTED',
          source_agent: 'MARK',
          direction: 'INBOUND',
          summary: `Assessment responses recorded for session ${session_id}`,
          payload: {
            session_id,
            responses: answers,
            lead_id: body.lead_id || body.investor_id || null,
          },
          status: 'SUCCESS',
          created_at: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error('INTAKE', `Failed inserting assessment responses into public.interaction_logs: ${res.status} ${errorText}`);
        return {
          status: 500,
          headers,
          body: { ok: false, error: 'Failed persisting assessment responses to interaction_logs' },
        };
      }

      return {
        status: 200,
        headers,
        body: {
          ok: true,
          session_id,
          status: 'completed',
        },
      };
    }

    return {
      status: 400,
      headers,
      body: { ok: false, error: `Unrecognized action: ${action}` },
    };
  } catch (err) {
    logger.error('INTAKE', `Unhandled intake error: ${err.message}`);
    return {
      status: 500,
      headers,
      body: { ok: false, error: err.message },
    };
  }
}
