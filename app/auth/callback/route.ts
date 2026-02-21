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
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/?error=auth_callback_failed", request.url));
  }

  // Capture the GitHub OAuth provider token so we can call the GitHub API later
  const providerToken = sessionData?.session?.provider_token ?? null;

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
    }
  }

  const response = NextResponse.redirect(new URL(next, request.url));

  // Store the GitHub token as an httpOnly cookie for subsequent server-side API calls
  if (providerToken) {
    response.cookies.set("gh_token", providerToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours (matches GitHub OAuth token lifetime)
    });
  }

  return response;
}
