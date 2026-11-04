"use client";

import { useActionState, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import type { ContextResponse, StoredEvent } from "@/lib/room-types";
import { browserSupabase } from "@/lib/supabase/browser";
import { CopyButton, CopyValue, RememberToken } from "./invite-link";
import { ProgressCard, SummaryDrawer } from "./room-progress";
import { EditableTitle } from "./editable-title";
import { useCopy } from "./language";
import { Symbol, pillPrimary } from "./symbol";
import { RoomSettings } from "./room-settings";
import { RoomTopBar, SettingsDrawer } from "./room-top-bar";
import { ShareDialog } from "./share-dialog";
import { secondaryButton } from "./styles";
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

export function RoomScreen({
  room,
  board: initialBoard,
  account,
}: {
  room: RoomView;
  board: RoomBoard;
  account?: ReactNode;
}) {
  const text = useCopy();
  const feed = useRoomFeed(room.id, room.events, room.members);
  const analysis = useRoomAnalysis(room.id, initialBoard, feed.status === "polling" || feed.status === "offline");
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const closeSummary = useCallback(() => setSummaryOpen(false), []);
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

  const aiByMember = new Map<string, string>();
  for (const event of feed.events) if (event.ai && !aiByMember.has(event.member)) aiByMember.set(event.member, event.ai);
  const promptByMember = new Map(
    analysis.board.fuente === "ia" ? analysis.board.miembros.map((member) => [member.nombre, member.prompt_sugerido] as const) : [],
  );

  return (
    <div className="m-home flex w-full flex-1 flex-col">
      <RoomTopBar topic={room.topic} onSettings={() => setSettingsOpen(true)} onShare={() => setShareOpen(true)} account={account} />
      <RememberToken roomId={room.id} token={room.token} />
      <div className="w-full px-4 pb-16 sm:px-8">
        <section className="flex flex-col gap-6 pt-8 pb-10 sm:pt-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-muted">
              <span className="inline-block size-2 rounded-full bg-accent" aria-hidden="true" />
              {text.roomKicker}
            </p>
            <EditableTitle roomId={room.id} topic={room.topic} />
            <p className="mt-2 max-w-[65ch] text-base leading-[1.5] text-muted">{text.roomPurpose}</p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm">
              <Symbol name="event" className="text-[18px] text-muted" />
              <span className="font-semibold">{text.dueLabel}:</span>
              <span className="text-muted">{due}</span>
            </p>
            {parts.length === 0 ? (
              <p className="mt-4 text-sm text-muted">{text.partsEmpty}</p>
            ) : (
              <ul aria-label={text.parts} className="mt-3 flex flex-wrap gap-2">
                {parts.map((part) => (
                  <li
                    key={part.name}
                    title={part.members.length > 0 ? part.members.join(", ") : text.nobody}
                    className="inline-flex items-center gap-2 rounded-full bg-structural px-3.5 py-1.5 text-sm"
                  >
                    <span className="font-semibold">{part.name}</span>
                    <PartStatusLabel status={part.status} />
                    <span className="text-muted">
                      {part.eventCount} {part.eventCount === 1 ? text.eventOne : text.eventMany}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="shrink-0">
            <AnalyzeButton roomId={room.id} onDone={analysis.refresh} />
          </div>
        </section>

        <div className="grid gap-6 gap-y-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-8 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="order-2 min-w-0 space-y-6 lg:order-none">
            <ProgressCard
              avance={analysis.board.avance}
              board={analysis.board}
              aiByMember={aiByMember}
              viewerName={room.viewerName}
              context={context}
              onOpen={() => setSummaryOpen(true)}
            />
            {analysis.board.pending && feed.events.length > 0 ? (
              <p role="status" className="-mt-3 px-2 text-sm text-muted">
                {text.pendingNote}
              </p>
            ) : feed.events.length > 0 && analysis.board.fuente !== "ia" ? (
              <p role="status" className="-mt-3 rounded-xl bg-falta-bg px-3 py-2 text-sm leading-6 text-falta-ink">
                {text.aiBusy}
              </p>
            ) : null}
            <SummaryDrawer
              open={summaryOpen}
              onClose={closeSummary}
              board={analysis.board}
              context={context}
              viewerName={room.viewerName}
              extra={
                <>
                  {analysis.board.chats.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted">{text.chats}</h3>
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
                  <CopyButton
                    value={summaryMarkdown(room, analysis.board, context, text)}
                    label={text.exportSummary}
                    doneLabel={text.exportCopied}
                  />
                </>
              }
            />

            <Panel live>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="inline-flex items-center gap-2 text-lg font-[650] tracking-[-0.2px]">
                  <Symbol name="forum" className="text-[20px] text-muted" />
                  {text.feed}
                </h2>
                <LiveStatusLabel status={feed.status} />
              </div>
              <div role="group" aria-label={text.filterLabel} className="mt-4 flex flex-wrap gap-2">
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
                <p className="mt-4 text-sm leading-6 text-muted">
                  {feed.events.length === 0 && feed.status === "offline"
                    ? text.eventsError
                    : activeFilter
                      ? text.feedEmptyFilter
                      : text.feedEmpty}
                </p>
              ) : (
                <ol className="mt-2 divide-y divide-line">
                  {visible.map((event) => (
                    <li key={event.eventId}>
                      <EventCard event={event} chatName={event.conversationName?.trim() || chatNames.get(event.conversationId) || null} />
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>

          <div className="order-1 min-w-0 space-y-6 lg:order-none lg:sticky lg:top-6 lg:self-start">
            <Panel>
              <h2 className="inline-flex items-center gap-2 text-lg font-[650] tracking-[-0.2px]">
                <Symbol name="group" className="text-[20px] text-muted" />
                {text.members}
              </h2>
              <ul className="mt-3 space-y-1">
                {feed.members.map((member) => {
                  const ai = aiByMember.get(member.name);
                  const prompt = member.name === room.viewerName ? null : promptByMember.get(member.name);
                  return (
                    <li key={member.name} className="flex gap-3 py-2">
                      <Letter name={member.name} strong={member.name === room.viewerName} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold">{member.name}</span>
                          {member.name === room.viewerName ? (
                            <span className="text-xs font-semibold text-link">{text.you}</span>
                          ) : null}
                          {ai ? <span className="rounded-full bg-structural px-2 py-0.5 text-xs text-muted">{ai}</span> : null}
                        </p>
                        <p className="text-sm text-muted">{member.part ?? text.memberPart}</p>
                        {prompt ? (
                          <p className="mt-2 rounded-xl bg-structural px-3 py-2 text-sm leading-6">
                            <span className="block text-xs font-semibold text-muted">{text.prompts}</span>
                            {prompt}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>
        </div>
      </div>
      <footer className="mt-auto border-t border-line px-4 py-6 text-sm text-muted sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Enlaza · HackaTOB</p>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Footer">
            <Link href="/" className="rounded-full px-3 py-1.5 transition-colors hover:bg-foreground/5 hover:text-foreground">
              {text.footerHome}
            </Link>
            <a
              href="https://github.com/julissb51-cell/HackaTOB"
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              {text.footerRepo}
            </a>
            <a
              href="https://github.com/julissb51-cell/HackaTOB/issues"
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              {text.footerHelp}
            </a>
          </nav>
        </div>
      </footer>
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        topic={room.topic}
        path={room.path}
        members={feed.members}
        viewerName={room.viewerName}
        aiByMember={aiByMember}
      />
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <RoomSettings initial={initialBoard} live={analysis.board} onSaved={analysis.refresh} />
        <details className="rounded-2xl bg-structural px-4 py-3">
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

/** Panel plano: marco gris redondeado con una tarjeta blanca dentro. */
function Panel({ children, live = false }: { children: ReactNode; live?: boolean }) {
  return (
    <section
      className="rounded-[24px] border border-line bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-7"
      aria-live={live ? "polite" : undefined}
    >
      {children}
    </section>
  );
}

function Letter({ name, strong = false }: { name: string; strong?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-10 shrink-0 place-items-center rounded-xl text-[15px] font-semibold ${
        strong ? "bg-accent text-accent-ink" : "bg-structural text-foreground"
      }`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
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
    <form action={action} className="w-full space-y-2 sm:w-auto lg:text-right">
      <input type="hidden" name="room_id" value={roomId} />
      <button type="submit" className={`${pillPrimary} h-12 w-full px-6 sm:w-auto`} disabled={pending} aria-busy={pending}>
        <Symbol name="auto_awesome" className="text-[20px]" />
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
    <section className="max-w-xl space-y-6 pt-10">
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
      className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
        selected ? "border-transparent bg-foreground text-background" : "border-transparent bg-structural text-muted hover:text-foreground"
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
    <article className="flex gap-3 py-4">
      <Letter name={event.member} />
      <div className="min-w-0 flex-1">
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
      </div>
    </article>
  );
}


