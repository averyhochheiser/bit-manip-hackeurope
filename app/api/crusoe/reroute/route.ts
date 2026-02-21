/**
 * POST /api/crusoe/reroute
 *
 * Triggered when a developer comments `/crusoe-run` on a PR (via the GitHub
 * Action). Looks up the latest gate event for that PR, computes what the
 * Crusoe run would look like, and returns a confirmation payload.
 *
 * In a full implementation this would also call Crusoe's job scheduling API
 * to actually spin up the compute. For the hackathon demo it records the
 * reroute intent and returns the emission savings.
 */

import { NextResponse }          from "next/server";
import { supabaseAdmin }         from "@/lib/supabase/admin";
import { getCrusoeAvailability } from "@/lib/crusoe/client";
import { calculateEmissions }    from "@/lib/carbon/calculator";
import { getCarbonIntensity }    from "@/lib/electricity-maps/client";

interface RerouteRequest {
  repo:      string;
  pr_number: number;
  api_key:   string;
}

export async function POST(request: Request) {
  let body: Partial<RerouteRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { repo, pr_number, api_key } = body;

  if (!api_key) {
    return NextResponse.json({ error: "Missing api_key." }, { status: 401 });
  }
  if (!repo || pr_number === undefined) {
    return NextResponse.json({ error: "Missing repo or pr_number." }, { status: 400 });
  }

  // ── Authenticate ──────────────────────────────────────────────────────────
  const { data: orgRow } = await supabaseAdmin
    .from("org_api_keys")
    .select("org_id")
    .eq("api_key", api_key)
    .maybeSingle();

  if (!orgRow) {
    return NextResponse.json({ error: "Invalid api_key." }, { status: 401 });
  }

  // ── Look up the most recent gate event for this PR ────────────────────────
  const { data: gateEvent } = await supabaseAdmin
    .from("gate_events")
    .select("*")
    .eq("org_id", orgRow.org_id)
    .eq("repo", repo)
    .eq("pr_number", pr_number)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!gateEvent) {
    return NextResponse.json(
      { error: "No gate event found for this PR. Run a gate check first." },
      { status: 404 }
    );
  }

  const { gpu, region, estimated_hours, emissions_kg } = gateEvent;

  // ── Check Crusoe availability ─────────────────────────────────────────────
  const crusoe = await getCrusoeAvailability(gpu);

  if (!crusoe.available) {
    return NextResponse.json(
      { error: "No Crusoe capacity currently available.", crusoe_available: false },
      { status: 503 }
    );
  }

  // ── Recalculate with Crusoe carbon intensity (5 gCO₂/kWh) ────────────────
  const crusoeEmissions = calculateEmissions({
    gpuType:                gpu,
    estimatedHours:         estimated_hours,
    carbonIntensityGPerKwh: 5, // Crusoe geothermal/solar
  });

  const currentIntensity = await getCarbonIntensity(region);
  const savingsPct = Math.round(((emissions_kg - crusoeEmissions.crusoeEmissionsKg) / emissions_kg) * 100);

  // ── Log the reroute decision ───────────────────────────────────────────────
  await supabaseAdmin.from("gate_events").insert({
    org_id:               orgRow.org_id,
    repo,
    pr_number,
    gpu,
    region:               "crusoe-clean",
    estimated_hours,
    emissions_kg:         crusoeEmissions.crusoeEmissionsKg,
    crusoe_emissions_kg:  crusoeEmissions.crusoeEmissionsKg,
    carbon_intensity:     5,
    pue_used:             crusoeEmissions.pueUsed,
    status:               "pass",
    crusoe_available:     true,
    crusoe_instance:      crusoe.recommendedModel,
  });

  return NextResponse.json({
    rerouted:            true,
    crusoe_model:        crusoe.recommendedModel,
    original_emissions_kg:  Math.round(emissions_kg * 100) / 100,
    crusoe_emissions_kg:    crusoeEmissions.crusoeEmissionsKg,
    savings_pct:            savingsPct,
    original_grid_intensity: currentIntensity,
    crusoe_grid_intensity:   5,
    message: `✅ Rerouted to Crusoe — ${savingsPct}% cleaner. Model: ${crusoe.recommendedModel}`,
  });
}
