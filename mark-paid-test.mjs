// One-time test helper: manually mark the pending row as paid
// to verify the /valid endpoint without needing stripe listen running.
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const { data, error } = await supabase
  .from("sha_overrides")
  .update({
    status: "paid",
    paid_at: new Date().toISOString(),
    purchaser_email: "test@example.com",
    amount_total: 1000,
    currency: "eur",
    expires_at: expiresAt,
  })
  .eq("sha", "abc1234def5678")
  .eq("status", "pending")
  .select("id, status, paid_at, expires_at");

if (error) {
  console.error("Error:", error.message);
} else {
  console.log("Updated row:", data);
  console.log("\nNow run the valid endpoint test in PowerShell.");
}
