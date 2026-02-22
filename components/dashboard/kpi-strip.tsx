"use client";

import type { KpiItem } from "@/lib/dashboard/types";
import { motion } from "framer-motion";
import { Activity, ShieldCheck, Zap, DollarSign } from "lucide-react";

type KpiStripProps = {
  kpis: KpiItem[];
};

const ICONS = [Activity, ShieldCheck, Zap, DollarSign];

export function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, i) => {
        const Icon = ICONS[i % ICONS.length];
        return (
          <motion.article
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md transition-all hover:bg-white/[0.06]"
          >
            {/* Subtle corner glow */}
            <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl transition-opacity group-hover:opacity-100 opacity-0 ${kpi.deltaPositive ? "bg-sage/20" : "bg-crusoe/20"
              }`} />

            <div className="relative flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${kpi.deltaPositive ? "border-sage/20 bg-sage/10 text-sage" : "border-crusoe/20 bg-crusoe/10 text-crusoe"
                }`}>
                <Icon size={20} strokeWidth={1.5} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-floral/40">
                {kpi.label}
              </p>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <p className="font-monoData text-2xl font-bold text-floral">
                {kpi.value}
              </p>
              {kpi.delta ? (
                <span className={`text-[10px] font-bold uppercase tracking-wider ${kpi.deltaPositive === true
                  ? "text-sage"
                  : kpi.deltaPositive === false
                    ? "text-crusoe"
                    : "text-floral/40"
                  }`}>
                  {kpi.delta}
                </span>
              ) : null}
            </div>
          </motion.article>
        );
      })}
    </section>
  );
}
