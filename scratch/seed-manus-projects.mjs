/**
 * RAIOC OS - Seed Manus Off-Plan Dataset into Supabase
 * Upserts 10 verified Manus intelligence off-plan projects:
 * 1. Rosehill (Dubai Hills Estate - Emaar)
 * 2. Hillsedge (Dubai Hills Estate - Emaar)
 * 3. Parkland (Dubai Hills Estate - Emaar)
 * 4. Valia (Dubai Creek Harbour - Emaar)
 * 5. Oria (Dubai Creek Harbour - Emaar)
 * 6. Palace Creek Blue (Dubai Creek Harbour - Emaar)
 * 7. Como Residences (Palm Jumeirah - Nakheel)
 * 8. Armani Beach Residences (Palm Jumeirah - Arada)
 * 9. Sobha Skyscape (Sobha Hartland II - Sobha)
 * 10. Sobha Estates (Sobha Hartland II - Sobha)
 */

import fs from 'node:fs';
import path from 'node:path';
import { supabase } from '../src/db/supabase-client.js';
import { logger } from '../src/logging/audit-logger.js';

async function seedManusProjects() {
  console.log('================================================================================');
  console.log('🏗️ RAIOC OS — SEEDING MANUS OFF-PLAN INTELLIGENCE DATASET');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================================\n');

  const jsonPath = path.resolve('src/knowledge/modules/off-plan-projects.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Knowledge file not found at: ${jsonPath}`);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const projects = JSON.parse(raw);

  console.log(`▶ Loaded ${projects.length} verified off-plan project records from dataset.`);

  // Upsert into Supabase
  const result = await supabase.upsertOffPlanProjects(projects);

  console.log(`\n================================================================================`);
  console.log(`✅ SEED COMPLETE: ${projects.length} PROJECTS UPSERTED TO SUPABASE`);
  console.log(`================================================================================`);
  projects.forEach((p, idx) => {
    console.log(`  ${idx + 1}. [${p.tier}] ${p.name} (${p.developer}) • ${p.community} • Starting: AED ${(p.starting_price_aed).toLocaleString()} • Yield: ${p.projected_yield_pct}%`);
  });
  console.log(`================================================================================\n`);

  return {
    success: true,
    count: projects.length,
    projects: projects.map((p) => ({ id: p.id, name: p.name, developer: p.developer, community: p.community })),
  };
}

seedManusProjects()
  .then((res) => {
    console.log('DATABASE_SEED_STATUS:', JSON.stringify(res, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
