"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Brand } from "./brand";
import { Symbol, iconButton, pillSecondary } from "./symbol";
import { useCopy } from "./language";

/** Barra superior fina de la sala (estilo Mobbin x Google): logo, volver, nombre, Invitar, Ajustes y cuenta. */
export function RoomTopBar({
  topic,
  onSettings,
  account,
}: {
  topic: string;
  onSettings: () => void;
  account?: ReactNode;
}) {
  const text = useCopy();
  return (
    <header className="relative z-30 mx-auto flex h-[72px] w-full max-w-[1120px] items-center gap-2 px-4 sm:gap-3 sm:px-8">
      <div className="hidden shrink-0 sm:block">
        <Brand mark />
      </div>
      <Link href="/rooms" aria-label={text.backToRooms} title={text.backToRooms} className={iconButton}>
        <Symbol name="arrow_back" />
      </Link>
      <p className="hidden min-w-0 truncate text-[15px] text-muted sm:block">
        {topic}
      </p>
      <div className="flex-1" />
      <a href="#invitar" className={`${pillSecondary} h-10 px-4 text-sm`}>
        <Symbol name="person_add" className="text-[20px]" />
        <span className="hidden sm:inline">{text.inviteShort}</span>
      </a>
      <button type="button" onClick={onSettings} aria-label={text.settingsOpen} title={text.settingsOpen} className={iconButton}>
        <Symbol name="tune" />
      </button>
      <div className="shrink-0">{account}</div>
    </header>
  );
}

/** Panel lateral derecho con los Ajustes de la sala. */
export function SettingsDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const text = useCopy();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[data-close]")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;
      const focusable = [
        ...(panel.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary") ?? []),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none invisible"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onMouseDown={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={text.settingsOpen}
        className={`absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-background font-[family-name:var(--font-geist)] shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-xl font-[650] tracking-[-0.3px]">{text.settingsOpen}</h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label={text.settingsClose}
            className="grid size-9 cursor-pointer place-items-center rounded-full text-muted hover:bg-structural hover:text-foreground"
          >
            <Symbol name="close" />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">{open ? children : null}</div>
      </div>
    </div>
  );
}
