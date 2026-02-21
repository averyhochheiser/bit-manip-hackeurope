/**
 * GET /api/health
 *
 * Liveness check — verifies Supabase and Crusoe API connectivity.
 * Useful for deployment checks and demo validation.
 */

import { NextResponse }  from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pingCrusoeApi } from "@/lib/crusoe/client";

export async function GET() {
  const [crusoeOk, supabaseOk] = await Promise.all([
    pingCrusoeApi(),
    supabaseAdmin
      .from("org_api_keys")
      .select("id", { count: "exact", head: true })
      .then(({ error }) => !error),
  ]);

  const status = crusoeOk && supabaseOk ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      services: {
        crusoe:   crusoeOk   ? "ok" : "error",
        supabase: supabaseOk ? "ok" : "error",
      },
    },
    { status: status === "ok" ? 200 : 207 }
  );
}
