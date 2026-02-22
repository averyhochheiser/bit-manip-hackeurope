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

  if (existing) {
    // Backfill API key for users who signed up before key provisioning was added
    const { data: existingKey } = await supabaseAdmin
      .from("org_api_keys")
      .select("api_key")
      .eq("org_id", existing.org_id)
      .maybeSingle();

    if (!existingKey) {
      const apiKey = `cg_${randomUUID().replace(/-/g, "")}`;
      await supabaseAdmin.from("org_api_keys").insert({
        org_id: existing.org_id,
        api_key: apiKey,
      });
    }

    return existing;
  }

  const orgId = randomUUID();

  // Create the profile row first so the user can always access the dashboard,
  // even if Stripe provisioning fails.
  const { data: profile, error } = await supabaseAdmin
    .from("billing_profiles")
    .insert({
      user_id: userId,
      org_id: orgId,
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

  // Provision an API key so the GitHub Action can authenticate gate checks
  const apiKey = `cg_${randomUUID().replace(/-/g, "")}`;
  await supabaseAdmin.from("org_api_keys").insert({
    org_id: orgId,
    api_key: apiKey,
  });

  // Attempt to create a Stripe customer — non-blocking, fails gracefully.
  try {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      metadata: { supabase_user_id: userId },
    });
    await supabaseAdmin
      .from("billing_profiles")
      .update({ stripe_customer_id: customer.id })
      .eq("user_id", userId);
  } catch (err) {
    console.error("[ensureBillingProfile] Stripe provisioning failed:", err);
  }

  return profile;
}
