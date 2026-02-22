"use client";

import type { RepoReport } from "@/lib/dashboard/types";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ExternalLink, ShieldCheck, GitBranch } from "lucide-react";
import { InstallCarbonGate } from "./install-carbon-gate";
import { useState } from "react";

const LS_KEY = "carbon-gate-installed-repos";

function getInstalledFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveInstalledToStorage(repos: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...repos]));
  } catch {}
}

type ReposGridProps = {
  activated: RepoReport[];
  notActivated: RepoReport[];
};

export function ReposGrid({ activated, notActivated }: ReposGridProps) {
  // Lazy initialisers read localStorage synchronously — no flash on reload
  const [localActivated, setLocalActivated] = useState<RepoReport[]>(() => {
    const installed = getInstalledFromStorage();
    if (installed.size === 0) return activated;
    const promoted = notActivated
      .filter((r) => installed.has(r.repo))
      .map((r) => ({ ...r, hasGateData: true }));
    return [...activated, ...promoted];
  });

  const [localNotActivated, setLocalNotActivated] = useState<RepoReport[]>(() => {
    const installed = getInstalledFromStorage();
    if (installed.size === 0) return notActivated;
    return notActivated.filter((r) => !installed.has(r.repo));
  });

  function handleInstalled(repoName: string) {
    const installed = getInstalledFromStorage();
    installed.add(repoName);
    saveInstalledToStorage(installed);

    setLocalNotActivated((prev) => {
      const repo = prev.find((r) => r.repo === repoName);
      if (repo) {
        setLocalActivated((act) => [...act, { ...repo, hasGateData: true }]);
      }
      return prev.filter((r) => r.repo !== repoName);
    });
  }

  return (
    <div className="space-y-8">
      {/* ── Activated repos ── */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sage/10 border border-sage/20">
            <ShieldCheck size={14} className="text-sage" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-floral">Carbon Gate Active</h2>
            <p className="text-[11px] text-floral/40">
              {localActivated.length} {localActivated.length === 1 ? "repository" : "repositories"} with gate checks running
            </p>
          </div>
        </div>

        {localActivated.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-10 text-center">
            <p className="text-sm text-floral/40">No repos with Carbon Gate yet.</p>
            <p className="mt-1 text-xs text-floral/25">Install it on a repo below to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {localActivated.map((repo, i) => (
              <ActivatedRepoCard key={repo.repo} repo={repo} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* ── Not activated repos ── */}
      {localNotActivated.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-floral/[0.05] border border-floral/10">
              <GitBranch size={14} className="text-floral/40" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-floral">Not Yet Activated</h2>
              <p className="text-[11px] text-floral/40">
                {localNotActivated.length} {localNotActivated.length === 1 ? "repository" : "repositories"} — install Carbon Gate with one click
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {localNotActivated.map((repo, i) => (
              <NotActivatedRepoCard key={repo.repo} repo={repo} index={i} onInstalled={handleInstalled} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Card for activated repos ── */

function ActivatedRepoCard({ repo, index }: { repo: RepoReport; index: number }) {
  const pct = repo.budgetKg > 0 ? (repo.usedKg / repo.budgetKg) * 100 : 0;
  const isOver = repo.usedKg > repo.budgetKg;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-2xl border border-sage/15 bg-sage/[0.02] p-5 backdrop-blur-md transition-all hover:bg-sage/[0.04]"
    >
      {/* Status badge */}
      <div className="absolute right-4 top-4">
        <span className="inline-flex items-center gap-1 rounded-full bg-sage/10 border border-sage/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-sage">
          <span className="h-1.5 w-1.5 rounded-full bg-sage animate-pulse" />
          Active
        </span>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-floral/30">Repository</p>
        <h3 className="mt-1 font-semibold text-floral pr-20">{repo.repo}</h3>
      </div>

      {/* Usage bar */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-floral/40">Carbon usage</span>
          <span className={cn("font-bold", isOver ? "text-crusoe" : "text-sage")}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <motion.div
            className={cn("h-full rounded-full", isOver ? "bg-crusoe" : "bg-sage")}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, pct)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.04] pt-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-floral/25">Used</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-floral/80">{repo.usedKg.toFixed(1)} kg</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-floral/25">Budget</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-floral/80">{repo.budgetKg.toFixed(0)} kg</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-floral/25">Gates</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-floral/80">{repo.totalGatesRun}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] text-floral/30">Top: {repo.topContributor}</span>
        <a
          href={`https://github.com/${repo.repo}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-bold text-floral/30 hover:text-floral/60 transition"
        >
          GitHub <ExternalLink size={10} />
        </a>
      </div>
    </motion.div>
  );
}

/* ── Card for non-activated repos ── */

function NotActivatedRepoCard({ repo, index, onInstalled }: { repo: RepoReport; index: number; onInstalled: (repoName: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-2xl border border-floral/[0.08] bg-white/[0.01] p-5 backdrop-blur-md transition-all hover:bg-white/[0.03]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-floral/30">Repository</p>
          <h3 className="mt-1 font-semibold text-floral truncate">{repo.repo}</h3>
          <p className="mt-2 text-[11px] text-floral/35">
            No gate checks yet. Install Carbon Gate to start tracking emissions.
          </p>
        </div>
        <a
          href={`https://github.com/${repo.repo}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.05] p-2 text-floral/30 transition hover:bg-white/[0.1] hover:text-floral/60"
        >
          <ExternalLink size={12} />
        </a>
      </div>

      <div className="mt-4">
        <InstallCarbonGate repo={repo.repo} onInstalled={onInstalled} />
      </div>
    </motion.div>
  );
}
