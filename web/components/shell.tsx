import type { ReactNode } from "react";
import { AppHeader } from "./app-header";

export function Shell({
  signedIn,
  wide = false,
  bare = false,
  children,
}: {
  signedIn: boolean;
  wide?: boolean;
  /** Sin encabezado ni márgenes: la pantalla pinta su propia barra superior a todo el ancho. */
  bare?: boolean;
  children: ReactNode;
}) {
  if (bare) return <main className="flex w-full flex-1 flex-col">{children}</main>;
  return (
    <main className={`mx-auto flex w-full flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 ${wide ? "max-w-6xl" : "max-w-xl"}`}>
      <AppHeader signedIn={signedIn} />
      <div className="flex flex-1 flex-col pt-10">{children}</div>
    </main>
  );
}

export function ScreenFallback({ wide = false }: { wide?: boolean }) {
  return (
    <main className={`mx-auto flex w-full flex-1 flex-col px-6 py-8 ${wide ? "max-w-6xl" : "max-w-xl"}`}>
      <p className="font-display text-2xl font-medium tracking-tight">Enlaza</p>
    </main>
  );
}
