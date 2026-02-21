import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { SettingsPanel } from "@/components/dashboard/settings-panel";

export default function SettingsPage() {
  return (
    <DashboardLayout
      title="Policy Settings"
      subtitle="Configure carbon thresholds and manage subscription billing controls."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <SettingsPanel defaultBudgetKg={320} warningPct={70} />
        </div>
      </div>
    </DashboardLayout>
  );
}
