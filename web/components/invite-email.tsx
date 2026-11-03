"use client";

import { useState, useSyncExternalStore } from "react";
import { gmailHref, inviteEmailText, isEmail, mailtoHref } from "@/lib/invite-email";
import { useCopy, useLanguage } from "./language";
import { fieldClass, secondaryButton } from "./styles";

/** "Invitar por correo": abre el cliente de correo (mailto:) o Gmail con la invitación ya escrita. */
export function InviteByEmail({ topic, path }: { topic: string; path: string }) {
  const text = useCopy();
  const { lang } = useLanguage();
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);

  const value = email.trim();
  const valid = isEmail(value);
  const message = inviteEmailText(lang === "en" ? "en" : "es", topic, `${origin}${path}`);
  const gmail = valid ? gmailHref(value, message.subject, message.body) : undefined;

  function send(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return setError(true);
    setError(false);
    window.location.href = mailtoHref(value, message.subject, message.body);
  }

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
          aria-invalid={error}
          aria-describedby={error ? "invite-email-error" : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(false);
          }}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <button type="submit" className={secondaryButton}>
          {text.inviteEmailSend}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {error ? (
          <p id="invite-email-error" role="alert" className="text-muted">
            {text.inviteEmailInvalid}
          </p>
        ) : (
          <p className="text-muted">{text.inviteEmailHint}</p>
        )}
        <a
          href={gmail}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!valid}
          onClick={(event) => {
            if (!valid) {
              event.preventDefault();
              setError(true);
            }
          }}
          className={`font-semibold text-link underline-offset-4 hover:underline ${valid ? "" : "opacity-60"}`}
        >
          {text.inviteEmailGmail} ↗
        </a>
      </div>
    </form>
  );
}

function noop() {
  return () => {};
}
