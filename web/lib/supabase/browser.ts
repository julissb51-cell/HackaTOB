"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: { url: string; key: string; client: SupabaseClient } | null = null;

export function browserSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (cached && cached.url === url && cached.key === key) return cached.client;
  const client = createBrowserClient(url, key);
  cached = { url, key, client };
  return client;
}
