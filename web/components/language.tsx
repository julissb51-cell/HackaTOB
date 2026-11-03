"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { LANG_STORAGE_KEY, langCookie, langFromCookieHeader, type Lang } from "@/lib/i18n";
import { copy } from "./copy";

const CHANGE_EVENT = "enlaza-lang";

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (lang: Lang) => void;
} | null>(null);

export function LanguageProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const lang = useSyncExternalStore(subscribeLanguage, () => readLanguage(initialLang), () => initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // El modo privado puede bloquear el almacenamiento.
    }
    document.cookie = langCookie(next, window.location.protocol === "https:");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("falta LanguageProvider");
  return value;
}

export function useCopy() {
  const { lang } = useLanguage();
  return copy[lang];
}

function subscribeLanguage(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readLanguage(fallback: Lang): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
  } catch {
    // El modo privado puede bloquear el almacenamiento.
  }
  return langFromCookieHeader(document.cookie) ?? fallback;
}

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  const text = copy[lang];

  return (
    <div role="group" aria-label={text.group} className="inline-flex rounded-full border border-line bg-surface p-1">
      {(["es", "en"] as const).map((code) => {
        const selected = lang === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={selected}
            onClick={() => setLang(code)}
            className={`cursor-pointer rounded-full px-3 py-1 text-sm font-semibold tracking-wide ${
              selected ? "bg-accent text-accent-ink" : "text-muted hover:text-foreground"
            }`}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
