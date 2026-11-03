"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NO_DATE } from "@/lib/room-fields";
import {
  acceptSuggestionAction,
  customTokenAction,
  dismissSuggestionAction,
  regenerateTokenAction,
  saveSettingsAction,
  type SettingsState,
} from "@/lib/room-actions";
import type { RoomBoard } from "@/lib/board-view";
import { useCopy } from "./language";
import { fieldClass, primaryButton, secondaryButton } from "./styles";

const initialState: SettingsState = { status: "idle" };

export function RoomSettings({ initial, live, onSaved }: { initial: RoomBoard; live: RoomBoard; onSaved: () => void }) {
  const text = useCopy();
  const formKey = [
    initial.id,
    initial.topic,
    initial.dueDate ?? "",
    initial.parts.join("\u0001"),
    initial.language,
    initial.members.map((member) => `${member.name}:${member.part ?? ""}`).join("\u0001"),
  ].join("\u0002");

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface/70 p-4">
      <div>
        <h2 className="text-sm font-semibold tracking-[0.14em] text-link uppercase">{text.settings}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{text.settingsHelp}</p>
      </div>
      {live.suggestion ? (
        <SuggestionBox roomId={live.id} suggestion={live.suggestion} fromAi={live.suggestionFromAi} onSaved={onSaved} />
      ) : null}
      <SettingsForm key={formKey} initial={initial} onSaved={onSaved} />
      <TokenForms roomId={live.id} onSaved={onSaved} />
    </section>
  );
}

function SuggestionBox({
  roomId,
  suggestion,
  fromAi,
  onSaved,
}: {
  roomId: string;
  suggestion: NonNullable<RoomBoard["suggestion"]>;
  fromAi: boolean;
  onSaved: () => void;
}) {
  const text = useCopy();
  const accept = useSavedAction(acceptSuggestionAction, onSaved);
  const dismiss = useSavedAction(dismissSuggestionAction, onSaved);

  return (
    <div className="space-y-3 rounded-xl border border-line bg-background/60 p-3">
      <h3 className="text-sm font-semibold">{fromAi ? text.suggestion : text.suggestionRules}</h3>
      {suggestion.partes.length > 0 ? <p className="text-sm">{suggestion.partes.join(", ")}</p> : null}
      {suggestion.asignaciones.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted">
          {suggestion.asignaciones.map((item) => (
            <li key={item.nombre}>
              {item.nombre}: {item.parte}
            </li>
          ))}
        </ul>
      ) : null}
      {suggestion.fecha ? <p className="text-sm">{suggestion.fecha}</p> : null}
      <div className="flex flex-wrap gap-2">
        <form action={accept.action}>
          <input type="hidden" name="room_id" value={roomId} />
          <button type="submit" className={primaryButton} disabled={accept.pending}>
            {text.accept}
          </button>
        </form>
        <form action={dismiss.action}>
          <input type="hidden" name="room_id" value={roomId} />
          <button type="submit" className={secondaryButton} disabled={dismiss.pending}>
            {text.dismiss}
          </button>
        </form>
      </div>
    </div>
  );
}

function SettingsForm({ initial, onSaved }: { initial: RoomBoard; onSaved: () => void }) {
  const text = useCopy();
  const saved = useSavedAction(saveSettingsAction, onSaved);
  const [parts, setParts] = useState<string[]>(initial.parts.length > 0 ? initial.parts : [""]);
  const [noDate, setNoDate] = useState(initial.dueDate === NO_DATE);
  const error = saved.state.status === "error" ? settingsError(text, saved.state.code) : null;

  return (
    <form action={saved.action} className="space-y-5">
      <input type="hidden" name="room_id" value={initial.id} />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved.state.status === "saved" ? <p className="text-sm text-link">{text.saved}</p> : null}
      <div className="space-y-2">
        <label className="block text-sm font-semibold" htmlFor="settings-topic">
          {text.topic}
        </label>
        <input id="settings-topic" name="topic" required maxLength={200} defaultValue={initial.topic} className={fieldClass} />
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">{text.parts}</legend>
        <p className="text-sm text-muted">{text.partsHelp}</p>
        {parts.map((part, index) => (
          <div key={index} className="flex gap-2">
            <input
              name="parts"
              value={part}
              maxLength={120}
              aria-label={`${text.partLabel} ${index + 1}`}
              className={fieldClass}
              onChange={(event) => {
                const next = [...parts];
                next[index] = event.target.value;
                setParts(next);
              }}
            />
            {parts.length > 1 ? (
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setParts(parts.filter((_, partIndex) => partIndex !== index))}
              >
                {text.removePart}
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className={secondaryButton} disabled={parts.length >= 30} onClick={() => setParts([...parts, ""])}>
          {text.addPart}
        </button>
      </fieldset>
      <div className="space-y-3">
        <label className="block text-sm font-semibold" htmlFor="settings-date">
          {text.date}
        </label>
        <input
          id="settings-date"
          name="date"
          type="date"
          defaultValue={initial.dueDate && initial.dueDate !== NO_DATE ? initial.dueDate : ""}
          disabled={noDate}
          className={fieldClass}
        />
        <label className="flex items-center gap-2 text-sm" htmlFor="settings-sin-fecha">
          <input
            id="settings-sin-fecha"
            name="sin_fecha"
            type="checkbox"
            checked={noDate}
            onChange={(event) => setNoDate(event.target.checked)}
          />
          {text.noDate}
        </label>
        <p className="text-sm text-muted">{text.dateHelp}</p>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-semibold" htmlFor="settings-language">
          {text.languageLabel}
        </label>
        <select id="settings-language" name="language" defaultValue={initial.language} className={fieldClass}>
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
        <p className="text-sm text-muted">{text.languageHelp}</p>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{text.members}</h3>
        {initial.members.map((member) => (
          <div key={member.name} className="grid gap-2 sm:grid-cols-[8rem_1fr] sm:items-center">
            <span className="text-sm font-semibold">{member.name}</span>
            <input type="hidden" name="member_name" value={member.name} />
            <input
              name="member_part"
              maxLength={120}
              defaultValue={member.part ?? ""}
              aria-label={`${text.partLabel} ${member.name}`}
              placeholder={text.memberPart}
              className={fieldClass}
            />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-semibold" htmlFor="settings-code">
          {text.roomCode}
        </label>
        <input
          id="settings-code"
          name="next_id"
          defaultValue={initial.id}
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
          className={fieldClass}
        />
        <p className="text-sm text-muted">{text.roomCodeHelp}</p>
      </div>
      <button type="submit" className={primaryButton} disabled={saved.pending}>
        {saved.pending ? text.saving : text.saveSettings}
      </button>
    </form>
  );
}

function TokenForms({ roomId, onSaved }: { roomId: string; onSaved: () => void }) {
  const text = useCopy();
  const regenerate = useSavedAction(regenerateTokenAction, onSaved);
  const custom = useSavedAction(customTokenAction, onSaved);
  const error = custom.state.status === "error" ? settingsError(text, custom.state.code) : null;

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <p className="text-sm leading-6 text-muted">{text.tokenHint}</p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <form action={regenerate.action}>
        <input type="hidden" name="room_id" value={roomId} />
        <button type="submit" className={secondaryButton} disabled={regenerate.pending}>
          {text.regenerate}
        </button>
      </form>
      <form action={custom.action} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="room_id" value={roomId} />
        <input
          name="custom_token"
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          aria-label={text.customToken}
          placeholder={text.customToken}
          className={fieldClass}
        />
        <button type="submit" className={secondaryButton} disabled={custom.pending}>
          {text.useToken}
        </button>
      </form>
    </div>
  );
}

function useSavedAction(
  action: (state: SettingsState, formData: FormData) => Promise<SettingsState>,
  onSaved: () => void,
) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  useEffect(() => {
    if (state.status !== "saved") return;
    router.refresh();
    onSaved();
  }, [state, router, onSaved]);
  return { state, action: formAction, pending };
}

function settingsError(text: ReturnType<typeof useCopy>, code: string): string {
  if (code === "topic") return text.topicError;
  if (code === "parts") return text.partsError;
  if (code === "date") return text.dateError;
  if (code === "id") return text.idError;
  if (code === "token") return text.customTokenError;
  if (code === "auth") return text.authError;
  if (code === "taken") return text.taken;
  if (code === "forbidden") return text.unavailable;
  return text.settingsError;
}
