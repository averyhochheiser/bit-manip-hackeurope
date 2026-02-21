import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type UsageReportResult = {
  stripeCustomerId: string;
  quantity: number;
  identifier: string;
};

/**
 * Reports carbon overage to Stripe via billing.meterEvents.create.
 * The meter is configured with `sum` aggregation so all events accumulate
 * across the billing period — the user is billed at month-end for total kg CO₂.
 */
export async function reportUsageToStripe(
  orgId: string,
  overageKg: number,
  timestamp?: number
): Promise<UsageReportResult | null> {
  if (overageKg <= 0) return null;

  const { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("stripe_customer_id")
    .eq("org_id", orgId)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id as string | undefined;
  if (!customerId) {
    console.warn(`No Stripe customer for org ${orgId}; skipping usage report.`);
    return null;
  }

  const eventName = process.env.STRIPE_METER_EVENT_NAME || "carbon_usage_kg";
  const identifier = `gate:${orgId}:${Date.now()}`;
  const quantity = Math.ceil(overageKg);

  await stripe.billing.meterEvents.create({
    event_name: eventName,
    payload: {
      stripe_customer_id: customerId,
      value: String(quantity)
    },
    timestamp: timestamp ?? Math.floor(Date.now() / 1000),
    identifier
  });

  return { stripeCustomerId: customerId, quantity, identifier };
}
