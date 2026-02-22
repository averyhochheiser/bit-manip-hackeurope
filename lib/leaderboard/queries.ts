import { supabaseAdmin } from "@/lib/supabase/admin";

export interface LeaderboardEntry {
  name: string;        // contributor username, org name, or repo name
  gateCount: number;
  totalEmissionsKg: number;
  savedKg: number;     // emissions avoided: blocked jobs + Crusoe reroute savings
  repos: string[];     // distinct repos (for contributor/org view) or contributing orgs (for repo view)
}

/**
 * Carbon saved by a single gate event.
 *
 * - Blocked/soft-blocked PRs: 100% of estimated emissions were avoided.
 * - Crusoe-available events that passed/warned: grid → Crusoe delta is the saving.
 * - Pure pass with no Crusoe: 0 savings (job ran on dirty grid as normal).
 */
function savedKgForEvent(ev: {
  emissions_kg: number | null;
  crusoe_emissions_kg: number | null;
  status: string | null;
  crusoe_available?: boolean | null;
}): number {
  const emKg = ev.emissions_kg ?? 0;
  const crusoeKg = ev.crusoe_emissions_kg ?? 0;
  const status = ev.status ?? "";

  // Hard block / soft block — the job never ran, all emissions avoided
  if (status === "block" || status === "hard_block" || status === "soft_block") {
    return emKg;
  }

  // Crusoe rerouting — job ran on clean compute, saving the grid–Crusoe delta
  if (ev.crusoe_available && crusoeKg > 0 && emKg > crusoeKg) {
    return emKg - crusoeKg;
  }

  return 0;
}

/**
 * Leaderboard grouped by individual contributor.
 *
 * Uses the `contributor` column (GitHub username) when available, falling back
 * to the repo-owner prefix (e.g. "averyhochheiser" from "averyhochheiser/repo")
 * for older events that predate pr_author tracking.
 */
export async function getContributorLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await supabaseAdmin
    .from("gate_events")
    .select("contributor, repo, emissions_kg, crusoe_emissions_kg, crusoe_available, status");

  if (!data || data.length === 0) return [];

  const map = new Map<string, { gateCount: number; totalEmissionsKg: number; savedKg: number; repos: Set<string> }>();

  for (const ev of data) {
    const name =
      (ev as Record<string, unknown>).contributor as string | null |
      undefined ?? ev.repo?.split("/")[0] ?? "unknown";
    const entry = map.get(name) ?? { gateCount: 0, totalEmissionsKg: 0, savedKg: 0, repos: new Set() };
    entry.gateCount++;
    entry.totalEmissionsKg += ev.emissions_kg ?? 0;
    entry.savedKg += savedKgForEvent(ev);
    if (ev.repo) entry.repos.add(ev.repo);
    map.set(name, entry);
  }

  return Array.from(map.entries())
    .map(([name, stats]) => ({
      name,
      gateCount: stats.gateCount,
      totalEmissionsKg: round2(stats.totalEmissionsKg),
      savedKg: round2(stats.savedKg),
      repos: Array.from(stats.repos),
    }))
    .sort((a, b) => b.savedKg - a.savedKg)
    .slice(0, 50);
}

/**
 * Leaderboard grouped by organisation (GitHub org prefix of the repo).
 */
export async function getOrgLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await supabaseAdmin
    .from("gate_events")
    .select("repo, emissions_kg, crusoe_emissions_kg, crusoe_available, status");

  if (!data || data.length === 0) return [];

  const map = new Map<string, { gateCount: number; totalEmissionsKg: number; savedKg: number; repos: Set<string> }>();

  for (const ev of data) {
    const org = ev.repo?.split("/")[0] ?? "unknown";
    const entry = map.get(org) ?? { gateCount: 0, totalEmissionsKg: 0, savedKg: 0, repos: new Set() };
    entry.gateCount++;
    entry.totalEmissionsKg += ev.emissions_kg ?? 0;
    entry.savedKg += savedKgForEvent(ev);
    entry.repos.add(ev.repo);
    map.set(org, entry);
  }

  return Array.from(map.entries())
    .map(([name, stats]) => ({
      name,
      gateCount: stats.gateCount,
      totalEmissionsKg: round2(stats.totalEmissionsKg),
      savedKg: round2(stats.savedKg),
      repos: Array.from(stats.repos),
    }))
    .sort((a, b) => b.savedKg - a.savedKg)
    .slice(0, 20);
}

/**
 * Leaderboard grouped by repo — useful for open-source projects where multiple
 * organisations contribute to the same codebase.
 */
export async function getRepoLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await supabaseAdmin
    .from("gate_events")
    .select("repo, emissions_kg, crusoe_emissions_kg, crusoe_available, status");

  if (!data || data.length === 0) return [];

  const map = new Map<string, { gateCount: number; totalEmissionsKg: number; savedKg: number; orgs: Set<string> }>();

  for (const ev of data) {
    const repo = ev.repo ?? "unknown";
    const org = repo.split("/")[0];
    const entry = map.get(repo) ?? { gateCount: 0, totalEmissionsKg: 0, savedKg: 0, orgs: new Set() };
    entry.gateCount++;
    entry.totalEmissionsKg += ev.emissions_kg ?? 0;
    entry.savedKg += savedKgForEvent(ev);
    entry.orgs.add(org);
    map.set(repo, entry);
  }

  return Array.from(map.entries())
    .map(([name, stats]) => ({
      name,
      gateCount: stats.gateCount,
      totalEmissionsKg: round2(stats.totalEmissionsKg),
      savedKg: round2(stats.savedKg),
      repos: Array.from(stats.orgs),
    }))
    .sort((a, b) => b.savedKg - a.savedKg)
    .slice(0, 20);
}

function round2(n: number) { return Math.round(n * 100) / 100; }
