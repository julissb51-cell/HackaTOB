import type { ReactNode } from "react";
import { LoadingScreen } from "./loading-screen";
import { AppHeader } from "./app-header";

export function Shell({
  signedIn,
  wide = false,
  bare = false,
  fusionHome = false,
  children,
}: {
  signedIn: boolean;
  wide?: boolean;
  /** Sin encabezado ni márgenes: la pantalla pinta su propia barra superior a todo el ancho. */
  bare?: boolean;
  /** Estilo Mobbin x Google (Geist, barra fina, paneles planos) solo para el inicio /rooms. */
  fusionHome?: boolean;
  children: ReactNode;
}) {
  if (bare) return <main className="flex w-full flex-1 flex-col">{children}</main>;
  if (fusionHome)
    return (
      <main className="m-home mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 pb-20 sm:px-8">
        <div className="flex h-[72px] items-center">
          <div className="w-full">
            <AppHeader signedIn={signedIn} mark />
          </div>
        </div>
        <div className="flex flex-1 flex-col">{children}</div>
      </main>
    );
  return (
    <main className={`mx-auto flex w-full flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 ${wide ? "max-w-6xl" : "max-w-xl"}`}>
      <AppHeader signedIn={signedIn} />
      <div className="flex flex-1 flex-col pt-10">{children}</div>
    </main>
  );
}

export function ScreenFallback({ wide = false, room = false }: { wide?: boolean; room?: boolean }) {
  void wide;
  return <LoadingScreen label={room ? "room" : "page"} />;
}
