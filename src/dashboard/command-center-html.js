/**
 * RAIOC Executive Command Center (Sprint 3)
 * Authoritative renderer linked to canonical sitePages and dashboard.html.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitePages } from '../site/site-pages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

export function renderCommandCenterHtml() {
  if (sitePages && sitePages.dashboard) {
    return sitePages.dashboard;
  }
  const dashboardPath = path.join(ROOT, 'dashboard.html');
  if (fs.existsSync(dashboardPath)) {
    return fs.readFileSync(dashboardPath, 'utf8');
  }
  return '<!DOCTYPE html><html><head><title>RAIOC Dashboard</title></head><body><h1>RAIOC Dashboard</h1></body></html>';
}
