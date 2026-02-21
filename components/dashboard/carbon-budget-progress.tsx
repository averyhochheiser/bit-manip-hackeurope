"use client";

import { motion } from "framer-motion";

type CarbonBudgetProgressBarProps = {
  usedKg: number;
  budgetKg: number;
  projectedKg?: number;
};

type ProgressState = "healthy" | "warning" | "reroute";

const FILL_COLOR: Record<ProgressState, string> = {
  healthy: "bg-stoneware-green",
  warning: "bg-stoneware-turquoise",
  reroute: "bg-stoneware-bordeaux"
};

export function CarbonBudgetProgressBar({
  usedKg,
  budgetKg,
  projectedKg
}: CarbonBudgetProgressBarProps) {
  const safeBudget = budgetKg <= 0 ? 1 : budgetKg;
  const pct = (usedKg / safeBudget) * 100;
  const clampedPct = Math.max(0, Math.min(100, pct));
  const state: ProgressState =
    pct < 70 ? "healthy" : pct < 100 ? "warning" : "reroute";
  const overageKg = Math.max(0, usedKg - safeBudget);

  return (
    <section className="relative flex h-full flex-col justify-between bg-canvas-raised p-6 lg:p-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="absolute left-6 top-6 text-[10px] uppercase tracking-widest text-ink-muted lg:left-10 lg:top-10">
            Carbon Budget
          </p>
          <h3 className="mt-16 text-lg font-normal text-ink">
            Budget Utilization
          </h3>
        </div>
        <p className="mt-16 font-mono text-lg font-light text-ink lg:mt-0">
          {pct.toFixed(1)}%
        </p>
      </div>

      <div className="mt-8">
        <div className="h-1.5 overflow-hidden rounded-full bg-border-subtle">
          <motion.div
            className={`h-full rounded-full ${FILL_COLOR[state]}`}
            initial={{ width: 0 }}
            animate={{ width: `${clampedPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm font-light text-ink-muted">
          <p className="font-mono">
            {usedKg.toFixed(2)}kg / {safeBudget.toFixed(2)}kg
          </p>
          {overageKg > 0 ? (
            <span className="border-[0.5px] border-stoneware-bordeaux/30 bg-stoneware-bordeaux/5 px-3 py-1.5 text-[10px] uppercase tracking-widest text-stoneware-bordeaux">
              Reroute active · +{overageKg.toFixed(2)}kg
            </span>
          ) : (
            <span className="border-[0.5px] border-border-subtle px-3 py-1.5 text-[10px] uppercase tracking-widest text-ink-muted bg-canvas">
              On policy budget
            </span>
          )}
        </div>
      </div>

      {projectedKg ? (
        <p className="mt-6 text-xs font-light text-ink-muted">
          Projected period close:{" "}
          <span className="font-mono text-stoneware-turquoise">
            {projectedKg.toFixed(2)}kg
          </span>
        </p>
      ) : null}
    </section>
  );
}
