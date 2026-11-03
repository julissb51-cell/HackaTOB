"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Brand } from "./brand";
import { EditableTitle } from "./editable-title";
import { useCopy } from "./language";

/** Barra superior de la sala (no fija, a todo el ancho, con el logo): volver, título editable, analizar y Ajustes. */
export function RoomTopBar({
  roomId,
  topic,
  due,
  analyze,
  onSettings,
  account,
}: {
  roomId: string;
  topic: string;
  due: string;
  analyze: ReactNode;
  onSettings: () => void;
  account?: ReactNode;
}) {
  const text = useCopy();
  return (
    <header className="relative z-30 w-full bg-gradient-to-b from-structural via-structural/50 to-background pb-8">
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="mr-1 hidden shrink-0 sm:mr-3 sm:block">
            <Brand />
          </div>
          <Link
            href="/rooms"
            aria-label={text.backToRooms}
            title={text.backToRooms}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-background/70 hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.7rem] font-semibold tracking-[0.16em] text-link uppercase">{due}</p>
            <EditableTitle roomId={roomId} topic={topic} compact />
          </div>
          <div className="hidden shrink-0 sm:block">{analyze}</div>
          <button
            type="button"
            onClick={onSettings}
            aria-label={text.settingsOpen}
            title={text.settingsOpen}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-link"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
              <circle cx="16" cy="6" r="2" />
              <circle cx="10" cy="12" r="2" />
              <circle cx="18" cy="18" r="2" />
            </svg>
          </button>
          <div className="ml-1 shrink-0 sm:ml-2">{account}</div>
        </div>
        <div className="mt-2 sm:hidden">{analyze}</div>
      </div>
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
        className={`absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-background shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between bg-structural px-5 py-4">
          <h2 className="font-display text-xl font-medium tracking-tight">{text.settingsOpen}</h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label={text.settingsClose}
            className="grid size-9 cursor-pointer place-items-center rounded-full text-muted hover:bg-background/70 hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">{open ? children : null}</div>
      </div>
    </div>
  );
}
