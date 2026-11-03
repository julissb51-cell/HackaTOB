"use client";

import Link from "next/link";
import { LanguageToggle, useCopy } from "./language";

export function AppHeader({ signedIn }: { signedIn: boolean }) {
  const text = useCopy();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/" className="font-display text-2xl font-medium tracking-tight">
        Enlaza
      </Link>
      <div className="flex items-center gap-3">
        {signedIn ? (
          <form action="/auth/logout" method="post">
            <button type="submit" className="cursor-pointer text-sm font-semibold text-muted hover:text-foreground">
              {text.signOut}
            </button>
          </form>
        ) : null}
        <LanguageToggle />
      </div>
    </header>
  );
}
