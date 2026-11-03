"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { quickCreateRoomAction } from "@/lib/room-actions";
import { invitePath } from "@/lib/room-fields";
import { useCopy, useLanguage } from "./language";
import { primaryButton } from "./styles";

export type DashboardRoom = {
  id: string;
  topic: string;
  token: string;
  createdAt: string;
  members: number;
  events: number;
};

export function NewRoomButton() {
  const { lang } = useLanguage();
  return (
    <form action={quickCreateRoomAction}>
      <input type="hidden" name="lang" value={lang} />
      <NewRoomSubmit />
    </form>
  );
}

function NewRoomSubmit() {
  const text = useCopy();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`${primaryButton} gap-2`} disabled={pending} aria-busy={pending}>
      <span aria-hidden="true" className="text-lg leading-none">+</span>
      {pending ? text.creating : text.newRoom}
    </button>
  );
}

export function RoomsDashboard({ name, rooms, failed }: { name: string; rooms: DashboardRoom[]; failed: boolean }) {
  const text = useCopy();
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {text.hello} <span className="text-foreground">{name}</span>
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight sm:text-4xl">{text.recentRooms}</h1>
        </div>
        <NewRoomButton />
      </div>
      {failed ? (
        <p role="alert" className="rounded-xl bg-contra-bg px-3 py-2 text-sm text-contra-ink">
          {text.createFailed}
        </p>
      ) : null}
      {rooms.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-6 text-muted">{text.noRooms}</p>
      ) : (
        <ul className="divide-y divide-line overflow-visible rounded-2xl border border-line bg-surface">
          {rooms.map((room) => (
            <RoomRow key={room.id} room={room} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RoomRow({ room }: { room: DashboardRoom }) {
  const text = useCopy();
  const { lang } = useLanguage();
  const date = new Date(room.createdAt).toLocaleDateString(lang === "en" ? "en-US" : "es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <li className="relative flex items-center gap-3 px-3 py-3 sm:px-4">
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-structural text-link">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M9 7h-2a4 4 0 0 0 0 8h2M15 7h2a4 4 0 0 1 0 8h-2M8 11h8" strokeLinecap="round" />
        </svg>
      </span>
      <Link href={`/rooms/${room.id}`} className="min-w-0 flex-1 after:absolute after:inset-0">
        <span className="block truncate font-semibold">{room.topic}</span>
        <span className="block truncate text-sm text-muted">
          {date} · {text.roomMembers(room.members)} · {text.roomEvents(room.events)}
        </span>
      </Link>
      <RoomMenu room={room} />
    </li>
  );
}

function RoomMenu({ room }: { room: DashboardRoom }) {
  const text = useCopy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function copyInvite() {
    const url = `${window.location.origin}${invitePath(room.id, room.token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1200);
    } catch {
      window.prompt(text.menuCopyInvite, url);
    }
  }

  const item = "block w-full cursor-pointer px-4 py-2 text-left text-sm hover:bg-structural";
  return (
    <div ref={box} className="relative z-10">
      <button
        type="button"
        aria-label={text.roomMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid size-9 cursor-pointer place-items-center rounded-full text-xl leading-none text-muted hover:bg-structural hover:text-foreground"
      >
        ⋮
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 mt-1 w-60 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
          <Link role="menuitem" href={`/rooms/${room.id}`} className={item}>
            {text.menuOpen}
          </Link>
          <button role="menuitem" type="button" className={item} onClick={copyInvite}>
            {copied ? text.menuCopied : text.menuCopyInvite}
          </button>
        </div>
      ) : null}
    </div>
  );
}
