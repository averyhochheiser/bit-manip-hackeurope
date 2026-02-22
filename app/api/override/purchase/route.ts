/**
 * POST /api/override/purchase
 *
 * Creates a Stripe Checkout session for a developer to pay for an override.
 * Called by gate_check.py (via the PR comment link) when a developer wants
 * to pay to unblock their PR.
 *
 * Body: { api_key, repo, pr_number, github_user, github_role, emissions_kg, justification? }
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import {
  checkOverrideEligibility,
  createOverrideEvent,
} from "@/lib/override/queries";
import { OVERRIDE_UNIT_PRICE } from "@/lib/override/types";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (_e) {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const apiKey = (body.api_key as string) || request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key." }, { status: 401 });
  }

  const { data: orgRow } = await supabaseAdmin
    .from("org_api_keys")
    .select("org_id")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (!orgRow) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  const repo = body.repo as string;
  const prNumber = Number(body.pr_number);
  const emissionsKg = Number(body.emissions_kg);
  const githubUser = body.github_user as string;
  const githubRole = body.github_role as string;
  const justification = (body.justification as string) || null;

  if (!repo || !prNumber || isNaN(emissionsKg) || !githubUser || !githubRole) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 }
    );
  }

  // Check eligibility
  const eligibility = await checkOverrideEligibility(
    orgRow.org_id,
    repo,
    emissionsKg,
    githubRole,
    OVERRIDE_UNIT_PRICE
  );

  if (!eligibility.canOverride) {
    return NextResponse.json(
      { error: eligibility.reason, allowed: false },
      { status: 403 }
    );
  }

  if (eligibility.overrideType !== "paid") {
    return NextResponse.json(
      {
        error:
          "This user qualifies for a free admin override. Use /api/override/admin instead.",
        allowed: true,
        override_type: "admin",
      },
      { status: 400 }
    );
  }

  const costUsd = eligibility.costUsd ?? 0;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://bit-manip-hackeurope.vercel.app";

  // Create a pending override record
  const overrideEvent = await createOverrideEvent({
    org_id: orgRow.org_id,
    repo,
    pr_number: prNumber,
    github_user: githubUser,
    github_role: githubRole,
    override_type: "paid",
    emissions_kg: emissionsKg,
    cost_usd: costUsd,
    stripe_session_id: null,
    status: "pending",
    justification,
  });

  if (!overrideEvent) {
    return NextResponse.json(
      { error: "Failed to create override record." },
      { status: 500 }
    );
  }

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${appUrl}/dashboard?override=success&pr=${prNumber}&repo=${encodeURIComponent(repo)}`,
    cancel_url: `${appUrl}/dashboard?override=cancelled`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(costUsd * 100), // cents
          product_data: {
            name: `Carbon Override — PR #${prNumber}`,
            description: `Override carbon gate for ${repo} PR #${prNumber} (${emissionsKg.toFixed(1)} kgCO₂)`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      override_id: overrideEvent.id,
      org_id: orgRow.org_id,
      repo,
      pr_number: String(prNumber),
      github_user: githubUser,
      emissions_kg: String(emissionsKg),
    },
  });

  // Update override record with Stripe session ID
  await supabaseAdmin
    .from("override_events")
    .update({ stripe_session_id: session.id })
    .eq("id", overrideEvent.id);

  return NextResponse.json({
    checkout_url: session.url,
    override_id: overrideEvent.id,
    cost_usd: costUsd,
  });
}
