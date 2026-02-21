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
  warning: "from-sage via-crusoe/80 to-crusoe",
  reroute: "from-crusoe to-crusoe/60"
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
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.15]" />

      <div className="relative">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-floral/30">Monthly Policy</p>
            <h3 className="mt-1 text-2xl font-bold text-floral">Carbon Budget</h3>
          </div>
          <div className="text-right">
            <span className="font-monoData text-3xl font-bold text-floral">{pct.toFixed(0)}</span>
            <span className="ml-1 text-xs font-bold text-floral/30 uppercase tracking-tighter">%</span>
          </div>
        </div>

        <div className="mt-8">
          <div className="relative h-4 overflow-hidden rounded-full bg-white/[0.05] shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
            <motion.div
              className={cn(
                "relative h-full rounded-full bg-gradient-to-r",
                FILL_CLASS[state]
              )}
              initial={{ width: 0 }}
              animate={{ width: `${clampedPct}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            >
              {/* Internal glow for the progress head */}
              <div className="absolute right-0 top-0 h-full w-4 bg-white/20 blur-sm" />
            </motion.div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 font-monoData text-xs">
            <div className="flex items-center gap-2">
              <span className="text-floral/40">Used:</span>
              <span className="font-bold text-floral">{usedKg.toFixed(1)} kg</span>
              <span className="text-floral/10">|</span>
              <span className="text-floral/40">Limit:</span>
              <span className="font-bold text-floral">{safeBudget.toFixed(0)} kg</span>
            </div>

            {overageKg > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-crusoe/30 bg-crusoe/10 px-3 py-1 font-bold text-crusoe uppercase tracking-wider text-[10px]">
                <span className="h-1 w-1 rounded-full bg-crusoe animate-pulse" />
                Reroute active: +{overageKg.toFixed(1)}kg Overage
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-sage/20 bg-sage/10 px-3 py-1 font-bold text-sage uppercase tracking-wider text-[10px]">
                On Policy
              </span>
            )}
          </div>
        </div>

        {projectedKg ? (
          <div className="mt-6 flex items-center gap-2 border-t border-white/[0.03] pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-floral/30">
              Projected Burn Rate:
            </p>
            <span className="font-monoData text-xs font-bold text-crusoe">
              {projectedKg.toFixed(1)} kgCO₂e at month end
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
