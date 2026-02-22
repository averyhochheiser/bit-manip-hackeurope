import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrgRepos } from "@/lib/dashboard/queries";
import { BILLING_TIERS, getTier } from "@/lib/billing/eu-tiers";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("org_id, tier")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) redirect("/");

  // Fetch budget + usage + API key in parallel
  const [budgetResult, usageResult, apiKeyResult] = await Promise.all([
    supabaseAdmin
      .from("carbon_budget")
      .select("included_kg, warning_pct")
      .eq("org_id", profile.org_id)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("org_usage_mtd")
      .select("used_kg")
      .eq("org_id", profile.org_id)
      .maybeSingle(),
    supabaseAdmin
      .from("org_api_keys")
      .select("api_key")
      .eq("org_id", profile.org_id)
      .maybeSingle(),
  ]);

  const budget = budgetResult.data;
  const usedKg = (usageResult.data as { used_kg?: number } | null)?.used_kg ?? 0;
  const orgApiKey = (apiKeyResult.data as { api_key?: string } | null)?.api_key ?? undefined;
  const repos = await getOrgRepos(profile.org_id);

  // Resolve current tier and build serialisable tier objects
  const currentTier = getTier(profile.tier);
  const allTiers = Object.values(BILLING_TIERS).map((t) => ({
    id: t.id,
    name: t.name,
    includedKg: t.includedKg,
    hardCapKg: t.hardCapKg,
    basePriceCents: t.basePriceCents,
    overagePerKgCents: t.overagePerKgCents,
    warningPct: t.warningPct,
    overBudgetAction: t.overBudgetAction,
    csrdReporting: t.csrdReporting,
    sbtiReduction: t.sbtiReduction,
    regulatoryNote: t.regulatoryNote,
  }));

  return (
    <DashboardLayout
      title="Policy Settings"
      subtitle="Set carbon budgets per organisation, repository, and team. Changes apply on the next gate check."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <SettingsPanel
            defaultBudgetKg={budget?.included_kg ?? currentTier.includedKg}
            warningPct={budget?.warning_pct ?? currentTier.warningPct}
            repos={repos}
            currentTier={{
              id: currentTier.id,
              name: currentTier.name,
              includedKg: currentTier.includedKg,
              hardCapKg: currentTier.hardCapKg,
              basePriceCents: currentTier.basePriceCents,
              overagePerKgCents: currentTier.overagePerKgCents,
              warningPct: currentTier.warningPct,
              overBudgetAction: currentTier.overBudgetAction,
              csrdReporting: currentTier.csrdReporting,
              sbtiReduction: currentTier.sbtiReduction,
              regulatoryNote: currentTier.regulatoryNote,
            }}
            tiers={allTiers}
            usedKg={usedKg}
            orgApiKey={orgApiKey}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
