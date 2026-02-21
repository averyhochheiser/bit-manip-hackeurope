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
    <section className="flex flex-col border-b-[0.5px] border-border-subtle bg-canvas">
      <div className="relative border-b-[0.5px] border-border-subtle p-6 lg:p-12">
        <p className="absolute left-6 top-6 text-[10px] uppercase tracking-widest text-ink-muted lg:left-12 lg:top-12">
          Functional Dashboard
        </p>
        <h2 className="mt-16 max-w-3xl text-3xl font-normal tracking-tight text-ink sm:text-4xl">
          Live policy enforcement, packaged as signal-rich bento blocks
        </h2>
      </div>

      <div className="flex border-b-[0.5px] border-border-subtle">
        <ScrollFloat className="w-full">
          {/* Note: KpiStrip natively renders its own grid, we assume we'll update it separately to match Stacked Grid */}
          <KpiStrip kpis={MOCK_DASHBOARD.kpis} />
        </ScrollFloat>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="border-b-[0.5px] border-border-subtle lg:col-span-8 lg:border-b-0 lg:border-r-[0.5px]">
          <ScrollFloat className="h-full" delay={0.05}>
            <CarbonBudgetProgressBar
              usedKg={MOCK_DASHBOARD.budget.usedKg}
              budgetKg={MOCK_DASHBOARD.budget.includedKg}
              projectedKg={MOCK_DASHBOARD.budget.projectedKg}
            />
          </ScrollFloat>
        </div>

        <div className="border-b-[0.5px] border-border-subtle lg:col-span-4 lg:border-b-0">
          <ScrollFloat className="h-full" delay={0.1}>
            <ForecastCard />
          </ScrollFloat>
        </div>

        {/* We need an extra border-t to split the rows nicely in 2-col mode since the heights may vary, actually let's just use CSS grid rows or standard div wrapping. Adding border-t. */}
        <div className="border-b-[0.5px] border-border-subtle lg:col-span-6 lg:border-b-0 lg:border-r-[0.5px] lg:border-t-[0.5px]">
          <ScrollFloat className="h-full" delay={0.15}>
            <div className="relative h-full bg-canvas p-6 lg:p-10">
              <h3 className="absolute left-6 top-6 text-[10px] uppercase tracking-widest text-ink-muted lg:left-10 lg:top-10">
                Physics Stats
              </h3>
              <div className="mt-16 flex flex-col border-[0.5px] border-border-subtle">
                {physicsMetrics.map((metric, i) => (
                  <div
                    key={metric.label}
                    className={`relative p-5 ${i !== physicsMetrics.length - 1 ? "border-b-[0.5px] border-border-subtle" : ""} ${metric.accent
                        ? "bg-stoneware-bordeaux bg-opacity-5 border-l-2 border-l-stoneware-bordeaux"
                        : "bg-canvas"
                      }`}
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-widest text-ink-muted">
                        {metric.label}
                      </p>
                      <p className="font-mono text-[10px] text-ink-faint">
                        {metric.equation}
                      </p>
                    </div>
                    <p
                      className={`font-mono text-xl font-light ${metric.accent ? "text-stoneware-bordeaux" : "text-ink"}`}
                    >
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs font-light text-ink-muted">
                      {metric.hint}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollFloat>
        </div>

        <div className="lg:col-span-6 lg:border-t-[0.5px] lg:border-border-subtle">
          <ScrollFloat className="h-full" delay={0.2}>
            <GateHistoryTable events={MOCK_DASHBOARD.gateEvents} />
          </ScrollFloat>
        </div>
      </div>
    </section>
  );
}
