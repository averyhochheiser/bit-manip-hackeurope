/**
 * POST /api/crusoe/chat
 *
 * Proxy endpoint that forwards chat completion requests to the Crusoe AI API.
 * Client repos authenticate with their org API key — the server injects the
 * real CRUSOE_API_KEY so clients never need it in their secrets.
 *
 * Body: { org_api_key: string, messages: Array<{role, content}>, max_tokens?: number }
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CRUSOE_API_BASE = "https://hackeurope.crusoecloud.com/v1";
const CRUSOE_MODEL    = "NVFP4/Qwen3-235B-A22B-Instruct-2507-FP4";

export async function POST(request: Request) {
  let body: {
    org_api_key?: string;
    messages?: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
  };

  try {
    body = await request.json();
  } catch (_e) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { org_api_key, messages, max_tokens = 4096, temperature = 0.2 } = body;

  if (!org_api_key) {
    return NextResponse.json({ error: "Missing org_api_key." }, { status: 401 });
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Missing or empty messages array." }, { status: 400 });
  }

  // ── Authenticate via org API key ──────────────────────────────────────────
  const { data: orgRow } = await supabaseAdmin
    .from("org_api_keys")
    .select("org_id")
    .eq("api_key", org_api_key)
    .maybeSingle();

  if (!orgRow) {
    return NextResponse.json({ error: "Invalid org_api_key." }, { status: 401 });
  }

  // ── Forward to Crusoe AI ──────────────────────────────────────────────────
  const crusoeKey = process.env.CRUSOE_API_KEY;
  if (!crusoeKey) {
    return NextResponse.json(
      { error: "CRUSOE_API_KEY not configured on server." },
      { status: 503 }
    );
  }

  try {
    const crusoeResp = await fetch(`${CRUSOE_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${crusoeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CRUSOE_MODEL,
        messages,
        max_tokens,
        temperature,
      }),
    });

    if (!crusoeResp.ok) {
      const errText = await crusoeResp.text();
      return NextResponse.json(
        { error: `Crusoe API error: ${crusoeResp.status}`, detail: errText },
        { status: crusoeResp.status }
      );
    }

    const data = await crusoeResp.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to reach Crusoe API: ${message}` },
      { status: 502 }
    );
  }
}
