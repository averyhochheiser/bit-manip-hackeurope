"use client";

import { motion } from "framer-motion";

type CarbonBudgetProgressBarProps = {
  usedKg: number;
  budgetKg: number;
  projectedKg?: number;
};

type ProgressState = "healthy" | "warning" | "reroute";

const FILL_COLOR: Record<ProgressState, string> = {
  healthy: "bg-sage",
  warning: "bg-crusoe/70",
  reroute: "bg-crusoe"
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
    <section className="panel flex h-full flex-col justify-between p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-floral/40">Carbon Budget</p>
          <h3 className="mt-2 text-lg font-medium text-floral">Budget Utilization</h3>
        </div>
        <p className="font-mono text-xl font-light text-floral">{pct.toFixed(1)}%</p>
      </div>

      <div className="mt-8">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className={`h-full rounded-full ${FILL_COLOR[state]}`}
            initial={{ width: 0 }}
            animate={{ width: `${clampedPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm font-light text-floral/50">
          <p className="font-mono text-sm">
            {usedKg.toFixed(2)}kg / {safeBudget.toFixed(2)}kg
          </p>
          {overageKg > 0 ? (
            <span className="rounded-full border border-crusoe/30 bg-crusoe/10 px-3 py-1 text-[10px] uppercase tracking-widest text-crusoe">
              Reroute active · +{overageKg.toFixed(2)}kg
            </span>
          ) : (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-widest text-floral/40">
              On policy budget
            </span>
          )}
        </div>
      </div>

      {projectedKg ? (
        <p className="mt-6 text-xs font-light text-floral/40">
          Projected period close:{" "}
          <span className="font-mono text-crusoe">
            {projectedKg.toFixed(2)}kg
          </span>
        </p>
      ) : null}
    </section>
  );
}
