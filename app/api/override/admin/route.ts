/**
 * POST /api/override/admin
 *
 * Admin override — free, no payment required.
 * Called by gate_check.py when an admin applies the carbon-override label.
 *
 * Body: { api_key, repo, pr_number, github_user, emissions_kg, justification? }
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  checkOverrideEligibility,
  createOverrideEvent,
  incrementRepoUsage,
} from "@/lib/override/queries";

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
  const justification = (body.justification as string) || null;

  if (!repo || !prNumber || isNaN(emissionsKg) || !githubUser) {
    return NextResponse.json(
      { error: "Missing required fields: repo, pr_number, emissions_kg, github_user." },
      { status: 400 }
    );
  }

  // Verify admin eligibility
  const eligibility = await checkOverrideEligibility(
    orgRow.org_id,
    repo,
    emissionsKg,
    "admin" // We trust the caller verified the role — the API key authenticates the org
  );

  if (!eligibility.canOverride) {
    return NextResponse.json(
      { error: eligibility.reason, allowed: false },
      { status: 403 }
    );
  }

  // Create approved override record
  const overrideEvent = await createOverrideEvent({
    org_id: orgRow.org_id,
    repo,
    pr_number: prNumber,
    github_user: githubUser,
    github_role: "admin",
    override_type: "admin",
    emissions_kg: emissionsKg,
    cost_usd: 0,
    stripe_session_id: null,
    status: "approved",
    justification,
  });

  if (!overrideEvent) {
    return NextResponse.json(
      { error: "Failed to create override record." },
      { status: 500 }
    );
  }

  // Track usage
  await incrementRepoUsage(orgRow.org_id, repo, emissionsKg);

  return NextResponse.json({
    override_id: overrideEvent.id,
    allowed: true,
    message: `Admin override approved for PR #${prNumber}. ${emissionsKg.toFixed(1)} kgCO₂ added to repo usage.`,
  });
}
