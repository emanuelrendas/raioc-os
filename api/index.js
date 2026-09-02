/**
 * Vercel Serverless Entrypoint - RAIOC OS (Security Hardened)
 * Explicitly protects root '/' to serve index.html (public website),
 * serves the '/dashboard' and '/admin/mission-control' HTML shells
 * unauthenticated so a browser can load them, and routes through the unified
 * API router, where '/api/executive/*', '/api/dashboard/*', '/api/telemetry/*'
 * and '/api/chat' remain authenticated.
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

  // Blocked / Deleted test endpoint: /api/test-email
  if (url === '/api/test-email' || url === '/test-email') {
    res.setHeader('Content-Type', 'application/json');
    res.status(404);
    return res.json ? res.json({ error: 'Endpoint deleted or disabled' }) : res.end(JSON.stringify({ error: 'Endpoint deleted or disabled' }));
  }

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
  // HTML shell only, served unauthenticated so a normal browser can load the
  // page. Every data path it calls (/api/v1/mission-control/*, /api/executive/*,
  // /api/dashboard/*) stays authenticated in src/api/server.js.
  if (url === '/admin/mission-control' || url === '/mission-control' || url === '/admin/mission-control.html' || url === '/mission-control.html' || url === '/api/mission-control/ui') {
    const mcHtml = (sitePages && sitePages['mission-control']) ? sitePages['mission-control'] : renderMissionControlHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200);
    return typeof res.send === 'function' ? res.send(mcHtml) : res.end(mcHtml);
  }

  // 2. Dashboard Subdomain (dashboard.emanuelrendas.com) or '/dashboard'
  // HTML shell only, served unauthenticated so a normal browser can load the
  // page. '/api/*' paths on the dashboard host are excluded here so they fall
  // through to the API router below and keep their authentication.
  if ((host.includes('dashboard') && !url.startsWith('/api/')) || url === '/dashboard' || url === '/dashboard/' || url === '/dashboard.html' || url === '/api/dashboard/ui') {
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

  // 2b. API Subdomain Normalization (api.emanuelrendas.com)
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

  // 3. API Route Execution via Internal Unified Router
  if (url.startsWith('/api/') || url === '/api' || url.startsWith('/healthz')) {
    const apiResponse = await routeApiRequest(url, method, body, query, headers);

    if (apiResponse.headers) {
      for (const [k, v] of Object.entries(apiResponse.headers)) {
        res.setHeader(k, v);
      }
    }

    res.status(apiResponse.status || 200);
    const contentType = apiResponse.headers?.['Content-Type'] || 'application/json';
    if (contentType.includes('text/html') || typeof apiResponse.body === 'string') {
      return typeof res.send === 'function' ? res.send(apiResponse.body) : res.end(apiResponse.body);
    }
    return typeof res.json === 'function' ? res.json(apiResponse.body) : res.end(JSON.stringify(apiResponse.body));
  }

  // 4. Static Pages & Assets Delivery
  // ARCHITECTURE: Decision B (locked) — site-pages.js is the canonical production source of truth.
  // Root .html files are authoring-only and are NOT consulted for HTML page serving.
  // Assets (CSS, JS, images, fonts) are served from disk as before.
  const urlExt = path.extname(url).toLowerCase();
  const isAssetRequest = urlExt && urlExt !== '.html';

  // 4-pre. Asset-First Exit: CSS, JS, images, fonts resolve from disk before any page lookup.
  // Assets are NOT in the bundle — they must be read from disk.
  if (isAssetRequest) {
    try {
      const candidateAssetPaths = [
        path.resolve(url.replace(/^\//, '')),
        path.resolve(`public/${url.replace(/^\//, '')}`),
      ];
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.json': 'application/json',
        '.js': 'application/javascript',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.txt': 'text/plain',
        '.xml': 'application/xml',
        '.pdf': 'application/pdf',
      };
      for (const filePath of candidateAssetPaths) {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const contentType = mimeTypes[urlExt] || 'application/octet-stream';
          const content = fs.readFileSync(filePath);
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
          res.status(200);
          return res.end(content);
        }
      }
    } catch (_) {}
    // Asset not found — fail closed, no HTML fallback
    res.setHeader('Content-Type', 'application/json');
    res.status(404);
    return res.end(JSON.stringify({ error: 'Asset not found', path: url }));
  }

  // 4a. HTML Page Serving — Bundle-Primary (Decision B, canonical)
  // site-pages.js is the sole production source. No filesystem read for HTML.
  // To update a page: edit .html → run tools/sync-site-pages.mjs → commit both → deploy.
  const cleanPath = url.replace(/^\//, '').replace(/\.html$/, '') || 'index';
  const pageHtml = sitePages?.[cleanPath];

  if (pageHtml) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.status(200);
    return typeof res.send === 'function' ? res.send(pageHtml) : res.end(pageHtml);
  }

  // 4b. Page not in bundle — fail closed (404), no silent disk fallback
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(404);
  const fallback404 = sitePages?.index ?? '<h1>404 - Page Not Found</h1>';
  return typeof res.send === 'function' ? res.send(fallback404) : res.end(fallback404);
}
