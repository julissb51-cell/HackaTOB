import { connection, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/room-fields";
import { requestOrigin } from "@/lib/public-origin";
import { supabaseAuthEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/session";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const next = safeNextPath(url.searchParams.get("next"));
  if (!supabaseAuthEnv()) return NextResponse.redirect(`${origin}/auth/error?reason=config`);

  try {
    const { supabase, applyCookies } = await createSessionClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) return applyCookies(NextResponse.redirect(`${origin}${next}`));

    const { data: oauth, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !oauth.url) return applyCookies(NextResponse.redirect(`${origin}/auth/error`));
    return applyCookies(NextResponse.redirect(oauth.url));
  } catch {
    return NextResponse.redirect(`${origin}/auth/error?reason=config`);
  }
}
