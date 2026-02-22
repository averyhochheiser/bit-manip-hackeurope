import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Map Stripe price IDs to our tier IDs */
function resolveTierFromSubscription(sub: Stripe.Subscription): string {
  const priceId = sub.items.data[0]?.price.id;
  if (!priceId) return "free";

  // Check against env-configured price IDs
  if (priceId === process.env.STRIPE_BASE_PRICE_ID) return "pro";
  if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) return "enterprise";

  // Fallback: check price metadata if set in Stripe dashboard
  const tierMeta = sub.items.data[0]?.price.metadata?.tier;
  if (tierMeta && ["free", "pro", "enterprise"].includes(tierMeta)) return tierMeta;

  return "pro"; // Default paid tier
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const meteredItem = subscription.items.data.find(
    (item) => item.price.recurring?.usage_type === "metered"
  );
  const tierId = resolveTierFromSubscription(subscription);

  await supabaseAdmin
    .from("billing_profiles")
    .update({
      stripe_subscription_id: subscription.id,
      stripe_subscription_item_id: meteredItem?.id ?? null,
      stripe_price_id: meteredItem?.price.id || subscription.items.data[0]?.price.id || null,
      tier: tierId,
    })
    .eq("stripe_customer_id", customerId);

  // Update carbon_budget to match the tier's included amount
  const { BILLING_TIERS } = await import("@/lib/billing/eu-tiers");
  const tier = BILLING_TIERS[tierId];
  if (tier) {
    const { data: profile } = await supabaseAdmin
      .from("billing_profiles")
      .select("org_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (profile?.org_id) {
      await supabaseAdmin.from("carbon_budget").upsert(
        {
          org_id: profile.org_id,
          included_kg: tier.includedKg,
          warning_pct: tier.warningPct,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "org_id" }
      );
    }
  }
}

async function handleInvoiceEvent(invoice: Stripe.Invoice) {
  const customerId = (invoice.customer || "") as string;
  await supabaseAdmin
    .from("billing_invoices")
    .upsert(
      {
        stripe_invoice_id: invoice.id,
        stripe_customer_id: customerId,
        amount_due: invoice.amount_due,
        amount_paid: invoice.amount_paid,
        status: invoice.status
      },
      { onConflict: "stripe_invoice_id" }
    );
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = (invoice.customer || "") as string;
  if (!customerId) return;

  await handleInvoiceEvent(invoice);

  await supabaseAdmin
    .from("billing_profiles")
    .update({ payment_status: "paid", last_payment_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  await supabaseAdmin
    .from("billing_profiles")
    .update({
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
      stripe_price_id: null,
      payment_status: "canceled",
      tier: "free",
    })
    .eq("stripe_customer_id", customerId);

  // Reset carbon budget to free tier limits
  const { BILLING_TIERS } = await import("@/lib/billing/eu-tiers");
  const freeTier = BILLING_TIERS.free;
  const { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("org_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (profile?.org_id) {
    await supabaseAdmin.from("carbon_budget").upsert(
      {
        org_id: profile.org_id,
        included_kg: freeTier.includedKg,
        warning_pct: freeTier.warningPct,
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "org_id" }
    );
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: "Missing webhook secret or signature." }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await handleSubscriptionCreated(sub);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionCreated(sub);
      break;
    }

    case "customer.subscription.deleted": {
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    }

    case "invoice.payment_succeeded": {
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;
    }

    case "invoice.upcoming":
    case "invoice.finalized":
    case "invoice.paid": {
      await handleInvoiceEvent(event.data.object as Stripe.Invoice);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
