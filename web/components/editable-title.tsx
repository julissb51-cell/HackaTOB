"use client";

import { useState, useTransition } from "react";
import { renameTopicAction } from "@/lib/room-actions";
import { useCopy } from "./language";

const UNTITLED = new Set(["Sala sin título", "Untitled room"]);

/** Título de la sala editable en línea: Enter o salir del campo guarda; Esc cancela. */
export function EditableTitle({ roomId, topic, compact = false }: { roomId: string; topic: string; compact?: boolean }) {
  const text = useCopy();
  const [saved, setSaved] = useState(topic);
  const [draft, setDraft] = useState(topic);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const fresh = UNTITLED.has(topic);

  function commit() {
    const next = draft.trim().replace(/\s+/g, " ");
    if (!next || next === saved) {
      setDraft(saved);
      return;
    }
    startTransition(async () => {
      const result = await renameTopicAction(roomId, next);
      if (result.ok && result.topic) {
        setSaved(result.topic);
        setDraft(result.topic);
        setError(false);
      } else {
        setDraft(saved);
        setError(true);
      }
    });
  }

  return (
    <div className={compact ? "min-w-0" : "mt-2"}>
      {compact ? (
        <h1 className="truncate font-display text-xl font-medium tracking-tight sm:text-2xl">
        <input
          aria-label={text.titleLabel}
          value={draft}
          maxLength={200}
          autoFocus={fresh}
          onFocus={(event) => {
            if (UNTITLED.has(draft)) event.currentTarget.select();
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(saved);
              requestAnimationFrame(() => (event.target as HTMLInputElement).blur());
            }
          }}
          aria-busy={pending}
          className="w-full rounded-lg border border-transparent bg-transparent px-1 -mx-1 outline-none hover:border-line focus:border-link focus:bg-surface text-ellipsis"
        />
        </h1>
      ) : (
        <>
          <h1 className="text-[1.65rem] leading-snug font-bold tracking-[-0.4px] lg:hidden">
            <textarea
              aria-label={text.titleLabel}
              value={draft}
              maxLength={200}
              rows={Math.min(4, Math.max(2, Math.ceil(draft.length / 22)))}
              autoFocus={fresh}
              onFocus={(event) => {
                if (UNTITLED.has(draft)) event.currentTarget.select();
              }}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setDraft(saved);
                  requestAnimationFrame(() => (event.target as HTMLTextAreaElement).blur());
                }
              }}
              aria-busy={pending}
              className="w-full resize-none break-words border-b-[3px] border-accent bg-[linear-gradient(transparent_78%,color-mix(in_srgb,var(--accent)_14%,transparent)_78%)] bg-transparent px-1 outline-none focus:border-link"
            />
          </h1>
          <h1 className="hidden font-display text-[64px] leading-[1.05] font-bold tracking-[-2.4px] lg:block lg:text-[80px] lg:tracking-[-3px]">
          <span className="relative inline-grid max-w-full border-b-[3px] border-accent bg-[linear-gradient(transparent_80%,color-mix(in_srgb,var(--accent)_14%,transparent)_80%)] pb-1 align-bottom">
            <span aria-hidden="true" className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre px-1 text-ellipsis">
              {draft || " "}
            </span>
            <input
          aria-label={text.titleLabel}
          value={draft}
          maxLength={200}
          onFocus={(event) => {
            if (UNTITLED.has(draft)) event.currentTarget.select();
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(saved);
              requestAnimationFrame(() => (event.target as HTMLInputElement).blur());
            }
          }}
          aria-busy={pending}
          className="col-start-1 row-start-1 min-w-0 w-full rounded-lg border border-transparent bg-transparent px-1 -mx-1 outline-none hover:border-line focus:border-link focus:bg-surface text-ellipsis"
        />
          </span>
        </h1>
        </>
      )}
      {fresh ? <p className={compact ? "mt-0.5 text-xs text-muted" : "mt-2 text-sm text-muted"}>{text.titleHint}</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {text.titleSaveError}
        </p>
      ) : null}
    </div>
  );
}
