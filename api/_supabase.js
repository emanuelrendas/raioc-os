/**
 * Shared Supabase Configuration Helper for Vercel API Routes (Security Hardened)
 * Requires explicitly configured SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

export function getSupabaseCredentials() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  const sourceUrl = process.env.SUPABASE_URL
    ? "SUPABASE_URL"
    : process.env.NEXT_PUBLIC_SUPABASE_URL
    ? "NEXT_PUBLIC_SUPABASE_URL"
    : null;

  const sourceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "SUPABASE_SERVICE_ROLE_KEY"
    : null;

  return {
    url,
    serviceKey,
    isConfigured: Boolean(url && serviceKey),
    sources: { url: sourceUrl, serviceKey: sourceKey },
  };
}
