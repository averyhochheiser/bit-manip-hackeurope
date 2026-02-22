import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ReposGrid } from "@/components/dashboard/repos-grid";
import { getDashboardReadModel } from "@/lib/dashboard/queries";
import { getUserDashboardData } from "@/lib/dashboard/github-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureBillingProfile } from "@/lib/billing/provision";
import type { RepoReport } from "@/lib/dashboard/types";

export default async function ReposPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  let { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    profile = await ensureBillingProfile({ userId: user.id, email: user.email ?? null });
  }
  if (!profile?.org_id) redirect("/");

  const userName: string = user.user_metadata?.user_name ?? user.user_metadata?.name ?? user.email ?? "";
  const userAvatarUrl: string = user.user_metadata?.avatar_url ?? "";
  const githubUsername: string = user.user_metadata?.user_name ?? "";

  // Fetch org gate data + real GitHub repos in parallel
  const [model, githubData] = await Promise.all([
    getDashboardReadModel(profile.org_id),
    githubUsername
      ? getUserDashboardData(githubUsername, profile.org_id).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Build deduplicated repo list with hasGateData flag
  const gateRepoNames = new Set(model.repoReports.map((r) => r.repo));
  const allRepos: RepoReport[] = [];

  // Gate repos first (from org data)
  for (const r of model.repoReports) {
    allRepos.push({ ...r, hasGateData: true });
  }

  // GitHub repos not already covered by org gate data
  if (githubData?.repoReports) {
    for (const r of githubData.repoReports) {
      if (!gateRepoNames.has(r.repo)) {
        // Preserve hasGateData from cross-org repo-name lookup
        allRepos.push({ ...r });
      }
    }
  }

  const activated = allRepos.filter((r) => r.hasGateData);
  const notActivated = allRepos.filter((r) => !r.hasGateData);

  return (
    <DashboardLayout
      title="Repositories"
      subtitle="Manage Carbon Gate across all your repositories."
      userName={userName}
      userAvatarUrl={userAvatarUrl}
    >
      <ReposGrid activated={activated} notActivated={notActivated} />
    </DashboardLayout>
  );
}
