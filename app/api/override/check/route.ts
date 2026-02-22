/**
 * POST /api/override/check
 *
 * Called by gate_check.py when a gate blocks a PR.
 * Returns whether the user can override (admin free / developer paid)
 * and provides a checkout URL if applicable.
 *
 * Body: { api_key, repo, pr_number, emissions_kg, github_user, github_role }
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkOverrideEligibility } from "@/lib/override/queries";
import { OVERRIDE_UNIT_PRICE } from "@/lib/override/types";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (_e) {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const apiKey = (body.api_key as string) || request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 401 });
  }

  const { data: orgRow } = await supabaseAdmin
    .from("org_api_keys")
    .select("org_id")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (!orgRow) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  const repo = body.repo as string;
  const prNumber = Number(body.pr_number);
  const emissionsKg = Number(body.emissions_kg);
  const githubUser = body.github_user as string;
  const githubRole = body.github_role as string;

  if (!repo || !prNumber || isNaN(emissionsKg) || !githubUser || !githubRole) {
    return NextResponse.json(
      { error: "Missing required fields: repo, pr_number, emissions_kg, github_user, github_role." },
      { status: 400 }
    );
  }

  const eligibility = await checkOverrideEligibility(
    orgRow.org_id,
    repo,
    emissionsKg,
    githubRole,
    OVERRIDE_UNIT_PRICE
  );

  return NextResponse.json({
    allowed: eligibility.canOverride,
    reason: eligibility.reason,
    override_type: eligibility.overrideType,
    cost_usd: eligibility.costUsd,
    repo_usage_kg: eligibility.repoUsageKg,
    hard_cap_kg: eligibility.hardCapKg,
    overrides_used: eligibility.overridesUsed,
    max_overrides: eligibility.maxOverrides,
  });
}
