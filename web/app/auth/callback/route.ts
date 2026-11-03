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
  const code = url.searchParams.get("code");
  if (!code || !supabaseAuthEnv()) return NextResponse.redirect(`${origin}/auth/error`);

  try {
    const { supabase, applyCookies } = await createSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return applyCookies(NextResponse.redirect(`${origin}/auth/error`));
    return applyCookies(NextResponse.redirect(`${origin}${next}`));
  } catch {
    return NextResponse.redirect(`${origin}/auth/error`);
  }
}
