import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseAnonClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("faltan SUPABASE_URL o SUPABASE_ANON_KEY");
  }

  return createClient(url, key);
}
