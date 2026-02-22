/**
 * Database queries for override & repo-policy system.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  EU_HARD_CAP_KG,
  DEFAULT_MAX_OVERRIDES,
  type RepoPolicy,
  type OverrideEvent,
} from "./types";

// ── Repo Policies ───────────────────────────────────────────────────────────

export async function getRepoPolicy(
  orgId: string,
  repo: string
): Promise<RepoPolicy | null> {
  const { data } = await supabaseAdmin
    .from("repo_policies")
    .select("*")
    .eq("org_id", orgId)
    .eq("repo", repo)
    .maybeSingle();
  return data;
}

export async function getOrgRepoPolicies(
  orgId: string
): Promise<RepoPolicy[]> {
  const { data } = await supabaseAdmin
    .from("repo_policies")
    .select("*")
    .eq("org_id", orgId)
    .order("repo");
  return data ?? [];
}

export async function upsertRepoPolicy(
  orgId: string,
  repo: string,
  policy: {
    budget_kg: number;
    warn_kg: number;
    hard_cap_kg?: number;
    max_overrides_per_month?: number;
  }
): Promise<RepoPolicy | null> {
  const { data } = await supabaseAdmin
    .from("repo_policies")
    .upsert(
      {
        org_id: orgId,
        repo,
        budget_kg: policy.budget_kg,
        warn_kg: policy.warn_kg,
        hard_cap_kg: policy.hard_cap_kg ?? EU_HARD_CAP_KG,
        max_overrides_per_month:
          policy.max_overrides_per_month ?? DEFAULT_MAX_OVERRIDES,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,repo" }
    )
    .select()
    .single();
  return data;
}

// ── Override Events ─────────────────────────────────────────────────────────

export async function createOverrideEvent(
  event: Omit<OverrideEvent, "id" | "created_at">
): Promise<OverrideEvent | null> {
  const { data } = await supabaseAdmin
    .from("override_events")
    .insert(event)
    .select()
    .single();
  return data;
}

export async function updateOverrideStatus(
  overrideId: string,
  status: OverrideEvent["status"]
): Promise<void> {
  await supabaseAdmin
    .from("override_events")
    .update({ status })
    .eq("id", overrideId);
}

export async function getOverrideCountThisMonth(
  orgId: string,
  repo: string
): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("override_events")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("repo", repo)
    .in("status", ["approved", "completed"])
    .gte("created_at", monthStart.toISOString());

  return count ?? 0;
}

export async function getPendingOverride(
  repo: string,
  prNumber: number
): Promise<OverrideEvent | null> {
  const { data } = await supabaseAdmin
    .from("override_events")
    .select("*")
    .eq("repo", repo)
    .eq("pr_number", prNumber)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getApprovedOverride(
  repo: string,
  prNumber: number
): Promise<OverrideEvent | null> {
  const { data } = await supabaseAdmin
    .from("override_events")
    .select("*")
    .eq("repo", repo)
    .eq("pr_number", prNumber)
    .in("status", ["approved", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// ── Repo Usage ──────────────────────────────────────────────────────────────

export async function getRepoUsageThisMonth(
  orgId: string,
  repo: string
): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const periodStart = monthStart.toISOString().split("T")[0];

  const { data } = await supabaseAdmin
    .from("repo_usage_mtd")
    .select("used_kg")
    .eq("org_id", orgId)
    .eq("repo", repo)
    .eq("period_start", periodStart)
    .maybeSingle();

  return data?.used_kg ?? 0;
}

export async function incrementRepoUsage(
  orgId: string,
  repo: string,
  additionalKg: number
): Promise<void> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const periodStart = monthStart.toISOString().split("T")[0];

  // Upsert: add to existing or create new row
  const current = await getRepoUsageThisMonth(orgId, repo);
  await supabaseAdmin.from("repo_usage_mtd").upsert(
    {
      org_id: orgId,
      repo,
      used_kg: current + additionalKg,
      period_start: periodStart,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,repo,period_start" }
  );
}

// ── Override Eligibility Check ──────────────────────────────────────────────

export interface OverrideEligibility {
  canOverride: boolean;
  reason: string;
  overrideType: "admin" | "paid" | null;
  costUsd: number | null;
  repoUsageKg: number;
  hardCapKg: number;
  overridesUsed: number;
  maxOverrides: number;
}

/**
 * Check whether a user can override a gate block for a specific PR.
 *
 * Rules:
 * 1. If emissions + current usage > hard_cap_kg → BLOCKED (EU compliance, no override possible)
 * 2. If overrides this month >= max_overrides_per_month → BLOCKED
 * 3. If role is admin/maintain → free override allowed
 * 4. If role is write (developer) → paid override at $2/kgCO₂ overage
 * 5. If role is read/none → no override
 */
export async function checkOverrideEligibility(
  orgId: string,
  repo: string,
  emissionsKg: number,
  githubRole: string,
  unitPrice: number = 2.0
): Promise<OverrideEligibility> {
  const policy = await getRepoPolicy(orgId, repo);
  const hardCapKg = policy?.hard_cap_kg ?? EU_HARD_CAP_KG;
  const maxOverrides = policy?.max_overrides_per_month ?? DEFAULT_MAX_OVERRIDES;
  const budgetKg = policy?.budget_kg ?? 10.0;

  const repoUsageKg = await getRepoUsageThisMonth(orgId, repo);
  const overridesUsed = await getOverrideCountThisMonth(orgId, repo);

  const base = { repoUsageKg, hardCapKg, overridesUsed, maxOverrides };

  // Rule 1: EU hard cap
  if (repoUsageKg + emissionsKg > hardCapKg) {
    return {
      ...base,
      canOverride: false,
      reason: `EU compliance: this would put repo at ${(repoUsageKg + emissionsKg).toFixed(1)} kgCO₂, exceeding the ${hardCapKg} kgCO₂/month hard cap. No override possible.`,
      overrideType: null,
      costUsd: null,
    };
  }

  // Rule 2: Monthly override limit
  if (overridesUsed >= maxOverrides) {
    return {
      ...base,
      canOverride: false,
      reason: `Override limit reached: ${overridesUsed}/${maxOverrides} overrides used this month for this repo.`,
      overrideType: null,
      costUsd: null,
    };
  }

  // Permission hierarchy
  const ROLE_LEVEL: Record<string, number> = {
    admin: 4,
    maintain: 3,
    write: 2,
    read: 1,
    none: 0,
  };
  const level = ROLE_LEVEL[githubRole] ?? 0;

  // Rule 3: Admin/maintain → free override
  if (level >= 3) {
    return {
      ...base,
      canOverride: true,
      reason: "Admin override available (free).",
      overrideType: "admin",
      costUsd: 0,
    };
  }

  // Rule 4: Developer (write) → paid override
  if (level >= 2) {
    const overageKg = Math.max(0, repoUsageKg + emissionsKg - budgetKg);
    const cost = Math.round(overageKg * unitPrice * 100) / 100;
    return {
      ...base,
      canOverride: true,
      reason: `Paid override available: $${cost.toFixed(2)} (${overageKg.toFixed(1)} kgCO₂ × $${unitPrice}/kg).`,
      overrideType: "paid",
      costUsd: cost,
    };
  }

  // Rule 5: Read/none → no override
  return {
    ...base,
    canOverride: false,
    reason: "Insufficient permissions. Only admins and developers (write access) can override.",
    overrideType: null,
    costUsd: null,
  };
}
