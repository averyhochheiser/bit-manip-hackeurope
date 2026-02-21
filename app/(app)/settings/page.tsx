import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOrgRepos } from "@/lib/dashboard/queries";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) redirect("/");

  const { data: budget } = await supabaseAdmin
    .from("carbon_budget")
    .select("included_kg, warning_pct")
    .eq("org_id", profile.org_id)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const repos = await getOrgRepos(profile.org_id);

  return (
    <DashboardLayout
      title="Policy Settings"
      subtitle="Set carbon budgets per organisation, repository, and team. Changes apply on the next gate check."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <SettingsPanel
            defaultBudgetKg={budget?.included_kg ?? 50}
            warningPct={budget?.warning_pct ?? 80}
            repos={repos}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
