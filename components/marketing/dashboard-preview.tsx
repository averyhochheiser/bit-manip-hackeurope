"use client";

import { CarbonBudgetProgressBar } from "@/components/dashboard/carbon-budget-progress";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { GateHistoryTable } from "@/components/dashboard/gate-history-table";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { ScrollFloat } from "@/components/marketing/scroll-float";
import { MOCK_DASHBOARD } from "@/lib/dashboard/mock-data";

const physicsMetrics = [
  {
    label: "Dynamic PUE",
    value: "1.11",
    equation: "1 + Q / P",
    hint: "Runtime thermodynamic profile",
    accent: false
  },
  {
    label: "Radiative Forcing",
    value: "0.74x",
    equation: "α · ln(C/C₀)",
    hint: "Relative atmospheric impact index",
    accent: false
  },
  {
    label: "Embodied Carbon",
    value: "150kg",
    equation: "H100 GPU",
    hint: "Manufacturing footprint before first line of code",
    accent: true
  }
];

export function DashboardPreview() {
  return (
    <section className="relative py-24">
      <div className="mb-12">
        <p className="text-[10px] uppercase tracking-widest text-ink-muted">
          Functional Dashboard
        </p>
        <h2 className="mt-4 text-2xl font-normal tracking-tight text-ink">
          Live policy enforcement, packaged as signal-rich bento blocks
        </h2>
      </div>

      <ScrollFloat>
        <KpiStrip kpis={MOCK_DASHBOARD.kpis} />
      </ScrollFloat>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <ScrollFloat className="xl:col-span-8" delay={0.05}>
          <CarbonBudgetProgressBar
            usedKg={MOCK_DASHBOARD.budget.usedKg}
            budgetKg={MOCK_DASHBOARD.budget.includedKg}
            projectedKg={MOCK_DASHBOARD.budget.projectedKg}
          />
        </ScrollFloat>

        <ScrollFloat className="xl:col-span-4" delay={0.1}>
          <ForecastCard />
        </ScrollFloat>

        <ScrollFloat className="xl:col-span-6" delay={0.15}>
          <div className="rounded border-[0.5px] border-border-subtle bg-canvas-raised px-8 py-10">
            <h3 className="text-[10px] uppercase tracking-widest text-ink-muted">
              Physics Stats
            </h3>
            <div className="mt-8 space-y-4">
              {physicsMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className={
                    metric.accent
                      ? "rounded border-[0.5px] border-stoneware-bordeaux/20 bg-stoneware-bordeaux/5 px-5 py-4"
                      : "rounded border-[0.5px] border-border-subtle px-5 py-4"
                  }
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-ink-muted">
                      {metric.label}
                    </p>
                    <p className="font-mono text-[10px] text-ink-faint">
                      {metric.equation}
                    </p>
                  </div>
                  <p
                    className={`mt-2 font-mono text-xl font-light ${metric.accent ? "text-stoneware-bordeaux" : "text-ink"}`}
                  >
                    {metric.value}
                  </p>
                  <p className="mt-2 text-xs font-light text-ink-muted">
                    {metric.hint}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </ScrollFloat>

        <ScrollFloat className="xl:col-span-6" delay={0.2}>
          <GateHistoryTable events={MOCK_DASHBOARD.gateEvents} />
        </ScrollFloat>
      </div>
    </section>
  );
}
