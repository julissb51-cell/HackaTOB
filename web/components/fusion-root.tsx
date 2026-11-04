import type { ReactNode } from "react";
import { Geist } from "next/font/google";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

/** Carga Geist y Material Symbols Rounded para las pantallas con estilo Mobbin x Google (/rooms, la sala y /join). */
export function FusionRoot({ children }: { children: ReactNode }) {
  return (
    <div className={`${geist.variable} flex flex-1 flex-col`}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=block"
        precedence="default"
      />
      {children}
    </div>
  );
}
