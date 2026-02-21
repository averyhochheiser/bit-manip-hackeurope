/**
 * Usage ingestion pipeline — Person 3 deliverable.
 *
 * Reads gate_events from Supabase written by /api/gate/check, aggregates
 * them per org, and upserts totals into an org_usage running total.
 *
 * Called by:  POST /api/usage/ingest  (cron job or manual trigger)
 * State:      Cursor stored in ingestion_checkpoints table.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface GateEvent {
  id: string;
  org_id: string;
  repo: string;
  pr_number: number;
  gpu: string;
  region: string;
  estimated_hours: number;
  emissions_kg: number;
  crusoe_emissions_kg: number;
  carbon_intensity: number;
  status: "pass" | "warn" | "block";
  created_at: string;
}

export interface IngestResult {
  ingested: number;
  nextCursor: string;
  events: GateEvent[];
}

/**
 * Ingest all gate_events created after `cursor` (ISO timestamp).
 * Aggregates emissions per org and increments org_usage totals.
 */
export async function ingestUsageSinceCursor(cursor?: string): Promise<IngestResult> {
  let query = supabaseAdmin
    .from("gate_events")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(200);

  if (cursor) {
    query = query.gt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw new Error(`[ingest] Supabase query failed: ${error.message}`);

  const events = (data ?? []) as GateEvent[];

  if (events.length > 0) {
    // Group by org_id → sum emissions
    const byOrg = events.reduce<Record<string, number>>((acc, e) => {
      acc[e.org_id] = (acc[e.org_id] ?? 0) + (e.emissions_kg ?? 0);
      return acc;
    }, {});

    for (const [orgId, totalKg] of Object.entries(byOrg)) {
      // Upsert into a running usage_mtd table
      const { data: existing } = await supabaseAdmin
        .from("org_usage_mtd")
        .select("used_kg")
        .eq("org_id", orgId)
        .maybeSingle();

      const newTotal = (existing?.used_kg ?? 0) + totalKg;

      await supabaseAdmin
        .from("org_usage_mtd")
        .upsert({ org_id: orgId, used_kg: newTotal }, { onConflict: "org_id" });
    }
  }

  const nextCursor =
    events.length > 0
      ? events[events.length - 1].created_at
      : cursor ?? new Date().toISOString();

  return { ingested: events.length, nextCursor, events };
}
