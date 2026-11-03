import "server-only";
import { accountName, isUserId } from "./room-fields";
import type { Account } from "./room-membership";
import { supabaseAuthEnv } from "./supabase/env";
import { createSessionClient } from "./supabase/session";

export type { Account };

export async function currentAccount(): Promise<Account | null> {
  if (!supabaseAuthEnv()) return null;
  try {
    const { supabase } = await createSessionClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub || !isUserId(claims.sub)) return null;

    const fromClaims = accountName({
      email: typeof claims.email === "string" ? claims.email : null,
      user_metadata: claims.user_metadata ?? null,
    });
    if (claims.user_metadata?.full_name || claims.user_metadata?.name) {
      return { id: claims.sub, name: fromClaims };
    }

    const userResult = await supabase.auth.getUser();
    const user = userResult.data.user;
    if (user && user.id === claims.sub) return { id: claims.sub, name: accountName(user) };
    return { id: claims.sub, name: fromClaims };
  } catch {
    return null;
  }
}
