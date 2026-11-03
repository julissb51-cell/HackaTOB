"use client";

import { useState } from "react";
import { isEmail } from "@/lib/invite-email";
import { useCopy } from "./language";
import { fieldClass, secondaryButton } from "./styles";

type Status = { kind: "idle" | "sending" } | { kind: "sent"; email: string } | { kind: "error"; code: string };

/** "Invitar por correo": manda el enlace de invitación (si el correo del proyecto está configurado). */
export function InviteByEmail({ roomId }: { roomId: string }) {
  const text = useCopy();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!isEmail(value)) return setStatus({ kind: "error", code: "invalid" });
    setStatus({ kind: "sending" });
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (response.ok && body.ok) {
        setStatus({ kind: "sent", email: value });
        setEmail("");
      } else setStatus({ kind: "error", code: body.error ?? "failed" });
    } catch {
      setStatus({ kind: "error", code: "failed" });
    }
  }

  const message =
    status.kind === "sent"
      ? text.inviteEmailSent(status.email)
      : status.kind === "error"
        ? status.code === "invalid"
          ? text.inviteEmailInvalid
          : status.code === "not_configured"
            ? text.inviteEmailNotConfigured
            : status.code === "rate_limited"
              ? text.inviteEmailLimited
              : text.inviteEmailFailed
        : null;

  return (
    <form onSubmit={send} className="space-y-2" noValidate>
      <label className="block text-sm font-semibold" htmlFor="invite-email">
        {text.inviteEmailLabel}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="invite-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          placeholder={text.inviteEmailPlaceholder}
          onChange={(event) => setEmail(event.target.value)}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <button type="submit" className={secondaryButton} disabled={status.kind === "sending"}>
          {status.kind === "sending" ? text.inviteEmailSending : text.inviteEmailSend}
        </button>
      </div>
      {message ? (
        <p role="status" className={`text-sm ${status.kind === "sent" ? "text-link" : "text-muted"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
