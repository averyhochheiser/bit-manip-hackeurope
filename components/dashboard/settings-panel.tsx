"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { GitBranch, Users, Building2, Plus, Trash2, Loader2, Save } from "lucide-react";

type SettingsPanelProps = {
  defaultBudgetKg: number;
  warningPct: number;
};

type RepoPolicy = {
  repo: string;
  budget_kg: number;
  warn_kg: number;
  hard_cap_kg: number;
  max_overrides_per_month: number;
  _default?: boolean;
  _dirty?: boolean;
};

const MOCK_TEAMS = [
  { name: "ML Platform", members: 6, budgetKg: 50 },
  { name: "Data Eng", members: 4, budgetKg: 25 },
  { name: "Infra", members: 3, budgetKg: 15 },
];

const EU_HARD_CAP_KG = 20;

export function SettingsPanel({ defaultBudgetKg, warningPct }: SettingsPanelProps) {
  const [budgetKg, setBudgetKg] = useState(defaultBudgetKg);
  const [warning, setWarning] = useState(warningPct);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"org" | "repos" | "teams">("org");

  // Repo policy state
  const [repoPolicies, setRepoPolicies] = useState<RepoPolicy[]>([]);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoSaving, setRepoSaving] = useState(false);
  const [repoStatus, setRepoStatus] = useState<string | null>(null);
  const [newRepo, setNewRepo] = useState("");

  // Fetch repo policies on tab switch
  const fetchRepoPolicies = useCallback(async () => {
    setRepoLoading(true);
    setRepoStatus(null);
    try {
      const res = await fetch("/api/repo/policy", {
        headers: { "x-api-key": "demo" }, // TODO: use real org key from session
      });
      if (res.ok) {
        const data = await res.json();
        setRepoPolicies(
          (data.policies ?? []).map((p: RepoPolicy) => ({ ...p, _dirty: false }))
        );
      } else {
        setRepoStatus("Could not load repo policies.");
      }
    } catch {
      setRepoStatus("Network error loading policies.");
    }
    setRepoLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "repos") fetchRepoPolicies();
  }, [activeTab, fetchRepoPolicies]);

  function updateRepoField(repo: string, field: keyof RepoPolicy, value: number) {
    setRepoPolicies((prev) =>
      prev.map((p) => (p.repo === repo ? { ...p, [field]: value, _dirty: true } : p))
    );
  }

  function removeRepo(repo: string) {
    setRepoPolicies((prev) => prev.filter((p) => p.repo !== repo));
  }

  function addRepo() {
    const name = newRepo.trim();
    if (!name || repoPolicies.some((p) => p.repo === name)) return;
    setRepoPolicies((prev) => [
      ...prev,
      {
        repo: name,
        budget_kg: 10,
        warn_kg: 5,
        hard_cap_kg: EU_HARD_CAP_KG,
        max_overrides_per_month: 5,
        _dirty: true,
      },
    ]);
    setNewRepo("");
  }

  async function saveRepoPolicies() {
    setRepoSaving(true);
    setRepoStatus(null);
    const dirtyPolicies = repoPolicies.filter((p) => p._dirty);
    let ok = true;
    for (const p of dirtyPolicies) {
      try {
        const res = await fetch("/api/repo/policy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "demo",
          },
          body: JSON.stringify({
            repo: p.repo,
            budget_kg: p.budget_kg,
            warn_kg: p.warn_kg,
            hard_cap_kg: p.hard_cap_kg,
            max_overrides_per_month: p.max_overrides_per_month,
          }),
        });
        if (!res.ok) ok = false;
      } catch {
        ok = false;
      }
    }
    setRepoSaving(false);
    if (ok) {
      setRepoStatus(dirtyPolicies.length ? "Saved." : "No changes to save.");
      setRepoPolicies((prev) => prev.map((p) => ({ ...p, _dirty: false })));
    } else {
      setRepoStatus("Some policies failed to save.");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving...");
    const response = await fetch("/api/usage/ingest", {
      method: "POST",
      body: JSON.stringify({ mode: "settings-preview", budgetKg, warningPct: warning }),
    });
    setStatus(response.ok ? "Saved." : "Could not save yet.");
  }

  async function openBillingPortal() {
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const payload = (await response.json()) as { url?: string };
    if (payload.url) window.location.href = payload.url;
  }

  async function startSubscription() {
    const response = await fetch("/api/stripe/checkout", { method: "POST" });
    const payload = (await response.json()) as { url?: string };
    if (payload.url) window.location.href = payload.url;
  }

  const tabs = [
    { id: "org" as const, label: "Organisation", icon: <Building2 size={14} /> },
    { id: "repos" as const, label: "Repositories", icon: <GitBranch size={14} /> },
    { id: "teams" as const, label: "Teams", icon: <Users size={14} /> },
  ];

  return (
    <section className="panel p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-floral">Policy Settings</h2>
        <p className="mt-1 text-sm text-floral/55">
          Configure carbon budgets per organisation, repository, and team.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl border border-floral/10 bg-floral/[0.03] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-floral/10 text-floral shadow-insetGlow"
                : "text-floral/50 hover:text-floral/75"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Organisation tab */}
      {activeTab === "org" && (
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm text-floral/75">
            Organisation monthly budget (kgCO₂e)
            <input
              type="number"
              value={budgetKg}
              onChange={(e) => setBudgetKg(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-floral/15 bg-gate-bg/80 px-3 py-2 font-monoData text-floral outline-none ring-crusoe/50 focus:ring-2"
            />
          </label>
          <label className="block text-sm text-floral/75">
            Warning threshold (%)
            <input
              type="number"
              min={1}
              max={99}
              value={warning}
              onChange={(e) => setWarning(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-floral/15 bg-gate-bg/80 px-3 py-2 font-monoData text-floral outline-none ring-crusoe/50 focus:ring-2"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              className="rounded-lg border border-floral/15 bg-floral/10 px-4 py-2 text-sm font-medium text-floral transition hover:bg-floral/20"
            >
              Save policy
            </button>
            <button
              type="button"
              onClick={startSubscription}
              className="rounded-lg border border-sage/35 bg-sage/15 px-4 py-2 text-sm font-medium text-sage transition hover:bg-sage/25"
            >
              Start subscription
            </button>
            <button
              type="button"
              onClick={openBillingPortal}
              className="rounded-lg border border-crusoe/40 bg-crusoe/15 px-4 py-2 text-sm font-medium text-crusoe transition hover:bg-crusoe/25"
            >
              Billing portal
            </button>
            {status ? <span className="text-xs text-floral/60">{status}</span> : null}
          </div>
        </form>
      )}

      {/* Repositories tab */}
      {activeTab === "repos" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-floral/50">Per-repo budgets, override limits, and EU hard cap.</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="org/repo-name"
                value={newRepo}
                onChange={(e) => setNewRepo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRepo()}
                className="w-44 rounded-lg border border-floral/15 bg-gate-bg/80 px-2.5 py-1.5 text-xs font-monoData text-floral outline-none placeholder:text-floral/30 focus:ring-1 focus:ring-crusoe/50"
              />
              <button
                onClick={addRepo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sage/35 bg-sage/10 px-3 py-1.5 text-xs font-medium text-sage transition hover:bg-sage/20"
              >
                <Plus size={12} />
                Add repo
              </button>
            </div>
          </div>

          {repoLoading && (
            <div className="flex items-center justify-center py-8 text-floral/40">
              <Loader2 size={18} className="animate-spin" />
              <span className="ml-2 text-sm">Loading policies…</span>
            </div>
          )}

          {!repoLoading && repoPolicies.length === 0 && (
            <p className="py-6 text-center text-sm text-floral/40">
              No repo policies yet. Add a repository above to get started.
            </p>
          )}

          {repoPolicies.map((r) => (
            <div
              key={r.repo}
              className={`panel-muted flex flex-wrap items-center gap-4 p-4 ${
                r._dirty ? "ring-1 ring-crusoe/30" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-monoData text-sm text-floral">{r.repo}</p>
                <p className="mt-0.5 text-xs text-floral/45">
                  EU cap: {r.hard_cap_kg} kg · Max overrides: {r.max_overrides_per_month}/mo
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-floral/65">
                <label className="flex flex-col gap-1">
                  <span className="text-floral/45">Budget (kg)</span>
                  <input
                    type="number"
                    value={r.budget_kg}
                    onChange={(e) => updateRepoField(r.repo, "budget_kg", Number(e.target.value))}
                    className="w-20 rounded-md border border-floral/15 bg-gate-bg/80 px-2 py-1 font-monoData text-floral outline-none focus:ring-1 focus:ring-crusoe/50"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-floral/45">Warn (kg)</span>
                  <input
                    type="number"
                    value={r.warn_kg}
                    onChange={(e) => updateRepoField(r.repo, "warn_kg", Number(e.target.value))}
                    className="w-16 rounded-md border border-floral/15 bg-gate-bg/80 px-2 py-1 font-monoData text-floral outline-none focus:ring-1 focus:ring-crusoe/50"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-floral/45">Hard cap</span>
                  <input
                    type="number"
                    max={EU_HARD_CAP_KG}
                    value={r.hard_cap_kg}
                    onChange={(e) =>
                      updateRepoField(r.repo, "hard_cap_kg", Math.min(Number(e.target.value), EU_HARD_CAP_KG))
                    }
                    className="w-16 rounded-md border border-floral/15 bg-gate-bg/80 px-2 py-1 font-monoData text-floral outline-none focus:ring-1 focus:ring-crusoe/50"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-floral/45">Max overrides</span>
                  <input
                    type="number"
                    min={0}
                    value={r.max_overrides_per_month}
                    onChange={(e) =>
                      updateRepoField(r.repo, "max_overrides_per_month", Number(e.target.value))
                    }
                    className="w-16 rounded-md border border-floral/15 bg-gate-bg/80 px-2 py-1 font-monoData text-floral outline-none focus:ring-1 focus:ring-crusoe/50"
                  />
                </label>
                <button
                  onClick={() => removeRepo(r.repo)}
                  className="mt-4 rounded-md p-1 text-floral/30 transition hover:text-mauve/70"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              onClick={saveRepoPolicies}
              disabled={repoSaving}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-floral/15 bg-floral/10 px-4 py-2.5 text-sm font-medium text-floral transition hover:bg-floral/20 disabled:opacity-50"
            >
              {repoSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save repo policies
            </button>
            {repoStatus && <span className="mt-2 text-xs text-floral/60">{repoStatus}</span>}
          </div>
        </div>
      )}

      {/* Teams tab */}
      {activeTab === "teams" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-floral/50">Assign budgets to teams. Members inherit the team policy.</p>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-sage/35 bg-sage/10 px-3 py-1.5 text-xs font-medium text-sage transition hover:bg-sage/20">
              <Plus size={12} />
              Add team
            </button>
          </div>
          {MOCK_TEAMS.map((team) => (
            <div key={team.name} className="panel-muted flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-floral">{team.name}</p>
                <p className="mt-0.5 text-xs text-floral/45">{team.members} members</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="text-floral/45">Monthly budget (kg)</span>
                  <input
                    type="number"
                    defaultValue={team.budgetKg}
                    className="w-24 rounded-md border border-floral/15 bg-gate-bg/80 px-2 py-1 font-monoData text-floral outline-none focus:ring-1 focus:ring-crusoe/50"
                  />
                </label>
                <button className="mt-4 rounded-md p-1 text-floral/30 transition hover:text-mauve/70">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <p className="pt-2 text-xs text-floral/35">
            Coming soon: invite members by GitHub login and assign per-user overrides.
          </p>
        </div>
      )}
    </section>
  );
}
