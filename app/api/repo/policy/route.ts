/**
 * GET  /api/repo/policy?org_id=...&repo=...   → Get repo policy
 * POST /api/repo/policy                        → Upsert repo policy
 *
 * Auth: org API key (via x-api-key header or body.api_key)
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getRepoPolicy,
  getOrgRepoPolicies,
  upsertRepoPolicy,
} from "@/lib/override/queries";
import { EU_HARD_CAP_KG, DEFAULT_MAX_OVERRIDES } from "@/lib/override/types";

async function authenticateOrg(
  request: Request
): Promise<{ orgId: string } | NextResponse> {
  const apiKey =
    request.headers.get("x-api-key") ??
    (request.method === "POST"
      ? ((await request.clone().json().catch(() => ({}))) as Record<string, unknown>)
          .api_key
      : new URL(request.url).searchParams.get("api_key"));

  if (!apiKey || typeof apiKey !== "string") {
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

  return { orgId: orgRow.org_id };
}

export async function GET(request: Request) {
  const auth = await authenticateOrg(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const repo = searchParams.get("repo");

  if (repo) {
    const policy = await getRepoPolicy(auth.orgId, repo);
    if (!policy) {
      return NextResponse.json({
        repo,
        budget_kg: 10.0,
        warn_kg: 5.0,
        hard_cap_kg: EU_HARD_CAP_KG,
        max_overrides_per_month: DEFAULT_MAX_OVERRIDES,
        _default: true,
      });
    }
    return NextResponse.json(policy);
  }

  // No repo specified → return all policies for the org
  const policies = await getOrgRepoPolicies(auth.orgId);
  return NextResponse.json({ policies });
}

export async function POST(request: Request) {
  const auth = await authenticateOrg(request);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (_e) {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const repo = body.repo as string;
  const budgetKg = Number(body.budget_kg);
  const warnKg = Number(body.warn_kg);

  if (!repo || isNaN(budgetKg) || isNaN(warnKg)) {
    return NextResponse.json(
      { error: "Missing required fields: repo, budget_kg, warn_kg." },
      { status: 400 }
    );
  }

  const hardCapKg = body.hard_cap_kg != null ? Number(body.hard_cap_kg) : undefined;
  const maxOverrides =
    body.max_overrides_per_month != null
      ? Number(body.max_overrides_per_month)
      : undefined;

  // Enforce: hard_cap_kg cannot exceed EU limit
  if (hardCapKg != null && hardCapKg > EU_HARD_CAP_KG) {
    return NextResponse.json(
      {
        error: `hard_cap_kg cannot exceed EU limit of ${EU_HARD_CAP_KG} kgCO₂/month.`,
      },
      { status: 400 }
    );
  }

  const policy = await upsertRepoPolicy(auth.orgId, repo, {
    budget_kg: budgetKg,
    warn_kg: warnKg,
    hard_cap_kg: hardCapKg,
    max_overrides_per_month: maxOverrides,
  });

  return NextResponse.json(policy);
}
