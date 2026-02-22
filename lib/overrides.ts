/**
 * SHA-based override helpers.
 *
 * These functions manage "sha_overrides" rows in Supabase — a separate table
 * from the existing PR-based "override_events" table.  An override is keyed
 * on (owner, repo, sha, check_name) and is immutable to the specific commit.
 *
 * Required Supabase migration — run once in the SQL editor:
 *
 *   CREATE TABLE sha_overrides (
 *     id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     owner             TEXT        NOT NULL,
 *     repo              TEXT        NOT NULL,
 *     sha               TEXT        NOT NULL,
 *     check_name        TEXT        NOT NULL,
 *     pr                TEXT,
 *     stripe_session_id TEXT        NOT NULL UNIQUE,
 *     paid_at           TIMESTAMPTZ,
 *     purchaser_email   TEXT,
 *     amount_total      INTEGER,
 *     currency          TEXT,
 *     status            TEXT        NOT NULL DEFAULT 'pending',
 *     expires_at        TIMESTAMPTZ,
 *     created_at        TIMESTAMPTZ DEFAULT NOW()
 *   );
 *
 *   -- Optional: speed up the lookup in getOverride
 *   CREATE INDEX sha_overrides_lookup
 *     ON sha_overrides (owner, repo, sha, check_name, status);
 *
 * Storage note: we reuse the existing Supabase instance instead of adding
 * a Redis/Vercel KV dependency — keeps the project dependency-free while
 * still satisfying the key/TTL requirements (expires_at enforced in app layer).
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ShaOverride {
  id: string;
  owner: string;
  repo: string;
  sha: string;
  check_name: string;
  pr: string | null;
  stripe_session_id: string;
  paid_at: string | null;
  purchaser_email: string | null;
  amount_total: number | null;
  currency: string | null;
  status: "pending" | "paid";
  expires_at: string | null;
  created_at: string;
}

/**
 * Look up the most recent paid, non-expired override for a specific
 * owner/repo/sha/check_name combination.
 *
 * Returns null if no override exists or if it has expired.
 */
export async function getOverride(
  owner: string,
  repo: string,
  sha: string,
  checkName: string
): Promise<ShaOverride | null> {
  const { data, error } = await supabaseAdmin
    .from("sha_overrides")
    .select("*")
    .eq("owner", owner)
    .eq("repo", repo)
    .eq("sha", sha)
    .eq("check_name", checkName)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Enforce TTL in the application layer (belt-and-suspenders over DB TTL).
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data as ShaOverride;
}

/**
 * Insert a pending override row when a Stripe Checkout session is created.
 * May return null if the insert fails (e.g. duplicate session_id — safe to ignore,
 * the webhook will upsert the row when payment completes).
 */
export async function createPendingOverride(
  owner: string,
  repo: string,
  sha: string,
  checkName: string,
  stripeSessionId: string,
  pr: string | null
): Promise<ShaOverride | null> {
  const { data } = await supabaseAdmin
    .from("sha_overrides")
    .insert({
      owner,
      repo,
      sha,
      check_name: checkName,
      stripe_session_id: stripeSessionId,
      pr,
      status: "pending",
    })
    .select()
    .single();

  return (data as ShaOverride) ?? null;
}

/**
 * Mark an override as paid.  Called from the Stripe webhook handler.
 *
 * Idempotency: uses upsert on (stripe_session_id) so duplicate webhook
 * deliveries are harmless.  If the pending row was never created (edge case),
 * the row is inserted here instead.
 *
 * TTL: expires_at is set to now + 7 days (configurable via OVERRIDE_TTL_DAYS).
 */
export async function markOverridePaid(
  stripeSessionId: string,
  fields: {
    owner: string;
    repo: string;
    sha: string;
    check_name: string;
    pr: string | null;
    paid_at: string;
    purchaser_email: string | null;
    amount_total: number | null;
    currency: string | null;
    expires_at: string;
  }
): Promise<void> {
  await supabaseAdmin.from("sha_overrides").upsert(
    {
      owner: fields.owner,
      repo: fields.repo,
      sha: fields.sha,
      check_name: fields.check_name,
      stripe_session_id: stripeSessionId,
      pr: fields.pr,
      paid_at: fields.paid_at,
      purchaser_email: fields.purchaser_email,
      amount_total: fields.amount_total,
      currency: fields.currency,
      expires_at: fields.expires_at,
      status: "paid",
    },
    { onConflict: "stripe_session_id" }
  );
}
