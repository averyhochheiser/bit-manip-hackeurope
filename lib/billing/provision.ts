import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

interface ProvisionOptions {
  userId: string;
  email: string | null;
}

export async function ensureBillingProfile({ userId, email }: ProvisionOptions) {
  const { data: existing } = await supabaseAdmin
    .from("billing_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing;

  // Create a Stripe customer for this user
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  const orgId = randomUUID();

  const { data: profile, error } = await supabaseAdmin
    .from("billing_profiles")
    .insert({
      user_id: userId,
      org_id: orgId,
      stripe_customer_id: customer.id,
    })
    .select()
    .single();

  if (error) throw error;

  // Provision a default 30-day carbon budget
  await supabaseAdmin.from("carbon_budget").insert({
    org_id: orgId,
    included_kg: 50,
    warning_pct: 80,
    period_start: new Date().toISOString(),
    period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return profile;
}
