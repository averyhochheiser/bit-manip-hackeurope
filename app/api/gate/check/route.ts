/**
 * POST /api/gate/check
 *
 * Called by the Carbon Gate GitHub Action (gate_check.py) on every PR.
 * Authenticates the org via api_key, calculates carbon emissions using
 * real-time grid data + advanced physics, queries Crusoe for availability,
 * persists the event, and returns the gate decision.
 *
 * Request body:
 *   { repo, pr_number, gpu, estimated_hours, region, api_key }
 *
 * Response:
 *   { emissions_kg, crusoe_emissions_kg, budget_remaining_kg, status,
 *     optimal_window, crusoe_available, crusoe_instance,
 *     carbon_intensity, pue_used }
 */

import { NextResponse }               from "next/server";
import { supabaseAdmin }              from "@/lib/supabase/admin";
import { getCarbonIntensity }         from "@/lib/electricity-maps/client";
import { getCrusoeAvailability }      from "@/lib/crusoe/client";
import { calculateEmissions, forecastOptimalWindow } from "@/lib/carbon/calculator";

// ── Request / response types ─────────────────────────────────────────────────

interface GateCheckRequest {
  repo:             string;
  pr_number:        number;
  gpu:              string;
  estimated_hours:  number;
  region:           string;
  api_key:          string;
}

interface GateCheckResponse {
  emissions_kg:         number;
  crusoe_emissions_kg:  number;
  budget_remaining_kg:  number;
  status:               "pass" | "warn" | "block";
  optimal_window:       string;
  crusoe_available:     boolean;
  crusoe_instance:      string | null;
  carbon_intensity:     number;
  pue_used:             number;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // ── 1. Parse & validate input ───────────────────────────────────────────
  let body: Partial<GateCheckRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { repo, pr_number, gpu, estimated_hours, region, api_key } = body;

  if (!api_key) {
    return NextResponse.json({ error: "Missing api_key." }, { status: 401 });
  }
  if (!gpu || !estimated_hours || !region) {
    return NextResponse.json(
      { error: "Missing required fields: gpu, estimated_hours, region." },
      { status: 400 }
    );
  }

  // ── 2. Authenticate org via API key ────────────────────────────────────
  const { data: orgRow, error: orgError } = await supabaseAdmin
    .from("org_api_keys")
    .select("org_id")
    .eq("api_key", api_key)
    .maybeSingle();

  if (orgError || !orgRow) {
    return NextResponse.json({ error: "Invalid or unknown api_key." }, { status: 401 });
  }

  const orgId = orgRow.org_id as string;

  // ── 3. Fetch real-time carbon intensity ────────────────────────────────
  const carbonIntensity = await getCarbonIntensity(region);

  // ── 4. Calculate emissions (thermodynamic PUE + embodied carbon) ───────
  const emissions = calculateEmissions({
    gpuType:                gpu,
    estimatedHours:         estimated_hours,
    carbonIntensityGPerKwh: carbonIntensity,
    // TODO: wire in real ambient temp from a weather API
    ambientTempC:           20,
  });

  // ── 5. Fetch org carbon budget ─────────────────────────────────────────
  const { data: budget } = await supabaseAdmin
    .from("carbon_budget")
    .select("included_kg, warning_pct")
    .eq("org_id", orgId)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: usage } = await supabaseAdmin
    .from("org_usage_mtd")
    .select("used_kg")
    .eq("org_id", orgId)
    .maybeSingle();

  const includedKg  = budget?.included_kg  ?? 50;
  const warningPct  = budget?.warning_pct  ?? 80;
  const usedKg      = usage?.used_kg       ?? 0;
  const budgetRemainingKg = Math.max(0, includedKg - usedKg);

  // ── 6. Gate decision ───────────────────────────────────────────────────
  const thresholdKg = includedKg;                         // block at 100 %
  const warnKg      = includedKg * (warningPct / 100);   // warn at warning_pct %
  const projectedUsed = usedKg + emissions.emissionsKg;

  let status: "pass" | "warn" | "block";
  if (projectedUsed >= thresholdKg) {
    status = "block";
  } else if (projectedUsed >= warnKg) {
    status = "warn";
  } else {
    status = "pass";
  }

  // ── 7. Crusoe availability ─────────────────────────────────────────────
  const crusoe = await getCrusoeAvailability(gpu);

  // ── 8. Optimal window forecast ─────────────────────────────────────────
  const optimalWindow = forecastOptimalWindow(carbonIntensity, region, new Date());

  // ── 9. Persist gate event ──────────────────────────────────────────────
  await supabaseAdmin.from("gate_events").insert({
    org_id:               orgId,
    repo:                 repo ?? "unknown",
    pr_number:            pr_number ?? 0,
    gpu,
    region,
    estimated_hours,
    emissions_kg:         emissions.emissionsKg,
    crusoe_emissions_kg:  emissions.crusoeEmissionsKg,
    carbon_intensity:     carbonIntensity,
    pue_used:             emissions.pueUsed,
    status,
    crusoe_available:     crusoe.available,
    crusoe_instance:      crusoe.recommendedModel,
  });

  // ── 10. Return response ────────────────────────────────────────────────
  const response: GateCheckResponse = {
    emissions_kg:         emissions.emissionsKg,
    crusoe_emissions_kg:  emissions.crusoeEmissionsKg,
    budget_remaining_kg:  Math.round(budgetRemainingKg * 100) / 100,
    status,
    optimal_window:       optimalWindow,
    crusoe_available:     crusoe.available,
    crusoe_instance:      crusoe.recommendedModel,
    carbon_intensity:     carbonIntensity,
    pue_used:             emissions.pueUsed,
  };

  return NextResponse.json(response);
}
