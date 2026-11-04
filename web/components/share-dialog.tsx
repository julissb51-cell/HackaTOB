"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { InviteByEmail } from "./invite-email";
import { useCopy } from "./language";
import { Symbol, iconButton, pillPrimary, pillSecondary } from "./symbol";

/** Diálogo "Compartir" al estilo de Google Drive: invitar por correo, personas con acceso y copiar enlace. */
export function ShareDialog({
  open,
  onClose,
  topic,
  path,
  members,
  viewerName,
  aiByMember,
}: {
  open: boolean;
  onClose: () => void;
  topic: string;
  path: string;
  members: { name: string; part: string | null }[];
  viewerName: string;
  aiByMember: Map<string, string>;
}) {
  const text = useCopy();
  const panel = useRef<HTMLDivElement>(null);
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("#invite-email")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;
      const focusable = [...(panel.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input:not([disabled])") ?? [])];
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

  if (!open) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${origin}${path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="relative flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[28px] bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <h2 id="share-title" className="min-w-0 text-[22px] leading-tight font-[650] tracking-[-0.3px]">
            {text.shareTitle(topic)}
          </h2>
          <button type="button" onClick={onClose} aria-label={text.shareClose} className={`${iconButton} -mt-1 -mr-2`}>
            <Symbol name="close" />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <InviteByEmail topic={topic} path={path} />
          <div>
            <h3 className="text-[15px] font-semibold">{text.peopleWithAccess}</h3>
            <ul className="mt-2">
              {members.map((member) => {
                const ai = aiByMember.get(member.name);
                const you = member.name === viewerName;
                return (
                  <li key={member.name} className="flex items-center gap-3 py-2">
                    <span
                      aria-hidden="true"
                      className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                        you ? "bg-accent text-accent-ink" : "bg-structural"
                      }`}
                    >
                      {member.name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {member.name}
                        {you ? <span className="font-normal text-muted"> ({text.you.toLowerCase()})</span> : null}
                      </p>
                      <p className="truncate text-sm text-muted">{member.part ?? text.memberPart}</p>
                    </div>
                    {ai ? <span className="shrink-0 rounded-full bg-structural px-2.5 py-1 text-xs text-muted">{ai}</span> : null}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="flex gap-3 rounded-2xl bg-structural px-4 py-3">
            <Symbol name="link" className="mt-0.5 text-[20px] text-muted" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{text.linkAccess}</p>
              <p className="text-sm text-muted">{text.linkAccessHint}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-6 pt-2 pb-6">
          <button type="button" onClick={copyLink} className={`${pillSecondary} h-10 border border-line bg-surface px-5 text-sm text-link`}>
            <Symbol name={copied ? "check" : "link"} className="text-[20px]" />
            {copied ? text.copied : text.copyLink}
          </button>
          <button type="button" onClick={onClose} className={`${pillPrimary} h-10 px-6 text-sm`}>
            {text.shareDone}
          </button>
        </div>
      </div>
    </div>
  );
}

function noop() {
  return () => {};
}
