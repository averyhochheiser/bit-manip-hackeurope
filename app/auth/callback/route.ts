import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureBillingProfile } from "@/lib/billing/provision";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/?error=auth_callback_failed", request.url));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await ensureBillingProfile({
        userId: user.id,
        email: user.email ?? null
      });
    } catch (err) {
      console.error("[auth/callback] ensureBillingProfile failed:", err);
      // Don't block sign-in if billing provisioning fails
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
