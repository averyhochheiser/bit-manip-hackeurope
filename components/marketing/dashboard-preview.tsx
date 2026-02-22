"use client";

import { CarbonBudgetProgressBar } from "@/components/dashboard/carbon-budget-progress";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { GateHistoryTable } from "@/components/dashboard/gate-history-table";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { RepoBreakdown } from "@/components/dashboard/repo-breakdown";
import { ScrollFloat } from "@/components/marketing/scroll-float";
import { TextScramble } from "@/components/ui/text-scramble";
import type { DashboardReadModel } from "@/lib/dashboard/types";

const physicsMetrics = [
  {
    label: "Dynamic PUE",
    value: "1.11",
    equation: "1 + Q / P",
    hint: "Runtime thermodynamic profile",
    color: "text-stoneware-turquoise"
  },
  {
    label: "Radiative Forcing",
    value: "0.74x",
    equation: "α · ln(C/C₀)",
    hint: "Relative atmospheric impact index",
    color: "text-stoneware-pink"
  },
  {
    label: "Embodied Carbon",
    value: "150kg",
    equation: "H100 GPU",
    hint: "Manufacturing footprint before first line of code",
    color: "text-stoneware-bordeaux"
  }
];

type DashboardPreviewProps = {
  data: DashboardReadModel;
};

export function DashboardPreview({ data }: DashboardPreviewProps) {
  return (
    <section className="relative py-16 sm:py-20">
      <div className="mb-12">
        <div className="flex items-center gap-3">
          <p className="text-[10px] uppercase tracking-widest text-[#FFF8F0]/50">Live dashboard preview</p>
          {data.gateEvents.length > 0 && (
            <span className="inline-flex items-center gap-1.5 border-[0.5px] border-stoneware-green/30 px-2.5 py-1 text-[9px] uppercase tracking-widest text-stoneware-green">
              <span className="h-1 w-1 animate-pulse rounded-full bg-stoneware-green" />
              Live data
            </span>
          )}
        </div>
        <h2 className="mt-4 text-3xl font-normal tracking-tight text-[#FFF8F0] sm:text-4xl">
          <TextScramble
            initial="∀ repo ∈ org · Σ CO₂"
            target="Every repo. Every team. One carbon ledger."
            holdMs={600}
            scrambleMs={1400}
            startDelay={200}
          />
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
          <div className="grid grid-cols-1 gap-[0.5px] bg-floral/10">
            {physicsMetrics.map((metric) => (
              <div
                key={metric.label}
                className="relative flex flex-col justify-end bg-[#2A2F35] p-6"
                style={{ minHeight: "130px" }}
              >
                <p className="absolute left-6 top-6 text-[10px] uppercase tracking-widest text-[#FFF8F0]/50">
                  {metric.label}
                </p>
                <div className="flex items-baseline justify-between">
                  <p className={`font-mono text-2xl font-light ${metric.color}`}>
                    {metric.value}
                  </p>
                  <p className="font-mono text-[10px] text-[#FFF8F0]/30">{metric.equation}</p>
                </div>
                <p className="mt-1 text-[11px] text-[#FFF8F0]/40">{metric.hint}</p>
              </div>
            ))}
          </div>
        </ScrollFloat>

        <ScrollFloat className="xl:col-span-6" delay={0.2}>
          <GateHistoryTable events={data.gateEvents} />
        </ScrollFloat>
      </div>
    </section>
  );
}
