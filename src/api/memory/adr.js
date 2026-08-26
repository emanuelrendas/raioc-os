/**
 * RAIOC OS - Architectural Decision Records (ADR) API Gateway (Sprint 2 Core)
 * Provides programmatic inspection and creation of architectural decision logs.
 * 
 * Endpoints:
 * - GET  /api/v1/memory/adr
 * - GET  /api/v1/memory/adr/:id
 * - POST /api/v1/memory/adr
 */

import { supabase } from '../../db/supabase-client.js';
import { authMiddleware } from '../../security/auth-middleware.js';
import { logger } from '../../logging/audit-logger.js';

export async function handleMemoryAdrRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  // Extract ADR ID if path like /api/v1/memory/adr/ADR-001 or /api/memory/adr/ADR-001
  const parts = url.split('/').filter(Boolean);
  const adrIndex = parts.indexOf('adr');
  const adrIdParam = adrIndex !== -1 && parts.length > adrIndex + 1 ? parts[adrIndex + 1] : null;

  if (method === 'GET') {
    if (adrIdParam) {
      const adr = await supabase.getMemoryAdr(adrIdParam.toUpperCase());
      if (!adr) {
        return { status: 404, body: { success: false, error: `ADR '${adrIdParam}' not found` } };
      }
      return { status: 200, body: { success: true, adr } };
    }

    const filter = {};
    if (query.status) filter.status = query.status.toUpperCase();
    const adrs = await supabase.fetchMemoryAdrs(filter);

    return {
      status: 200,
      body: {
        success: true,
        adrs,
        count: adrs.length,
        timestamp: new Date().toISOString(),
      },
    };
  }

  if (method === 'POST') {
    const auth = authMiddleware.authenticateRequest(headers);
    if (!auth.authenticated) {
      return { status: 401, body: { success: false, error: 'Unauthorized: ADR modification requires authentication' } };
    }

    const adrId = body.adr_id || body.id || adrIdParam;
    if (!adrId || !body.title || !body.decision) {
      return { status: 400, body: { success: false, error: 'adr_id, title, and decision are required' } };
    }

    const upserted = await supabase.upsertMemoryAdr({
      adr_id: adrId.toUpperCase(),
      title: body.title,
      status: (body.status || 'ACCEPTED').toUpperCase(),
      context: body.context || '',
      decision: body.decision,
      consequences: body.consequences || '',
      author: body.author || 'CTO (Gemini)',
    });

    logger.info('ADR_LEDGER', `ADR registered/updated: ${upserted.adr_id} - ${upserted.title}`);

    return {
      status: 200,
      body: {
        success: true,
        adr: upserted,
      },
    };
  }

  return { status: 405, body: { success: false, error: `Method ${method} not allowed on ADR ledger` } };
}
