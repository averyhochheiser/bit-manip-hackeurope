import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Leaderboard } from "@/components/marketing/leaderboard";
import { Footer } from "@/components/marketing/footer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getContributorLeaderboard } from "@/lib/leaderboard/queries";
import { getGlobalDashboardPreview } from "@/lib/dashboard/queries";
import { getUserDashboardData } from "@/lib/dashboard/github-data";
import Link from "next/link";

export default async function MarketingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const githubUsername = user?.user_metadata?.user_name ?? "";

  const [topContributors, dashboardData] = await Promise.all([
    getContributorLeaderboard().then(r => r.slice(0, 5)).catch(() => []),
    githubUsername
      ? getUserDashboardData(githubUsername).catch(() => getGlobalDashboardPreview())
      : getGlobalDashboardPreview(),
  ]);

  return (
    <main className="relative min-h-screen bg-[#23282E] overflow-x-hidden">
      <nav className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
          <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white/70 backdrop-blur-md">
            BETA
          </span>
          <div className="flex items-center gap-6">
            {user && (
              <>
                <Link
                  href="/dashboard"
                  className="text-xs font-semibold uppercase tracking-widest text-white/60 transition hover:text-white"
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings"
                  className="text-xs font-semibold uppercase tracking-widest text-white/60 transition hover:text-white"
                >
                  Settings
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <Hero isSignedIn={!!user} />

      {/* Palette section divider */}
      <div className="flex h-[3px]">
        <div className="flex-1 bg-stoneware-turquoise/40" />
        <div className="flex-1 bg-stoneware-green/40" />
        <div className="flex-1 bg-stoneware-pink/40" />
        <div className="flex-1 bg-stoneware-bordeaux/40" />
      </div>

      <HowItWorks />

      {/* Palette accent line */}
      <div className="h-[1px] bg-gradient-to-r from-stoneware-turquoise/20 via-stoneware-green/30 to-stoneware-bordeaux/20" />

      <div className="relative mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <DashboardPreview data={dashboardData} />
      </div>

      {/* Palette accent line */}
      <div className="h-[1px] bg-gradient-to-r from-stoneware-bordeaux/20 via-stoneware-pink/30 to-stoneware-turquoise/20" />

      <Leaderboard topContributors={topContributors} />

      {/* Palette accent line */}
      <div className="h-[1px] bg-gradient-to-r from-stoneware-green/20 via-stoneware-turquoise/30 to-stoneware-pink/20" />

      <Footer />
    </main>
  );
}
