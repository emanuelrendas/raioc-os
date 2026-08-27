/**
 * Vercel Serverless Entrypoint - RAIOC OS
 * Explicitly protects root '/' to serve index.html (public website),
 * '/dashboard' to serve the Executive Command Center,
 * and '/api/*' to route through the unified API router.
 */

import fs from 'node:fs';
import path from 'node:path';
import { routeApiRequest } from '../src/api/server.js';
import { renderCommandCenterHtml } from '../src/dashboard/command-center-html.js';
import { renderExecutiveBriefHtml } from '../src/site/brief-viewer-html.js';
import { renderMissionControlHtml } from '../src/site/mission-control-html.js';
import { supabase } from '../src/db/supabase-client.js';
import { sitePages } from '../src/site/site-pages.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
    responseLimit: '15mb',
  },
};

export default async function handler(req, res) {
  const headers = req.headers || {};
  let query = req.query || {};
  const method = req.method || 'GET';
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }
  const host = (headers['x-forwarded-host'] || headers.host || '').toLowerCase();

  // Set Global Security & Permissions Headers
  if (typeof res.setHeader === 'function') {
    res.setHeader('Permissions-Policy', 'microphone=*, camera=(), geolocation=()');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  // Extract query parameters from req.url if req.query was not passed
  if (Object.keys(query).length === 0 && req.url && req.url.includes('?')) {
    try {
      const rawQuery = req.url.split('?')[1];
      const params = new URLSearchParams(rawQuery);
      query = Object.fromEntries(params.entries());
    } catch {
      // fallback
    }
  }

  // Extract and normalize incoming requested URL from query parameter, route matches, or headers
  let url = query.__path || headers['x-matched-path'] || req.url || '/';

  // Check if Vercel matched a named parameter 'id' or route matches header for /brief/:id
  let matchedBriefId = null;
  if (query.id) {
    matchedBriefId = Array.isArray(query.id) ? query.id.join('/') : String(query.id);
  } else if (headers['x-now-route-matches']) {
    const rm = String(headers['x-now-route-matches']);
    const match = rm.match(/id=([^&]+)/) || rm.match(/1=([^&]+)/);
    if (match) matchedBriefId = decodeURIComponent(match[1]);
  }

  if (matchedBriefId && (matchedBriefId.startsWith('brief') || String(req.url).includes('/brief') || headers['x-matched-path']?.includes('/brief'))) {
    url = `/brief/${matchedBriefId}`;
  }

  url = url.split('?')[0]; // strip query string for route matching
  url = url.replace(/^\/api\/api\//, '/api/');

  // 1. Brief Viewer (/brief/:id, /api/brief/:id, or any request with brief id)
  const isBriefRequest = url.startsWith('/brief') || url.startsWith('/api/brief') || url.includes('/brief/') || Boolean(matchedBriefId && matchedBriefId.startsWith('brief'));
  if (isBriefRequest && method === 'GET') {
    let briefId = matchedBriefId;
    if (!briefId) {
      const match = url.match(/\/brief\/([^\/\?]+)/);
      briefId = match ? match[1] : url.replace(/^\/(api\/)?brief\/?/, '').split('/')[0].split('?')[0];
    }
    briefId = (briefId || '').trim();

    const briefRecord = await supabase.fetchExecutiveBriefById(briefId);
    const briefHtml = renderExecutiveBriefHtml(briefRecord || { id: briefId, companyName: 'Private Sovereign Investor' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.status(200);
    return typeof res.send === 'function' ? res.send(briefHtml) : res.end(briefHtml);
  }

  // 1b. Executive Mission Control UI (/admin/mission-control, /mission-control)
  if (url === '/admin/mission-control' || url === '/mission-control' || url === '/admin/mission-control.html' || url === '/mission-control.html' || url === '/api/mission-control/ui') {
    const mcHtml = (sitePages && sitePages['mission-control']) ? sitePages['mission-control'] : renderMissionControlHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200);
    return typeof res.send === 'function' ? res.send(mcHtml) : res.end(mcHtml);
  }

  // 2. Dashboard Subdomain (dashboard.emanuelrendas.com) or '/dashboard'
  if (host.includes('dashboard') || url === '/dashboard' || url === '/dashboard/' || url === '/dashboard.html' || url === '/api/dashboard/ui') {
    let dashHtml = (sitePages && sitePages.dashboard) ? sitePages.dashboard : '';
    if (!dashHtml) {
      try {
        const candidates = [
          path.resolve('public/dashboard.html'),
          path.resolve('dashboard.html'),
        ];
        for (const p of candidates) {
          if (fs.existsSync(p)) {
            dashHtml = fs.readFileSync(p, 'utf8');
            break;
          }
        }
      } catch {
        // fallback
      }
    }
    if (!dashHtml) {
      dashHtml = renderCommandCenterHtml();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200);
    return typeof res.send === 'function' ? res.send(dashHtml) : res.end(dashHtml);
  }

  // 2. API Subdomain Normalization (api.emanuelrendas.com)
  if (host.startsWith('api.')) {
    if (url === '/' || url === '' || url === '/status') {
      url = '/api/executive/status';
    } else if (url === '/connectors') {
      url = '/api/executive/connectors';
    } else if (url === '/pipeline') {
      url = '/api/executive/pipeline';
    } else if (url === '/alerts') {
      url = '/api/executive/alerts';
    } else if (url === '/kpis') {
      url = '/api/executive/kpis';
    } else if (url === '/chat') {
      url = '/api/executive/chat';
    } else if (url === '/health') {
      url = '/api/health';
    } else if (!url.startsWith('/api/')) {
      url = `/api${url}`;
    }
  }

  // 3. Static Web Pages & Assets on public website (www.emanuelrendas.com / emanuelrendas.com)
  if (!host.startsWith('api.') && !host.startsWith('dashboard.')) {
    // Hard guard: Never fall back to static pages or index.html for brief routes
    if (url.startsWith('/brief') || url.includes('/brief/')) {
      const briefId = url.replace(/^\/(api\/)?brief\/?/, '').split('/')[0].split('?')[0] || 'default';
      const briefRecord = await supabase.fetchExecutiveBriefById(briefId);
      const briefHtml = renderExecutiveBriefHtml(briefRecord || { id: briefId, companyName: 'Private Sovereign Investor' });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
      res.status(200);
      return typeof res.send === 'function' ? res.send(briefHtml) : res.end(briefHtml);
    }

    let cleanKey = url.replace(/^\//, '').replace(/\.html$/, '').split('?')[0].toLowerCase();
    if (cleanKey === '' || cleanKey === 'index') cleanKey = 'index';

    if (sitePages && sitePages[cleanKey]) {
      const html = sitePages[cleanKey];
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      res.status(200);
      return typeof res.send === 'function' ? res.send(html) : res.end(html);
    }

    // Static assets fallback
    if (url.startsWith('/assets/') || url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.svg')) {
      try {
        const cleanPath = url.replace(/^\//, '');
        const candidates = [
          path.resolve('public', cleanPath),
          path.resolve(cleanPath),
        ];
        for (const p of candidates) {
          if (fs.existsSync(p)) {
            const fileBuf = fs.readFileSync(p);
            let mimeType = 'text/plain';
            if (p.endsWith('.css')) mimeType = 'text/css';
            else if (p.endsWith('.js')) mimeType = 'application/javascript';
            else if (p.endsWith('.jpg') || p.endsWith('.jpeg')) mimeType = 'image/jpeg';
            else if (p.endsWith('.png')) mimeType = 'image/png';
            else if (p.endsWith('.svg')) mimeType = 'image/svg+xml';
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.status(200);
            return typeof res.send === 'function' ? res.send(fileBuf) : res.end(fileBuf);
          }
        }
      } catch {
        // Fallback
      }
    }
  }

  // 4. API & Telemetry Routes
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
      if (typeof res.send === 'function') {
        res.send(response.body);
      } else {
        res.end(response.body);
      }
    } else {
      res.setHeader('Content-Type', 'application/json');
      if (typeof res.json === 'function') {
        res.json(response.body);
      } else {
        res.end(JSON.stringify(response.body));
      }
    }
  } catch (err) {
    res.status(500);
    const errPayload = { error: 'Internal Serverless Execution Error', message: err.message };
    if (typeof res.json === 'function') {
      res.json(errPayload);
    } else {
      res.end(JSON.stringify(errPayload));
    }
  }
}
