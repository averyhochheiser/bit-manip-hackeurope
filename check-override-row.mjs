import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from("sha_overrides")
  .select("id, owner, repo, sha, check_name, status, paid_at, stripe_session_id, created_at")
  .order("created_at", { ascending: false })
  .limit(5);

if (error) {
  console.error("Supabase error:", error.message);
  console.error("Hint: make sure the sha_overrides table exists (run the migration SQL)");
} else if (!data?.length) {
  console.log("No rows found in sha_overrides — the create-checkout call may not have saved a pending row");
} else {
  console.log("Latest sha_overrides rows:");
  data.forEach(r => console.log(` - ${r.status.padEnd(8)} | ${r.sha} | ${r.stripe_session_id?.slice(0,20)}... | ${r.created_at}`));
}
