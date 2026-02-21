"use client";

import { FormEvent, useState } from "react";

type SettingsPanelProps = {
  defaultBudgetKg: number;
  warningPct: number;
};

export function SettingsPanel({
  defaultBudgetKg,
  warningPct
}: SettingsPanelProps) {
  const [budgetKg, setBudgetKg] = useState(defaultBudgetKg);
  const [warning, setWarning] = useState(warningPct);
  const [status, setStatus] = useState<string | null>(null);

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
    <section className="rounded border-[0.5px] border-border-subtle bg-canvas-raised px-8 py-10">
      <h2 className="text-lg font-normal text-ink">Settings</h2>
      <form className="mt-10 space-y-8" onSubmit={onSubmit}>
        <label className="block text-sm font-light text-ink-muted">
          <span className="text-[10px] uppercase tracking-widest">
            Budget threshold (kgCO2e / period)
          </span>
          <input
            type="number"
            value={budgetKg}
            onChange={(event) => setBudgetKg(Number(event.target.value))}
            className="mt-3 w-full rounded border-[0.5px] border-border-subtle bg-canvas px-4 py-3 font-mono text-sm font-light text-ink outline-none transition-colors focus:border-stoneware-turquoise"
          />
        </label>
        <label className="block text-sm font-light text-ink-muted">
          <span className="text-[10px] uppercase tracking-widest">
            Warning threshold (%)
          </span>
          <input
            type="number"
            min={1}
            max={99}
            value={warning}
            onChange={(event) => setWarning(Number(event.target.value))}
            className="mt-3 w-full rounded border-[0.5px] border-border-subtle bg-canvas px-4 py-3 font-mono text-sm font-light text-ink outline-none transition-colors focus:border-stoneware-turquoise"
          />
        </label>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="submit"
            className="rounded bg-ink px-5 py-3 text-[10px] uppercase tracking-widest text-canvas transition-opacity hover:opacity-80"
          >
            Save policy
          </button>
          <button
            type="button"
            onClick={startSubscription}
            className="rounded bg-stoneware-green px-5 py-3 text-[10px] uppercase tracking-widest text-canvas transition-opacity hover:opacity-80"
          >
            Start subscription
          </button>
          <button
            type="button"
            onClick={openBillingPortal}
            className="rounded bg-stoneware-turquoise px-5 py-3 text-[10px] uppercase tracking-widest text-ink transition-opacity hover:opacity-80"
          >
            Billing portal
          </button>
          {status ? (
            <span className="text-xs font-light text-ink-muted">
              {status}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
