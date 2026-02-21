import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.stripe_subscription_id) {
    await stripe.subscriptions.cancel(profile.stripe_subscription_id, {
      invoice_now: true,
      prorate: true
    });
  }

  if (profile?.stripe_customer_id) {
    await stripe.customers.del(profile.stripe_customer_id);
  }

  await supabaseAdmin.from("billing_profiles").delete().eq("user_id", user.id);
  await supabaseAdmin.auth.admin.deleteUser(user.id);

  return NextResponse.json({ deleted: true });
}
