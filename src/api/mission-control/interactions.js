/**
 * RAIOC OS - Mission Control Interaction Stream API
 * Serves real-time ingestion pulse feeds and multi-channel interaction history.
 * 
 * Endpoints:
 * - GET /api/mission-control/interactions
 */

import { supabase } from '../../db/supabase-client.js';
import { authMiddleware, Roles } from '../../security/auth-middleware.js';

export async function handleInteractionsRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  if (method !== 'GET') {
    return {
      status: 405,
      body: { success: false, error: `Method ${method} not allowed on interactions stream` },
    };
  }

  // MISSION-016: this stream carries client communication history. Its sibling
  // handlers (approvals, fleet) already authenticate; this one did not.
  const auth = authMiddleware.authenticateRequest(headers, [Roles.ADMIN, Roles.AGENT]);
  if (!auth.authenticated) {
    return {
      status: 401,
      body: {
        success: false,
        error: 'Unauthorized: interaction history requires authentication',
        details: auth.error,
      },
    };
  }

  const limit = Math.min(Number(query.limit) || 15, 50);
  const interactions = await supabase.fetchInteractionLogs(limit);

  return {
    status: 200,
    body: {
      success: true,
      interactions,
      count: interactions.length,
      limit,
      timestamp: new Date().toISOString(),
    },
  };
}
