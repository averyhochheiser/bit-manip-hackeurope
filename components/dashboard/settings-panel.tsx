"use client";

import { useState } from "react";
import { GitBranch, Users, Building2, Plus, Trash2, Shield, Zap, Globe, ChevronRight, Key, Copy } from "lucide-react";

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
  tiers?: TierInfo[];
  usedKg?: number;
  orgApiKey?: string;
};

// ── Tier card colours ────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, { border: string; bg: string; accent: string; badge: string }> = {
  free:       { border: "border-floral/15", bg: "bg-floral/[0.03]", accent: "text-floral/60", badge: "bg-floral/10 text-floral/60" },
  pro:        { border: "border-sage/30",   bg: "bg-sage/[0.04]",   accent: "text-sage",      badge: "bg-sage/15 text-sage" },
  enterprise: { border: "border-crusoe/30", bg: "bg-crusoe/[0.04]", accent: "text-crusoe",    badge: "bg-crusoe/15 text-crusoe" },
};

// ── Component ────────────────────────────────────────────────────────────────

export function SettingsPanel({
  defaultBudgetKg,
  warningPct: initialWarning,
  repos = [],
  currentTier,
  tiers = [],
  usedKg = 0,
  orgApiKey,
}: SettingsPanelProps) {
  const [budgetKg, setBudgetKg] = useState(defaultBudgetKg);
  const [warning, setWarning] = useState(initialWarning);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"billing" | "org" | "repos" | "teams">("billing");
  const [keyCopied, setKeyCopied] = useState(false);

  const tier = currentTier ?? { id: "free", name: "Starter", includedKg: 50, hardCapKg: 75, basePriceCents: 0, overagePerKgCents: 0, warningPct: 80, overBudgetAction: "block" as const, csrdReporting: false, sbtiReduction: false, regulatoryNote: "" };

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
    { id: "billing" as const, label: "Billing & Tiers", icon: <Shield size={14} /> },
    { id: "org" as const, label: "Organisation", icon: <Building2 size={14} /> },
    { id: "repos" as const, label: "Repositories", icon: <GitBranch size={14} /> },
    { id: "teams" as const, label: "Teams", icon: <Users size={14} /> },
  ];

  return (
    <section className="panel p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-floral">Policy Settings</h2>
        <p className="mt-1 text-sm text-floral/55">
          Configure carbon budgets, billing tiers, and EU-compliant thresholds.
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

      {/* ── Billing & Tiers tab ── */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Current plan banner */}
          <div className={`rounded-2xl border ${TIER_STYLES[tier.id]?.border ?? "border-floral/15"} ${TIER_STYLES[tier.id]?.bg ?? "bg-floral/[0.03]"} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-floral/30">Current plan</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${TIER_STYLES[tier.id]?.badge ?? ""}`}>
                    {tier.name}
                  </span>
                </div>
                <p className="mt-2 font-display text-2xl font-semibold text-floral">
                  {tier.basePriceCents === 0 ? "Free" : `$${(tier.basePriceCents / 100).toFixed(0)}`}
                  <span className="text-sm font-normal text-floral/40">{tier.basePriceCents > 0 ? "/mo" : ""}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-monoData text-lg font-bold text-floral">
                  {usedKg.toFixed(1)}<span className="text-xs text-floral/40">/{tier.includedKg} kgCO₂e</span>
                </p>
                <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className={`h-full rounded-full transition-all ${usedKg > tier.includedKg ? "bg-crusoe" : "bg-sage"}`}
                    style={{ width: `${Math.min(100, (usedKg / tier.includedKg) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {tier.regulatoryNote && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-floral/[0.06] bg-floral/[0.02] px-3 py-2">
                <Globe size={12} className="mt-0.5 shrink-0 text-floral/30" />
                <p className="text-[11px] leading-relaxed text-floral/45">{tier.regulatoryNote}</p>
              </div>
            )}
          </div>

          {/* Tier comparison */}
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-floral/30">Compare plans</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {tiers.map((t) => {
                const style = TIER_STYLES[t.id] ?? TIER_STYLES.free;
                const isCurrent = t.id === tier.id;

                return (
                  <div
                    key={t.id}
                    className={`relative overflow-hidden rounded-2xl border p-5 transition ${
                      isCurrent ? `${style.border} ${style.bg}` : "border-floral/[0.08] bg-white/[0.01] hover:bg-white/[0.03]"
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute right-3 top-3">
                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest ${style.badge}`}>
                          Current
                        </span>
                      </div>
                    )}

                    <p className={`text-xs font-bold ${style.accent}`}>{t.name}</p>
                    <p className="mt-1 font-display text-xl font-semibold text-floral">
                      {t.basePriceCents === 0 ? "Free" : `$${(t.basePriceCents / 100).toFixed(0)}`}
                      <span className="text-xs font-normal text-floral/40">{t.basePriceCents > 0 ? "/mo" : ""}</span>
                    </p>

                    <div className="mt-4 space-y-2 text-[11px] text-floral/55">
                      <div className="flex items-center gap-2">
                        <Zap size={10} className={style.accent} />
                        <span><strong className="text-floral/80">{t.includedKg}</strong> kgCO₂e/mo included</span>
                      </div>
                      {t.hardCapKg > 0 && (
                        <div className="flex items-center gap-2">
                          <Shield size={10} className="text-crusoe/60" />
                          <span>Hard cap at {t.hardCapKg} kg (DNSH)</span>
                        </div>
                      )}
                      {t.overagePerKgCents > 0 && (
                        <div className="flex items-center gap-2">
                          <Globe size={10} className={style.accent} />
                          <span>Overage: ${(t.overagePerKgCents / 100).toFixed(3)}/kg (EU ETS rate)</span>
                        </div>
                      )}
                      {t.csrdReporting && (
                        <div className="flex items-center gap-2">
                          <Globe size={10} className="text-sage/60" />
                          <span>CSRD-ready reporting</span>
                        </div>
                      )}
                      {t.sbtiReduction && (
                        <div className="flex items-center gap-2">
                          <Shield size={10} className="text-sage/60" />
                          <span>SBTi 1.5°C pathway (−4.2%/yr)</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Shield size={10} className="text-floral/30" />
                        <span>Over-budget: {t.overBudgetAction === "block" ? "hard block" : "warn only"}</span>
                      </div>
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={t.basePriceCents > 0 ? startSubscription : undefined}
                        className={`mt-4 flex w-full items-center justify-center gap-1 rounded-lg border py-2 text-xs font-medium transition ${
                          t.basePriceCents > 0
                            ? `${style.border} ${style.bg} ${style.accent} hover:bg-white/[0.08]`
                            : "border-floral/10 text-floral/40"
                        }`}
                      >
                        {t.basePriceCents > 0 ? "Upgrade" : "Current baseline"}
                        {t.basePriceCents > 0 && <ChevronRight size={12} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* EU Regulatory info */}
          <div className="rounded-2xl border border-floral/[0.08] bg-floral/[0.02] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-sage/60" />
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-floral/40">EU Regulatory Alignment</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-[11px] leading-relaxed text-floral/50">
              <div className="space-y-1">
                <p className="font-semibold text-floral/70">EU ETS Phase IV</p>
                <p>Overage pricing mirrors the EU carbon market (~€85/tCO₂). Your internal carbon cost matches the real economic cost of emissions.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-floral/70">EU Taxonomy (DNSH)</p>
                <p>Free tier hard cap at 75 kgCO₂e — based on &quot;Do No Significant Harm&quot; threshold for small-scale ICT (100 gCO₂e/kWh × typical SME GPU compute).</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-floral/70">CSRD Reporting</p>
                <p>Pro and Enterprise tiers include ESRS E1-compliant emission reports (Scope 3 Category 11) compatible with the Corporate Sustainability Reporting Directive.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-floral/70">SBTi 1.5°C Pathway</p>
                <p>Enterprise tier enforces Science Based Targets initiative absolute contraction: −4.2% annual reduction to align with Paris Agreement goals.</p>
              </div>
            </div>
          </div>

          {/* Manage subscription */}
          <div className="flex flex-wrap gap-3">
            {tier.basePriceCents > 0 && (
              <button
                onClick={openBillingPortal}
                className="rounded-lg border border-crusoe/40 bg-crusoe/15 px-4 py-2 text-sm font-medium text-crusoe transition hover:bg-crusoe/25"
              >
                Manage subscription
              </button>
            )}
          </div>
        </div>
      )}

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
              onChange={(e) => setBudgetKg(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-floral/15 bg-gate-bg/80 px-3 py-2 font-monoData text-floral outline-none ring-crusoe/50 focus:ring-2"
            />
            <span className="mt-1 block text-[11px] text-floral/40">
              Plan limit: {tier.includedKg} kgCO₂e/mo
              {tier.hardCapKg > 0 && ` · Hard cap: ${tier.hardCapKg} kg (EU Taxonomy DNSH)`}
            </span>
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
            {status ? <span className="text-xs text-floral/60">{status}</span> : null}
          </div>
        </form>
        </div>
      )}

      {/* ── Repositories tab ── */}
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

      {/* ── Teams tab ── */}
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
