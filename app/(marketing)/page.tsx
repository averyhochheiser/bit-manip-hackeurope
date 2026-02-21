import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Footer } from "@/components/marketing/footer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getContributorLeaderboard } from "@/lib/leaderboard/queries";
import { getGlobalDashboardPreview } from "@/lib/dashboard/queries";
import { getUserDashboardData } from "@/lib/dashboard/github-data";
import { Trophy, Zap, LogOut } from "lucide-react";
import Link from "next/link";
// Note: /leaderboard links use <a> tags because the typed-routes cache doesn't include the new page yet

export default async function MarketingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Show top 5 contributors on the marketing page leaderboard teaser
  const githubUsername = user?.user_metadata?.user_name ?? "";

  const [topContributors, dashboardData] = await Promise.all([
    getContributorLeaderboard().then(r => r.slice(0, 5)).catch(() => []),
    // When logged in, show the user's real GitHub repos; otherwise show global data / mock
    githubUsername
      ? getUserDashboardData(githubUsername).catch(() => getGlobalDashboardPreview())
      : getGlobalDashboardPreview(),
  ]);

  return (
    <main className="relative min-h-screen bg-[#23282E] overflow-x-hidden">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.05] bg-[#23282E]/80 backdrop-blur-xl transition-all duration-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-4">
            <p className="font-display text-sm font-bold uppercase tracking-[0.25em] text-[#FFF8F0]">
              Carbon Gate
            </p>
            <span className="rounded-full border border-sage/40 bg-sage/20 px-2.5 py-0.5 text-[10px] font-bold text-sage backdrop-blur-md">
              BETA
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <a
              href="/leaderboard"
              className="text-xs font-semibold uppercase tracking-widest text-[#FFF8F0]/60 transition hover:text-[#FFF8F0]"
            >
              Leaderboard
            </a>
            {user && (
              <>
                <Link
                  href="/dashboard"
                  className="text-xs font-semibold uppercase tracking-widest text-[#FFF8F0]/60 transition hover:text-[#FFF8F0]"
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings"
                  className="text-xs font-semibold uppercase tracking-widest text-[#FFF8F0]/60 transition hover:text-[#FFF8F0]"
                >
                  Settings
                </Link>
              </>
            )}
            {user ? (
              <div className="hidden sm:flex items-center gap-2">
                <a
                  href="/dashboard"
                  className="inline-flex items-center rounded-full border border-sage/30 bg-sage/10 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-sage transition hover:bg-sage/20 hover:border-sage/50"
                >
                  Go to Dashboard
                </a>
                <form action="/api/auth/signout" method="POST">
                  <button
                    type="submit"
                    title="Sign out"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-[#FFF8F0]/40 transition hover:bg-white/[0.06] hover:text-[#FFF8F0]"
                  >
                    <LogOut size={15} />
                  </button>
                </form>
              </div>
            ) : (
              <a
                href="/api/auth/signin"
                className="hidden sm:inline-flex items-center rounded-full border border-sage/30 bg-sage/10 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-sage transition hover:bg-sage/20 hover:border-sage/50"
              >
                Sign In with GitHub
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <Hero isSignedIn={!!user} />

      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-40" />

        {/* How it works */}
        <HowItWorks />

        {/* Dashboard preview */}
        <div className="relative mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <DashboardPreview data={dashboardData} />
        </div>

        {/* Leaderboard teaser */}
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-crusoe" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-floral/40">Global impact</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-3xl font-bold text-floral sm:text-4xl">
                Who&apos;s leading the way?
              </h2>
              <p className="mt-2 max-w-lg text-sm text-floral/50">
                Teams and open-source projects making their ML workflows carbon-aware.
                Runs across companies, orgs, and individual contributors.
              </p>
            </div>
            <a
              href="/leaderboard"
              className="inline-flex items-center gap-2 rounded-full border border-crusoe/30 bg-crusoe/10 px-5 py-2 text-xs font-bold uppercase tracking-wider text-crusoe transition hover:bg-crusoe/20"
            >
              Full leaderboard
              <Zap size={12} />
            </a>
          </div>

          {topContributors.length === 0 ? (
            <div className="panel flex flex-col items-center gap-3 py-16 text-center">
              <Trophy size={32} className="text-floral/15" />
              <p className="text-sm text-floral/40">Be the first team on the board.</p>
              <a
                href="/api/auth/signin"
                className="inline-flex items-center rounded-full border border-sage/30 bg-sage/10 px-5 py-2 text-xs font-bold uppercase tracking-wider text-sage transition hover:bg-sage/20"
              >
                Sign in with GitHub
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {topContributors.map((entry, i) => {
                const medal = i === 0 ? "text-yellow-400" : i === 1 ? "text-floral/50" : i === 2 ? "text-amber-600/70" : "text-floral/20";
                return (
                  <div key={entry.name} className="panel-muted flex items-center gap-4 rounded-xl p-4">
                    <span className={`w-6 shrink-0 text-center text-sm font-bold ${medal}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-monoData text-sm text-floral">{entry.name}</p>
                      {entry.repos.length > 1 && (
                        <p className="text-xs text-floral/35">{entry.repos.length} repos</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-floral">{entry.gateCount} gates</p>
                      {entry.savedKg > 0 && (
                        <p className="text-xs text-sage">{entry.savedKg.toFixed(1)} kg saved</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
}
