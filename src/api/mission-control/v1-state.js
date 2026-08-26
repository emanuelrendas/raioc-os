/**
 * RAIOC OS - Mission Control V1 Consolidated State API (Compatibility Alias)
 * Legacy Route: GET /api/mission-control/v1-state
 * Canonical Route: GET /api/v1/mission-control/v1-state
 */

import { handleMissionControlV1State as handleCanonicalV1State } from '../v1/mission-control/v1-state.js';

export async function handleMissionControlV1State(url, method = 'GET', body = {}, query = {}, headers = {}) {
  const result = await handleCanonicalV1State(url, method, body, query, headers);
  return {
    ...result,
    headers: {
      ...(result.headers || { 'Content-Type': 'application/json' }),
      Deprecation: 'true',
      Link: '</api/v1/mission-control/v1-state>; rel="canonical"',
    },
  };
}
