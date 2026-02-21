"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type CarbonBudgetProgressBarProps = {
  usedKg: number;
  budgetKg: number;
  projectedKg?: number;
};

type ProgressState = "healthy" | "warning" | "reroute";

const FILL_CLASS: Record<ProgressState, string> = {
  healthy: "from-emerald-400 to-emerald-300",
  warning: "from-orange-400 to-amber-300",
  reroute: "from-crusoe to-sky-300"
};

const SHIMMER_CLASS: Record<ProgressState, string> = {
  healthy: "bg-emerald-200/10",
  warning: "bg-orange-100/20",
  reroute: "bg-sky-100/20"
};

export function CarbonBudgetProgressBar({
  usedKg,
  budgetKg,
  projectedKg
}: CarbonBudgetProgressBarProps) {
  const safeBudget = budgetKg <= 0 ? 1 : budgetKg;
  const pct = (usedKg / safeBudget) * 100;
  const clampedPct = Math.max(0, Math.min(100, pct));
  const state: ProgressState = pct < 70 ? "healthy" : pct < 100 ? "warning" : "reroute";
  const overageKg = Math.max(0, usedKg - safeBudget);

  return (
    <section className="panel relative overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-40" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Carbon Budget</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Budget Utilization</h3>
          </div>
          <p className="font-monoData text-lg text-white/85">{pct.toFixed(1)}%</p>
        </div>

        <div className="mt-6">
          <div className="h-3 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
            <motion.div
              className={cn("relative h-full rounded-full bg-gradient-to-r", FILL_CLASS[state])}
              initial={{ width: 0 }}
              animate={{ width: `${clampedPct}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 22 }}
            >
              {state !== "healthy" ? (
                <motion.span
                  className={cn(
                    "absolute inset-y-0 w-1/3 rounded-full blur-sm",
                    SHIMMER_CLASS[state]
                  )}
                  initial={{ x: "-30%" }}
                  animate={{ x: "300%" }}
                  transition={{ duration: 2.6, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                />
              ) : null}
            </motion.div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-white/70">
            <p className="font-monoData">
              {usedKg.toFixed(2)}kg / {safeBudget.toFixed(2)}kg
            </p>
            {overageKg > 0 ? (
              <span className="rounded-md border border-crusoe/40 bg-crusoe/15 px-2.5 py-1 text-xs font-medium text-sky-200">
                Reroute active: +{overageKg.toFixed(2)}kg over
              </span>
            ) : (
              <span className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                On policy budget
              </span>
            )}
          </div>
        </div>

        {projectedKg ? (
          <p className="mt-4 text-xs text-white/55">
            Projected period close: <span className="font-monoData">{projectedKg.toFixed(2)}kg</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
