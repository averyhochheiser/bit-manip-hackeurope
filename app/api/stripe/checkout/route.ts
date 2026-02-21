import { NextResponse } from "next/server";
import { ensureBillingProfile } from "@/lib/billing/provision";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await ensureBillingProfile({ userId: user.id, email: user.email ?? null });
  const priceId = process.env.STRIPE_METERED_PRICE_ID;
  const basePriceId = process.env.STRIPE_BASE_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!priceId) {
    return NextResponse.json({ error: "Missing STRIPE_METERED_PRICE_ID" }, { status: 500 });
  }

  const lineItems = [
    ...(basePriceId ? [{ price: basePriceId, quantity: 1 }] : []),
    { price: priceId }
  ];

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: profile.stripe_customer_id,
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/settings?checkout=cancel`,
    line_items: lineItems,
    metadata: {
      supabase_user_id: user.id,
      org_id: profile.org_id || ""
    }
  });

  return NextResponse.json({ url: session.url });
}
