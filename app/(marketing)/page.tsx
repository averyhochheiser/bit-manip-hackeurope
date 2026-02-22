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
    <main className="relative min-h-screen bg-[#16191d] overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.25]" />
      <div className="pointer-events-none absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-sage/[0.03] blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-crusoe/[0.03] blur-[120px]" />

      <nav className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-end px-6 py-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-6">
            {user && (
              <>
                <Link
                  href="/dashboard"
                  className="text-xs font-semibold uppercase tracking-widest text-floral/50 transition hover:text-floral"
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings"
                  className="text-xs font-semibold uppercase tracking-widest text-floral/50 transition hover:text-floral"
                >
                  Settings
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <Hero isSignedIn={!!user} />

      <HowItWorks />

      <div className="relative mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <DashboardPreview data={dashboardData} />
      </div>

      <Leaderboard topContributors={topContributors} />

      <Footer />
    </main>
  );
}
