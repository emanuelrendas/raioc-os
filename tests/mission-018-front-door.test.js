/**
 * MISSION-018: Front Door — session attribution and lazy persistence
 *
 * Two defects found on 2026-09-05 by tracing the live site against production data.
 *
 * 1. SESSION ATTRIBUTION (fixed here)
 *    assets/site.js kept the session id inside the Track closure and built the
 *    /api/lead body without it. Production evidence: 12 of 12 rows in lead_events
 *    carry a session_id, and 0 of 7 website leads do. Every funnel event is
 *    therefore permanently orphaned from the lead it produced, so no submission
 *    can ever be attributed to a page, a campaign or a UTM.
 *
 * 2. EAGER PERSISTENCE (fixed by R3-A, cherry-picked into this branch)
 *    src/db/supabase-client.js constructed the shared client at module import.
 *    In production without resolvable credentials the constructor throws
 *    PersistenceError('init') during import, taking the whole serverless
 *    function down before any handler runs. The live site reported
 *    stored:false on 3 of 6 form submissions between 22 and 25 August, and
 *    /api/v1/health — the alias R3-A introduces — still answers 404 there,
 *    which is how we know the deployed build predates the fix.
 *
 * NOT fixed here, and deliberately so: this repository never INSERTs into
 * public.leads. It writes investors, executive_briefs and dispatch_queue. The
 * lead rows in production were written by a separate importer that is not in
 * this codebase. Sending the session id is necessary but not sufficient until
 * one system owns the lead write. That is an architecture decision, not a patch.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const REPO = path.resolve(import.meta.dirname, '..');

function loadTrackFactory() {
  const source = fs.readFileSync(path.join(REPO, 'assets/site.js'), 'utf8');
  const start = source.indexOf('window.Track = (function(){');
  assert.ok(start !== -1, 'the Track factory must be present in assets/site.js');
  const end = source.indexOf('})();', start);
  assert.ok(end !== -1, 'the Track factory must be closed');
  return source.slice(start, end + 5);
}

describe('MISSION-018 #1: the session id reaches the lead', () => {
  test('Track exposes the same id it stamps on events', () => {
    const posted = [];
    const store = new Map();
    const sandbox = {
      window: {},
      sessionStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
      },
      crypto: { randomUUID: () => 'sess-mission018-fixed' },
      location: { pathname: '/contact', search: '' },
      fetch: (url, opts) => {
        posted.push({ url, body: JSON.parse(opts.body) });
        return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
      },
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(loadTrackFactory(), sandbox);

    const track = sandbox.window.Track;
    assert.equal(typeof track, 'function', 'Track must be callable');
    assert.equal(
      track.sessionId,
      'sess-mission018-fixed',
      'the session id must be readable from outside the closure, or the lead body cannot carry it'
    );

    track('form_submitted', { stored: true });
    assert.equal(posted.length, 1);
    assert.equal(
      posted[0].body.session_id,
      track.sessionId,
      'the id reported on events and the id exposed for the lead must be the same value'
    );
  });

  test('the lead payload sends session_id, and sends it first', () => {
    const source = fs.readFileSync(path.join(REPO, 'assets/site.js'), 'utf8');
    const call = source.indexOf("fetch('/api/lead'");
    assert.ok(call !== -1, 'the brief form must still POST to /api/lead');

    const block = source.slice(call, call + 1200);
    assert.match(
      block,
      /session_id:\s*\(window\.Track && window\.Track\.sessionId\) \|\| null/,
      'the /api/lead body must carry the session id from Track'
    );
    assert.ok(
      block.indexOf('session_id:') < block.indexOf("name:"),
      'session_id belongs at the top of the payload: it is the join key, not an afterthought'
    );
  });

  test('the published copy under public/ carries the same fix', () => {
    const a = fs.readFileSync(path.join(REPO, 'assets/site.js'), 'utf8');
    const b = fs.readFileSync(path.join(REPO, 'public/assets/site.js'), 'utf8');
    for (const file of [['assets/site.js', a], ['public/assets/site.js', b]]) {
      assert.match(
        file[1],
        /session_id:\s*\(window\.Track && window\.Track\.sessionId\)/,
        `${file[0]} must carry the fix, or the deployed copy silently keeps the bug`
      );
    }
  });

  test('tracking still degrades quietly when storage is unavailable', () => {
    const sandbox = {
      window: {},
      sessionStorage: {
        getItem: () => { throw new Error('private mode'); },
        setItem: () => { throw new Error('private mode'); },
      },
      crypto: { randomUUID: () => 'never-reached' },
      location: { pathname: '/', search: '' },
      fetch: () => { throw new Error('must not be called without a session'); },
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(loadTrackFactory(), sandbox);

    const track = sandbox.window.Track;
    assert.doesNotThrow(() => track('page_view'), 'a blocked storage must never surface an error');
    assert.equal(track.sessionId, null, 'with no session there is no id to report');
  });
});

describe('MISSION-018 #2: persistence is deferred, not eager', () => {
  test('the shared client is not constructed at module import', () => {
    const source = fs.readFileSync(path.join(REPO, 'src/db/supabase-client.js'), 'utf8');
    assert.doesNotMatch(
      source,
      /^export const supabase = new SupabaseClient\(\);$/m,
      'eager construction throws PersistenceError during import in production and takes the whole function down'
    );
  });

  test('the versioned health alias exists in the router', () => {
    const source = fs.readFileSync(path.join(REPO, 'src/api/server.js'), 'utf8');
    assert.match(
      source,
      /api\/v1\/health/,
      'the live site answers 404 on /api/v1/health; that alias is how a deploy is proven to carry this branch'
    );
  });
});
