import type { ReactNode } from "react";
import { AppHeader } from "./app-header";

export function Shell({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8">
      <AppHeader signedIn={signedIn} />
      <div className="flex flex-1 flex-col pt-10">{children}</div>
    </main>
  );
}

export function ScreenFallback() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8">
      <p className="font-display text-2xl font-medium tracking-tight">Enlaza</p>
    </main>
  );
}
