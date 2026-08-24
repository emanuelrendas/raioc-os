/**
 * Vercel Serverless Entrypoint - RAIOC OS Web API
 * Dispatches all serverless invocations into the routeApiRequest router.
 */

import { routeApiRequest } from '../src/api/server.js';

export default async function handler(req, res) {
  const url = req.url || '/';
  const method = req.method || 'GET';
  const headers = req.headers || {};
  const query = req.query || {};
  const body = req.body || {};

  try {
    const response = await routeApiRequest(url, method, body, query, headers);

    if (response.headers) {
      for (const [k, v] of Object.entries(response.headers)) {
        res.setHeader(k, v);
      }
    }

    const contentType = response.headers?.['Content-Type'] || 'application/json';
    res.status(response.status);

    if (contentType.includes('text/html') || typeof response.body === 'string') {
      res.setHeader('Content-Type', contentType);
      res.send(response.body);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.json(response.body);
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal Serverless Execution Error', message: err.message });
  }
}
