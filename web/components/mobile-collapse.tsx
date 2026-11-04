"use client";

import { useState, type ReactNode } from "react";
import { Symbol } from "./symbol";

/**
 * Solo en móvil (<640px): esconde el contenido tras un botón.
 * Desde sm el botón no existe y el envoltorio usa display:contents,
 * así el escritorio queda igual que antes.
 */
export function MobileCollapse({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-12 w-full cursor-pointer items-center justify-between rounded-2xl px-1 text-[15px] font-semibold text-link sm:hidden ${className}`}
      >
        <span>{label}</span>
        <Symbol
          name="expand_more"
          className={`text-[22px] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div className={`sm:contents ${open ? "" : "max-sm:hidden"}`}>{children}</div>
    </>
  );
}
