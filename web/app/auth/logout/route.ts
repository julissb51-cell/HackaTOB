import { connection, NextResponse } from "next/server";
import { requestOrigin } from "@/lib/public-origin";
import { supabaseAuthEnv } from "@/lib/supabase/env";
import { createSessionClient } from "@/lib/supabase/session";

export async function POST(request: Request) {
  await connection();
  const origin = requestOrigin(request);
  if (!supabaseAuthEnv()) return NextResponse.redirect(`${origin}/`, 303);
  try {
    const { supabase, applyCookies } = await createSessionClient();
    await supabase.auth.signOut();
    return applyCookies(NextResponse.redirect(`${origin}/`, 303));
  } catch {
    return NextResponse.redirect(`${origin}/`, 303);
  }
}
