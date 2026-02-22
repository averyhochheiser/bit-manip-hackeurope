/**
 * POST /api/override/create-checkout
 * GET  /api/override/create-checkout?owner=…&repo=…&sha=…&check=…&pr=…&ts=…&sig=…
 *
 * Creates a Stripe Checkout session for a "pay to override" carbon-gate bypass
 * scoped to a single commit SHA.
 *
 * Authentication: HMAC-SHA256 signed by OVERRIDE_SIGNING_SECRET.
 *
 * Canonical payload (keys sorted alphabetically):
 *   check=<check>&owner=<owner>&repo=<repo>&sha=<sha>&ts=<ts_ms>
 *
 * • POST → returns JSON { url: string }
 * • GET  → redirects (303) to Stripe checkout URL  (for clickable PR links)
 *
 * Timestamp window: 24 hours (enough time for a developer to click a PR link).
 *
 * On success, a pending row is inserted in sha_overrides; the webhook
 * (/api/stripe/webhook) promotes it to "paid" once payment completes.
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createPendingOverride } from "@/lib/overrides";
import {
  verifyHmac,
  verifyTimestamp,
  makeRequestPayload,
  CHECKOUT_WINDOW_MS,
} from "@/lib/hmac";

interface CheckoutInput {
  owner: string;
  repo: string;
  sha: string;
  check: string;
  pr: string | null;
  ts: string;
  sig: string;
}

function validateInput(
  raw: Record<string, string | null | undefined>
): CheckoutInput | null {
  const { owner, repo, sha, check, ts, sig } = raw;
  if (!owner || !repo || !sha || !check || !ts || !sig) return null;
  return { owner, repo, sha, check, ts, sig, pr: raw.pr ?? null };
}

async function buildSession(
  input: CheckoutInput
): Promise<
  | { url: string }
  | { error: string; status: number }
> {
  const signingSecret = process.env.OVERRIDE_SIGNING_SECRET;
  if (!signingSecret) {
    return {
      error: "Server misconfiguration: OVERRIDE_SIGNING_SECRET is not set.",
      status: 500,
    };
  }

  const priceId = process.env.STRIPE_OVERRIDE_PRICE_ID;
  if (!priceId) {
    return {
      error: "Server misconfiguration: STRIPE_OVERRIDE_PRICE_ID is not set.",
      status: 500,
    };
  }

  // Replay / expiry check (24h window for human-clickable links)
  if (!verifyTimestamp(input.ts, CHECKOUT_WINDOW_MS)) {
    return {
      error: "Request expired or timestamp invalid. Links are valid for 24 hours.",
      status: 401,
    };
  }

  // HMAC signature verification
  const payload = makeRequestPayload({
    check: input.check,
    owner: input.owner,
    repo: input.repo,
    sha: input.sha,
    ts: input.ts,
  });
  if (!verifyHmac(signingSecret, payload, input.sig)) {
    return { error: "Invalid signature.", status: 401 };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://bit-manip-hackeurope.vercel.app";

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      // Stripe replaces {CHECKOUT_SESSION_ID} before redirecting the browser.
      success_url: `${appUrl}/override/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/override/cancel`,
      metadata: {
        override_type: "sha",
        owner: input.owner,
        repo: input.repo,
        sha: input.sha,
        check: input.check,
        pr: input.pr ?? "",
        requested_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[create-checkout] Stripe error:", err);
    return { error: "Failed to create Stripe checkout session.", status: 502 };
  }

  if (!session.url) {
    return { error: "Stripe returned no checkout URL.", status: 502 };
  }

  // Persist a pending row (best-effort; webhook will upsert on payment anyway)
  await createPendingOverride(
    input.owner,
    input.repo,
    input.sha,
    input.check,
    session.id,
    input.pr
  ).catch((e) =>
    console.warn("[create-checkout] Could not persist pending row:", e)
  );

  return { url: session.url };
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const input = validateInput(body as Record<string, string | null | undefined>);
  if (!input) {
    return NextResponse.json(
      {
        error:
          "Missing required fields. Expected: owner, repo, sha, check, ts, sig.",
      },
      { status: 400 }
    );
  }

  const result = await buildSession(input);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url });
}

// ── GET (redirects browser to Stripe) ────────────────────────────────────────

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;

  const input = validateInput({
    owner: p.get("owner"),
    repo: p.get("repo"),
    sha: p.get("sha"),
    check: p.get("check"),
    pr: p.get("pr"),
    ts: p.get("ts"),
    sig: p.get("sig"),
  });

  if (!input) {
    return NextResponse.json(
      {
        error:
          "Missing required query params. Expected: owner, repo, sha, check, ts, sig.",
      },
      { status: 400 }
    );
  }

  const result = await buildSession(input);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // 303 See Other — browser follows with a GET, which is correct for Stripe redirect
  return NextResponse.redirect(result.url, 303);
}
