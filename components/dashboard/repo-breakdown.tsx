"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { GitBranch, TrendingUp, TrendingDown, Minus } from "lucide-react";

export type RepoStat = {
  name: string;
  owner: string;
  budgetKg: number;
  usedKg: number;
  events: number;
  trend: "up" | "down" | "flat";
  topContributor?: string;
};

const MOCK_REPOS: RepoStat[] = [
  {
    name: "ml-training",
    owner: "acme-corp",
    budgetKg: 30,
    usedKg: 22.4,
    events: 14,
    trend: "up",
    topContributor: "alex@acme.com",
  },
  {
    name: "data-pipeline",
    owner: "acme-corp",
    budgetKg: 15,
    usedKg: 11.8,
    events: 8,
    trend: "down",
    topContributor: "priya@acme.com",
  },
  {
    name: "model-serving",
    owner: "acme-corp",
    budgetKg: 10,
    usedKg: 10.9,
    events: 5,
    trend: "up",
    topContributor: "carlos@acme.com",
  },
  {
    name: "feature-store",
    owner: "acme-corp",
    budgetKg: 8,
    usedKg: 3.2,
    events: 3,
    trend: "flat",
    topContributor: "nina@acme.com",
  },
];

type Status = "healthy" | "warning" | "over";

function getStatus(usedKg: number, budgetKg: number): Status {
  const pct = usedKg / budgetKg;
  if (pct >= 1) return "over";
  if (pct >= 0.75) return "warning";
  return "healthy";
}

const STATUS_LABEL: Record<Status, string> = {
  healthy: "On budget",
  warning: "Near limit",
  over: "Over budget",
};

const STATUS_CLASS: Record<Status, string> = {
  healthy: "border-sage/35 bg-sage/10 text-sage",
  warning: "border-mauve/35 bg-mauve/10 text-[#c09ab0]",
  over: "border-crusoe/40 bg-crusoe/10 text-crusoe",
};

const BAR_CLASS: Record<Status, string> = {
  healthy: "from-sage to-sage/60",
  warning: "from-mauve/80 to-mauve/50",
  over: "from-crusoe to-crusoe/70",
};

const TREND_ICON: Record<"up" | "down" | "flat", React.ReactNode> = {
  up: <TrendingUp size={12} className="text-mauve/70" />,
  down: <TrendingDown size={12} className="text-sage" />,
  flat: <Minus size={12} className="text-floral/40" />,
};

type Props = {
  repos?: RepoStat[];
};

export function RepoBreakdown({ repos = MOCK_REPOS }: Props) {
  return (
    <section className="panel p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-floral">
            Repository Breakdown
          </h3>
          <p className="mt-0.5 text-xs text-floral/50">
            Carbon budget utilisation per connected repo
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-floral/15 bg-floral/5 px-3 py-1 text-xs text-floral/60">
          <GitBranch size={11} />
          {repos.length} repos
        </span>
      </div>

      <div className="space-y-3">
        {repos.map((repo, i) => {
          const status = getStatus(repo.usedKg, repo.budgetKg);
          const pct = Math.min(100, (repo.usedKg / repo.budgetKg) * 100);

          return (
            <motion.div
              key={repo.name}
              className="panel-muted p-4"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-monoData text-sm font-semibold text-floral">
                      {repo.owner}/{repo.name}
                    </p>
                    <span className="flex items-center gap-1">
                      {TREND_ICON[repo.trend]}
                    </span>
                  </div>
                  {repo.topContributor && (
                    <p className="mt-0.5 text-xs text-floral/40">
                      Top: {repo.topContributor}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-xs font-medium",
                      STATUS_CLASS[status]
                    )}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  <span className="text-xs text-floral/50">
                    {repo.events} gates
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-floral/8 ring-1 ring-floral/10">
                  <motion.div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r",
                      BAR_CLASS[status]
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{
                      delay: i * 0.06 + 0.1,
                      type: "spring",
                      stiffness: 130,
                      damping: 24,
                    }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-floral/45">
                  <span className="font-monoData">
                    {repo.usedKg.toFixed(1)} / {repo.budgetKg.toFixed(0)} kgCO₂e
                  </span>
                  <span className="font-monoData">{pct.toFixed(0)}%</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
