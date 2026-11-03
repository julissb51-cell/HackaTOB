"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Profile } from "@/lib/current-profile";
import { LanguageToggle, useCopy } from "./language";

/** Ajustes de la cuenta: avatar (foto de Google o inicial) que abre nombre/correo, idioma y cerrar sesión. */
export function AccountMenu({ profile }: { profile: Profile | null }) {
  const text = useCopy();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!profile) return <LanguageToggle />;
  const initial = (profile.name.trim()[0] ?? "?").toUpperCase();

  return (
    <div ref={box} className={`relative ${open ? "z-40" : ""}`}>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        aria-label={text.accountOpen}
        title={text.accountOpen}
        onClick={() => setOpen((value) => !value)}
        className="grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full bg-accent text-sm font-bold text-accent-ink ring-2 ring-transparent transition hover:ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
      >
        {profile.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          <span aria-hidden="true">{initial}</span>
        )}
      </button>
      {open ? (
        <div
          id={id}
          role="dialog"
          aria-label={text.accountTitle}
          className="animate-pop absolute top-full right-0 mt-2 w-72 origin-top-right rounded-2xl border border-line bg-surface p-2 shadow-xl shadow-black/25"
        >
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent font-bold text-accent-ink">
              {profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile.name}</p>
              {profile.email ? <p className="truncate text-sm text-muted">{profile.email}</p> : null}
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm font-semibold">{text.accountLanguage}</span>
            <LanguageToggle />
          </div>
          <div className="my-1 h-px bg-line" />
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-structural focus-visible:bg-structural focus-visible:outline-none"
            >
              <svg viewBox="0 0 24 24" className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
              </svg>
              {text.signOutFull}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
