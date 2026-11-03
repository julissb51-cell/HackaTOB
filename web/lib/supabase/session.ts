import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAuthEnv } from "./env";

type PendingCookie = { name: string; value: string; options: CookieOptions };

export async function createSessionClient() {
  const env = supabaseAuthEnv();
  if (!env) throw new Error("faltan SUPABASE_URL o SUPABASE_ANON_KEY");

  const cookieStore = await cookies();
  const pending: PendingCookie[] = [];
  let cacheHeaders: Record<string, string> = {};
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        cacheHeaders = headers;
        for (const cookie of cookiesToSet) {
          pending.push(cookie);
          try {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          } catch {
            // En un Server Component el proxy es quien refresca la sesión.
          }
        }
      },
    },
  });

  return {
    supabase,
    applyCookies(response: NextResponse) {
      for (const cookie of pending) response.cookies.set(cookie.name, cookie.value, cookie.options);
      for (const [name, value] of Object.entries(cacheHeaders)) response.headers.set(name, value);
      return response;
    },
  };
}
