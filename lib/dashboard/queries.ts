/**
 * Dashboard read model — aggregates data from Supabase for the dashboard page.
 * All queries are scoped to the authenticated user's org_id.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { DashboardReadModel, GateEventDbRow, GateEventRow, KpiItem, RepoReport } from "./types";

export async function getDashboardReadModel(orgId: string): Promise<DashboardReadModel> {
  try {
    // ── Budget ──────────────────────────────────────────────────────────────
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
      .limit(1)
      .maybeSingle();

    const includedKg = budget?.included_kg ?? 50;
    const warningPct = budget?.warning_pct ?? 80;
    const usedKg = usage?.used_kg ?? 0;

    // Naive linear projection to end of 30-day period based on burn rate so far
    const dayOfMonth = new Date().getDate();
    const projectedKg = dayOfMonth > 0 ? (usedKg / dayOfMonth) * 30 : usedKg;

    // ── Gate events ─────────────────────────────────────────────────────────
    const { data: rawEvents } = await supabaseAdmin
      .from("gate_events")
      .select(
        "id, repo, pr_number, gpu, region, emissions_kg, crusoe_emissions_kg, status, created_at"
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    const gateEvents: GateEventRow[] = (rawEvents ?? []).map((r: GateEventDbRow) => ({
      id: r.id,
      prNumber: r.pr_number,
      repo: r.repo,
      branch: "—",
      kgCO2e: r.emissions_kg,
      status: r.status === "pass" ? "Passed" : "Rerouted to Crusoe",
      emittedAt: r.created_at,
    }));

    // ── Billing ─────────────────────────────────────────────────────────────
    const UNIT_PRICE = 2.0; // $2 / kgCO₂ overage
    const overageKg = Math.max(0, usedKg - includedKg);
    const estimatedCharge = overageKg * UNIT_PRICE;

    // ── KPIs ────────────────────────────────────────────────────────────────
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
    console.error("[dashboard] read model failed:", err);
    throw err;
  }
}

/**
 * Repos the given GitHub username appears in as a PR author (contributor),
 * across *all* orgs — not just their own. Used to surface open-source /
 * cross-org repos on the dashboard.
 */
export async function getContributorRepos(githubUsername: string): Promise<RepoReport[]> {
  if (!githubUsername) return [];

  const { data } = await supabaseAdmin
    .from("gate_events")
    .select("repo, emissions_kg, status, contributor")
    .eq("contributor", githubUsername)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return [];

  const repoMap = new Map<string, { used: number; count: number }>();
  for (const row of data) {
    const entry = repoMap.get(row.repo) ?? { used: 0, count: 0 };
    entry.used += row.emissions_kg ?? 0;
    entry.count += 1;
    repoMap.set(row.repo, entry);
  }

  return Array.from(repoMap.entries()).map(([name, stats]) => ({
    repo: name,
    usedKg: round1(stats.used),
    budgetKg: 10.0,
    topContributor: githubUsername,
    totalGatesRun: stats.count,
  }));
}

/** Derive the unique repos that have run gate checks for this org. */
export async function getOrgRepos(orgId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("gate_events")
    .select("repo")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (!data) return [];
  const unique = Array.from(new Set(data.map((r: { repo: string }) => r.repo)));
  return unique;
}

/**
 * Global aggregate across ALL orgs — powers the marketing page preview.
 * Falls back to MOCK_DASHBOARD when no real gate events exist yet.
 */
export async function getGlobalDashboardPreview(): Promise<DashboardReadModel> {
  try {
    const { data: rawEvents } = await supabaseAdmin
      .from("gate_events")
      .select(
        "id, repo, pr_number, gpu, region, emissions_kg, crusoe_emissions_kg, status, created_at, contributor"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (!rawEvents || rawEvents.length === 0) {
      // No live data yet — show mock so the preview isn't blank
      const { MOCK_DASHBOARD } = await import("./mock-data");
      return MOCK_DASHBOARD;
    }

    const gateEvents: GateEventRow[] = rawEvents.map((r: GateEventDbRow & { contributor?: string }) => ({
      id: r.id,
      prNumber: r.pr_number,
      repo: r.repo,
      branch: r.contributor ?? "—",
      kgCO2e: r.emissions_kg,
      status: r.status === "pass" ? "Passed" as const : "Rerouted to Crusoe" as const,
      emittedAt: r.created_at,
    }));

    const totalEmissions = gateEvents.reduce((s, e) => s + e.kgCO2e, 0);
    const crusoeSavings = gateEvents
      .filter((e) => e.status === "Rerouted to Crusoe")
      .reduce((s, e) => s + e.kgCO2e * 0.88, 0);
    const reroutedCount = gateEvents.filter((e) => e.status === "Rerouted to Crusoe").length;
    const uniqueRepos = new Set(gateEvents.map((e) => e.repo));

    const kpis: KpiItem[] = [
      {
        label: "Emissions this month",
        value: `${round1(totalEmissions)} kgCO₂eq`,
        delta: `across ${uniqueRepos.size} repos`,
        deltaPositive: false,
      },
      {
        label: "Gates triggered",
        value: String(gateEvents.length),
        delta: `${reroutedCount} rerouted to Crusoe`,
        deltaPositive: false,
      },
      {
        label: "Crusoe saves",
        value: `${round1(crusoeSavings)} kgCO₂eq`,
        delta: "if rerouted",
        deltaPositive: true,
      },
      {
        label: "Carbon overage cost",
        value: "$0.00",
        delta: "within budget",
        deltaPositive: true,
      },
    ];

    const budgetKg = 50;
    const projectedKg = (() => {
      const day = new Date().getDate();
      return day > 0 ? (totalEmissions / day) * 30 : totalEmissions;
    })();

    // Repo-level aggregation
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
      budgetKg: 20.0,
      topContributor: "PR Author",
      totalGatesRun: stats.count,
    }));

    return {
      kpis,
      budget: {
        usedKg: round1(totalEmissions),
        includedKg: budgetKg,
        projectedKg: round1(projectedKg),
        warningPct: 80,
      },
      billing: {
        unitPrice: 2.0,
        estimatedOverageKg: round2(Math.max(0, totalEmissions - budgetKg)),
        estimatedCharge: round2(Math.max(0, (totalEmissions - budgetKg) * 2.0)),
      },
      gateEvents: gateEvents.slice(0, 5),
      repoReports,
    };
  } catch (err) {
    console.error("[dashboard] global preview failed, using mock:", err);
    const { MOCK_DASHBOARD } = await import("./mock-data");
    return MOCK_DASHBOARD;
  }
}

function round1(n: number) { return Math.round(n * 10) / 10; }
function round2(n: number) { return Math.round(n * 100) / 100; }
