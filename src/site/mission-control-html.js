import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * RAIOC OS — Executive Mission Control V2 (Bloomberg Terminal x Linear Luxury Command Center)
 * Pre-compiled Zero-I/O renderer for `/admin/mission-control` and `/mission-control`.
 * 24/7 Wall-Screen Ultra-Luxury Dashboard featuring:
 * - 6 Modular Navigation Tabs (Overview, CRM Kanban, Agent Fleet Matrix, Ingestion Pulse, Approvals, Infrastructure)
 * - Live World Clocks (DXB, LON, LIS, NYC) with UTC offset indicators
 * - Interactive Slide-Over Drawers & Modals (Agent Drawer, Lead Dossier, Event JSON Inspector, Command Palette)
 * - Real-time Sparklines, DIRA Risk score gauges, and 1-click Quick Action triggers
 * - Zero-flicker client-side state controller with localStorage persistence & PII Masking toggle
 */

let cachedHtml = null;

export function renderMissionControlHtml() {
  if (cachedHtml) return cachedHtml;

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const localHtmlPath = path.resolve(__dirname, '../../mission-control.html');
    if (fs.existsSync(localHtmlPath)) {
      cachedHtml = fs.readFileSync(localHtmlPath, 'utf8');
      return cachedHtml;
    }
  } catch (_) {}

  try {
    const cwdPath = path.resolve(process.cwd(), 'mission-control.html');
    if (fs.existsSync(cwdPath)) {
      cachedHtml = fs.readFileSync(cwdPath, 'utf8');
      return cachedHtml;
    }
  } catch (_) {}

  return cachedHtml || '';
}
