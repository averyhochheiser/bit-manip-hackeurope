import { CarbonBudgetProgressBar } from "@/components/dashboard/carbon-budget-progress";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { GateHistoryTable } from "@/components/dashboard/gate-history-table";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { OverageBillingCard } from "@/components/dashboard/overage-billing-card";
import { RepoBreakdown } from "@/components/dashboard/repo-breakdown";
import { getDashboardReadModel } from "@/lib/dashboard/queries";

export default async function DashboardPage() {
  const model = await getDashboardReadModel();

  return (
    <DashboardLayout
      title="Organisation Overview"
      subtitle="Company-wide carbon analytics across all connected repositories and teams."
    >
      <div className="space-y-4">
        <KpiStrip kpis={model.kpis} />
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <CarbonBudgetProgressBar
              usedKg={model.budget.usedKg}
              budgetKg={model.budget.includedKg}
              projectedKg={model.budget.projectedKg}
            />
          </div>
          <div className="xl:col-span-4">
            <OverageBillingCard
              includedKg={model.budget.includedKg}
              usedKg={model.budget.usedKg}
              unitPrice={model.billing.unitPrice}
            />
          </div>
          <div className="xl:col-span-12">
            <RepoBreakdown reports={model.repoReports} />
          </div>
          <div className="xl:col-span-7">
            <GateHistoryTable events={model.gateEvents} />
          </div>
          <div className="xl:col-span-5">
            <ForecastCard />
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
