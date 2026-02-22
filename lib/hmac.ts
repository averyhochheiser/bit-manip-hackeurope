/**
 * HMAC utilities for signing and verifying override requests.
 *
 * Canonical payload format: keys sorted alphabetically, joined with "&".
 * e.g. makeRequestPayload({ sha, owner, repo }) → "owner=o&repo=r&sha=s"
 *
 * Used by:
 *   - POST/GET /api/override/create-checkout  (sign: GitHub Action → verify: server)
 *   - GET       /api/override/valid           (sign: GitHub Action → verify: server)
 */
import { createHmac, timingSafeEqual } from "crypto";

/** Build canonical payload string: keys sorted alphabetically, joined with & */
export function makeRequestPayload(fields: Record<string, string>): string {
  return Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("&");
}

/** Produce a hex HMAC-SHA256 signature. */
export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Constant-time comparison of candidate against expected HMAC.
 * Returns false on length mismatch or any error.
 */
export function verifyHmac(
  secret: string,
  payload: string,
  candidate: string
): boolean {
  const expected = signPayload(secret, payload);
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(candidate, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Verify that a timestamp (ms since epoch as string) is within windowMs.
 * Default window: 5 minutes (machine-to-machine verification).
 * Use CHECKOUT_WINDOW_MS (24h) for the checkout link to allow human click time.
 */
export function verifyTimestamp(
  ts: string,
  windowMs: number = 5 * 60 * 1000
): boolean {
  const t = parseInt(ts, 10);
  if (isNaN(t)) return false;
  return Math.abs(Date.now() - t) <= windowMs;
}

/** 24 hours — used for the clickable checkout link timestamp window. */
export const CHECKOUT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 5 minutes — used for machine-to-machine verification calls. */
export const VERIFY_WINDOW_MS = 5 * 60 * 1000;
