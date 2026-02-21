/**
 * Builds a DashboardReadModel from the user's real GitHub repos,
 * enriched with any gate_events data from Supabase.
 *
 * This replaces the MOCK_DASHBOARD fallback with actual repo data
 * so the dashboard preview and dashboard page show the user's real repos.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAllUserRepos, type GitHubRepo } from "@/lib/github/client";
import type { DashboardReadModel, GateEventRow, KpiItem, RepoReport } from "./types";

function round1(n: number) { return Math.round(n * 10) / 10; }
function round2(n: number) { return Math.round(n * 100) / 100; }

/**
 * Build dashboard data for a GitHub user using their real repos + any gate events.
 *
 * @param username  GitHub username (from user_metadata.user_name)
 * @param orgId     Optional: scope gate_events to this org. When null, queries globally.
 */
export async function getUserDashboardData(
  username: string,
  orgId?: string | null
): Promise<DashboardReadModel & { githubRepos: GitHubRepo[] }> {
  // 1. Fetch GitHubRepos first (we need the names for the gate query)
  const githubRepos = await getAllUserRepos(username);
  const repoNames = githubRepos.map((r) => r.fullName);

  // 2. Fetch gate events scoped to org + any repos the user is connected to
  const gateResult = await fetchGateEvents(orgId ?? null, repoNames);

  const gateEvents = gateResult.events;
  const totalEmissions = gateResult.totalEmissions;

  // ── KPIs ──────────────────────────────────────────────────────────────
  const crusoeSavings = gateEvents
    .filter((e) => e.status === "Rerouted to Crusoe")
    .reduce((s, e) => s + e.kgCO2e * 0.88, 0);
  const reroutedCount = gateEvents.filter((e) => e.status === "Rerouted to Crusoe").length;

  const kpis: KpiItem[] = [
    {
      label: "Emissions this month",
      value: totalEmissions > 0 ? `${round1(totalEmissions)} kgCO₂eq` : "0 kgCO₂eq",
      delta: gateEvents.length > 0
        ? `across ${new Set(gateEvents.map((e) => e.repo)).size} repos`
        : `${githubRepos.length} repos connected`,
      deltaPositive: true,
    },
    {
      label: "Gates triggered",
      value: String(gateEvents.length),
      delta: reroutedCount > 0 ? `${reroutedCount} rerouted` : "no PRs gated yet",
      deltaPositive: false,
    },
    {
      label: "Crusoe saves",
      value: crusoeSavings > 0 ? `${round1(crusoeSavings)} kgCO₂eq` : "—",
      delta: crusoeSavings > 0 ? "if rerouted" : "install action to start",
      deltaPositive: crusoeSavings > 0,
    },
    {
      label: "Carbon overage cost",
      value: "$0.00",
      delta: "within budget",
      deltaPositive: true,
    },
  ];

  // ── Budget ────────────────────────────────────────────────────────────
  const budgetKg = 50;
  const projectedKg = (() => {
    const day = new Date().getDate();
    return day > 0 ? (totalEmissions / day) * 30 : totalEmissions;
  })();

  // ── Repo reports (merge GitHub repos with gate data) ──────────────────
  const gateByRepo = new Map<string, { used: number; count: number }>();
  gateEvents.forEach((ev) => {
    const entry = gateByRepo.get(ev.repo) || { used: 0, count: 0 };
    entry.used += ev.kgCO2e;
    entry.count += 1;
    gateByRepo.set(ev.repo, entry);
  });

  const repoReports: RepoReport[] = githubRepos.slice(0, 20).map((gh) => {
    const gate = gateByRepo.get(gh.fullName);
    return {
      repo: gh.fullName,
      usedKg: gate ? round1(gate.used) : 0,
      budgetKg: 10.0,
      topContributor: gh.relation === "owned" ? "you (owner)" : "you (contributor)",
      totalGatesRun: gate?.count ?? 0,
    };
  });

  // Also add any gate repos that aren't in the GitHub repos list
  for (const [repoName, stats] of gateByRepo) {
    if (!repoReports.some((r) => r.repo === repoName)) {
      repoReports.push({
        repo: repoName,
        usedKg: round1(stats.used),
        budgetKg: 10.0,
        topContributor: "gate data",
        totalGatesRun: stats.count,
      });
    }
  }

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
    gateEvents: gateEvents.slice(0, 10),
    repoReports,
    githubRepos,
  };
}

// ── Internal: fetch gate events ──────────────────────────────────────────────

interface GateResult {
  events: GateEventRow[];
  totalEmissions: number;
}

interface RawGateEvent {
  id: string;
  repo: string;
  pr_number: number;
  emissions_kg: number;
  status: string;
  created_at: string;
}

/**
 * Fetch gate events via two strategies:
 *  1. By org_id — covers events from the user's own org
 *  2. By repo name ∈ user's GitHub repos — covers cross-org contributions
 *     (e.g. user opened a PR to another org's repo that has Carbon Gate installed)
 *
 * Results are merged and deduplicated by event id.
 */
async function fetchGateEvents(orgId: string | null, repoNames: string[]): Promise<GateResult> {
  try {
    const queries: Promise<{ data: RawGateEvent[] | null }>[] = [];

    // Query 1: events belonging to the user's own org
    if (orgId) {
      queries.push(
        (async () => {
          const { data } = await supabaseAdmin
            .from("gate_events")
            .select("id, repo, pr_number, gpu, region, emissions_kg, crusoe_emissions_kg, status, created_at")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false })
            .limit(50);
          return { data: data as RawGateEvent[] | null };
        })()
      );
    }

    // Query 2: events for repos the user owns/contributes to (cross-org)
    // Filter out repos already covered by the org query, and batch in groups of 20
    if (repoNames.length > 0) {
      // We query all of the user's repos — the org_id query dedup handles overlap
      const batches: string[][] = [];
      for (let i = 0; i < repoNames.length; i += 20) {
        batches.push(repoNames.slice(i, i + 20));
      }

      for (const batch of batches) {
        queries.push(
          (async () => {
            const { data } = await supabaseAdmin
              .from("gate_events")
              .select("id, repo, pr_number, gpu, region, emissions_kg, crusoe_emissions_kg, status, created_at")
              .in("repo", batch)
              .order("created_at", { ascending: false })
              .limit(50);
            return { data: data as RawGateEvent[] | null };
          })()
        );
      }
    }

    const results = await Promise.all(queries);

    // Merge and deduplicate by event id
    const seen = new Set<string>();
    const allRaw: RawGateEvent[] = [];
    for (const { data } of results) {
      if (data) {
        for (const row of data) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            allRaw.push(row);
          }
        }
      }
    }

    // Sort by most recent first
    allRaw.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (allRaw.length === 0) {
      return { events: [], totalEmissions: 0 };
    }

    const events: GateEventRow[] = allRaw.map((r) => ({
      id: r.id,
      prNumber: r.pr_number,
      repo: r.repo,
      branch: "—",
      kgCO2e: r.emissions_kg,
      status: (r.status === "pass" ? "Passed" : "Rerouted to Crusoe") as
        | "Passed"
        | "Rerouted to Crusoe",
      emittedAt: r.created_at,
    }));

    const totalEmissions = events.reduce((s, e) => s + e.kgCO2e, 0);
    return { events, totalEmissions };
  } catch (err) {
    console.error("[getUserDashboardData] gate_events query failed:", err);
    return { events: [], totalEmissions: 0 };
  }
}
