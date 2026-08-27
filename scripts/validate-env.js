#!/usr/bin/env node
/**
 * RAIOC OS - Environment & Infrastructure Validation Script
 * Verifies Node.js runtime, configuration integrity, security rules, and adapter readiness.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { secretsManager } from '../src/config/secrets-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isProd = process.env.NODE_ENV === 'production';

console.log('\n=============================================================');
console.log('🏛 RAIOC OS — INSTITUTIONAL ENVIRONMENT & SECURITY VALIDATION');
console.log('=============================================================\n');

let hasErrors = false;
const diagnostics = [];

// 1. Node.js Version Check
const nodeVersion = process.versions.node;
const [major] = nodeVersion.split('.').map(Number);
if (major < 18) {
  console.error(`❌ [FAIL] Unsupported Node.js version: v${nodeVersion}. Minimum required is v18.0.0.`);
  hasErrors = true;
} else {
  diagnostics.push({ check: 'Node.js Runtime', status: 'PASS', details: `v${nodeVersion}` });
}

// 2. Critical Configuration Files Integrity
const requiredConfigs = [
  'src/config/corridor-benchmarks.json',
  'src/config/dm-triage-rules.json',
  'src/config/aida-voice-templates.json',
  'src/config/vip-dispatch-templates.json',
];

for (const relPath of requiredConfigs) {
  const fullPath = path.resolve(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ [FAIL] Missing required config file: ${relPath}`);
    hasErrors = true;
  } else {
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      diagnostics.push({ check: `Config: ${relPath}`, status: 'PASS', details: `${Object.keys(parsed).length} top-level keys` });
    } catch (err) {
      console.error(`❌ [FAIL] Invalid JSON in ${relPath}: ${err.message}`);
      hasErrors = true;
    }
  }
}

// 3. Security & Fail-Closed Checks
const internalSecret = process.env.RAIOC_INTERNAL_SECRET || process.env.INTERNAL_SERVICE_KEY || '';
if (isProd && (!internalSecret || internalSecret === 'raioc_sec_default_dev_key')) {
  console.error('❌ [FAIL] Production security violation: RAIOC_INTERNAL_SECRET is missing or using deprecated dev key.');
  hasErrors = true;
} else {
  diagnostics.push({
    check: 'Internal Service Secret',
    status: 'PASS',
    details: internalSecret ? secretsManager.mask(internalSecret) : '[DEV_MOCK_READY]',
  });
}

// 4. Supabase Configuration Check
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (isProd && (!supabaseUrl || !supabaseKey)) {
  console.error('❌ [FAIL] Production requires live Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
  hasErrors = true;
} else {
  diagnostics.push({
    check: 'Database / Supabase',
    status: 'PASS',
    details: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : '[IN-MEMORY STORE / SANDBOX MODE]',
  });
}

// 5. Adapters Readiness (WhatsApp, ElevenLabs, Gemini, SMTP)
const whatsappToken = process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

diagnostics.push({
  check: 'WhatsApp Adapter',
  status: 'PASS',
  details: whatsappToken ? `LIVE (${secretsManager.mask(whatsappToken)})` : 'SIMULATED_SANDBOX (Deterministic)',
});

diagnostics.push({
  check: 'ElevenLabs Neural TTS',
  status: 'PASS',
  details: elevenLabsKey ? `LIVE (${secretsManager.mask(elevenLabsKey)})` : 'SIMULATED_SANDBOX (Deterministic SHA-256)',
});

diagnostics.push({
  check: 'Gemini AI Advisor',
  status: 'PASS',
  details: geminiKey ? `LIVE (${secretsManager.mask(geminiKey)})` : 'JARVIS_COGNITIVE_SYNTHESIS (Local Engine)',
});

// Output formatted table
console.table(diagnostics);

if (hasErrors) {
  console.error('\n❌ Environment validation FAILED with errors. Review output above.\n');
  process.exit(1);
} else {
  console.log('\n✅ All environment and configuration checks passed successfully (Code 0).\n');
  process.exit(0);
}
