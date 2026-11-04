"use client";

import { Symbol, pillPrimary, pillSecondary } from "./symbol";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { deleteRoomAction, leaveRoomAction, quickCreateRoomAction } from "@/lib/room-actions";
import { removalFor } from "@/lib/room-protection";
import { invitePath } from "@/lib/room-fields";
import { parseInviteLink } from "@/lib/invite-link";
import { useCopy, useLanguage } from "./language";
import { secondaryButton } from "./styles";

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
    <button type="submit" className={pillPrimary} disabled={pending} aria-busy={pending}>
      <Symbol name="add" />
      {pending ? text.creating : text.newRoom}
    </button>
  );
}

type Filter = "all" | "mine" | "shared";

export function RoomsDashboard({ name, rooms: initial, failed }: { name: string; rooms: DashboardRoom[]; failed: boolean }) {
  const text = useCopy();
  const [rooms, setRooms] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
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
  const shown = rooms.filter((room) => (filter === "all" ? true : filter === "mine" ? room.owner : !room.owner));
  const tabs: [Filter, string][] = [
    ["all", text.tabAll],
    ["mine", text.tabMine],
    ["shared", text.tabShared],
  ];
  return (
    <section>
      <div className="px-2 pb-10 pt-12 text-center sm:pt-16">
        <h1 className="text-4xl font-[650] leading-[1.05] tracking-[-1.4px] sm:text-[64px]">
          {text.greeting(name)}
          <span aria-hidden="true" className="mx-1.5 inline-block size-9 rounded-[12px] bg-accent align-[-4px] sm:size-[52px] sm:rounded-[14px] sm:align-[-6px]" />
          <br />
          {text.greetingSub}
        </h1>
        <p className="mx-auto mb-8 mt-[18px] max-w-[34rem] text-lg text-muted">{text.homeLead}</p>
        <div className="flex flex-wrap items-start justify-center gap-3">
          <NewRoomButton />
          <JoinWithLink />
        </div>
      </div>
      {failed ? (
        <p role="alert" className="mx-auto mb-4 max-w-xl rounded-2xl bg-contra-bg px-4 py-3 text-center text-sm text-contra-ink">
          {text.createFailed}
        </p>
      ) : null}
      <div className="rounded-[28px] bg-structural p-3">
        <div className="rounded-[20px] bg-surface px-4 pb-3 pt-6 sm:px-7 sm:pt-7">
          <h2 className="mb-3 text-2xl font-[650] tracking-[-0.4px]">{text.recentRooms}</h2>
          <div role="tablist" aria-label={text.tabsLabel} className="mb-3 flex gap-1.5">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  filter === key ? "bg-foreground text-background" : "text-muted hover:bg-structural hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="px-3 py-6 text-muted">{rooms.length === 0 ? text.noRooms : text.noRoomsFiltered}</p>
          ) : (
            <ul>
              {shown.map((room, index) => (
                <RoomRow key={room.id} room={room} first={index === 0} onRemove={remove} />
              ))}
            </ul>
          )}
        </div>
      </div>
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

function JoinWithLink() {
  const text = useCopy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const inputId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  if (!open)
    return (
      <button type="button" className={pillSecondary} onClick={() => setOpen(true)}>
        {text.joinLink}
        <Symbol name="arrow_forward" className="text-[18px]" />
      </button>
    );
  return (
    <form
      className="w-full max-w-md text-left"
      onSubmit={(event) => {
        event.preventDefault();
        const path = parseInviteLink(value);
        if (!path) return setError(true);
        router.push(path);
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {text.joinLinkLabel}
      </label>
      <div className="flex items-center gap-2 rounded-full bg-structural p-1 pl-4 focus-within:ring-2 focus-within:ring-link">
        <Symbol name="link" className="text-[20px] text-muted" />
        <input
          ref={input}
          id={inputId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(false);
          }}
          onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
          placeholder={text.joinLinkPlaceholder}
          aria-invalid={error}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-muted focus-visible:outline-none"
        />
        <button type="submit" className={`${pillPrimary} h-9 px-4`}>
          {text.joinLinkGo}
        </button>
        <button type="button" aria-label={text.joinLinkCancel} onClick={() => setOpen(false)} className="grid size-9 cursor-pointer place-items-center rounded-full text-muted hover:bg-line">
          <Symbol name="close" className="text-[20px]" />
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 rounded-2xl bg-contra-bg px-4 py-2 text-sm text-contra-ink">
          {text.joinLinkInvalid}
        </p>
      ) : null}
    </form>
  );
}

type Remove = (room: DashboardRoom, mode: "delete" | "leave") => Promise<void>;

function relativeTime(iso: string, lang: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat(lang === "en" ? "en" : "es", { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return format.format(0, "minute");
}

function RoomRow({ room, first, onRemove }: { room: DashboardRoom; first: boolean; onRemove: Remove }) {
  const text = useCopy();
  const { lang } = useLanguage();
  const letter = (room.topic.trim()[0] ?? "#").toLocaleUpperCase();
  return (
    <li className={`relative flex items-center gap-4 rounded-[14px] px-3 py-3.5 transition-colors focus-within:z-20 hover:bg-foreground/[0.04] ${first ? "" : "border-t border-line"}`}>
      <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-xl text-lg font-[650] ${first ? "bg-accent text-accent-ink" : "bg-structural"}`}>
        {letter}
      </span>
      <Link href={`/rooms/${room.id}`} className="min-w-0 flex-1 after:absolute after:inset-0">
        <span className="block truncate font-semibold tracking-[-0.1px]">{room.topic}</span>
        <span className="block truncate text-sm text-muted">
          {text.roomMembers(room.members)} · {text.roomEvents(room.events)}
        </span>
      </Link>
      <time dateTime={room.createdAt} className="hidden shrink-0 text-sm text-muted sm:block">
        {relativeTime(room.createdAt, lang)}
      </time>
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
        <Symbol name="more_vert" />
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
