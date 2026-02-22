"use client";

import { useCallback, useEffect, useState } from "react";
import { GitBranch, Building2, Trash2, Key, Copy, Plus, Loader2, Save } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type TierInfo = {
  id: string;
  name: string;
  includedKg: number;
  hardCapKg: number;
  basePriceCents: number;
  overagePerKgCents: number;
  warningPct: number;
  overBudgetAction: "warn" | "block";
  csrdReporting: boolean;
  sbtiReduction: boolean;
  regulatoryNote: string;
};

type SettingsPanelProps = {
  defaultBudgetKg: number;
  warningPct: number;
  repos?: string[];
  currentTier?: TierInfo;
  orgApiKey?: string;
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

const EU_HARD_CAP_KG = 20;

// ── Component ────────────────────────────────────────────────────────────────

export function SettingsPanel({
  defaultBudgetKg,
  warningPct: initialWarning,
  repos = [],
  currentTier,
  orgApiKey,
}: SettingsPanelProps) {
  const [budgetKg, setBudgetKg] = useState(defaultBudgetKg);
  const [warning, setWarning] = useState(initialWarning);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"org" | "repos">("org");
  const [keyCopied, setKeyCopied] = useState(false);

  const tier = currentTier ?? { id: "free", name: "Starter", includedKg: 50, hardCapKg: 75, basePriceCents: 0, overagePerKgCents: 0, warningPct: 80, overBudgetAction: "block" as const, csrdReporting: false, sbtiReduction: false, regulatoryNote: "" };

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
        headers: { "x-api-key": "demo" },
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

  async function onSubmit(event: { preventDefault(): void }) {
    event.preventDefault();
    setStatus("Saving...");
    const response = await fetch("/api/usage/ingest", {
      method: "POST",
      body: JSON.stringify({
        mode: "settings-preview",
        budgetKg,
        warningPct: warning
      })
    });
    setStatus(response.ok ? "Saved." : "Could not save yet.");
  }

  const tabs = [
    { id: "org" as const, label: "Organisation", icon: <Building2 size={14} /> },
    { id: "repos" as const, label: "Repositories", icon: <GitBranch size={14} /> },
  ];

  return (
    <section className="panel p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-floral">Policy Settings</h2>
        <p className="mt-1 text-sm text-floral/55">
          Configure carbon budgets, billing tiers, and EU-compliant thresholds.
        </p>
      </div>

      <div className="mt-8 mb-10 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 border-[0.5px] px-4 py-2.5 text-[10px] uppercase tracking-widest transition-colors ${
              activeTab === tab.id
                ? "border-[#FFF8F0]/10 bg-[#23282E] text-[#FFF8F0]"
                : "border-transparent text-[#FFF8F0]/50 hover:text-[#FFF8F0]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Organisation tab ── */}
      {activeTab === "org" && (
        <div className="space-y-6">
          {/* API Key section */}
          <div className="rounded-2xl border border-floral/[0.08] bg-floral/[0.02] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Key size={14} className="text-sage/60" />
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-floral/40">API Key</p>
            </div>
            <p className="text-[11px] text-floral/50 leading-relaxed mb-3">
              Add this as a <span className="font-semibold text-floral/70">CARBON_GATE_ORG_KEY</span> secret on each repo where Carbon Gate is installed.
            </p>
            {orgApiKey ? (
              <div className="flex items-center gap-2 rounded-lg border border-floral/[0.08] bg-black/30 px-3 py-2">
                <code className="flex-1 font-mono text-xs text-floral/70 select-all">
                  {orgApiKey}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(orgApiKey); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000); }}
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-sage/60 hover:text-sage transition"
                >
                  {keyCopied ? "Copied!" : <><Copy size={12} /> Copy</>}
                </button>
              </div>
            ) : (
              <p className="text-xs text-floral/30 italic">No API key found. It will be created automatically when you install Carbon Gate on a repo.</p>
            )}
          </div>

          {/* Budget form */}
          <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm text-floral/75">
            Organisation monthly budget (kgCO₂e)
            <input
              type="number"
              value={budgetKg}
              onChange={(event) => setBudgetKg(Number(event.target.value))}
              className="mt-3 w-full rounded border-[0.5px] border-[#FFF8F0]/10 bg-[#23282E] px-4 py-3 font-mono text-sm font-light text-[#FFF8F0] outline-none transition-colors focus:border-stoneware-turquoise"
            />
            <span className="mt-1 block text-[11px] text-floral/40">
              Plan limit: {tier.includedKg} kgCO₂e/mo
              {tier.hardCapKg > 0 && ` · Hard cap: ${tier.hardCapKg} kg (EU Taxonomy DNSH)`}
            </span>
          </label>
          <label className="block text-sm font-light text-[#FFF8F0]/60">
            <span className="text-[10px] uppercase tracking-widest">
              Warning threshold (%)
            </span>
            <input
              type="number"
              min={1}
              max={99}
              value={warning}
              onChange={(event) => setWarning(Number(event.target.value))}
              className="mt-3 w-full rounded border-[0.5px] border-[#FFF8F0]/10 bg-[#23282E] px-4 py-3 font-mono text-sm font-light text-[#FFF8F0] outline-none transition-colors focus:border-stoneware-turquoise"
            />
          </label>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="submit"
              className="rounded bg-[#FFF8F0] px-5 py-3 text-[10px] uppercase tracking-widest text-[#23282E] transition-opacity hover:opacity-80"
            >
              Save policy
            </button>
            {status ? <span className="text-xs text-floral/60">{status}</span> : null}
          </div>
        </form>
        </div>
      )}

      {/* ── Repositories tab ── */}
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

    </section>
  );
}
