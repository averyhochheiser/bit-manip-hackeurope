import { readFileSync } from "fs";
import Stripe from "stripe";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const sk = env.STRIPE_SECRET_KEY ?? "";
const priceId = env.STRIPE_OVERRIDE_PRICE_ID ?? "";

console.log("STRIPE_SECRET_KEY:        ", sk.slice(0, 12) + "...");
console.log("STRIPE_OVERRIDE_PRICE_ID: ", priceId);

if (!priceId.startsWith("price_")) {
  console.error("\n❌ STRIPE_OVERRIDE_PRICE_ID does not start with 'price_'");
  console.error("   Current value starts with:", priceId.slice(0, 8));
  console.error("   Go to Stripe Dashboard (test mode) → Products → your product → copy the price_ ID");
  process.exit(1);
}

const stripe = new Stripe(sk, { apiVersion: "2026-01-28.clover" });

try {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: "http://localhost:3000/override/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url:  "http://localhost:3000/override/cancel",
    metadata: { override_type: "sha", owner: "test", repo: "test", sha: "abc123", check: "carbon", pr: "1", requested_at: new Date().toISOString() },
  });
  console.log("\n✅ Stripe is working! Checkout URL:\n");
  console.log(session.url);
  console.log("\nNow restart your dev server (Ctrl+C → npm run dev), then run node test-checkout.mjs");
} catch (err) {
  console.error("\n❌ Stripe error:", err.message);
}
