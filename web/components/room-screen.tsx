"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { analyzeNowAction, readRoomBoardAction, type SettingsState } from "@/lib/room-actions";
import { previewMemberContext } from "@/lib/room-analysis";
import type { RoomBoard } from "@/lib/board-view";
import { NO_DATE } from "@/lib/room-fields";
import {
  feedMembers,
  filterEvents,
  formatEventTime,
  POLL_MS,
  realtimeFailed,
  realtimeFilter,
  summarizeParts,
  type LiveStatus,
  type PartStatus,
} from "@/lib/room-feed";
import type { ContextResponse, StoredEvent, WarningType } from "@/lib/room-types";
import { browserSupabase } from "@/lib/supabase/browser";
import { CopyButton, CopyValue, InviteLink, RememberToken } from "./invite-link";
import { useCopy } from "./language";
import { RoomSettings } from "./room-settings";
import { RoomTopBar, SettingsDrawer } from "./room-top-bar";
import { InviteByEmail } from "./invite-email";
import { fieldClass, primaryButton, secondaryButton } from "./styles";
import { useRoomFeed } from "./use-room-feed";

const PREVIEW = 420;
const idleSettings: SettingsState = { status: "idle" };

export type RoomView = {
  id: string;
  topic: string;
  dueDate: string | null;
  parts: string[];
  token: string;
  path: string;
  members: { name: string; part: string | null }[];
  viewerName: string;
  events: StoredEvent[];
};

export function RoomScreen({ room, board: initialBoard }: { room: RoomView; board: RoomBoard }) {
  const text = useCopy();
  const feed = useRoomFeed(room.id, room.events, room.members);
  const analysis = useRoomAnalysis(room.id, initialBoard, feed.status === "polling" || feed.status === "offline");
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const due = !room.dueDate ? text.dueUnset : room.dueDate === NO_DATE ? text.noDate : room.dueDate;
  const names = feedMembers(feed.members, feed.events);
  const activeFilter = memberFilter && names.includes(memberFilter) ? memberFilter : null;
  const visible = filterEvents(feed.events, activeFilter);
  const parts = summarizeParts(room.parts, feed.members, feed.events);
  const chatNames = useMemo(
    () => new Map(analysis.board.chats.map((chat) => [chat.conversationId, chat.nombre])),
    [analysis.board.chats],
  );
  const rules = useMemo(
    () =>
      previewMemberContext({
        room: { id: room.id, topic: room.topic, projectName: null, dueDate: room.dueDate },
        members: feed.members,
        events: feed.events,
        member: room.viewerName,
      }),
    [feed.events, feed.members, room.dueDate, room.id, room.topic, room.viewerName],
  );
  const context = memberContext(analysis.board, room.viewerName, rules);

  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]">
      <RememberToken roomId={room.id} token={room.token} />
      <RoomTopBar
        roomId={room.id}
        topic={room.topic}
        due={due}
        analyze={<AnalyzeButton roomId={room.id} onDone={analysis.refresh} />}
        onSettings={() => setSettingsOpen(true)}
      />
      <header className="order-1 min-w-0 space-y-6 lg:order-none lg:col-span-2">
        {analysis.board.pending && feed.events.length > 0 ? (
          <p role="status" className="text-sm text-muted">
            {text.pendingNote}
          </p>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-5">
            <InviteLink path={room.path} />
            <InviteByEmail topic={room.topic} path={room.path} />
          </div>
          <section className="min-w-0 space-y-3">
            <h2 className="text-sm font-semibold tracking-[0.14em] text-muted uppercase">{text.members}</h2>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {feed.members.map((member) => (
                <li key={member.name} className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <span className="font-semibold">
                    {member.name}
                    {member.name === room.viewerName ? (
                      <span className="ml-2 text-xs font-semibold tracking-wide text-link uppercase">{text.you}</span>
                    ) : null}
                  </span>
                  <span className="text-right text-sm text-muted">{member.part ?? text.memberPart}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </header>

      <section className="order-3 min-w-0 space-y-3 lg:order-none lg:col-start-2 lg:row-start-2">
        <h2 className="text-sm font-semibold tracking-[0.14em] text-muted uppercase">{text.parts}</h2>
        {parts.length === 0 ? (
          <p className="text-sm text-muted">{text.partsEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {parts.map((part) => (
              <li key={part.name} className="rounded-2xl border border-line bg-surface/70 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold break-words">{part.name}</h3>
                  <PartStatusLabel status={part.status} />
                </div>
                <p className="mt-2 text-sm text-muted">{part.members.length > 0 ? part.members.join(", ") : text.nobody}</p>
                <p className="mt-1 text-sm">
                  {part.eventCount} {part.eventCount === 1 ? text.eventOne : text.eventMany}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="order-4 min-w-0 space-y-4 lg:order-none lg:col-start-1 lg:row-start-2 lg:row-span-2" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-[0.14em] text-muted uppercase">{text.feed}</h2>
          <LiveStatusLabel status={feed.status} />
        </div>
        <div role="group" aria-label={text.filterLabel} className="flex flex-wrap gap-2">
          <FilterChip selected={activeFilter === null} onClick={() => setMemberFilter(null)}>
            {text.allMembers}
          </FilterChip>
          {names.map((name) => (
            <FilterChip key={name} selected={activeFilter === name} onClick={() => setMemberFilter(name)}>
              {name}
            </FilterChip>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="text-sm leading-6 text-muted">
            {feed.events.length === 0 && feed.status === "offline"
              ? text.eventsError
              : activeFilter
                ? text.feedEmptyFilter
                : text.feedEmpty}
          </p>
        ) : (
          <ol className="space-y-3">
            {visible.map((event) => (
              <li key={event.eventId}>
                <EventCard event={event} chatName={event.conversationName?.trim() || chatNames.get(event.conversationId) || null} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="order-2 min-w-0 space-y-4 rounded-2xl border border-line bg-surface/70 p-4 lg:order-none lg:col-start-2 lg:row-start-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-[0.14em] text-muted uppercase">{text.contextTitle}</h2>
            <p className="mt-2 text-sm text-muted">
              {text.forMember} <span className="text-foreground">{room.viewerName}</span>
            </p>
          </div>
          <span className="text-xs font-semibold tracking-[0.14em] text-link uppercase">
            {analysis.board.fuente === "ia" ? text.fromAi : text.fromRules}
          </span>
        </div>
        {feed.events.length === 0 ? (
          <p className="text-sm leading-6 text-muted">{text.noEventsYet}</p>
        ) : analysis.board.fuente !== "ia" ? (
          <p role="status" className="rounded-xl border border-warm/40 px-3 py-2 text-sm leading-6 text-warm">
            {text.aiBusy}
          </p>
        ) : null}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{text.summary}</h3>
          <p className="text-sm leading-6">{context.resumen}</p>
        </div>
        {analysis.board.consejo ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{text.teamAdvice}</h3>
            <p className="text-sm leading-6">{analysis.board.consejo}</p>
          </div>
        ) : null}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{text.yourPart}</h3>
          <p className="text-sm">{context.parte}</p>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold" htmlFor="prompt-sugerido">
            {text.suggested}
          </label>
          <textarea
            id="prompt-sugerido"
            readOnly
            rows={4}
            value={context.prompt_sugerido}
            className={`${fieldClass} text-sm leading-6`}
          />
          <CopyButton value={context.prompt_sugerido} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{text.warnings}</h3>
          {context.advertencias.length === 0 ? (
            <p className="text-sm text-muted">{text.noWarnings}</p>
          ) : (
            <ul className="space-y-3">
              {context.advertencias.map((warning, index) => (
                <li key={`${warning.tipo}-${index}`} className={`rounded-xl px-3 py-3 ${warningTone(warning.tipo)}`}>
                  <p className="text-xs font-semibold tracking-[0.14em] uppercase">
                    <WarningLabel tipo={warning.tipo} />
                  </p>
                  <p className="mt-1 text-sm leading-6">{warning.mensaje}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        {analysis.board.chats.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{text.chats}</h3>
            <ul className="space-y-1 text-sm">
              {analysis.board.chats.map((chat) => (
                <li key={chat.conversationId} className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{chat.nombre}</span>
                  <span className="truncate font-mono text-xs text-muted">{chat.conversationId}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {analysis.board.miembros.length > 1 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{text.prompts}</h3>
            <ul className="space-y-2">
              {analysis.board.miembros
                .filter((member) => member.nombre !== room.viewerName)
                .map((member) => (
                  <li key={member.nombre} className="text-sm leading-6">
                    <span className="font-semibold">{member.nombre}.</span> {member.prompt_sugerido}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
        <CopyButton
          value={summaryMarkdown(room, analysis.board, context, text)}
          label={text.exportSummary}
          doneLabel={text.exportCopied}
        />
      </section>

      <div className="order-7 lg:order-none lg:col-span-2">
        <Link href="/" className={secondaryButton}>
          {text.back}
        </Link>
      </div>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <RoomSettings initial={initialBoard} live={analysis.board} onSaved={analysis.refresh} />
      <details className="rounded-2xl border border-line px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold">{text.extensionDetails}</summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-muted">{text.extensionHelp}</p>
          <CopyValue id="room-id" label={text.idLabel} value={room.id} />
          <CopyValue id="room-token" label={text.tokenLabel} value={analysis.board.token || room.token} />
          <p className="text-sm leading-6 text-muted">{text.tokenHelp}</p>
        </div>
      </details>

      </SettingsDrawer>
    </div>
  );
}

function useRoomAnalysis(roomId: string, initial: RoomBoard, fallback: boolean) {
  const [board, setBoard] = useState(initial);
  const revision = boardRevision(initial);
  const [seen, setSeen] = useState(revision);
  if (seen !== revision) {
    setSeen(revision);
    setBoard(initial);
  }

  const refresh = useCallback(async () => {
    try {
      const result = await readRoomBoardAction(roomId);
      if (result.ok) setBoard(result.board);
    } catch {
      // El siguiente intento, o Realtime, vuelve a pedir el análisis.
    }
  }, [roomId]);

  useEffect(() => {
    let stopped = false;
    let pollId = 0;
    const stopPoll = () => {
      if (!pollId) return;
      window.clearInterval(pollId);
      pollId = 0;
    };
    const startPoll = () => {
      if (pollId || stopped) return;
      pollId = window.setInterval(() => {
        void refresh();
      }, POLL_MS);
    };

    if (fallback) {
      startPoll();
      return () => {
        stopped = true;
        stopPoll();
      };
    }

    const client = browserSupabase();
    const filter = realtimeFilter(roomId);
    if (!client || !filter) {
      startPoll();
      return () => {
        stopped = true;
        stopPoll();
      };
    }

    const channel = client
      .channel(`enlaza-analysis-${roomId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_analysis", filter }, () => {
        void refresh();
      })
      .subscribe((status: string) => {
        if (stopped) return;
        if (status === "SUBSCRIBED") {
          stopPoll();
          void refresh();
          return;
        }
        if (realtimeFailed(status)) startPoll();
      });

    return () => {
      stopped = true;
      stopPoll();
      void client.removeChannel(channel);
    };
  }, [fallback, refresh, roomId]);

  return { board, refresh };
}

function memberContext(board: RoomBoard, viewerName: string, rules: ContextResponse): ContextResponse {
  if (board.fuente !== "ia") return rules;
  const mine = board.miembros.find((member) => member.nombre === viewerName);
  const advertencias = board.alertas.filter(
    (warning) => warning.destinatario === viewerName || warning.destinatario === "equipo",
  );
  return {
    resumen: mine?.resumen || board.resumen || rules.resumen,
    parte: mine?.parte || rules.parte,
    prompt_sugerido: mine?.prompt_sugerido || rules.prompt_sugerido,
    advertencias: advertencias.length > 0 ? advertencias : mine ? [] : rules.advertencias,
  };
}

type Copy = ReturnType<typeof useCopy>;

function summaryMarkdown(room: RoomView, board: RoomBoard, context: ContextResponse, text: Copy): string {
  const lines = [`# ${room.topic}`, ""];
  if (room.dueDate && room.dueDate !== NO_DATE) lines.push(`**${text.exportDue}:** ${room.dueDate}`, "");
  lines.push(`## ${text.exportHeading}`, "", board.resumen || context.resumen, "");
  if (board.consejo) lines.push(`## ${text.teamAdvice}`, "", board.consejo, "");
  const members = board.members.length > 0 ? board.members : room.members;
  if (members.length > 0) {
    lines.push(`## ${text.exportMembers}`, "");
    for (const member of members) lines.push(`- **${member.name}**: ${member.part ?? text.memberPart}`);
    lines.push("");
  }
  const warnings = board.fuente === "ia" ? board.alertas : context.advertencias;
  if (warnings.length > 0) {
    lines.push(`## ${text.exportWarnings}`, "");
    for (const warning of warnings) {
      const label =
        warning.tipo === "contradiccion"
          ? text.warningContradiccion
          : warning.tipo === "duplicado"
            ? text.warningDuplicado
            : text.warningFalta;
      lines.push(`- **${label}** (${warning.destinatario}): ${warning.mensaje}`);
    }
    lines.push("");
  }
  if (board.miembros.length > 0) {
    lines.push(`## ${text.exportPrompts}`, "");
    for (const member of board.miembros) lines.push(`- **${member.nombre}**: ${member.prompt_sugerido}`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

function boardRevision(board: RoomBoard): string {
  return [
    board.id,
    board.topic,
    board.dueDate ?? "",
    board.parts.join("\u0001"),
    board.language,
    board.token,
    board.members.map((member) => `${member.name}:${member.part ?? ""}`).join("\u0001"),
  ].join("\u0002");
}

function AnalyzeButton({ roomId, onDone }: { roomId: string; onDone: () => void }) {
  const text = useCopy();
  const [state, action, pending] = useActionState(analyzeNowAction, idleSettings);
  useEffect(() => {
    if (state.status === "saved") onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="w-full space-y-2 sm:w-auto">
      <input type="hidden" name="room_id" value={roomId} />
      <button type="submit" className={`${primaryButton} w-full sm:w-auto`} disabled={pending} aria-busy={pending}>
        {pending ? text.analyzing : text.analyze}
      </button>
      {pending ? (
        <p role="status" className="max-w-xs text-sm text-muted">
          {text.analyzingNote}
        </p>
      ) : null}
      {state.status === "error" && !pending ? (
        <p role="alert" className="max-w-xs text-sm text-danger">
          {text.analyzeError}
        </p>
      ) : null}
    </form>
  );
}

export function RoomMessage({ code }: { code: "unavailable" | "save" }) {
  const text = useCopy();
  return (
    <section className="space-y-6">
      <p role="alert" className="text-lg">
        {code === "save" ? text.save : text.unavailable}
      </p>
      <Link href="/" className={secondaryButton}>
        {text.back}
      </Link>
    </section>
  );
}

function PartStatusLabel({ status }: { status: PartStatus }) {
  const text = useCopy();
  const label = status === "active" ? text.partActive : status === "waiting" ? text.partWaiting : text.partEmpty;
  const tone = status === "active" ? "text-link" : "text-muted";
  return <span className={`shrink-0 text-xs font-semibold tracking-wide uppercase ${tone}`}>{label}</span>;
}

function LiveStatusLabel({ status }: { status: LiveStatus }) {
  const text = useCopy();
  const label =
    status === "live" ? text.live : status === "polling" ? text.polling : status === "offline" ? text.offline : text.connecting;
  const dot =
    status === "live" ? "bg-accent" : status === "polling" ? "bg-warm" : status === "offline" ? "bg-danger" : "bg-muted";
  return (
    <p className="inline-flex items-center gap-2 text-sm text-muted">
      <span className={`inline-block size-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </p>
  );
}

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold ${
        selected ? "border-accent bg-accent text-accent-ink" : "border-line text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EventCard({ event, chatName }: { event: StoredEvent; chatName: string | null }) {
  const text = useCopy();
  const [open, setOpen] = useState(false);
  const long = event.text.length > PREVIEW;
  const body = long && !open ? `${event.text.slice(0, PREVIEW).trimEnd()}…` : event.text;
  const typeLabel = event.type === "prompt" ? text.typePrompt : event.type === "respuesta" ? text.typeRespuesta : text.typeArchivo;
  const typeTone = event.type === "prompt" ? "text-link" : event.type === "respuesta" ? "text-info" : "text-warm";

  return (
    <article className="rounded-2xl border border-line px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="min-w-0">
          <span className={`text-xs font-semibold tracking-[0.14em] uppercase ${typeTone}`}>{typeLabel}</span>
          <span className="mx-2 text-muted">·</span>
          <span className="font-semibold">{event.member}</span>
          <span className="ml-2 text-sm text-muted">{event.ai}</span>
        </p>
        <time dateTime={event.createdAt} className="text-sm text-muted">
          {formatEventTime(event.createdAt)}
        </time>
      </div>
      {chatName ? <p className="mt-1 text-sm text-muted">{chatName}</p> : null}
      <p className="mt-2 text-sm leading-6 break-words whitespace-pre-wrap">{body}</p>
      {long ? (
        <button type="button" className="mt-2 cursor-pointer text-sm font-semibold text-link" onClick={() => setOpen((value) => !value)}>
          {open ? text.seeLess : text.seeMore}
        </button>
      ) : null}
    </article>
  );
}

function warningTone(tipo: WarningType): string {
  if (tipo === "contradiccion") return "bg-contra-bg text-contra-ink";
  if (tipo === "duplicado") return "bg-dup-bg text-dup-ink";
  return "bg-falta-bg text-falta-ink";
}

function WarningLabel({ tipo }: { tipo: WarningType }) {
  const text = useCopy();
  if (tipo === "contradiccion") return text.warningContradiccion;
  if (tipo === "duplicado") return text.warningDuplicado;
  return text.warningFalta;
}
