import type { DashboardReadModel } from "./types";

/**
 * Static mock read model used when Supabase / auth is unavailable.
 * Matches the "85% of monthly budget" scenario described in the demo script.
 */
export const MOCK_DASHBOARD: DashboardReadModel = {
  kpis: [
    { label: "Emissions this month", value: "42.5 kgCO₂eq", delta: "+8% vs last month", deltaPositive: false },
    { label: "Gates triggered", value: "34", delta: "+5 this week", deltaPositive: false },
    { label: "Crusoe saves", value: "38.2 kgCO₂eq", delta: "if rerouted", deltaPositive: true },
    { label: "Carbon overage cost", value: "$0.00", delta: "within budget", deltaPositive: true },
  ],

  budget: {
    usedKg: 42.5,
    includedKg: 50.0,
    projectedKg: 48.1, // Fourier projection to end of period
    warningPct: 80,
  },

  billing: {
    unitPrice: 2.0,   // $2 / kgCO₂ overage
    estimatedOverageKg: 0,
    estimatedCharge: 0,
  },

  gateEvents: [
    {
      id: "evt_01",
      prNumber: 42,
      repo: "acme/ml-pipeline",
      branch: "feat/increase-epochs",
      kgCO2e: 3.2,
      status: "Rerouted to Crusoe",
      emittedAt: "2026-02-21T09:14:00Z",
    },
    {
      id: "evt_02",
      prNumber: 41,
      repo: "acme/ml-pipeline",
      branch: "feat/larger-batch-size",
      kgCO2e: 7.8,
      status: "Rerouted to Crusoe",
      emittedAt: "2026-02-20T18:33:00Z",
    },
    {
      id: "evt_03",
      prNumber: 17,
      repo: "acme/nlp-finetune",
      branch: "fix/tokenizer",
      kgCO2e: 0.4,
      status: "Passed",
      emittedAt: "2026-02-20T11:05:00Z",
    },
    {
      id: "evt_04",
      prNumber: 40,
      repo: "acme/ml-pipeline",
      branch: "feat/attention-heads",
      kgCO2e: 5.1,
      status: "Rerouted to Crusoe",
      emittedAt: "2026-02-19T14:22:00Z",
    },
    {
      id: "evt_05",
      prNumber: 8,
      repo: "acme/vision-model",
      branch: "main",
      kgCO2e: 1.9,
      status: "Passed",
      emittedAt: "2026-02-18T07:50:00Z",
    },
  ],
  repoReports: [
    {
      repo: "acme/ml-pipeline",
      usedKg: 16.1,
      budgetKg: 20.0,
      topContributor: "engineering@acme.com",
      totalGatesRun: 12,
    },
    {
      repo: "acme/nlp-finetune",
      usedKg: 0.4,
      budgetKg: 5.0,
      topContributor: "research@acme.com",
      totalGatesRun: 3,
    },
  ],
};
