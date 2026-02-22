-- ============================================================================
-- Carbon Gate: Override & Repo Policy Tables
-- Run this in the Supabase SQL editor to create the required tables.
-- ============================================================================

-- 1. Per-repo emission policies
--    Each org can set budget thresholds per repo, with an EU-compliance hard cap.
CREATE TABLE IF NOT EXISTS repo_policies (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        text NOT NULL,
  repo          text NOT NULL,            -- "owner/repo" format
  budget_kg     numeric NOT NULL DEFAULT 10.0,    -- soft budget per month
  warn_kg       numeric NOT NULL DEFAULT 5.0,     -- warning threshold per month
  hard_cap_kg   numeric NOT NULL DEFAULT 20.0,    -- EU compliance hard cap (cannot override past this)
  max_overrides_per_month integer NOT NULL DEFAULT 5,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(org_id, repo)
);

-- 2. Override events (audit trail)
--    Every override — admin free or developer paid — is logged here.
CREATE TABLE IF NOT EXISTS override_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        text NOT NULL,
  repo          text NOT NULL,
  pr_number     integer NOT NULL,
  github_user   text NOT NULL,
  github_role   text NOT NULL,             -- 'admin', 'maintain', 'write', etc.
  override_type text NOT NULL,             -- 'admin' (free) or 'paid'
  emissions_kg  numeric NOT NULL,          -- how much CO₂ this override allows
  cost_usd      numeric DEFAULT 0,         -- $0 for admin, calculated for paid
  stripe_session_id text,                  -- null for admin overrides
  status        text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'completed', 'expired'
  justification text,
  created_at    timestamptz DEFAULT now()
);

-- Index for monthly count checks
CREATE INDEX IF NOT EXISTS idx_override_events_monthly 
  ON override_events (org_id, repo, created_at);

-- Index for PR lookup
CREATE INDEX IF NOT EXISTS idx_override_events_pr
  ON override_events (repo, pr_number, status);

-- 3. Per-repo monthly usage tracking
--    Aggregated from gate_events, used for cap enforcement.
CREATE TABLE IF NOT EXISTS repo_usage_mtd (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        text NOT NULL,
  repo          text NOT NULL,
  used_kg       numeric NOT NULL DEFAULT 0,
  period_start  date NOT NULL DEFAULT date_trunc('month', now())::date,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(org_id, repo, period_start)
);

-- ============================================================================
-- Usage: After creating tables, your app code handles the rest.
-- The gate_check.py action queries these via the Carbon Gate API.
-- ============================================================================
