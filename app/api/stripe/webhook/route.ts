import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const meteredItem = subscription.items.data.find(
    (item) => item.price.recurring?.usage_type === "metered"
  );

  await supabaseAdmin
    .from("billing_profiles")
    .update({
      stripe_subscription_id: subscription.id,
      stripe_price_id: meteredItem?.price.id || subscription.items.data[0]?.price.id || null
    })
    .eq("stripe_customer_id", customerId);
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

  if (
    event.type === "checkout.session.completed" ||
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const subscriptionId =
      event.type === "checkout.session.completed"
        ? (event.data.object as Stripe.Checkout.Session).subscription
        : (event.data.object as Stripe.Subscription).id;

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
      await handleSubscriptionCreated(subscription);
    }
  }

  if (
    event.type === "invoice.upcoming" ||
    event.type === "invoice.finalized" ||
    event.type === "invoice.paid"
  ) {
    await handleInvoiceEvent(event.data.object as Stripe.Invoice);
  }

  return NextResponse.json({ received: true });
}
