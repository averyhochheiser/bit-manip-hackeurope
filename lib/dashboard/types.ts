// Shared types for the dashboard read model

export interface KpiItem {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
}

export interface BudgetModel {
  usedKg: number;
  includedKg: number;
  projectedKg: number;
  warningPct: number;
}

export interface BillingModel {
  unitPrice: number; // $/kgCO₂ overage
  estimatedOverageKg: number;
  estimatedCharge: number;
}

/** Matches the GateEvent type expected by GateHistoryTable component */
export interface GateEventRow {
  id: string;
  prNumber: number;
  repo: string;
  branch: string;
  kgCO2e: number;
  status: "Passed" | "Rerouted to Crusoe";
  emittedAt: string;
}

/** Raw DB row shape from gate_events table */
export interface GateEventDbRow {
  id: string;
  repo: string;
  pr_number: number;
  gpu: string;
  region: string;
  emissions_kg: number;
  crusoe_emissions_kg: number;
  status: "pass" | "warn" | "block";
  created_at: string;
}

export interface RepoReport {
  repo: string;
  usedKg: number;
  budgetKg: number;
  topContributor: string;
  totalGatesRun: number;
  /** true when at least one gate event exists for this repo */
  hasGateData?: boolean;
}

export interface DashboardReadModel {
  kpis: KpiItem[];
  budget: BudgetModel;
  billing: BillingModel;
  gateEvents: GateEventRow[];
  repoReports: RepoReport[];
}
