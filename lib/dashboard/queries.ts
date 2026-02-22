/**
 * Dashboard read model — aggregates data from Supabase for the dashboard page.
 * Falls back gracefully to mock data if the DB is unavailable or rows are missing.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { MOCK_DASHBOARD } from "./mock-data";
import type { DashboardReadModel, GateEventDbRow, GateEventRow, KpiItem, RepoReport } from "./types";

export async function getDashboardReadModel(): Promise<DashboardReadModel> {
  try {
    // ── Budget ──────────────────────────────────────────────────────────────
    const { data: budget } = await supabaseAdmin
      .from("carbon_budget")
      .select("included_kg, warning_pct")
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: usage } = await supabaseAdmin
      .from("org_usage_mtd")
      .select("used_kg")
      .limit(1)
      .maybeSingle();

    const includedKg = budget?.included_kg ?? MOCK_DASHBOARD.budget.includedKg;
    const warningPct = budget?.warning_pct ?? MOCK_DASHBOARD.budget.warningPct;
    const usedKg = usage?.used_kg ?? MOCK_DASHBOARD.budget.usedKg;

    // Naive linear projection to end of 30-day period based on burn rate so far
    const dayOfMonth = new Date().getDate();
    const projectedKg = dayOfMonth > 0 ? (usedKg / dayOfMonth) * 30 : usedKg;

    // ── Gate events ─────────────────────────────────────────────────────────
    const { data: rawEvents } = await supabaseAdmin
      .from("gate_events")
      .select(
        "id, repo, pr_number, gpu, region, emissions_kg, crusoe_emissions_kg, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    const gateEvents: GateEventRow[] = rawEvents
      ? (rawEvents as GateEventDbRow[]).map((r) => ({
        id: r.id,
        prNumber: r.pr_number,
        repo: r.repo,
        branch: "—",  // branch not stored in DB; populated by action in future
        kgCO2e: r.emissions_kg,
        status: r.status === "pass" ? "Passed" : "Rerouted to Crusoe",
        emittedAt: r.created_at,
      }))
      : MOCK_DASHBOARD.gateEvents;

    // ── Billing ─────────────────────────────────────────────────────────────
    const UNIT_PRICE = 2.0; // $2 / kgCO₂ overage
    const overageKg = Math.max(0, usedKg - includedKg);
    const estimatedCharge = overageKg * UNIT_PRICE;

    // ── KPIs ────────────────────────────────────────────────────────────────
    // Crusoe saves ≈88% of emissions on average (geothermal vs typical grid)
    const totalCrusoeSavings = gateEvents.reduce(
      (sum, e) => sum + e.kgCO2e * 0.88,
      0
    );

    const reroutedCount = gateEvents.filter((e) => e.status === "Rerouted to Crusoe").length;

    const kpis: KpiItem[] = [
      {
        label: "Emissions this month",
        value: `${usedKg.toFixed(1)} kgCO₂eq`,
        delta: `${((usedKg / includedKg) * 100).toFixed(0)}% of budget`,
        deltaPositive: usedKg < includedKg * (warningPct / 100),
      },
      {
        label: "Gates triggered",
        value: String(gateEvents.length),
        delta: `${reroutedCount} rerouted to Crusoe`,
        deltaPositive: false,
      },
      {
        label: "Crusoe potential save",
        value: `${totalCrusoeSavings.toFixed(1)} kgCO₂eq`,
        delta: "if all rerouted",
        deltaPositive: true,
      },
      {
        label: "Overage cost",
        value: estimatedCharge > 0 ? `$${estimatedCharge.toFixed(2)}` : "$0.00",
        delta: estimatedCharge > 0 ? `${overageKg.toFixed(1)} kg over` : "within budget",
        deltaPositive: estimatedCharge === 0,
      },
    ];

    // ── Repo Reports Aggregation ───────────────────────────────────────────
    const repoMap = new Map<string, { used: number; count: number }>();
    gateEvents.forEach((ev) => {
      const entry = repoMap.get(ev.repo) || { used: 0, count: 0 };
      entry.used += ev.kgCO2e;
      entry.count += 1;
      repoMap.set(ev.repo, entry);
    });

    const repoReports: RepoReport[] = Array.from(repoMap.entries()).map(([name, stats]) => ({
      repo: name,
      usedKg: round1(stats.used),
      budgetKg: 10.0,
      topContributor: "PR Author",
      totalGatesRun: stats.count,
    }));

    return {
      kpis,
      budget: { usedKg, includedKg, projectedKg: round1(projectedKg), warningPct },
      billing: { unitPrice: UNIT_PRICE, estimatedOverageKg: round2(overageKg), estimatedCharge: round2(estimatedCharge) },
      gateEvents,
      repoReports,
    };
  } catch (err) {
    console.error("[dashboard] read model failed, using mock data:", err);
    return MOCK_DASHBOARD;
  }
}

function round1(n: number) { return Math.round(n * 10) / 10; }
function round2(n: number) { return Math.round(n * 100) / 100; }
