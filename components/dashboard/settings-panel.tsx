"use client";

import { FormEvent, useState } from "react";
import { GitBranch, Users, Building2, Plus, Trash2 } from "lucide-react";

type SettingsPanelProps = {
  defaultBudgetKg: number;
  warningPct: number;
};

const MOCK_REPO_POLICIES = [
  { repo: "acme-corp/ml-training", budgetKg: 30, warningPct: 75, team: "ML Platform" },
  { repo: "acme-corp/data-pipeline", budgetKg: 15, warningPct: 70, team: "Data Eng" },
  { repo: "acme-corp/model-serving", budgetKg: 10, warningPct: 80, team: "Infra" },
];

const MOCK_TEAMS = [
  { name: "ML Platform", members: 6, budgetKg: 50 },
  { name: "Data Eng", members: 4, budgetKg: 25 },
  { name: "Infra", members: 3, budgetKg: 15 },
];

export function SettingsPanel({
  defaultBudgetKg,
  warningPct
}: SettingsPanelProps) {
  const [budgetKg, setBudgetKg] = useState(defaultBudgetKg);
  const [warning, setWarning] = useState(warningPct);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"org" | "repos" | "teams">("org");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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
    { id: "org" as const, label: "Organisation", icon: <Building2 size={14} strokeWidth={1} /> },
    { id: "repos" as const, label: "Repositories", icon: <GitBranch size={14} strokeWidth={1} /> },
    { id: "teams" as const, label: "Teams", icon: <Users size={14} strokeWidth={1} /> },
  ];

  return (
    <section className="rounded border-[0.5px] border-[#FFF8F0]/10 bg-[#2A2F35] px-8 py-10">
      <h2 className="text-lg font-normal text-[#FFF8F0]">Settings</h2>

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

      {activeTab === "org" && (
        <form className="space-y-8" onSubmit={onSubmit}>
          <label className="block text-sm font-light text-[#FFF8F0]/60">
            <span className="text-[10px] uppercase tracking-widest">
              Budget threshold (kgCO2e / period)
            </span>
            <input
              type="number"
              value={budgetKg}
              onChange={(event) => setBudgetKg(Number(event.target.value))}
              className="mt-3 w-full rounded border-[0.5px] border-[#FFF8F0]/10 bg-[#23282E] px-4 py-3 font-mono text-sm font-light text-[#FFF8F0] outline-none transition-colors focus:border-stoneware-turquoise"
            />
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
            <button
              type="button"
              onClick={startSubscription}
              className="rounded bg-stoneware-green px-5 py-3 text-[10px] uppercase tracking-widest text-white transition-opacity hover:opacity-80"
            >
              Start subscription
            </button>
            <button
              type="button"
              onClick={openBillingPortal}
              className="rounded bg-stoneware-turquoise px-5 py-3 text-[10px] uppercase tracking-widest text-[#23282E] transition-opacity hover:opacity-80"
            >
              Billing portal
            </button>
            {status ? (
              <span className="text-xs font-light text-[#FFF8F0]/50">
                {status}
              </span>
            ) : null}
          </div>
        </form>
      )}

      {activeTab === "repos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-light text-[#FFF8F0]/50">Per-repo overrides apply on top of the org budget.</p>
            <button className="inline-flex items-center gap-2 rounded border-[0.5px] border-stoneware-green/30 bg-stoneware-green/10 px-4 py-2.5 text-[10px] uppercase tracking-widest text-stoneware-green transition-opacity hover:opacity-80">
              <Plus size={12} />
              Connect repo
            </button>
          </div>
          {MOCK_REPO_POLICIES.map((r) => (
            <div key={r.repo} className="flex flex-wrap items-center gap-4 border-[0.5px] border-[#FFF8F0]/10 bg-[#23282E] p-5">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm text-[#FFF8F0]">{r.repo}</p>
                <p className="mt-0.5 text-xs font-light text-[#FFF8F0]/50">Team: {r.team}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#FFF8F0]/50">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[#FFF8F0]/30">Budget (kg)</span>
                  <input
                    type="number"
                    defaultValue={r.budgetKg}
                    className="w-20 rounded border-[0.5px] border-[#FFF8F0]/10 bg-[#2A2F35] px-2 py-1 font-mono text-[#FFF8F0] outline-none transition-colors focus:border-stoneware-turquoise"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[#FFF8F0]/30">Warn %</span>
                  <input
                    type="number"
                    defaultValue={r.warningPct}
                    className="w-16 rounded border-[0.5px] border-[#FFF8F0]/10 bg-[#2A2F35] px-2 py-1 font-mono text-[#FFF8F0] outline-none transition-colors focus:border-stoneware-turquoise"
                  />
                </label>
                <button className="mt-4 rounded p-1 text-[#FFF8F0]/30 transition-colors hover:text-stoneware-bordeaux">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <button className="mt-2 w-full rounded border-[0.5px] border-[#FFF8F0]/10 py-3 text-[10px] uppercase tracking-widest text-[#FFF8F0]/50 transition-colors hover:bg-[#23282E]">
            Save repo policies
          </button>
        </div>
      )}

      {activeTab === "teams" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-light text-[#FFF8F0]/50">Assign budgets to teams. Members inherit the team policy.</p>
            <button className="inline-flex items-center gap-2 rounded border-[0.5px] border-stoneware-green/30 bg-stoneware-green/10 px-4 py-2.5 text-[10px] uppercase tracking-widest text-stoneware-green transition-opacity hover:opacity-80">
              <Plus size={12} />
              Add team
            </button>
          </div>
          {MOCK_TEAMS.map((team) => (
            <div key={team.name} className="flex flex-wrap items-center gap-4 border-[0.5px] border-[#FFF8F0]/10 bg-[#23282E] p-5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-normal text-[#FFF8F0]">{team.name}</p>
                <p className="mt-0.5 text-xs font-light text-[#FFF8F0]/50">{team.members} members</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[#FFF8F0]/30">Monthly budget (kg)</span>
                  <input
                    type="number"
                    defaultValue={team.budgetKg}
                    className="w-24 rounded border-[0.5px] border-[#FFF8F0]/10 bg-[#2A2F35] px-2 py-1 font-mono text-[#FFF8F0] outline-none transition-colors focus:border-stoneware-turquoise"
                  />
                </label>
                <button className="mt-4 rounded p-1 text-[#FFF8F0]/30 transition-colors hover:text-stoneware-bordeaux">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <p className="pt-2 text-xs font-light text-[#FFF8F0]/50">
            Coming soon: invite members by GitHub login and assign per-user overrides.
          </p>
        </div>
      )}
    </section>
  );
}
