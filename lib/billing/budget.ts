import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type OrgBudget = {
  includedKg: number;
  warningPct: number;
  thresholdKgCo2: number;
  warnKgCo2: number;
};

export type BudgetStatus = {
  totalUsageKg: number;
  includedKg: number;
  percentUsed: number;
  remainingKg: number;
  overBudget: boolean;
};

export async function getOrgBudget(orgId: string): Promise<OrgBudget> {
  const [{ data: budget }, { data: gateCheck }] = await Promise.all([
    supabaseAdmin
      .from("carbon_budget")
      .select("included_kg, warning_pct")
      .eq("org_id", orgId)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("gate_checks")
      .select("threshold_kg_co2, warn_kg_co2")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  return {
    includedKg: Number(budget?.included_kg ?? 320),
    warningPct: Number(budget?.warning_pct ?? 70),
    thresholdKgCo2: Number(gateCheck?.threshold_kg_co2 ?? 2.0),
    warnKgCo2: Number(gateCheck?.warn_kg_co2 ?? 1.0)
  };
}

/**
 * Returns the total metered usage (kg CO₂) for the current billing period by
 * querying Stripe Billing Meter event summaries for the given customer.
 */
export async function getStripeUsageTotal(
  customerId: string,
  meterId: string
): Promise<number> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const startTime = alignToMinute(periodStart);
  const endTime = alignToMinute(now);

  if (endTime <= startTime) return 0;

  const summaries = await stripe.billing.meters.listEventSummaries(meterId, {
    customer: customerId,
    start_time: startTime,
    end_time: endTime
  });

  return summaries.data.reduce((sum, s) => sum + s.aggregated_value, 0);
}

/**
 * Calculates percentage of monthly budget used by comparing current Stripe
 * usage total against the organization's included_kg limit.
 */
export async function getBudgetStatus(orgId: string): Promise<BudgetStatus> {
  const budget = await getOrgBudget(orgId);

  const { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("stripe_customer_id")
    .eq("org_id", orgId)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id as string | undefined;
  const meterId = process.env.STRIPE_METER_ID;

  let totalUsageKg = 0;
  if (customerId && meterId) {
    totalUsageKg = await getStripeUsageTotal(customerId, meterId);
  } else {
    const { data: rows } = await supabaseAdmin
      .from("carbon_usage_events")
      .select("kg_co2e")
      .eq("org_id", orgId);
    totalUsageKg = (rows ?? []).reduce((s, r) => s + Number(r.kg_co2e ?? 0), 0);
  }

  const percentUsed =
    budget.includedKg > 0 ? (totalUsageKg / budget.includedKg) * 100 : 0;

  return {
    totalUsageKg,
    includedKg: budget.includedKg,
    percentUsed: Math.min(percentUsed, 100),
    remainingKg: Math.max(0, budget.includedKg - totalUsageKg),
    overBudget: totalUsageKg > budget.includedKg
  };
}

function alignToMinute(date: Date): number {
  return Math.floor(date.getTime() / 60_000) * 60;
}
