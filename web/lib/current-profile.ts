import "server-only";
import { accountName } from "./room-fields";
import { supabaseAuthEnv } from "./supabase/env";
import { createSessionClient } from "./supabase/session";

export type Profile = { name: string; email: string | null; avatar: string | null };

/** Nombre, correo y foto de Google de la sesión actual, para el menú de cuenta. */
export async function currentProfile(): Promise<Profile | null> {
  if (!supabaseAuthEnv()) return null;
  try {
    const { supabase } = await createSessionClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub) return null;
    const email = typeof claims.email === "string" ? claims.email : null;
    const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
    const raw = meta.avatar_url ?? meta.picture;
    const avatar = typeof raw === "string" && /^https:\/\//.test(raw) ? raw : null;
    return { name: accountName({ email, user_metadata: meta }), email, avatar };
  } catch {
    return null;
  }
}
