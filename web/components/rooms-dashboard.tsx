"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { deleteRoomAction, leaveRoomAction, quickCreateRoomAction } from "@/lib/room-actions";
import { removalFor } from "@/lib/room-protection";
import { invitePath } from "@/lib/room-fields";
import { useCopy, useLanguage } from "./language";
import { primaryButton, secondaryButton } from "./styles";

export type DashboardRoom = {
  id: string;
  topic: string;
  token: string;
  createdAt: string;
  members: number;
  events: number;
  owner: boolean;
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

export function RoomsDashboard({ name, rooms: initial, failed }: { name: string; rooms: DashboardRoom[]; failed: boolean }) {
  const text = useCopy();
  const [rooms, setRooms] = useState(initial);
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(null);
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setRooms(initial);
  }
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const remove = useCallback(
    async (room: DashboardRoom, mode: "delete" | "leave") => {
      const before = rooms;
      setRooms((list) => list.filter((item) => item.id !== room.id));
      setToast({ message: mode === "delete" ? text.roomDeleted : text.roomLeft, tone: "ok" });
      const result = mode === "delete" ? await deleteRoomAction(room.id) : await leaveRoomAction(room.id);
      if (!result.ok) {
        setRooms(before);
        setToast({ message: text.deleteFailed, tone: "error" });
      }
    },
    [rooms, text],
  );
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
            <RoomRow key={room.id} room={room} onRemove={remove} />
          ))}
        </ul>
      )}
      {toast ? (
        <div
          role="status"
          className={`animate-pop fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${
            toast.tone === "ok" ? "bg-foreground text-background" : "bg-contra-bg text-contra-ink"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </section>
  );
}

type Remove = (room: DashboardRoom, mode: "delete" | "leave") => Promise<void>;

function RoomRow({ room, onRemove }: { room: DashboardRoom; onRemove: Remove }) {
  const text = useCopy();
  const { lang } = useLanguage();
  const date = new Date(room.createdAt).toLocaleDateString(lang === "en" ? "en-US" : "es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <li className="relative flex items-center gap-3 px-3 py-3 focus-within:z-20 sm:px-4">
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
      <RoomMenu room={room} onRemove={onRemove} />
    </li>
  );
}

const icons = {
  open: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
  leave: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function RoomMenu({ room, onRemove }: { room: DashboardRoom; onRemove: Remove }) {
  const text = useCopy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const removal = removalFor(room.id, room.owner);

  const close = useCallback((focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
    const onPointer = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return close(true);
      if (event.key === "Tab") return close(false);
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  async function copyInvite() {
    const url = `${window.location.origin}${invitePath(room.id, room.token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
        close(true);
      }, 1100);
    } catch {
      window.prompt(text.menuCopyInvite, url);
    }
  }

  const item =
    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground outline-none transition-colors hover:bg-structural focus-visible:bg-structural";
  return (
    <div ref={box} className={`relative ${open ? "z-30" : "z-10"}`}>
      <button
        ref={trigger}
        type="button"
        aria-label={text.roomMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`grid size-9 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-structural hover:text-foreground focus-visible:outline-2 focus-visible:outline-link ${
          open ? "bg-structural text-foreground" : ""
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>
      {open ? (
        <div
          ref={menu}
          role="menu"
          aria-label={text.roomMenu}
          className="animate-pop absolute right-0 top-full mt-2 w-64 origin-top-right rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.22),0_2px_6px_rgb(0_0_0/0.06)]"
        >
          <Link role="menuitem" href={`/rooms/${room.id}`} className={item}>
            <span className="text-muted"><Icon name="open" /></span>
            {text.menuOpen}
          </Link>
          <button role="menuitem" type="button" className={item} onClick={copyInvite}>
            <span className={copied ? "text-link" : "text-muted"}><Icon name={copied ? "check" : "copy"} /></span>
            <span aria-live="polite">{copied ? text.menuCopied : text.menuCopyInvite}</span>
          </button>
          <div role="separator" className="mx-2 my-1.5 h-px bg-line" />
          {removal === "protected" ? (
            <div
              role="menuitem"
              tabIndex={-1}
              aria-disabled="true"
              title={text.menuProtected}
              className={`${item} cursor-not-allowed text-muted opacity-60 hover:bg-transparent`}
            >
              <Icon name="lock" />
              <span>
                {text.menuDelete}
                <span className="block text-xs">{text.menuProtected}</span>
              </span>
            </div>
          ) : (
            <button
              role="menuitem"
              type="button"
              className={`${item} text-danger hover:bg-contra-bg focus-visible:bg-contra-bg`}
              onClick={() => {
                setOpen(false);
                setConfirming(true);
              }}
            >
              <Icon name={removal === "delete" ? "trash" : "leave"} />
              {removal === "delete" ? text.menuDelete : text.menuLeave}
            </button>
          )}
        </div>
      ) : null}
      {confirming && removal !== "protected" ? (
        <ConfirmDialog
          title={removal === "delete" ? text.deleteTitle : text.leaveTitle}
          body={removal === "delete" ? text.deleteBody(room.topic) : text.leaveBody(room.topic)}
          cancel={text.deleteCancel}
          confirm={removal === "delete" ? text.deleteConfirm : text.leaveConfirm}
          icon={<Icon name={removal === "delete" ? "trash" : "leave"} />}
          onCancel={() => {
            setConfirming(false);
            trigger.current?.focus();
          }}
          onConfirm={() => {
            setConfirming(false);
            void onRemove(room, removal);
          }}
        />
      ) : null}
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  cancel,
  confirm,
  icon,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  cancel: string;
  confirm: string;
  icon: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    card.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(card.current?.querySelectorAll<HTMLElement>("button") ?? [])];
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
  }, [onCancel]);

  return (
    <div className="animate-fade fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div
        ref={card}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="animate-pop w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-foreground shadow-2xl"
      >
        <span className="grid size-11 place-items-center rounded-full bg-contra-bg text-danger [&_svg]:size-5">{icon}</span>
        <h2 id={titleId} className="mt-4 font-display text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-relaxed text-muted">
          {body}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" data-autofocus className={secondaryButton} onClick={onCancel}>
            {cancel}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
            onClick={onConfirm}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
