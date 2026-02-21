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
      stripe_subscription_item_id: meteredItem?.id ?? null,
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
      payment_status: "canceled"
    })
    .eq("stripe_customer_id", customerId);
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
