/**
 * Live Infrastructure Probing Script (Zero Mock Policy)
 * Tests every real production connector, gathers real network responses, latency, and status.
 */

import { config } from '../src/config/env.js';
import { secretsManager } from '../src/config/secrets-manager.js';

async function auditLiveConnectors() {
  console.log('=== RAIOC PRODUCTION ACTIVATION SPRINT 1: LIVE CONNECTOR PROBE ===\n');

  const results = {
    timestamp: new Date().toISOString(),
    connectors: {},
  };

  // 1. Supabase Live Probe
  console.log('1. Probing Supabase Production Database...');
  const supabaseUrl = process.env.SUPABASE_URL || config.supabase.url;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabase.serviceKey || config.supabase.anonKey;

  if (!supabaseUrl || !supabaseKey) {
    results.connectors.supabase = {
      status: 'BLOCKED_MISSING_CREDENTIALS',
      url: supabaseUrl || '[NOT_SET]',
      keyMasked: secretsManager.mask(supabaseKey),
      blocker: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable is not configured in process environment.',
    };
  } else {
    try {
      const t0 = Date.now();
      const res = await fetch(`${supabaseUrl}/rest/v1/leads?select=id&limit=1`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      const latencyMs = Date.now() - t0;
      results.connectors.supabase = {
        status: res.ok ? 'ACTIVE' : 'HTTP_ERROR',
        httpStatus: res.status,
        latencyMs,
        url: supabaseUrl,
        payload: await res.text(),
      };
    } catch (err) {
      results.connectors.supabase = {
        status: 'NETWORK_ERROR',
        error: err.message,
        url: supabaseUrl,
      };
    }
  }

  // 2. n8n Live Probe
  console.log('2. Probing n8n Webhook Infrastructure...');
  const n8nUrl = process.env.N8N_WEBHOOK_URL || config.n8n.webhookUrl;
  if (!n8nUrl) {
    results.connectors.n8n = {
      status: 'BLOCKED_MISSING_CREDENTIALS',
      url: '[NOT_SET]',
      blocker: 'N8N_WEBHOOK_URL is not set in environment.',
    };
  } else {
    try {
      const t0 = Date.now();
      const res = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'ping', timestamp: new Date().toISOString() }),
      });
      const latencyMs = Date.now() - t0;
      results.connectors.n8n = {
        status: res.ok ? 'ACTIVE' : 'HTTP_ERROR',
        httpStatus: res.status,
        latencyMs,
        url: n8nUrl,
        response: await res.text(),
      };
    } catch (err) {
      results.connectors.n8n = {
        status: 'NETWORK_ERROR',
        error: err.message,
        url: n8nUrl,
      };
    }
  }

  // 3. Gmail Live Probe
  console.log('3. Probing Gmail OAuth Integration...');
  const gmailClientId = process.env.GMAIL_CLIENT_ID || config.google.gmail.clientId;
  const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET || config.google.gmail.clientSecret;
  const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN || config.google.gmail.refreshToken;

  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken) {
    results.connectors.gmail = {
      status: 'BLOCKED_MISSING_CREDENTIALS',
      blocker: 'GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN is not configured.',
      configuredFields: {
        clientId: Boolean(gmailClientId),
        clientSecret: Boolean(gmailClientSecret),
        refreshToken: Boolean(gmailRefreshToken),
      },
    };
  } else {
    try {
      const t0 = Date.now();
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: gmailClientId,
          client_secret: gmailClientSecret,
          refresh_token: gmailRefreshToken,
          grant_type: 'refresh_token',
        }),
      });
      const tokenData = await tokenRes.json();
      const latencyMs = Date.now() - t0;
      results.connectors.gmail = {
        status: tokenRes.ok ? 'ACTIVE' : 'AUTH_FAILED',
        httpStatus: tokenRes.status,
        latencyMs,
        tokenReceived: Boolean(tokenData.access_token),
      };
    } catch (err) {
      results.connectors.gmail = {
        status: 'AUTH_ERROR',
        error: err.message,
      };
    }
  }

  // 4. Google Calendar Live Probe
  console.log('4. Probing Google Calendar Integration...');
  const calendarId = process.env.GOOGLE_CALENDAR_ID || config.google.calendar.calendarId;
  if (!gmailClientId || !gmailRefreshToken) {
    results.connectors.googleCalendar = {
      status: 'BLOCKED_MISSING_CREDENTIALS',
      blocker: 'Google OAuth credentials missing for Calendar API access.',
    };
  } else {
    results.connectors.googleCalendar = {
      status: 'DEPENDS_ON_GOOGLE_OAUTH',
      calendarId,
    };
  }

  // 5. WhatsApp Business Cloud Live Probe
  console.log('5. Probing WhatsApp Business Meta Cloud API...');
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || config.whatsappBusiness.phoneNumberId;
  const waToken = process.env.WHATSAPP_ACCESS_TOKEN || config.whatsappBusiness.accessToken;

  if (!waPhoneId || !waToken) {
    results.connectors.whatsappCloud = {
      status: 'BLOCKED_MISSING_CREDENTIALS',
      blocker: 'WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN is missing.',
      phoneIdSet: Boolean(waPhoneId),
      tokenSet: Boolean(waToken),
    };
  } else {
    try {
      const t0 = Date.now();
      const res = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}`, {
        headers: { Authorization: `Bearer ${waToken}` },
      });
      const latencyMs = Date.now() - t0;
      results.connectors.whatsappCloud = {
        status: res.ok ? 'ACTIVE' : 'API_ERROR',
        httpStatus: res.status,
        latencyMs,
        response: await res.json(),
      };
    } catch (err) {
      results.connectors.whatsappCloud = {
        status: 'NETWORK_ERROR',
        error: err.message,
      };
    }
  }

  // 6. CRM Live Probe
  console.log('6. Probing CRM Integration (HubSpot / Supabase)...');
  const crmApiKey = process.env.CRM_API_KEY || config.crm.apiKey;
  const crmWebhookUrl = process.env.CRM_WEBHOOK_URL || config.crm.webhookUrl;

  if (!crmApiKey && !crmWebhookUrl) {
    results.connectors.crm = {
      status: 'BLOCKED_MISSING_CREDENTIALS',
      provider: config.crm.provider,
      blocker: 'CRM_API_KEY and CRM_WEBHOOK_URL are not configured.',
    };
  } else if (crmApiKey) {
    try {
      const t0 = Date.now();
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: { Authorization: `Bearer ${crmApiKey}` },
      });
      const latencyMs = Date.now() - t0;
      results.connectors.crm = {
        status: res.ok ? 'ACTIVE' : 'AUTH_FAILED',
        httpStatus: res.status,
        latencyMs,
        response: await res.json(),
      };
    } catch (err) {
      results.connectors.crm = {
        status: 'NETWORK_ERROR',
        error: err.message,
      };
    }
  }

  // 7. Production Website Live Probe (www.emanuelrendas.com)
  console.log('7. Probing Production Website (https://www.emanuelrendas.com)...');
  const liveUrls = [
    'https://www.emanuelrendas.com',
    'https://www.emanuelrendas.com/api/health',
    'https://www.emanuelrendas.com/api/leads',
    'https://www.emanuelrendas.com/api/assessments',
    'https://www.emanuelrendas.com/api/calculators/roi',
  ];

  results.connectors.website = {
    domain: 'https://www.emanuelrendas.com',
    endpoints: {},
  };

  for (const url of liveUrls) {
    try {
      const t0 = Date.now();
      const res = await fetch(url, { method: 'GET' });
      const latencyMs = Date.now() - t0;
      results.connectors.website.endpoints[url] = {
        status: res.status,
        statusText: res.statusText,
        latencyMs,
        ok: res.ok,
      };
      console.log(`  - ${url}: ${res.status} (${latencyMs}ms)`);
    } catch (err) {
      results.connectors.website.endpoints[url] = {
        status: 'ERROR',
        error: err.message,
      };
      console.log(`  - ${url}: ERROR (${err.message})`);
    }
  }

  console.log('\n=== PROBE RESULTS SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
}

auditLiveConnectors();
