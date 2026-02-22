"use client";

import type { RepoReport } from "@/lib/dashboard/types";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ExternalLink, GitBranch } from "lucide-react";
import { InstallCarbonGate } from "./install-carbon-gate";

type RepoBreakdownProps = {
  reports: RepoReport[];
};

export function RepoBreakdown({ reports }: RepoBreakdownProps) {
  if (!reports || reports.length === 0) {
    return (
      <div className="panel-muted flex flex-col items-center p-8 text-center">
        <GitBranch size={24} className="text-floral/20" />
        <p className="mt-3 text-sm font-light text-floral/40">No connected repositories yet</p>
        <p className="mt-1 max-w-xs text-[11px] text-floral/25">
          Repositories will appear here once you&apos;ve installed the Carbon Gate action and triggered your first PR check.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {reports.map((report, i) => {
        const pct = (report.usedKg / report.budgetKg) * 100;
        const isOver = report.usedKg > report.budgetKg;

        return (
          <motion.div
            key={report.repo}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="panel-muted p-5"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-floral/30">Repository</p>
                <h4 className="mt-1 truncate text-base font-medium text-floral">{report.repo}</h4>
              </div>
              <a
                href={`https://github.com/${report.repo}`}
                target="_blank"
                rel="noreferrer"
                className="ml-3 shrink-0 text-floral/30 transition hover:text-floral/60"
              >
                <ExternalLink size={14} />
              </a>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-floral/40">{report.usedKg.toFixed(1)}kg / {report.budgetKg.toFixed(0)}kg</span>
                <span className={cn("font-bold", isOver ? "text-crusoe" : "text-sage")}>{pct.toFixed(1)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <motion.div
                  className={cn("h-full rounded-full", isOver ? "bg-crusoe" : "bg-sage")}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, pct)}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              {isOver ? (
                <span className="rounded-full border border-crusoe/30 bg-crusoe/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-crusoe">
                  Over budget
                </span>
              ) : (
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-widest text-floral/40">
                  On policy budget
                </span>
              )}
              {report.hasGateData === false ? (
                <InstallCarbonGate repo={report.repo} />
              ) : (
                <span className="text-[11px] text-floral/30">Top: {report.topContributor}</span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
