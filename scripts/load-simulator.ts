import crypto from 'node:crypto';

/**
 * RAIOC OS — Institutional Sovereign Lead Load Simulator
 * Script: scripts/load-simulator.ts
 * 
 * Simulates 5 high-value institutional sovereign mandates with strict
 * CloudEvent v1.1 envelopes, W3C traceparents, and cryptographic SHA-256 hashes.
 */

const TARGET_ENDPOINT =
  process.env.TARGET_ENDPOINT ||
  process.env.RAIOC_API_URL ||
  'http://localhost:3000/api/v1/events/ingest';

const INTERNAL_SECRET =
  process.env.RAIOC_INTERNAL_SECRET || 'raioc_sovereign_auth_2026_x99';

interface InstitutionalLead {
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  segment: string;
  budget_aed: number;
  target_asset: string;
  channel: 'TELEGRAM' | 'WHATSAPP' | 'DIRECT_ADVISORY' | 'WEBSITE_PORTAL';
  thesis: string;
  dira_target_score: number;
}

const SOVEREIGN_MANDATES: InstitutionalLead[] = [
  {
    name: 'Lord Alistair Sterling',
    email: 'sterling@sterling-capital.co.uk',
    phone: '+44 20 7946 0991',
    company: 'Sterling Capital Sovereign Fund',
    country: 'United Kingdom',
    segment: 'UK_NONDOM',
    budget_aed: 25000000,
    target_asset: 'Como Residences (Palm Jumeirah Ultra-Prime Freehold)',
    channel: 'TELEGRAM',
    thesis: 'UK Non-Dom abolition capital reallocation into UAE Law 8 ringfenced freehold assets.',
    dira_target_score: 95,
  },
  {
    name: 'Dr. Afonso Henriques',
    email: 'afonso@lisbon-capital.pt',
    phone: '+351 912 345 678',
    company: 'Henriques Family Office & Private Trust',
    country: 'Portugal',
    segment: 'PT_HNW',
    budget_aed: 30000000,
    target_asset: 'Palace Residences (Dubai Creek Harbour Waterfront Penthouse)',
    channel: 'WHATSAPP',
    thesis: 'Post-NHR wealth preservation, EUR-AED hedge, and UAE Golden Visa qualification.',
    dira_target_score: 92,
  },
  {
    name: 'Baroness Victoria Vance',
    email: 'vance@vance-trust.ch',
    phone: '+41 22 819 2000',
    company: 'Vance & Co Global Sovereign Trust',
    country: 'Switzerland',
    segment: 'SWISS_FAMILY_OFFICE',
    budget_aed: 45000000,
    target_asset: 'DIFC Private Residences & Sovereign Wealth Shield',
    channel: 'DIRECT_ADVISORY',
    thesis: 'Common law asset ringfencing via DIFC Foundation and prime commercial real estate.',
    dira_target_score: 98,
  },
  {
    name: 'Zhang Wei',
    email: 'zhang.wei@dragoncrest.sg',
    phone: '+65 6789 0123',
    company: 'Dragon Crest Capital Pte Ltd',
    country: 'Singapore',
    segment: 'APAC_FAMILY_OFFICE',
    budget_aed: 60000000,
    target_asset: 'Palm Jebel Ali Sovereign Waterfront Signature Villa',
    channel: 'WEBSITE_PORTAL',
    thesis: 'Diversification of Asian sovereign liquidity into Dubai luxury waterfront developments.',
    dira_target_score: 94,
  },
  {
    name: 'Sheikh Tariq Al-Mansoor',
    email: 'tariq@almansoor-holdings.ae',
    phone: '+971 50 888 9999',
    company: 'Gulf Sovereign Asset Corporation',
    country: 'United Arab Emirates',
    segment: 'GCC_SOVEREIGN_FO',
    budget_aed: 80000000,
    target_asset: 'Dubai Hills Private Estate Mega-Mansions',
    channel: 'WHATSAPP',
    thesis: 'Long-term high-yield institutional asset portfolio with 100% Escrow Law 8 guarantees.',
    dira_target_score: 99,
  },
];

function createCloudEvent(lead: InstitutionalLead) {
  const eventId = `evt_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const correlationId = `corr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const traceparent = `00-${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-01`;

  const payloadData = {
    lead: {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      country: lead.country,
      segment: lead.segment,
      budget_aed: lead.budget_aed,
      target_asset: lead.target_asset,
      channel: lead.channel,
      thesis: lead.thesis,
      dira_target_score: lead.dira_target_score,
      status: 'NEW_LEAD',
    },
    metadata: {
      simulator: 'RAIOC_LOAD_SIMULATOR_V2',
      dispatched_at: new Date().toISOString(),
    },
  };

  const payloadSha256 = crypto
    .createHash('sha256')
    .update(JSON.stringify(payloadData))
    .digest('hex');

  return {
    envelope: {
      specversion: '1.0',
      type: 'raioc.lead.ingested.v1',
      source: `raioc.channel.${lead.channel.toLowerCase()}`,
      id: eventId,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      traceparent,
      correlation_id: correlationId,
      causation_id: eventId,
      payload_sha256: payloadSha256,
      data: payloadData,
    },
    traceparent,
    correlationId,
    payloadSha256,
  };
}

async function simulateSingleLead(lead: InstitutionalLead, index: number) {
  const { envelope, traceparent, correlationId, payloadSha256 } = createCloudEvent(lead);
  const startTime = Date.now();

  console.log(`\n─────────────────────────────────────────────────────────────────`);
  console.log(`[${index + 1}/5] 🚀 DISPATCHING SOVEREIGN MANDATE: ${lead.name}`);
  console.log(`     Corridor:   ${lead.target_asset}`);
  console.log(`     Allocation: AED ${(lead.budget_aed / 1000000).toFixed(1)}M (${lead.country})`);
  console.log(`     Trace:      ${traceparent}`);
  console.log(`     SHA-256:    ${payloadSha256.substring(0, 16)}...`);

  try {
    const res = await fetch(TARGET_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTERNAL_SECRET}`,
        'X-RAIOC-Secret': INTERNAL_SECRET,
        'traceparent': traceparent,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(envelope),
    });

    const latency = Date.now() - startTime;

    if (res.ok || res.status === 202) {
      const responseData = await res.json();
      console.log(`     Status:     ✅ ACCEPTED (${res.status}) in ${latency}ms`);
      console.log(`     Ack ID:     ${responseData.id || 'ack_confirmed'}`);
      return { success: true, lead: lead.name, latency, status: res.status };
    } else {
      const errText = await res.text();
      console.log(`     Status:     ⚠️ HTTP ${res.status} (${latency}ms) - ${errText}`);
      return { success: false, lead: lead.name, latency, status: res.status, error: errText };
    }
  } catch (err: unknown) {
    const latency = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`     Status:     ❌ NETWORK / DISPATCH ERROR (${latency}ms) - ${msg}`);
    return { success: false, lead: lead.name, latency, error: msg };
  }
}

async function runSimulation() {
  console.log(`\n=================================================================`);
  console.log(`🏛️  RAIOC OS — SOVEREIGN INSTITUTIONAL LOAD SIMULATOR (5 LEADS)`);
  console.log(`=================================================================`);
  console.log(`Target Ingest Endpoint: ${TARGET_ENDPOINT}`);
  console.log(`Total Capital Volume:   AED ${(SOVEREIGN_MANDATES.reduce((acc, l) => acc + l.budget_aed, 0) / 1000000).toFixed(1)}M`);
  console.log(`Timestamp:              ${new Date().toISOString()}`);

  const results = [];

  for (let i = 0; i < SOVEREIGN_MANDATES.length; i++) {
    const result = await simulateSingleLead(SOVEREIGN_MANDATES[i], i);
    results.push(result);
    // Pause 500ms between dispatches to simulate staggered ingress
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n=================================================================`);
  console.log(`📊 SIMULATION COMPLETE SUMMARY`);
  console.log(`=================================================================`);
  results.forEach((r, idx) => {
    const mark = r.success ? '✅' : '⚠️';
    console.log(`${mark} [${idx + 1}] ${r.lead.padEnd(28)} | Latency: ${r.latency}ms | Status: ${r.status || 'ERR'}`);
  });
  console.log(`=================================================================\n`);
}

// Execute simulator if run directly
runSimulation();
