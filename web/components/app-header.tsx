import type { ReactNode } from "react";
import { currentProfile } from "@/lib/current-profile";
import { AccountMenu } from "./account-menu";
import { Brand } from "./brand";


/** Menú de cuenta (avatar) o, sin sesión, solo el selector de idioma. */
export async function AccountSlot({ signedIn }: { signedIn: boolean }) {
  const profile = signedIn ? await currentProfile() : null;
  return <AccountMenu profile={profile} />;
}

export function AppHeader({ signedIn, children }: { signedIn: boolean; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Brand />
      <div className="flex items-center gap-3">
        {children}
        <AccountSlot signedIn={signedIn} />
      </div>
    </header>
  );
}
