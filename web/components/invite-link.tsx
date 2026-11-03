"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { roomTokenStorageKey } from "@/lib/room-fields";
import { useCopy } from "./language";
import { fieldClass, secondaryButton } from "./styles";

export function InviteLink({ path }: { path: string }) {
  const text = useCopy();
  const origin = useSyncExternalStore(subscribeOrigin, readOrigin, readServerOrigin);
  const href = origin ? `${origin}${path}` : path;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold" htmlFor="invite-link">
        {text.invite}
      </label>
      <input id="invite-link" readOnly value={href} className={`${fieldClass} font-mono text-sm`} />
      <CopyButton value={href} />
    </div>
  );
}

export function CopyValue({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold" htmlFor={id}>
        {label}
      </label>
      <input id={id} readOnly value={value} spellCheck={false} className={`${fieldClass} font-mono text-sm`} />
      <CopyButton value={value} />
    </div>
  );
}

export function RememberToken({ roomId, token }: { roomId: string; token: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(roomTokenStorageKey(roomId), token);
    } catch {
      // El modo privado puede bloquear el almacenamiento.
    }
  }, [roomId, token]);
  return null;
}

function subscribeOrigin() {
  return () => {};
}

function readOrigin() {
  return window.location.origin;
}

function readServerOrigin() {
  return "";
}

export function CopyButton({ value }: { value: string }) {
  const text = useCopy();
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={secondaryButton}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? text.copied : text.copy}
    </button>
  );
}
