/**
 * GET /api/override/valid?owner=…&repo=…&sha=…&check=…&ts=…
 *
 * Called by the GitHub Action to check whether a paid override exists for a
 * specific commit SHA before deciding to fail the gate check.
 *
 * Authentication: HMAC-SHA256 bearer token in the Authorization header.
 *
 *   Authorization: Bearer <sig>
 *
 * where <sig> = HMAC-SHA256(OVERRIDE_SIGNING_SECRET, canonical_payload)
 * and   canonical_payload = makeRequestPayload({ check, owner, repo, sha, ts })
 *
 * Timestamp window: 5 minutes (machine-to-machine — tight for security).
 *
 * Responses:
 *   200 { valid: false }                          — no paid override found
 *   200 { valid: true, expires_at, paid_at, session_id }
 *   400 { error: "…" }                            — missing params
 *   401 { error: "…" }                            — bad/expired signature
 *   500 { error: "…" }                            — server misconfiguration
 *
 * Fork safety note: the OVERRIDE_SIGNING_SECRET is a repository secret.
 * GitHub Actions does NOT expose repository secrets to workflows triggered by
 * pull_request events from forks. For fork PRs, this endpoint will not be
 * callable from the action; the gate will simply fail (correct behaviour).
 * Override payments for fork PRs must be verified manually or via a separate
 * trusted workflow (e.g. workflow_dispatch on the base repo).
 */

import { NextRequest, NextResponse } from "next/server";
import { getOverride } from "@/lib/overrides";
import {
  verifyHmac,
  verifyTimestamp,
  makeRequestPayload,
  VERIFY_WINDOW_MS,
} from "@/lib/hmac";

export async function GET(request: NextRequest) {
  const signingSecret = process.env.OVERRIDE_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: OVERRIDE_SIGNING_SECRET is not set." },
      { status: 500 }
    );
  }

  const p = request.nextUrl.searchParams;
  const owner = p.get("owner");
  const repo = p.get("repo");
  const sha = p.get("sha");
  const check = p.get("check");
  const ts = p.get("ts");

  if (!owner || !repo || !sha || !check || !ts) {
    return NextResponse.json(
      {
        error:
          "Missing required query params: owner, repo, sha, check, ts.",
      },
      { status: 400 }
    );
  }

  // Verify timestamp (5-minute window)
  if (!verifyTimestamp(ts, VERIFY_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Request expired or timestamp invalid (window: 5 minutes)." },
      { status: 401 }
    );
  }

  // Extract bearer token from Authorization header
  const authHeader = request.headers.get("authorization") ?? "";
  const sig = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!sig) {
    return NextResponse.json(
      { error: "Missing Authorization header. Expected: Bearer <hmac-sig>" },
      { status: 401 }
    );
  }

  // Verify HMAC
  const payload = makeRequestPayload({ check, owner, repo, sha, ts });
  if (!verifyHmac(signingSecret, payload, sig)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // Look up override
  const record = await getOverride(owner, repo, sha, check);

  if (!record) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    expires_at: record.expires_at,
    paid_at: record.paid_at,
    session_id: record.stripe_session_id,
  });
}
