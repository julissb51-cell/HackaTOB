"use client";

import { useEffect } from "react";

/** Onda suave al tocar botones y filas dentro de .g-home (solo inicio /rooms). */
export function Ripple() {
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(".g-home button");
      if (!target || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const box = target.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "g-ripple";
      dot.style.left = `${event.clientX - box.left}px`;
      dot.style.top = `${event.clientY - box.top}px`;
      target.appendChild(dot);
      window.setTimeout(() => dot.remove(), 520);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return null;
}
