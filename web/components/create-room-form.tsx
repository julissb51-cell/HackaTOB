"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createRoomAction } from "@/lib/room-actions";
import type { CreateErrorCode, CreateState } from "@/lib/room-fields";
import { CopyValue, InviteLink, RememberToken } from "./invite-link";
import { useCopy } from "./language";
import { fieldClass, primaryButton, secondaryButton } from "./styles";

const initialState: CreateState = { status: "idle" };

export function CreateRoomScreen() {
  const [formKey, setFormKey] = useState(0);
  return <CreateRoomForm key={formKey} onAnother={() => setFormKey((value) => value + 1)} />;
}

function CreateRoomForm({ onAnother }: { onAnother: () => void }) {
  const text = useCopy();
  const [state, action, pending] = useActionState(createRoomAction, initialState);

  if (state.status === "created") {
    return (
      <section className="space-y-6">
        <RememberToken roomId={state.id} token={state.token} />
        <h1 className="font-display text-4xl font-medium tracking-tight">{text.ready}</h1>
        <InviteLink path={state.path} />
        <div className="space-y-4 rounded-2xl border border-line bg-surface/70 p-4">
          <h2 className="text-sm font-semibold tracking-[0.14em] text-accent uppercase">{text.extension}</h2>
          <p className="text-sm leading-6 text-muted">{text.extensionHelp}</p>
          <CopyValue id="room-id" label={text.idLabel} value={state.id} />
          <CopyValue id="room-token" label={text.tokenLabel} value={state.token} />
          <p className="text-sm leading-6 text-muted">{text.tokenHelp}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/rooms/${state.id}`} className={primaryButton}>
            {text.openRoom}
          </Link>
          <button type="button" className={secondaryButton} onClick={onAnother}>
            {text.another}
          </button>
        </div>
      </section>
    );
  }

  const error = state.status === "error" ? errorText(text, state.code) : null;

  return (
    <form action={action} className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-medium tracking-tight">{text.createRoom}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{text.createHelp}</p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        <label className="block text-sm font-semibold" htmlFor="topic">
          {text.topic}
        </label>
        <input id="topic" name="topic" required maxLength={200} className={fieldClass} />
      </div>
      <button type="submit" className={primaryButton} disabled={pending}>
        {pending ? text.creating : text.submit}
      </button>
    </form>
  );
}

function errorText(text: ReturnType<typeof useCopy>, code: CreateErrorCode): string {
  if (code === "topic") return text.topicError;
  if (code === "parts") return text.partsError;
  if (code === "date") return text.dateError;
  if (code === "id") return text.idError;
  if (code === "auth") return text.authError;
  if (code === "taken") return text.taken;
  return text.createSave;
}
