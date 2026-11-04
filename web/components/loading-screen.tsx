"use client";

import { useLanguage } from "./language";

const LABELS = {
  room: { es: "Cargando sala…", en: "Loading room…" },
  page: { es: "Cargando…", en: "Loading…" },
} as const;

/** Pantalla de carga: círculo cian que gira, centrado. Respeta prefers-reduced-motion. */
export function LoadingScreen({ label = "page" }: { label?: keyof typeof LABELS }) {
  const { lang } = useLanguage();
  const text = LABELS[label][lang === "en" ? "en" : "es"];
  return (
    <main className="flex min-h-[60vh] w-full flex-1 flex-col items-center justify-center gap-4 px-6 py-16" role="status" aria-live="polite">
      <span aria-hidden="true" className="enlaza-spinner" />
      <p className="text-sm font-medium text-muted">{text}</p>
    </main>
  );
}
