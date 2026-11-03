import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuthEnv } from "./env";

export async function updateSession(request: NextRequest) {
  const env = supabaseAuthEnv();
  if (!env) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) supabaseResponse.headers.set(name, value);
      },
    },
  });

  try {
    await supabase.auth.getClaims();
  } catch {
    return supabaseResponse;
  }
  return supabaseResponse;
}
