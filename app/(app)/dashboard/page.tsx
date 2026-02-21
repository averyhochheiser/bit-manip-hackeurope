import { redirect } from "next/navigation";
import { CarbonBudgetProgressBar } from "@/components/dashboard/carbon-budget-progress";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { GateHistoryTable } from "@/components/dashboard/gate-history-table";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { OverageBillingCard } from "@/components/dashboard/overage-billing-card";
import { RepoBreakdown } from "@/components/dashboard/repo-breakdown";
import { getDashboardReadModel, getContributorRepos } from "@/lib/dashboard/queries";
import { getUserDashboardData } from "@/lib/dashboard/github-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureBillingProfile } from "@/lib/billing/provision";

const GITHUB_ACTION_YAML = `# .github/workflows/carbon-gate.yml
name: Carbon Gate
on: [pull_request]
jobs:
  carbon-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Carbon Gate
        uses: carbon-gate/action@v1
        with:
          api_key: \${{ secrets.CARBON_GATE_API_KEY }}
          gpu: H100
          estimated_hours: 2`;

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  let { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    // Profile missing (e.g. Stripe failed during signup) — create it now.
    profile = await ensureBillingProfile({ userId: user.id, email: user.email ?? null });
  }

  if (!profile?.org_id) redirect("/");

  const userName: string = user.user_metadata?.user_name ?? user.user_metadata?.name ?? user.email ?? "";
  const userAvatarUrl: string = user.user_metadata?.avatar_url ?? "";
  const githubUsername: string = user.user_metadata?.user_name ?? "";

  // Fetch org gate data + real GitHub repos + cross-org contributions in parallel
  const [model, githubData, contributorRepos] = await Promise.all([
    getDashboardReadModel(profile.org_id),
    githubUsername
      ? getUserDashboardData(githubUsername, profile.org_id).catch(() => null)
      : Promise.resolve(null),
    getContributorRepos(githubUsername),
  ]);

  // Merge: prefer org gate data when it exists; enrich with GitHub repo info
  const hasGateData = model.gateEvents.length > 0;
  const hasGithubRepos = (githubData?.githubRepos?.length ?? 0) > 0;

  // Use org gate data as primary, but fall back to GitHub-enriched data
  const displayModel = hasGateData ? model : (githubData ?? model);

  // Build repo list: org gate repos + GitHub-fetched repos (deduplicated)
  const orgRepoNames = new Set(model.repoReports.map((r) => r.repo));
  const allRepoReports = [...model.repoReports];

  // Add GitHub repos that aren't already in gate data
  if (githubData?.repoReports) {
    for (const ghRepo of githubData.repoReports) {
      if (!orgRepoNames.has(ghRepo.repo)) {
        allRepoReports.push(ghRepo);
        orgRepoNames.add(ghRepo.repo);
      }
    }
  }

  const externalContribRepos = contributorRepos.filter((r) => !orgRepoNames.has(r.repo));

  return (
    <DashboardLayout
      title="Organisation Overview"
      subtitle="Carbon analytics across all connected repositories and teams."
      userName={userName}
      userAvatarUrl={userAvatarUrl}
    >
      <div className="space-y-4">
        <KpiStrip kpis={displayModel.kpis} />

        {/* GitHub repos (owned + contributed) */}
        {allRepoReports.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-floral/40">Your repositories</p>
              {hasGithubRepos && (
                <span className="rounded-full bg-sage/[0.08] border border-sage/20 px-2 py-0.5 text-[10px] font-bold text-sage">
                  {allRepoReports.length} repos
                </span>
              )}
            </div>
            <RepoBreakdown reports={allRepoReports} />
          </div>
        )}

        {externalContribRepos.length > 0 && (
          /* ── Repos this user contributed to (other orgs) ── */
          <div>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-floral/40">Your contributions</p>
              <span className="rounded-full bg-floral/[0.06] px-2 py-0.5 text-[10px] text-floral/30">across all orgs</span>
            </div>
            <RepoBreakdown reports={externalContribRepos} />
          </div>
        )}

        {!hasGateData && !hasGithubRepos ? (
          /* ── Onboarding empty state ── */
          <div className="space-y-4">
            <div className="panel p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sage/20 bg-sage/[0.08]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-sage" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-floral">
                    Connect your first repo
                  </h2>
                  <p className="text-sm text-floral/45">
                    Add the Carbon Gate Action to a repository to start tracking emissions on every PR.
                  </p>
                </div>
              </div>

              {/* Steps */}
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    step: "1",
                    title: "Add the GitHub Action",
                    desc: "Copy the YAML below into .github/workflows/carbon-gate.yml in your repo.",
                    done: false,
                  },
                  {
                    step: "2",
                    title: "Add your API key",
                    desc: "Set CARBON_GATE_API_KEY as a GitHub secret. Find your key in Settings.",
                    done: false,
                  },
                  {
                    step: "3",
                    title: "Open a pull request",
                    desc: "Every PR will now get a carbon cost estimate. Results appear here automatically.",
                    done: false,
                  },
                ].map((s) => (
                  <div key={s.step} className="panel-muted rounded-xl p-5">
                    <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full border border-crusoe/30 bg-crusoe/10 text-xs font-bold text-crusoe">
                      {s.step}
                    </div>
                    <p className="text-sm font-semibold text-floral">{s.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-floral/45">{s.desc}</p>
                  </div>
                ))}
              </div>

              {/* YAML snippet */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-floral/40">
                    GitHub Action YAML
                  </p>
                  <a
                    href="/settings"
                    className="text-xs text-crusoe/70 transition hover:text-crusoe"
                  >
                    Get API key in Settings →
                  </a>
                </div>
                <pre className="overflow-x-auto rounded-xl border border-floral/[0.07] bg-black/30 p-4 font-monoData text-xs leading-relaxed text-floral/70">
                  {GITHUB_ACTION_YAML}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          /* ── Live dashboard ── */
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <CarbonBudgetProgressBar
                usedKg={displayModel.budget.usedKg}
                budgetKg={displayModel.budget.includedKg}
                projectedKg={displayModel.budget.projectedKg}
              />
            </div>
            <div className="xl:col-span-4">
              <OverageBillingCard
                includedKg={displayModel.budget.includedKg}
                usedKg={displayModel.budget.usedKg}
                unitPrice={displayModel.billing.unitPrice}
              />
            </div>
            {displayModel.gateEvents.length > 0 && (
              <div className="xl:col-span-7">
                <GateHistoryTable events={displayModel.gateEvents} />
              </div>
            )}
            <div className={displayModel.gateEvents.length > 0 ? "xl:col-span-5" : "xl:col-span-12"}>
              <ForecastCard />
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
