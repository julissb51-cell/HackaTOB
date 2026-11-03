"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { copy, type Lang } from "./copy";

const STORAGE_KEY = "enlaza.lang";
const CHANGE_EVENT = "enlaza-lang";

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (lang: Lang) => void;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribeLanguage, readLanguage, readServerLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next);
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

function readLanguage(): Lang {
  return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "es";
}

function readServerLanguage(): Lang {
  return "es";
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
