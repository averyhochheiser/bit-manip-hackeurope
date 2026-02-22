"use client";

import { CarbonBudgetProgressBar } from "@/components/dashboard/carbon-budget-progress";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { GateHistoryTable } from "@/components/dashboard/gate-history-table";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { RepoBreakdown } from "@/components/dashboard/repo-breakdown";
import { ScrollFloat } from "@/components/marketing/scroll-float";
import type { DashboardReadModel } from "@/lib/dashboard/types";

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

type DashboardPreviewProps = {
  data: DashboardReadModel;
};

export function DashboardPreview({ data }: DashboardPreviewProps) {
  return (
    <section className="relative py-16 sm:py-20">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-floral/55">Live dashboard preview</p>
          {data.gateEvents.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/20 bg-sage/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-sage">
              <span className="h-1 w-1 animate-pulse rounded-full bg-sage" />
              Live data
            </span>
          )}
        </div>
        <h2 className="mt-3 font-display text-3xl font-bold text-floral sm:text-4xl">
          Every repo. Every team. One carbon ledger.
        </h2>
      </div>

      <ScrollFloat>
        <KpiStrip kpis={data.kpis} />
      </ScrollFloat>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ScrollFloat className="xl:col-span-8" delay={0.05}>
          <CarbonBudgetProgressBar
            usedKg={data.budget.usedKg}
            budgetKg={data.budget.includedKg}
            projectedKg={data.budget.projectedKg}
          />
        </ScrollFloat>

        <ScrollFloat className="xl:col-span-4" delay={0.1}>
          <ForecastCard />
        </ScrollFloat>

        {data.repoReports.length > 0 && (
          <ScrollFloat className="xl:col-span-12" delay={0.12}>
            <RepoBreakdown reports={data.repoReports} />
          </ScrollFloat>
        )}

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
          <GateHistoryTable events={data.gateEvents} />
        </ScrollFloat>
      </div>
    </section>
  );
}
