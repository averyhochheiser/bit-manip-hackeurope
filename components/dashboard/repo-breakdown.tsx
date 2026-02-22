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
      <div className="relative bg-[#2A2F35] p-8 lg:p-10" style={{ minHeight: "200px" }}>
        <p className="absolute left-8 top-8 text-[10px] uppercase tracking-widest text-[#FFF8F0]/50 lg:left-10 lg:top-10">
          Repositories
        </p>
        <div className="mt-12 flex flex-col items-center text-center">
          <GitBranch size={24} className="text-stoneware-turquoise/30" />
          <p className="mt-3 text-sm font-light text-[#FFF8F0]/40">No connected repositories yet</p>
          <p className="mt-1 max-w-xs text-[11px] text-[#FFF8F0]/25">
            Repositories will appear here once you&apos;ve installed the Carbon Gate action and triggered your first PR check.
          </p>
          <button className="mt-6 border-[0.5px] border-[#FFF8F0]/10 bg-[#23282E] px-5 py-2.5 text-[10px] uppercase tracking-widest text-[#FFF8F0]/50 transition hover:text-[#FFF8F0]">
            View Setup Guide
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-[0.5px] bg-floral/10 lg:grid-cols-2">
      {reports.map((report, i) => {
        const pct = (report.usedKg / report.budgetKg) * 100;
        const isOver = report.usedKg > report.budgetKg;

        return (
          <motion.div
            key={report.repo}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative bg-[#2A2F35] p-6 lg:p-8"
          >
            <p className="absolute left-6 top-6 text-[10px] uppercase tracking-widest text-[#FFF8F0]/50 lg:left-8 lg:top-8">
              Repository
            </p>

            <div className="mt-10 flex items-center justify-between">
              <h4 className="text-lg font-normal text-floral">{report.repo}</h4>
              <a
                href={`https://github.com/${report.repo}`}
                target="_blank"
                rel="noreferrer"
                className="text-floral/30 transition hover:text-floral/60"
              >
                <ExternalLink size={14} />
              </a>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-sm font-light text-[#FFF8F0]/60">
                <p className="font-mono">
                  {report.usedKg.toFixed(1)}kg / {report.budgetKg.toFixed(0)}kg
                </p>
                <p className={cn("font-mono", isOver ? "text-stoneware-bordeaux" : "text-stoneware-green")}>
                  {pct.toFixed(1)}%
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#FFF8F0]/10">
                <motion.div
                  className={cn("h-full rounded-full", isOver ? "bg-stoneware-bordeaux" : "bg-stoneware-green")}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, pct)}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              {isOver ? (
                <span className="border-[0.5px] border-stoneware-bordeaux/30 bg-stoneware-bordeaux/10 px-3 py-1.5 text-[10px] uppercase tracking-widest text-stoneware-bordeaux">
                  Over budget
                </span>
              ) : (
                <span className="border-[0.5px] border-[#FFF8F0]/10 bg-[#23282E] px-3 py-1.5 text-[10px] uppercase tracking-widest text-[#FFF8F0]/50">
                  On policy budget
                </span>
              )}

              {report.hasGateData === false ? (
                <InstallCarbonGate repo={report.repo} />
              ) : (
                <span className="text-[11px] text-floral/30">
                  Top: {report.topContributor}
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
