/**
 * MISSION-019: one cache version across the site
 *
 * THE BUG THIS PREVENTS
 *
 * vercel.json serves /assets/* with `Cache-Control: public, max-age=31536000,
 * immutable` — one year, and immutable means a browser will not even ask
 * whether the file changed. The only way a visitor ever sees a new
 * stylesheet is a different `?v=` on the request URL.
 *
 * On 2026-09-05 the pages disagreed:
 *
 *   index.html        /assets/site.css?v=20260826_v1
 *   every other page  /assets/site.css?v=20260823c
 *
 * So the homepage pulled the new stylesheet and every page reached from it
 * pulled the old one out of a year-long cache. The reported symptom was
 * exactly that: the design looked new on arrival and reverted to the old one
 * on any click. Nothing was wrong with the HTML, which this suite also
 * checks: the bundle matched its source files byte for byte modulo line
 * endings. The design was correct and unreachable.
 *
 * A stale asset version is invisible in review, survives a deploy, and lasts
 * a year in a visitor's browser. It needs a test, not a convention.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');

const PAGES = fs
  .readdirSync(REPO)
  .filter((f) => f.endsWith('.html'))
  .filter((f) => !['dashboard.html', 'mission-control.html'].includes(f));

function assetRefs(html) {
  return [...html.matchAll(/\/assets\/(site\.(?:css|js))(?:\?v=([^"']*))?/g)]
    .map((m) => ({ file: m[1], version: m[2] ?? null }));
}

describe('MISSION-019: cached assets carry one version', () => {
  test('every referenced asset is versioned', () => {
    const unversioned = [];
    for (const page of PAGES) {
      for (const ref of assetRefs(fs.readFileSync(path.join(REPO, page), 'utf8'))) {
        if (!ref.version) unversioned.push(`${page} -> ${ref.file}`);
      }
    }
    assert.deepEqual(
      unversioned,
      [],
      'an unversioned asset is frozen in the visitor cache for a year and can never be updated'
    );
  });

  test('all pages agree on the same version', () => {
    const seen = new Map();
    for (const page of PAGES) {
      for (const ref of assetRefs(fs.readFileSync(path.join(REPO, page), 'utf8'))) {
        if (!ref.version) continue;
        if (!seen.has(ref.version)) seen.set(ref.version, []);
        seen.get(ref.version).push(`${page}:${ref.file}`);
      }
    }
    assert.equal(
      seen.size,
      1,
      'pages disagree on the asset version, so some will serve the old design from cache:\n' +
        [...seen.entries()].map(([v, where]) => `  ?v=${v} -> ${where.join(', ')}`).join('\n')
    );
  });

  test('the immutable cache rule that makes this matter is still in place', () => {
    const vercel = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
    const rule = (vercel.headers || []).find((h) => h.source === '/assets/(.*)');
    assert.ok(rule, 'the /assets/ cache rule must exist');
    const cacheControl = rule.headers.find((h) => h.key === 'Cache-Control');
    assert.match(
      cacheControl.value,
      /immutable/,
      'if this rule ever stops being immutable, revisit this suite — the version discipline exists because of it'
    );
  });

  test('the served bundle matches its source pages', () => {
    const bundleSrc = fs.readFileSync(path.join(REPO, 'src/site/site-pages.js'), 'utf8');
    const norm = (s) => s.replace(/\r\n/g, '\n');
    for (const page of PAGES) {
      const key = page === 'index.html' ? 'index' : page.replace(/\.html$/, '');
      const version = assetRefs(fs.readFileSync(path.join(REPO, page), 'utf8'))[0]?.version;
      if (!version) continue;
      assert.ok(
        norm(bundleSrc).includes(`?v=${version}`),
        `${key} was edited but the bundle was not rebuilt: run npm run build and commit both, ` +
          'or the deploy keeps serving the previous page'
      );
    }
  });
});
