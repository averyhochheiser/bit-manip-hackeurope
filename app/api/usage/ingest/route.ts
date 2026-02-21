import { NextResponse } from "next/server";
import { ingestUsageSinceCursor } from "@/lib/usage/ingest";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    mode?: string;
    budgetKg?: number;
    warningPct?: number;
  };

  if (body.mode === "settings-preview") {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("billing_profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.org_id) {
      return NextResponse.json({ error: "No org linked." }, { status: 400 });
    }

    await supabaseAdmin.from("carbon_budget").upsert(
      {
        org_id: profile.org_id,
        included_kg: body.budgetKg || 320,
        warning_pct: body.warningPct || 70,
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
      },
      { onConflict: "org_id" }
    );

    return NextResponse.json({ ok: true });
  }

  const cronSecret = process.env.CRON_SECRET;
  const incomingSecret = request.headers.get("x-cron-secret");
  if (cronSecret && incomingSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized cron invocation." }, { status: 401 });
  }

  const { data: checkpoint } = await supabaseAdmin
    .from("ingestion_checkpoints")
    .select("cursor")
    .eq("pipeline", "person3_usage")
    .maybeSingle();

  const result = await ingestUsageSinceCursor(checkpoint?.cursor);

  await supabaseAdmin.from("ingestion_checkpoints").upsert(
    {
      pipeline: "person3_usage",
      cursor: result.nextCursor
    },
    { onConflict: "pipeline" }
  );

  return NextResponse.json(result);
}
