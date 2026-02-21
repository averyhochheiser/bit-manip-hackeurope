"use client";

import { useState } from "react";
import { GitBranch, Users, Building2, Plus, Trash2 } from "lucide-react";

type SettingsPanelProps = {
  defaultBudgetKg: number;
  warningPct: number;
  repos?: string[];
};

export function SettingsPanel({ defaultBudgetKg, warningPct, repos = [] }: SettingsPanelProps) {
  const [budgetKg, setBudgetKg] = useState(defaultBudgetKg);
  const [warning, setWarning] = useState(warningPct);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"org" | "repos" | "teams">("org");

  async function onSubmit(event: { preventDefault(): void }) {
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
            <p className="text-xs text-floral/50">Per-repo overrides apply on top of the org budget.</p>
          </div>
          {repos.length === 0 ? (
            <div className="rounded-xl border border-floral/[0.06] bg-floral/[0.02] py-10 text-center">
              <p className="text-sm text-floral/40">No repositories have run gate checks yet.</p>
              <p className="mt-1 text-xs text-floral/30">
                Repos will appear here automatically once the GitHub Action runs.
              </p>
            </div>
          ) : (
            repos.map((repo) => (
              <div key={repo} className="panel-muted flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-monoData text-sm text-floral">{repo}</p>
                  <p className="mt-0.5 text-xs text-floral/45">Connected via GitHub Action</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-floral/65">
                  <label className="flex flex-col gap-1">
                    <span className="text-floral/45">Budget (kg)</span>
                    <input
                      type="number"
                      defaultValue={10}
                      className="w-20 rounded-md border border-floral/15 bg-gate-bg/80 px-2 py-1 font-monoData text-floral outline-none focus:ring-1 focus:ring-crusoe/50"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-floral/45">Warn %</span>
                    <input
                      type="number"
                      defaultValue={80}
                      className="w-16 rounded-md border border-floral/15 bg-gate-bg/80 px-2 py-1 font-monoData text-floral outline-none focus:ring-1 focus:ring-crusoe/50"
                    />
                  </label>
                  <button className="mt-4 rounded-md p-1 text-floral/30 transition hover:text-mauve/70">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
          {repos.length > 0 && (
            <button className="mt-2 w-full rounded-lg border border-floral/10 py-2.5 text-sm text-floral/40 transition hover:border-floral/20 hover:text-floral/65">
              Save repo policies
            </button>
          )}
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
          <div className="rounded-xl border border-floral/[0.06] bg-floral/[0.02] py-10 text-center">
            <p className="text-sm text-floral/40">No teams configured yet.</p>
            <p className="mt-1 text-xs text-floral/30">
              Coming soon: invite members by GitHub login and assign per-user overrides.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
