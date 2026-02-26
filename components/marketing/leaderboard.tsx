"use client";

import { CursorTilt } from "@/components/ui/cursor-tilt";
import { TextScramble } from "@/components/ui/text-scramble";
import { Trophy } from "lucide-react";

type LeaderboardEntry = {
  name: string;
  gateCount: number;
  savedKg: number;
  repos: string[];
};

const RANK_COLORS = [
  "text-stoneware-turquoise",
  "text-stoneware-green",
  "text-stoneware-pink",
  "text-stoneware-bordeaux",
  "text-ink-faint",
];

export function Leaderboard({ topContributors }: { topContributors: LeaderboardEntry[] }) {
  return (
    <section className="w-full bg-[#23282E] py-20 px-6 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <p className="text-[10px] uppercase tracking-widest text-[#FFF8F0]/50">
            Global impact
          </p>
          <h2 className="mt-4 text-3xl font-normal tracking-tight text-[#FFF8F0] sm:text-4xl lg:text-5xl">
            <TextScramble
              initial="∑ₖ Δe(k) → min"
              target="Who's leading the way?"
              holdMs={600}
              scrambleMs={1200}
              startDelay={200}
            />
          </h2>
          <p className="mt-4 max-w-xl text-sm font-light text-[#FFF8F0]/60">
            Teams and open-source projects making their ML workflows carbon-aware.
            Runs across companies, orgs, and individual contributors.
          </p>
        </div>

        {topContributors.length === 0 ? (
          <div className="relative bg-[#2A2F35] p-8 text-center" style={{ minHeight: "180px" }}>
            <p className="absolute left-8 top-8 text-[10px] uppercase tracking-widest text-[#FFF8F0]/50">
              Leaderboard
            </p>
            <div className="mt-8">
              <Trophy size={28} className="mx-auto text-stoneware-pink/30" />
              <p className="mt-3 text-sm text-[#FFF8F0]/40">Be the first team on the board.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[0.5px] bg-floral/10">
            {topContributors.map((entry, i) => (
              <CursorTilt key={entry.name} intensity={3}>
                <div className="relative flex items-center gap-6 bg-[#2A2F35] p-6">
                  <span className={`font-mono text-2xl font-light ${RANK_COLORS[i] ?? "text-[#FFF8F0]/20"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm text-[#FFF8F0]">{entry.name}</p>
                    {entry.repos.length > 1 && (
                      <p className="mt-0.5 text-[11px] text-[#FFF8F0]/35">{entry.repos.length} repos</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-light text-[#FFF8F0]">{entry.gateCount} gates</p>
                    {entry.savedKg > 0 && (
                      <p className="mt-0.5 text-[11px] text-stoneware-green">{entry.savedKg.toFixed(1)} kg saved</p>
                    )}
                  </div>
                </div>
              </CursorTilt>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <a
            href="/leaderboard"
            className="border-[0.5px] border-[#FFF8F0]/10 bg-[#23282E] px-5 py-2.5 text-[10px] uppercase tracking-widest text-[#FFF8F0]/50 transition hover:text-[#FFF8F0]"
          >
            Full leaderboard
          </a>
        </div>
      </div>
    </section>
  );
}
