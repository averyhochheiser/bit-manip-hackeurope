/**
 * Types and constants for the override & repo-policy system.
 */

// ── EU Compliance ───────────────────────────────────────────────────────────
/** Hard cap per repo per month — cannot be overridden even with payment */
export const EU_HARD_CAP_KG = 20;

/** Default price per kgCO₂ for paid overrides */
export const OVERRIDE_UNIT_PRICE = 2.0; // $/kgCO₂

/** Default max free admin overrides per repo per month */
export const DEFAULT_MAX_OVERRIDES = 5;

// ── Database row types ──────────────────────────────────────────────────────

export interface RepoPolicy {
  id: string;
  org_id: string;
  repo: string;
  budget_kg: number;
  warn_kg: number;
  hard_cap_kg: number;
  max_overrides_per_month: number;
  created_at: string;
  updated_at: string;
}

export type OverrideType = "admin" | "paid";
export type OverrideStatus = "pending" | "approved" | "completed" | "expired";

export interface OverrideEvent {
  id: string;
  org_id: string;
  repo: string;
  pr_number: number;
  github_user: string;
  github_role: string;
  override_type: OverrideType;
  emissions_kg: number;
  cost_usd: number;
  stripe_session_id: string | null;
  status: OverrideStatus;
  justification: string | null;
  created_at: string;
}

export interface RepoUsageMtd {
  id: string;
  org_id: string;
  repo: string;
  used_kg: number;
  period_start: string;
  updated_at: string;
}

// ── API request/response shapes ─────────────────────────────────────────────

export interface OverridePurchaseRequest {
  repo: string;
  pr_number: number;
  github_user: string;
  github_role: string;
  emissions_kg: number;
  justification?: string;
}

export interface OverridePurchaseResponse {
  checkout_url: string;
  override_id: string;
  cost_usd: number;
}

export interface AdminOverrideRequest {
  repo: string;
  pr_number: number;
  github_user: string;
  emissions_kg: number;
  justification?: string;
}

export interface OverrideCheckRequest {
  repo: string;
  pr_number: number;
  emissions_kg: number;
  github_user: string;
  github_role: string;
}

export interface OverrideCheckResponse {
  allowed: boolean;
  reason: string;
  override_type: OverrideType | null;
  /** If paid override is available, this is the cost */
  cost_usd: number | null;
  /** If paid override is available, this is the checkout URL */
  checkout_url: string | null;
  /** Current month usage for the repo */
  repo_usage_kg: number;
  /** Hard cap for the repo */
  hard_cap_kg: number;
  /** Overrides used this month */
  overrides_used: number;
  /** Max overrides allowed per month */
  max_overrides: number;
}

export interface RepoPolicyUpsertRequest {
  repo: string;
  budget_kg: number;
  warn_kg: number;
  hard_cap_kg?: number;
  max_overrides_per_month?: number;
}
