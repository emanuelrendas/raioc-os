/**
 * Writing a lead against the unique index on lower(email).
 *
 * Recovered from dld-update-website (donor ref
 * 815e0469043a04f5229bc056b540b6a96ce0dd6a) as part of MISSION P1-A —
 * Canonical Website Lead Ingress Reconciliation, then adapted to the
 * ADR-015D business-lifecycle boundary (see src/db/migrations/
 * 005_lead_execution_schema_foundation.sql): `leads.status` is CRM /
 * business-lifecycle authority, never something a public form resubmission
 * may reset. The donor's duplicate-patch KEEP list included `status` (and
 * scoring fields that do not exist in this canonical contract); both are
 * deliberately dropped below. See PATCH KEEP list.
 *
 * Both inbound routes need identical conflict handling, so it lives once
 * here rather than twice.
 *
 * The index (leads_lower_email_key) means a returning client submitting a
 * second brief now hits a 23505 unique violation. Failing their
 * submission would be the wrong answer — they are a returning client,
 * not an error — so the conflict resolves to the existing row and the
 * fields carrying the new submission are written onto it.
 *
 * PostgREST's own `resolution=merge-duplicates` is not used: it infers
 * the conflict target from the payload columns, which cannot match an
 * index on the expression lower(email). The two steps below are explicit
 * and do not depend on that inference.
 */

const AUTH = (SERVICE) => ({
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
});

/**
 * Inserts a lead, or updates the existing row for that address.
 * Returns { id, created } — created false when an existing row was used.
 * Throws on any failure other than the unique violation.
 */
export async function upsertLead(URL_BASE, SERVICE, row) {
  const email = String(row.email || '').toLowerCase();

  const r = await fetch(`${URL_BASE}/rest/v1/leads`, {
    method: 'POST',
    headers: { ...AUTH(SERVICE), Prefer: 'return=representation' },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(8000),
  });

  const text = await r.text();

  if (r.ok) {
    let id = null;
    try { id = JSON.parse(text)?.[0]?.id ?? null; } catch { id = null; }
    return { id, created: true };
  }

  /* 23505 is the unique violation. Anything else is a real failure and
     the caller must be told, not quietly handed a null id. */
  const isDuplicate = r.status === 409 || text.includes('23505') || text.includes('leads_lower_email_key');
  if (!isDuplicate) {
    throw Object.assign(new Error(`leads ${r.status}`), { detail: text.slice(0, 400) });
  }

  /* Only the fields that carry this submission, and only where they have
     a value — a second brief with a blank phone must not erase the phone
     from the first.
     id, email, created_at and consent_status are left alone: the row's
     identity and its original consent record are not this submission's
     to rewrite.
     status is deliberately EXCLUDED from this list (ADR-015D): leads.status
     is CRM / business-lifecycle authority, never an execution lock and
     never something a public website resubmission may reset. A lead a
     human has already moved to qualified/contacted/later stages must not
     be silently reset to "new" by a repeat form submission. */
  const KEEP = ['name', 'mobile', 'address', 'notes', 'investment_objective',
                'budget_band', 'lead_magnet', 'preferred_language',
                'utm_source', 'utm_medium', 'utm_campaign', 'referrer_url'];

  const patch = {};
  for (const k of KEEP) {
    if (row[k] !== null && row[k] !== undefined && row[k] !== '') patch[k] = row[k];
  }
  patch.updated_at = new Date().toISOString();

  const u = await fetch(
    `${URL_BASE}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&select=id`,
    {
      method: 'PATCH',
      headers: { ...AUTH(SERVICE), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(8000),
    },
  );

  const utext = await u.text();

  if (!u.ok) {
    /* The update failed but the person is on file. Recover their id so
       the caller can still return a deterministic identity. */
    console.error(`leads: duplicate update failed ${u.status}: ${utext.slice(0, 300)}`);
    const g = await fetch(
      `${URL_BASE}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      { headers: AUTH(SERVICE), signal: AbortSignal.timeout(8000) },
    );
    if (!g.ok) throw Object.assign(new Error(`leads lookup ${g.status}`), { detail: (await g.text()).slice(0, 400) });
    let id = null;
    try { id = JSON.parse(await g.text())?.[0]?.id ?? null; } catch { id = null; }
    return { id, created: false };
  }

  let id = null;
  try { id = JSON.parse(utext)?.[0]?.id ?? null; } catch { id = null; }
  return { id, created: false };
}
