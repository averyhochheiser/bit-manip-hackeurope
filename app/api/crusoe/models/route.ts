/**
 * GET /api/crusoe/models
 *
 * Returns the live list of models available on Crusoe's inference platform.
 * Used by the dashboard to show what's available for rerouting.
 * Cached for 60 seconds.
 */

import { NextResponse }          from "next/server";
import { getCrusoeAvailability } from "@/lib/crusoe/client";

export async function GET() {
  const result = await getCrusoeAvailability("H100");

  return NextResponse.json(
    {
      available:        result.available,
      model_count:      result.models.length,
      models:           result.models.map((m) => ({
        id:          m.id,
        owned_by:    m.owned_by,
      })),
      recommended_h100: result.recommendedModel,
    },
    {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    }
  );
}
