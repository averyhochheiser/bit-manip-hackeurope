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
  healthy: "from-sage to-sage/70",
  warning: "from-sage/60 via-crusoe/50 to-crusoe",
  reroute: "from-crusoe to-crusoe/80"
};

const SHIMMER_CLASS: Record<ProgressState, string> = {
  healthy: "bg-sage/10",
  warning: "bg-crusoe/15",
  reroute: "bg-crusoe/20"
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
  const glowClass =
    state === "healthy"
      ? ""
      : state === "warning"
        ? "shadow-[0_0_38px_rgba(152,210,235,0.2)]"
        : "shadow-[0_0_42px_rgba(152,210,235,0.35)]";

  return (
    <section className="panel relative overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-40" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-floral/60">Carbon Budget</p>
            <h3 className="mt-2 text-2xl font-semibold text-floral">Budget Utilization</h3>
          </div>
          <p className="font-monoData text-lg text-floral/85">{pct.toFixed(1)}%</p>
        </div>

        <div className="mt-6">
          <div className="h-3 overflow-hidden rounded-full bg-floral/10 ring-1 ring-floral/15">
            <motion.div
              className={cn(
                "relative h-full rounded-full bg-gradient-to-r transition-shadow duration-300",
                FILL_CLASS[state],
                glowClass
              )}
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-floral/70">
            <p className="font-monoData">
              {usedKg.toFixed(2)}kg / {safeBudget.toFixed(2)}kg
            </p>
            {overageKg > 0 ? (
              <span className="rounded-md border border-crusoe/40 bg-crusoe/15 px-2.5 py-1 text-xs font-medium text-crusoe">
                Reroute active: +{overageKg.toFixed(2)}kg over
              </span>
            ) : (
              <span className="rounded-md border border-floral/15 bg-floral/5 px-2.5 py-1 text-xs text-floral/70">
                On policy budget
              </span>
            )}
          </div>
        </div>

        {projectedKg ? (
          <p className="mt-4 text-xs text-floral/55">
            Projected period close: <span className="font-monoData text-crusoe">{projectedKg.toFixed(2)}kg</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
