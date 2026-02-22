import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateOverrideStatus, incrementRepoUsage } from "@/lib/override/queries";
import { markOverridePaid } from "@/lib/overrides";

/** Days until a SHA-based override expires. */
const OVERRIDE_TTL_DAYS = Number(process.env.OVERRIDE_TTL_DAYS ?? 7);

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

      // ── SHA-based override (new pay-to-override flow) ─────────────────────
      // Idempotent: markOverridePaid uses upsert on stripe_session_id.
      if (
        session.metadata?.override_type === "sha" &&
        session.mode === "payment"
      ) {
        const { owner, repo, sha, check, pr } = session.metadata;
        if (owner && repo && sha && check) {
          const expiresAt = new Date(
            Date.now() + OVERRIDE_TTL_DAYS * 24 * 60 * 60 * 1000
          ).toISOString();
          await markOverridePaid(session.id, {
            owner,
            repo,
            sha,
            check_name: check,
            pr: pr || null,
            paid_at: new Date().toISOString(),
            purchaser_email: session.customer_details?.email ?? null,
            amount_total: session.amount_total ?? null,
            currency: session.currency ?? null,
            expires_at: expiresAt,
          });
        }
        break;
      }

      // ── PR-based override (existing flow) ─────────────────────────────────
      if (session.metadata?.override_id && session.mode === "payment") {
        const overrideId = session.metadata.override_id;
        const orgId = session.metadata.org_id;
        const repo = session.metadata.repo;
        const emissionsKg = parseFloat(session.metadata.emissions_kg || "0");

        await updateOverrideStatus(overrideId, "approved");
        if (orgId && repo && emissionsKg > 0) {
          await incrementRepoUsage(orgId, repo, emissionsKg);
        }
        break;
      }

      // ── Subscription checkout ─────────────────────────────────────────────
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
