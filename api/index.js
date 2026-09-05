/**
 * Vercel Serverless Entrypoint - RAIOC OS (Security Hardened)
 * Explicitly protects root '/' to serve index.html (public website),
 * requires authentication for '/dashboard', '/admin/mission-control', and '/api/executive/*',
 * and routes through the unified API router.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

// MISSION-016 (security): the asset handler previously passed the caller-controlled
// path straight to path.resolve(), so '/../secret.txt' escaped the application root
// and '/src/config/secrets-manager.js' served source code to any anonymous caller.
// Assets are now confined to an explicit set of roots plus a named allowlist of
// root-level files, and only declared media types are servable.
const ASSET_MIME_TYPES = {
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
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

// Directories whose contents may be served in full.
const ASSET_ROOTS = ['assets', 'public'];

// Individual files at the project root that the public site legitimately requests.
const ROOT_FILE_ALLOWLIST = new Set([
  'og.jpg',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'favicon.ico',
]);

/**
 * Roots to resolve an asset against, in order of trust.
 *
 * The first is derived from this module's own location and does not depend on
 * the working directory: this file lives at <root>/api/index.js, so its parent's
 * parent is the project root wherever the bundle is unpacked. The second is the
 * working directory, kept as a fallback for a host that relocates the entry
 * point away from the sources it ships.
 *
 * MISSION-016 originally used path.resolve() alone, which is process.cwd(). That
 * matched the pre-existing behaviour and works when the platform runs the
 * function from the project root, but it is silent and total when it does not:
 * every asset resolves to null and the site loads with no stylesheet at all.
 * Verified before this change: from any working directory other than the project
 * root, /assets/site.css, /assets/site.js, /robots.txt and /og.jpg all returned
 * null. Confinement is unaffected — each candidate root is still checked with
 * the same startsWith guard.
 */
const PROJECT_ROOTS = [...new Set([
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  path.resolve(),
])];

function isReadableFile(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolves a request path to a file on disk, or null when the request is not a
 * legitimate asset request. Fail-closed: anything not provably inside an allowed
 * root, and not on the root allowlist, resolves to null.
 *
 * @param {string} requestPath - caller-controlled path, e.g. '/assets/site.css'
 * @returns {{ filePath: string, contentType: string } | null}
 */
export function resolveAssetPath(requestPath) {
  const withoutQuery = String(requestPath ?? '').split('?')[0];
  const ext = path.extname(withoutQuery).toLowerCase();
  const contentType = ASSET_MIME_TYPES[ext];
  if (!contentType) return null;

  // Collapse the path and drop leading separators before any check runs.
  const normalized = path.normalize(withoutQuery).replace(/^[/\\]+/, '');

  // Reject empty paths, null bytes, surviving traversal segments, absolute paths.
  if (!normalized || normalized.includes('\0')) return null;
  if (normalized.split(/[/\\]/).some((segment) => segment === '..')) return null;
  if (path.isAbsolute(normalized)) return null;

  const segments = normalized.split(/[/\\]/);

  for (const projectRoot of PROJECT_ROOTS) {
    // Case 1: a named file at the project root.
    if (segments.length === 1) {
      if (!ROOT_FILE_ALLOWLIST.has(segments[0])) return null;
      const filePath = path.join(projectRoot, segments[0]);
      if (isReadableFile(filePath)) return { filePath, contentType };
      continue;
    }

    // Case 2: a file inside an allowed asset root. The resolved path is verified
    // to sit under that root, so a crafted segment cannot climb back out.
    for (const root of ASSET_ROOTS) {
      const rootDir = path.resolve(projectRoot, root);
      const filePath = segments[0] === root
        ? path.resolve(projectRoot, normalized)
        : path.resolve(rootDir, normalized);

      if (!filePath.startsWith(rootDir + path.sep)) continue;
      if (isReadableFile(filePath)) return { filePath, contentType };
    }
  }

  return null;
}

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

  // 4. Static Pages & Assets Delivery
  // ARCHITECTURE: Decision B (locked) — site-pages.js is the canonical production source of truth.
  // Root .html files are authoring-only and are NOT consulted for HTML page serving.
  // Assets (CSS, JS, images, fonts) are served from disk as before.
  const urlExt = path.extname(url).toLowerCase();
  const isAssetRequest = urlExt && urlExt !== '.html';

  // 4-pre. Asset-First Exit: CSS, JS, images, fonts resolve from disk before any page lookup.
  // Assets are NOT in the bundle — they must be read from disk. resolveAssetPath is
  // fail-closed: it returns null for anything outside the allowed roots, so a rejected
  // path and a missing file are indistinguishable to the caller.
  if (isAssetRequest) {
    const resolved = resolveAssetPath(url);
    if (resolved) {
      try {
        const content = fs.readFileSync(resolved.filePath);
        res.setHeader('Content-Type', resolved.contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        res.status(200);
        return res.end(content);
      } catch (_) {
        // Fall through to the 404 below rather than leaking a read error.
      }
    }
    // Not an allowed asset, or not present — fail closed, no HTML fallback.
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
