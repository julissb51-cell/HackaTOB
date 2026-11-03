"use client";

import { useEffect, useState } from "react";

type Lang = "es" | "en";

const copy = {
  es: {
    group: "Idioma",
    kicker: "Sala compartida",
    lead: "El equipo sigue con sus IAs. Enlaza junta el trabajo en un solo lugar.",
    note: "El cambio de idioma queda preparado. La sala llega en la siguiente fase.",
  },
  en: {
    group: "Language",
    kicker: "Shared room",
    lead: "The team keeps its own AIs. Enlaza brings the work into one place.",
    note: "The language switch is in place. The room arrives in the next phase.",
  },
} as const;

export function HomeScreen() {
  const [lang, setLang] = useState<Lang>("es");
  const text = copy[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <main className="flex flex-1 flex-col px-6 py-8 sm:px-10">
      <div className="flex justify-end">
        <div
          role="group"
          aria-label={text.group}
          className="inline-flex rounded-full border border-line bg-white/60 p-1"
        >
          {(["es", "en"] as const).map((code) => {
            const selected = lang === code;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={selected}
                onClick={() => setLang(code)}
                className={`rounded-full px-3 py-1 text-sm font-semibold tracking-wide transition-colors ${
                  selected
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {code.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center pb-16">
        <p className="text-sm font-semibold tracking-[0.16em] text-accent uppercase">
          {text.kicker}
        </p>
        <h1 className="mt-3 font-display text-6xl leading-none font-medium tracking-tight sm:text-7xl">
          Enlaza
        </h1>
        <p className="mt-6 max-w-md text-xl leading-8 text-foreground">{text.lead}</p>
        <p className="mt-8 border-t border-line pt-6 text-base leading-7 text-muted">
          {text.note}
        </p>
      </div>
    </main>
  );
}
