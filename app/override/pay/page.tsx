/**
 * /override/pay?owner=…&repo=…&sha=…&pr=…
 *
 * Server-side redirect to Stripe checkout.
 * Signs the payload using OVERRIDE_SIGNING_SECRET so the comment link
 * needs no secrets — just plain repo/sha params.
 */

import { redirect } from "next/navigation";
import { createHmac } from "crypto";
import { stripe } from "@/lib/stripe";
import { createPendingOverride } from "@/lib/overrides";

interface Props {
  searchParams: Promise<{
    owner?: string;
    repo?: string;
    sha?: string;
    pr?: string;
  }>;
}

export default async function OverridePayPage({ searchParams }: Props) {
  const { owner, repo, sha, pr } = await searchParams;

  if (!owner || !repo || !sha) {
    return (
      <main style={{ fontFamily: "sans-serif", padding: 40 }}>
        <h2>Missing parameters</h2>
        <p>This link is missing required parameters (owner, repo, sha).</p>
      </main>
    );
  }

  const signingSecret = process.env.OVERRIDE_SIGNING_SECRET;
  const priceId = process.env.STRIPE_OVERRIDE_PRICE_ID;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://bit-manip-hackeurope.vercel.app";

  if (!signingSecret || !priceId) {
    return (
      <main style={{ fontFamily: "sans-serif", padding: 40 }}>
        <h2>Server misconfiguration</h2>
        <p>Payment is not configured on this server. Contact the repo admin.</p>
      </main>
    );
  }

  // Sign server-side — no secret needed in the PR comment
  const ts = String(Date.now());
  const check = "carbon";
  const payload = `check=${check}&owner=${owner}&repo=${repo}&sha=${sha}&ts=${ts}`;
  const sig = createHmac("sha256", signingSecret).update(payload).digest("hex");

  let sessionUrl: string;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/override/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/override/cancel`,
      metadata: {
        override_type: "sha",
        owner,
        repo,
        sha,
        check,
        pr: pr ?? "",
        requested_at: new Date().toISOString(),
      },
    });

    if (!session.url) throw new Error("No session URL returned");
    sessionUrl = session.url;

    // Persist pending row best-effort
    await createPendingOverride(owner, repo, sha, check, session.id, pr ?? null).catch(
      () => {}
    );
  } catch (err) {
    console.error("[override/pay] Stripe error:", err);
    return (
      <main style={{ fontFamily: "sans-serif", padding: 40 }}>
        <h2>Payment error</h2>
        <p>Could not create a Stripe checkout session. Please try again.</p>
      </main>
    );
  }

  redirect(sessionUrl);
}
