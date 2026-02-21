"use client";

import { CarbonBudgetProgressBar } from "@/components/dashboard/carbon-budget-progress";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { GateHistoryTable } from "@/components/dashboard/gate-history-table";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { ScrollFloat } from "@/components/marketing/scroll-float";
import { MOCK_DASHBOARD } from "@/lib/dashboard/mock-data";

const MOCK_KPIS        = MOCK_DASHBOARD.kpis;
const MOCK_BUDGET      = MOCK_DASHBOARD.budget;
const MOCK_GATE_EVENTS = MOCK_DASHBOARD.gateEvents;

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
    <section className="relative py-16 sm:py-20">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-floral/55">Live dashboard preview</p>
        <h2 className="mt-3 font-display text-3xl font-bold text-floral sm:text-4xl">
          Every repo. Every team. One carbon ledger.
        </h2>
      </div>

      <ScrollFloat>
        <KpiStrip kpis={MOCK_KPIS} />
      </ScrollFloat>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ScrollFloat className="xl:col-span-8" delay={0.05}>
          <CarbonBudgetProgressBar
            usedKg={MOCK_BUDGET.usedKg}
            budgetKg={MOCK_BUDGET.includedKg}
            projectedKg={MOCK_BUDGET.projectedKg}
          />
        </ScrollFloat>

        <ScrollFloat className="xl:col-span-4" delay={0.1}>
          <ForecastCard />
        </ScrollFloat>

        <ScrollFloat className="xl:col-span-6" delay={0.15}>
          <div className="panel p-5">
            <h3 className="text-base font-semibold text-floral">Physics Stats</h3>
            <div className="mt-4 space-y-3">
              {physicsMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className={
                    metric.accent
                      ? "rounded-xl border border-mauve/30 bg-mauve/10 p-3 shadow-insetGlow"
                      : "panel-muted p-3"
                  }
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs uppercase tracking-[0.14em] text-floral/55">{metric.label}</p>
                    <p className="font-monoData text-[11px] text-floral/35">{metric.equation}</p>
                  </div>
                  <p className={`mt-1 font-monoData text-xl ${metric.accent ? "text-mauve" : "text-floral"}`}>
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-floral/55">{metric.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollFloat>

        <ScrollFloat className="xl:col-span-6" delay={0.2}>
          <GateHistoryTable events={MOCK_GATE_EVENTS} />
        </ScrollFloat>
      </div>
    </section>
  );
}
