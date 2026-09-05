#!/usr/bin/env node
/**
 * RAIOC OS — Test Health Ratchet (MISSION-016)
 *
 * Why this exists
 * ---------------
 * `npm run test:ci` runs nine hand-picked suites and goes green. The full suite
 * tells a different story: on main at 2026-09-05 it was 539 tests, 438 passing,
 * 101 failing across 31 suites. CI never saw those, so the repository reported
 * health it did not have, and every new failure landed silently on top.
 *
 * This script runs the WHOLE suite and measures it against a recorded baseline
 * of known-failing suites. It is a ratchet, not an amnesty:
 *
 *   - A suite that fails and is NOT in the baseline is a regression. Exit 1.
 *   - More failing tests than the baseline records is a regression. Exit 1.
 *   - A baseline suite that now passes is reported as recovered, so the baseline
 *     can be tightened. The debt can shrink; it cannot quietly grow.
 *
 * The baseline is data in tests/known-failing-suites.json, reviewable in a diff,
 * with a reason on every entry. Regenerate deliberately with --update, never as
 * a reflex to make a red build green.
 *
 * Usage
 *   node scripts/test-health.mjs            # gate: compare against the baseline
 *   node scripts/test-health.mjs --update   # rewrite the baseline from reality
 *   node scripts/test-health.mjs --json     # machine-readable summary
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(REPO_ROOT, 'tests', 'known-failing-suites.json');

const args = new Set(process.argv.slice(2));
const SHOULD_UPDATE = args.has('--update');
const AS_JSON = args.has('--json');

function runFullSuite() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--test', 'tests/*.test.js', 'tests/**/*.test.js'],
      { cwd: REPO_ROOT, env: process.env, shell: process.platform === 'win32' }
    );

    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', () => {});
    child.on('close', () => resolve(stdout));
  });
}

/**
 * Parses node:test TAP output. Top-level suite results sit at column zero;
 * nested subtests are indented, so the anchored patterns below pick up suites
 * without double-counting the individual tests inside them.
 */
function parseTap(output) {
  const failingSuites = [];
  const passingSuites = [];

  for (const line of output.split('\n')) {
    const failed = line.match(/^not ok \d+ - (.+)$/);
    if (failed) {
      failingSuites.push(failed[1].trim());
      continue;
    }
    const passed = line.match(/^ok \d+ - (.+)$/);
    if (passed) passingSuites.push(passed[1].trim());
  }

  const totals = {};
  for (const key of ['tests', 'pass', 'fail', 'suites']) {
    const found = output.match(new RegExp(`^# ${key} (\\d+)$`, 'm'));
    totals[key] = found ? Number(found[1]) : 0;
  }

  return { failingSuites: [...new Set(failingSuites)], passingSuites, totals };
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch (err) {
    console.error(`Baseline at ${BASELINE_PATH} is not readable JSON: ${err.message}`);
    process.exit(2);
  }
}

function writeBaseline(result) {
  const previous = loadBaseline();
  const previousReasons = new Map(
    (previous?.suites || []).map((entry) => [entry.name, entry.reason])
  );

  const baseline = {
    _comment: [
      'Suites known to fail on main, recorded so CI can report the real number',
      'instead of running only the suites that pass. Every entry needs a reason.',
      'This list may shrink. It must never grow without a deliberate --update and',
      'a note in the pull request explaining why the debt increased.',
    ],
    recordedAt: new Date().toISOString(),
    totals: result.totals,
    suites: result.failingSuites.sort().map((name) => ({
      name,
      reason: previousReasons.get(name) || 'UNCLASSIFIED — triage and replace this text',
    })),
  };

  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline written: ${baseline.suites.length} known-failing suites, ${result.totals.fail} failing tests.`);
}

function report(result, baseline) {
  const known = new Set((baseline.suites || []).map((entry) => entry.name));
  const regressions = result.failingSuites.filter((name) => !known.has(name));
  const recovered = [...known].filter((name) => !result.failingSuites.includes(name));
  const failCountGrew = result.totals.fail > (baseline.totals?.fail ?? 0);

  if (AS_JSON) {
    console.log(JSON.stringify({
      totals: result.totals,
      baselineTotals: baseline.totals,
      regressions,
      recovered,
      failCountGrew,
    }, null, 2));
  } else {
    const pct = result.totals.tests
      ? ((result.totals.pass / result.totals.tests) * 100).toFixed(1)
      : '0.0';

    console.log('');
    console.log('RAIOC OS — Test Health');
    console.log('──────────────────────────────────────────────');
    console.log(`  Tests            ${result.totals.tests}`);
    console.log(`  Passing          ${result.totals.pass}  (${pct}%)`);
    console.log(`  Failing          ${result.totals.fail}   (baseline ${baseline.totals?.fail ?? '?'})`);
    console.log(`  Failing suites   ${result.failingSuites.length}   (baseline ${(baseline.suites || []).length})`);
    console.log('──────────────────────────────────────────────');

    if (recovered.length) {
      console.log('');
      console.log(`  ${recovered.length} suite(s) recovered — tighten the baseline with --update:`);
      for (const name of recovered) console.log(`    + ${name}`);
    }

    if (regressions.length) {
      console.log('');
      console.log(`  ${regressions.length} suite(s) newly failing, not in the baseline:`);
      for (const name of regressions) console.log(`    - ${name}`);
    }

    if (failCountGrew) {
      console.log('');
      console.log(`  Failing test count rose from ${baseline.totals?.fail} to ${result.totals.fail}.`);
    }
    console.log('');
  }

  if (regressions.length || failCountGrew) {
    console.error('FAIL: the suite got worse. Fix the regression or justify a deliberate baseline change.');
    process.exit(1);
  }

  console.log('PASS: no new failures. Known debt is recorded and not growing.');
  process.exit(0);
}

const output = await runFullSuite();
const result = parseTap(output);

if (!result.totals.tests) {
  console.error('The test runner produced no results. Check that dependencies are installed.');
  process.exit(2);
}

if (SHOULD_UPDATE) {
  writeBaseline(result);
  process.exit(0);
}

const baseline = loadBaseline();
if (!baseline) {
  console.error(`No baseline found at ${BASELINE_PATH}. Create one with: node scripts/test-health.mjs --update`);
  process.exit(2);
}

report(result, baseline);
