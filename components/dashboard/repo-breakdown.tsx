"use client";

import type { RepoReport } from "@/lib/dashboard/types";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronRight, ExternalLink, GitBranch } from "lucide-react";
import { InstallCarbonGate } from "./install-carbon-gate";

type RepoBreakdownProps = {
  reports: RepoReport[];
};

export function RepoBreakdown({ reports }: RepoBreakdownProps) {
  if (!reports || reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/10 text-sage/40">
          <GitBranch size={24} />
        </div>
        <h3 className="mt-4 font-semibold text-floral/80">No connected repositories yet</h3>
        <p className="mt-1 max-w-xs text-xs text-floral/40 leading-relaxed">
          Repositories will appear here once you&apos;ve installed the Carbon Gate action and triggered your first PR check.
        </p>
        <button className="mt-6 rounded-full border border-white/10 bg-white/[0.05] px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-floral/60 transition hover:bg-white/[0.1] hover:text-floral">
          View Setup Guide
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {reports.map((report, i) => {
        const pct = (report.usedKg / report.budgetKg) * 100;
        const isOver = report.usedKg > report.budgetKg;

        return (
          <motion.div
            key={report.repo}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-md transition-all hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-floral/30">Repository</p>
                <h4 className="mt-1 font-semibold text-floral">{report.repo}</h4>
              </div>
              <a
                href={`https://github.com/${report.repo}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/[0.08] bg-white/[0.05] p-2 text-floral/40 transition hover:bg-white/[0.1] hover:text-floral"
              >
                <ExternalLink size={14} />
              </a>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-[11px] font-monoData">
                <span className="text-floral/40">Utilization</span>
                <span className={cn("font-bold", isOver ? "text-crusoe" : "text-sage")}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                <motion.div
                  className={cn("h-full rounded-full", isOver ? "bg-crusoe" : "bg-sage")}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, pct)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.03] pt-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-floral/25">Used</p>
                <p className="mt-1 font-monoData text-sm font-semibold text-floral/80">
                  {report.usedKg.toFixed(1)}kg
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-floral/25">Budget</p>
                <p className="mt-1 font-monoData text-sm font-semibold text-floral/80">
                  {report.budgetKg.toFixed(0)}kg
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-floral/25">Status</p>
                <span className={cn(
                  "mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                  isOver ? "bg-crusoe/10 text-crusoe border border-crusoe/20" : "bg-sage/10 text-sage border border-sage/20"
                )}>
                  {isOver ? "Over" : "Healthy"}
                </span>
              </div>
            </div>

            {/* Install button for repos without gate data */}
            {report.hasGateData === false && (
              <div className="mt-4 border-t border-white/[0.03] pt-4">
                <InstallCarbonGate repo={report.repo} />
              </div>
            )}

            {report.hasGateData !== false && (
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-white/[0.08]" />
                  <span className="text-[11px] text-floral/30">Top: {report.topContributor}</span>
                </div>
                <button className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-floral/40 transition hover:text-floral/80">
                  View Reports <ChevronRight size={12} />
                </button>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
