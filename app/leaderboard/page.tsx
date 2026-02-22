import Link from "next/link";
import { Leaf, Trophy, Shield, Zap, User } from "lucide-react";
import { getOrgLeaderboard, getRepoLeaderboard, getContributorLeaderboard } from "@/lib/leaderboard/queries";

export const revalidate = 60; // refresh every minute

export default async function LeaderboardPage() {
  const [orgBoard, repoBoard, contributorBoard] = await Promise.all([
    getOrgLeaderboard(),
    getRepoLeaderboard(),
    getContributorLeaderboard(),
  ]);

  const isEmpty = orgBoard.length === 0 && repoBoard.length === 0 && contributorBoard.length === 0;

  return (
    <main className="relative min-h-screen bg-[#16191d] text-floral">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.25]" />
      <div className="pointer-events-none absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-sage/[0.03] blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-crusoe/[0.03] blur-[120px]" />

      <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-floral/40 transition hover:text-floral/70">
            <Leaf size={14} className="text-sage" />
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.25em]">Carbon Gate</span>
          </Link>
          <span className="text-floral/20">/</span>
          <span className="text-[10px] uppercase tracking-widest text-floral/40">Leaderboard</span>
        </div>

        <div className="mb-10 flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-floral">
              Global Impact
            </h1>
            <p className="mt-2 max-w-lg text-sm text-floral/50">
              Teams and open-source projects making every PR carbon-aware. Ranked by
              kgCO₂e avoided — blocked jobs + Crusoe clean-compute savings.
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 rounded-full border border-crusoe/25 bg-crusoe/[0.06] px-4 py-2 text-xs font-semibold text-crusoe md:flex">
            <Trophy size={14} />
            Live rankings
          </div>
        </div>

        {isEmpty ? (
          <div className="panel flex flex-col items-center gap-4 py-24 text-center">
            <Trophy size={36} className="text-floral/20" />
            <p className="text-lg font-semibold text-floral/60">No entries yet — be the first.</p>
            <p className="max-w-sm text-sm text-floral/35">
              Once teams start running Carbon Gate on their repos, they&apos;ll appear here.
            </p>
            <a
              href="/api/auth/signin"
              className="mt-2 inline-flex items-center rounded-full border border-sage/30 bg-sage/10 px-5 py-2 text-xs font-bold uppercase tracking-wider text-sage transition hover:bg-sage/20"
            >
              Sign in &amp; get started
            </a>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Individual contributor leaderboard — primary */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <User size={16} className="text-sage" />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-floral/60">
                  By Contributor
                  <span className="ml-2 rounded-full bg-sage/10 px-2 py-0.5 text-[10px] font-normal text-sage">
                    individual developers
                  </span>
                </h2>
              </div>
              <p className="mb-3 text-xs text-floral/35">
                Individual developers ranked by carbon emissions avoided across all repos and orgs.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {contributorBoard.length === 0 ? (
                  <p className="py-8 text-center text-sm text-floral/30 sm:col-span-2 lg:col-span-3">
                    No contributor data yet.
                  </p>
                ) : (
                  contributorBoard.map((entry, i) => (
                    <OrgRow key={entry.name} rank={i + 1} entry={entry} showRepos />
                  ))
                )}
              </div>
            </section>

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Org leaderboard */}
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <Shield size={16} className="text-sage" />
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-floral/60">By Organisation</h2>
                </div>
                <div className="space-y-2">
                  {orgBoard.length === 0 ? (
                    <p className="py-8 text-center text-sm text-floral/30">No data yet.</p>
                  ) : (
                    orgBoard.map((entry, i) => (
                      <OrgRow key={entry.name} rank={i + 1} entry={entry} showRepos />
                    ))
                  )}
                </div>
              </section>

              {/* Repo leaderboard */}
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <Zap size={16} className="text-crusoe" />
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-floral/60">
                    By Repository
                    <span className="ml-2 rounded-full bg-crusoe/10 px-2 py-0.5 text-[10px] font-normal text-crusoe">
                      open-source friendly
                    </span>
                  </h2>
                </div>
                <p className="mb-3 text-xs text-floral/35">
                  Repos ranked by total carbon avoided — great for open-source projects.
                </p>
                <div className="space-y-2">
                  {repoBoard.length === 0 ? (
                    <p className="py-8 text-center text-sm text-floral/30">No data yet.</p>
                  ) : (
                    repoBoard.map((entry, i) => (
                      <OrgRow key={entry.name} rank={i + 1} entry={entry} showOrgs />
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

function OrgRow({
  rank,
  entry,
  showRepos,
  showOrgs,
}: {
  rank: number;
  entry: { name: string; gateCount: number; totalEmissionsKg: number; savedKg: number; repos: string[] };
  showRepos?: boolean;
  showOrgs?: boolean;
}) {
  const medal = rank === 1 ? "text-yellow-400" : rank === 2 ? "text-floral/50" : rank === 3 ? "text-amber-600/70" : "text-floral/20";

  return (
    <div className="panel-muted flex items-center gap-4 rounded-xl p-4">
      <span className={`w-6 text-center text-sm font-bold ${medal}`}>{rank}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-monoData text-sm font-medium text-floral">{entry.name}</p>
        {showRepos && entry.repos.length > 0 && (
          <p className="mt-0.5 truncate text-xs text-floral/35">
            {entry.repos.slice(0, 3).join(", ")}
            {entry.repos.length > 3 ? ` +${entry.repos.length - 3} more` : ""}
          </p>
        )}
        {showOrgs && entry.repos.length > 1 && (
          <p className="mt-0.5 text-xs text-crusoe/60">
            {entry.repos.length} orgs contributing
          </p>
        )}
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        {entry.savedKg > 0 ? (
          <p className="text-sm font-semibold text-sage">{entry.savedKg.toFixed(2)} kg saved</p>
        ) : (
          <p className="text-sm font-semibold text-floral/40">0 kg saved</p>
        )}
        <p className="text-xs text-floral/35">{entry.gateCount} gate {entry.gateCount === 1 ? "check" : "checks"}</p>
      </div>
    </div>
  );
}
