/**
 * Vercel Serverless Entrypoint - RAIOC OS (Security Hardened)
 * Explicitly protects root '/' to serve index.html (public website),
 * requires authentication for '/dashboard', '/admin/mission-control', and '/api/executive/*',
 * and routes through the unified API router.
 */

import fs from 'node:fs';
import path from 'node:path';
import { routeApiRequest } from '../src/api/server.js';
import { renderCommandCenterHtml } from '../src/dashboard/command-center-html.js';
import { renderExecutiveBriefHtml } from '../src/site/brief-viewer-html.js';
import { renderMissionControlHtml } from '../src/site/mission-control-html.js';
import { supabase } from '../src/db/supabase-client.js';
import { sitePages } from '../src/site/site-pages.js';
import { authMiddleware, Roles } from '../src/security/auth-middleware.js';

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

  // 1b. Executive Mission Control UI (/admin/mission-control, /mission-control) -> PROTECTED
  if (url === '/admin/mission-control' || url === '/mission-control' || url === '/admin/mission-control.html' || url === '/mission-control.html' || url === '/api/mission-control/ui') {
    const auth = authMiddleware.authenticateRequest(headers, [Roles.ADMIN, Roles.AGENT]);
    if (!auth.authenticated) {
      res.setHeader('Content-Type', 'application/json');
      res.status(401);
      return res.json ? res.json({ success: false, error: 'Unauthorized: Mission Control requires authentication', details: auth.error }) : res.end(JSON.stringify({ success: false, error: 'Unauthorized', details: auth.error }));
    }

    const mcHtml = (sitePages && sitePages['mission-control']) ? sitePages['mission-control'] : renderMissionControlHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200);
    return typeof res.send === 'function' ? res.send(mcHtml) : res.end(mcHtml);
  }

  // 2. Dashboard Subdomain (dashboard.emanuelrendas.com) or '/dashboard' -> PROTECTED
  if (host.includes('dashboard') || url === '/dashboard' || url === '/dashboard/' || url === '/dashboard.html' || url === '/api/dashboard/ui') {
    const auth = authMiddleware.authenticateRequest(headers, [Roles.ADMIN, Roles.AGENT]);
    if (!auth.authenticated) {
      res.setHeader('Content-Type', 'application/json');
      res.status(401);
      return res.json ? res.json({ success: false, error: 'Unauthorized: Executive Dashboard requires authentication', details: auth.error }) : res.end(JSON.stringify({ success: false, error: 'Unauthorized', details: auth.error }));
    }

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

  // 4. Static Website Pages & Assets Delivery (Disk-First Source of Truth)
  const urlExt = path.extname(url).toLowerCase();
  const isAssetRequest = urlExt && urlExt !== '.html';

  // 4-pre. Asset-First Exit: CSS, JS, images, fonts must resolve before any HTML page lookup
  // This prevents non-HTML files (e.g. site.css) from being accidentally served as text/html.
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
    // Asset not found — return 404 without falling through to HTML resolution
    res.setHeader('Content-Type', 'application/json');
    res.status(404);
    return res.end(JSON.stringify({ error: 'Asset not found', path: url }));
  }

  const cleanPath = url.replace(/^\//, '').replace(/\.html$/, '') || 'index';

  // 4a. Check Disk for Canonical HTML Page (Source of Truth)
  const candidateHtmlPaths = [
    path.resolve(`${cleanPath}.html`),
    path.resolve(`public/${cleanPath}.html`),
  ];

  for (const p of candidateHtmlPaths) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const pageHtml = fs.readFileSync(p, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
        res.status(200);
        return typeof res.send === 'function' ? res.send(pageHtml) : res.end(pageHtml);
      }
    } catch (_) {}
  }

  // 4b. Bundled Fallback (If Disk Read Fails or Running in Bundled Serverless)
  if (sitePages && sitePages[cleanPath]) {
    const pageHtml = sitePages[cleanPath];
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.status(200);
    return typeof res.send === 'function' ? res.send(pageHtml) : res.end(pageHtml);
  }

  // 404 Fallback
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(404);
  const fallback404 = (sitePages && sitePages.index) ? sitePages.index : '<h1>404 - Page Not Found</h1>';
  return typeof res.send === 'function' ? res.send(fallback404) : res.end(fallback404);
}
