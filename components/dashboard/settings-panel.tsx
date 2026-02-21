"use client";

import { FormEvent, useState } from "react";

type SettingsPanelProps = {
  defaultBudgetKg: number;
  warningPct: number;
};

export function SettingsPanel({ defaultBudgetKg, warningPct }: SettingsPanelProps) {
  const [budgetKg, setBudgetKg] = useState(defaultBudgetKg);
  const [warning, setWarning] = useState(warningPct);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving...");

    const response = await fetch("/api/usage/ingest", {
      method: "POST",
      body: JSON.stringify({ mode: "settings-preview", budgetKg, warningPct: warning })
    });

    setStatus(response.ok ? "Saved budget policy." : "Could not save yet.");
  }

  async function openBillingPortal() {
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const payload = (await response.json()) as { url?: string };
    if (payload.url) {
      window.location.href = payload.url;
    }
  }

  async function startSubscription() {
    const response = await fetch("/api/stripe/checkout", { method: "POST" });
    const payload = (await response.json()) as { url?: string };
    if (payload.url) {
      window.location.href = payload.url;
    }
  }

  return (
    <section className="panel p-6">
      <h2 className="text-xl font-semibold text-floral">Settings</h2>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm text-floral/75">
          Budget threshold (kgCO2e / period)
          <input
            type="number"
            value={budgetKg}
            onChange={(event) => setBudgetKg(Number(event.target.value))}
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
            onChange={(event) => setWarning(Number(event.target.value))}
            className="mt-2 w-full rounded-lg border border-floral/15 bg-gate-bg/80 px-3 py-2 font-monoData text-floral outline-none ring-crusoe/50 focus:ring-2"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
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
            Start Stripe Subscription
          </button>
          <button
            type="button"
            onClick={openBillingPortal}
            className="rounded-lg border border-crusoe/40 bg-crusoe/15 px-4 py-2 text-sm font-medium text-crusoe transition hover:bg-crusoe/25"
          >
            Open Stripe Customer Portal
          </button>
          {status ? <span className="text-xs text-floral/60">{status}</span> : null}
        </div>
      </form>
    </section>
  );
}
