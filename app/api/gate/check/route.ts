import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { estimateEmissions } from "@/lib/emissions/calculate";
import { getOrgBudget, getBudgetStatus } from "@/lib/billing/budget";
import { reportUsageToStripe } from "@/lib/usage/report";

type GateCheckPayload = {
  repo: string;
  pr_number: number;
  gpu: string;
  estimated_hours: number;
  region: string;
  api_key?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GateCheckPayload;
  const { repo, pr_number, gpu, estimated_hours, region, api_key } = body;

  if (!repo || !pr_number || !gpu || !estimated_hours || !region) {
    return NextResponse.json(
      { error: "Missing required fields: repo, pr_number, gpu, estimated_hours, region" },
      { status: 400 }
    );
  }

  const orgId = await resolveOrgId(api_key);
  if (!orgId) {
    return NextResponse.json({ error: "Invalid or missing api_key" }, { status: 401 });
  }

  const emissions = estimateEmissions(gpu, estimated_hours, region);
  const budget = await getOrgBudget(orgId);
  const budgetStatus = await getBudgetStatus(orgId);

  const status = determineGateStatus(
    emissions.emissionsKg,
    budget.thresholdKgCo2,
    budget.warnKgCo2
  );

  const overageKg = Math.max(0, emissions.emissionsKg - budget.thresholdKgCo2);

  await supabaseAdmin.from("gate_checks").insert({
    org_id: orgId,
    repo,
    pr_number,
    gpu,
    estimated_hours,
    region,
    emissions_kg: emissions.emissionsKg,
    threshold_kg_co2: budget.thresholdKgCo2,
    warn_kg_co2: budget.warnKgCo2,
    status,
    overage_kg: overageKg
  });

  if ((status === "block" || status === "warn") && overageKg > 0) {
    await reportUsageToStripe(orgId, overageKg);
  }

  return NextResponse.json({
    emissions_kg: emissions.emissionsKg,
    crusoe_emissions_kg: emissions.crusoeEmissionsKg,
    budget_remaining_kg: budgetStatus.remainingKg,
    budget_pct_used: budgetStatus.percentUsed,
    status,
    overage_kg: overageKg,
    optimal_window: "wait 3 hours, save 34%",
    crusoe_available: true,
    crusoe_instance: selectCrusoeInstance(gpu),
    carbon_intensity: emissions.carbonIntensity,
    pue_used: emissions.pueUsed
  });
}

function determineGateStatus(
  emissionsKg: number,
  thresholdKg: number,
  warnKg: number
): "pass" | "warn" | "block" {
  if (emissionsKg >= thresholdKg) return "block";
  if (emissionsKg >= warnKg) return "warn";
  return "pass";
}

async function resolveOrgId(apiKey?: string): Promise<string | null> {
  if (!apiKey) return null;

  const { data } = await supabaseAdmin
    .from("billing_profiles")
    .select("org_id")
    .eq("org_api_key", apiKey)
    .maybeSingle();

  return (data?.org_id as string) ?? null;
}

function selectCrusoeInstance(gpu: string): string {
  const map: Record<string, string> = {
    A100: "a100-sxm-80gb-1x",
    H100: "h100-sxm-80gb-1x",
    V100: "v100-sxm-32gb-1x",
    A10: "a10-24gb-1x"
  };
  return map[gpu] ?? "h100-sxm-80gb-1x";
}
