"use client";

import { useEffect, type ReactNode } from "react";
import type { RoomBoard } from "@/lib/board-view";
import type { RoomProgress } from "@/lib/progress";
import { PRIORITIES, countByPriority, sortByPriority } from "@/lib/priority";
import type { ContextResponse, RoomWarning, WarningPriority, WarningType } from "@/lib/room-types";
import { CopyButton } from "./invite-link";
import { useCopy } from "./language";
import { Symbol, iconButton, pillSecondary } from "./symbol";

function priorityTone(prioridad: WarningPriority | undefined): string {
  if (prioridad === "urgente") return "bg-urg-bg text-urg-ink";
  if (prioridad === "puede_esperar") return "bg-wait-bg text-wait-ink";
  return "bg-soon-bg text-soon-ink";
}

function priorityIcon(prioridad: WarningPriority | undefined): string {
  if (prioridad === "urgente") return "priority_high";
  if (prioridad === "puede_esperar") return "schedule";
  return "timer";
}

function tone(tipo: WarningType): string {
  if (tipo === "contradiccion") return "bg-contra-bg text-contra-ink";
  if (tipo === "duplicado") return "bg-dup-bg text-dup-ink";
  return "bg-falta-bg text-falta-ink";
}

function icon(tipo: WarningType): string {
  if (tipo === "contradiccion") return "error";
  if (tipo === "duplicado") return "content_copy";
  return "help";
}

function Bar({ value, big = false, label }: { value: number; big?: boolean; label: string }) {
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-structural ${big ? "h-4" : "h-2"}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${value}%` }} />
    </div>
  );
}

export function countAlerts(alertas: readonly RoomWarning[]): Record<WarningType, number> {
  return {
    contradiccion: alertas.filter((a) => a.tipo === "contradiccion").length,
    duplicado: alertas.filter((a) => a.tipo === "duplicado").length,
    falta: alertas.filter((a) => a.tipo === "falta").length,
  };
}

export function ProgressCard({
  avance,
  board,
  aiByMember,
  viewerName,
  context,
  onOpen,
}: {
  avance: RoomProgress | null;
  board: RoomBoard;
  aiByMember: Map<string, string>;
  viewerName: string;
  context: ContextResponse;
  onOpen: () => void;
}) {
  const text = useCopy();
  const priorities = countByPriority(board.alertas);
  const total = board.alertas.length;
  const value = avance?.valor ?? 0;
  const parts = avance?.partes ?? board.parts.map((parte) => ({ parte, hechos: 0, total: 0, avance: 0 }));
  const own = context.advertencias[0];
  const stepText = own?.mensaje || context.parte;
  const stepPrompt = own?.prompt_sugerido || context.prompt_sugerido;

  return (
    <section className="rounded-[24px] border border-line bg-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
            <Symbol name="trending_up" className="text-[20px] text-link" />
            {text.progressTitle}
          </h2>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span className={`text-[56px] leading-none font-[700] tracking-[-2px] tabular-nums sm:text-[64px] ${avance ? "" : "text-muted"}`}>
              {value}%
            </span>
            {avance ? <span className="text-sm font-semibold text-muted">{text.progressApprox}</span> : null}
            {avance && avance.anterior !== null ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-structural px-2.5 py-1 text-sm font-semibold text-link"
                title={avance.motivo}
              >
                <Symbol
                  name={avance.delta > 0 ? "arrow_upward" : avance.delta < 0 ? "arrow_downward" : "trending_flat"}
                  className="text-[16px]"
                />
                {text.progressDelta(avance.delta)}
              </span>
            ) : null}
          </p>
        </div>
        <p className="max-w-sm text-sm text-muted">
          {avance ? (
            <>
              {avance.motivo || text.progressMeta}
              {avance.penalizacion > 0 ? ` · ${text.progressPenalty(avance.penalizacion)}` : ""}
            </>
          ) : (
            text.progressEmpty
          )}
        </p>
      </div>
      <div className="mt-5">
        <Bar value={value} big label={text.progressTitle} />
      </div>
      {parts.length > 0 ? (
        <ul className={`mt-6 grid gap-4 ${parts.length >= 3 ? "sm:grid-cols-3" : parts.length === 2 ? "sm:grid-cols-2" : ""}`}>
          {parts.map((part) => {
            const owners = board.members.filter((m) => m.part && m.part.toLocaleLowerCase() === part.parte.toLocaleLowerCase());
            const pending = (avance?.items ?? []).filter((item) => item.parte === part.parte && !item.hecho).map((item) => item.texto);
            return (
              <li key={part.parte} className="rounded-2xl bg-structural/60 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold">{part.parte}</span>
                  <span className="text-sm font-semibold tabular-nums">{part.avance}%</span>
                </div>
                <div className="mt-2">
                  <Bar value={part.avance} label={part.parte} />
                </div>
                {owners.length > 0 ? (
                  <p className="mt-2 text-sm text-muted">
                    {owners.map((m) => [m.name, aiByMember.get(m.name)].filter(Boolean).join(" · ")).join(", ")}
                  </p>
                ) : null}
                <p className="mt-1 text-sm leading-[1.5] text-muted">
                  {!avance || part.total === 0
                    ? text.partNoList
                    : pending.length === 0
                      ? text.partAllDone
                      : `${text.partDone(part.hechos, part.total)} · ${text.partMissing}: ${pending.slice(0, 3).join(", ")}${pending.length > 3 ? "…" : ""}`}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className={`mt-6 flex w-full cursor-pointer flex-wrap items-center gap-2 rounded-2xl border px-4 py-3 text-left transition-colors ${priorities.urgente > 0 ? "border-urg-ink/40 bg-urg-bg/60 hover:bg-urg-bg" : "border-line hover:bg-structural/60"}`}
      >
        {total === 0 ? (
          <span className="text-[15px] text-muted">{text.noticeNone}</span>
        ) : (
          PRIORITIES.filter((prioridad) => priorities[prioridad] > 0).map((prioridad) => (
            <span
              key={prioridad}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${priorityTone(prioridad)}`}
            >
              <Symbol name={priorityIcon(prioridad)} className="text-[16px]" />
              {text.priorityCount[prioridad](priorities[prioridad])}
            </span>
          ))
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-link">
          {text.noticeOpen} <Symbol name="arrow_forward" className="text-[18px]" />
        </span>
      </button>
      {stepPrompt ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-structural/60 px-4 py-3">
          <Symbol name="flag" className="text-[20px] text-link" />
          <p className="min-w-0 flex-1 text-[15px] leading-[1.5]">
            <strong>{text.nextStep(viewerName)}</strong> {stepText}
          </p>
          <CopyButton value={stepPrompt} label={text.copyPrompt} />
        </div>
      ) : null}
    </section>
  );
}

export function SummaryDrawer({
  open,
  onClose,
  board,
  context,
  viewerName,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  board: RoomBoard;
  context: ContextResponse;
  viewerName: string;
  extra?: ReactNode;
}) {
  const text = useCopy();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);
  if (!open) return null;
  const sorted = sortByPriority(board.alertas);
  const priorities = countByPriority(sorted);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onMouseDown={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={text.overviewTitle}
        className="absolute inset-y-0 right-0 flex w-full max-w-[600px] flex-col bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
          <h2 className="inline-flex items-center gap-2 text-xl font-[650]">
            <Symbol name="auto_awesome" className="text-link" />
            {text.overviewTitle}
          </h2>
          <button type="button" onClick={onClose} aria-label={text.close} className={iconButton} autoFocus>
            <Symbol name="close" />
          </button>
        </div>
        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-6">
          <section className="rounded-2xl border border-line p-4">
            <h3 className="inline-flex items-center gap-2 font-semibold">
              <Symbol name="person" className="text-[20px] text-link" />
              {text.forYou(viewerName)}
            </h3>
            <p className="mt-2 text-[15px] leading-[1.5]">{context.parte}</p>
            <label className="mt-3 block text-sm font-semibold text-muted" htmlFor="drawer-prompt">
              {text.suggested}
            </label>
            <textarea
              id="drawer-prompt"
              readOnly
              rows={4}
              value={context.prompt_sugerido}
              className="mt-1 w-full rounded-xl bg-structural p-3 text-sm leading-[1.5]"
            />
            <div className="mt-2">
              <CopyButton value={context.prompt_sugerido} label={text.copyPrompt} />
            </div>
            {extra ? <div className="mt-4 space-y-4">{extra}</div> : null}
          </section>
          <section>
            <h3 className="text-sm font-semibold text-muted">{text.summary}</h3>
            <p className="mt-1 text-[15px] leading-[1.5]">{context.resumen}</p>
            {board.consejo ? (
              <>
                <h3 className="mt-4 text-sm font-semibold text-muted">{text.teamAdvice}</h3>
                <p className="mt-1 text-[15px] leading-[1.5]">{board.consejo}</p>
              </>
            ) : null}
          </section>
          {board.alertas.length === 0 ? <p className="text-sm text-muted">{text.noWarnings}</p> : null}
          {PRIORITIES.filter((prioridad) => priorities[prioridad] > 0).map((prioridad) => (
            <section key={prioridad}>
              <h3 className="inline-flex items-center gap-2 font-semibold">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm ${priorityTone(prioridad)}`}>
                  <Symbol name={priorityIcon(prioridad)} className="text-[16px]" />
                  {text.priorityLabel[prioridad]}
                </span>
                <span className="rounded-full bg-structural px-2 text-sm text-muted">{priorities[prioridad]}</span>
              </h3>
              <ul className="mt-3 space-y-3">
                {sorted
                  .filter((alert) => (alert.prioridad ?? "pronto") === prioridad)
                  .map((alert, index) => (
                    <li key={`${prioridad}-${index}`} className="rounded-2xl border border-line bg-surface p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityTone(prioridad)}`}>
                          <Symbol name={priorityIcon(prioridad)} className="text-[14px]" />
                          {text.priorityLabel[prioridad]}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone(alert.tipo)}`}>
                          <Symbol name={icon(alert.tipo)} className="text-[14px]" />
                          {text.typeTag[alert.tipo]}
                        </span>
                      </div>
                      <p className="mt-2 text-[15px] leading-[1.5]">{alert.mensaje}</p>
                      <p className="mt-2 text-sm text-muted">
                        <strong>{text.alertWho}:</strong> {alert.destinatario || "—"}
                        {(alert.partes ?? []).length > 0 ? (
                          <>
                            {" · "}
                            <strong>{text.alertParts}:</strong> {(alert.partes ?? []).join(", ")}
                          </>
                        ) : null}
                      </p>
                      {alert.prompt_sugerido ? (
                        <div className="mt-3 rounded-xl bg-structural p-3 text-foreground">
                          <p className="text-xs font-semibold text-muted">{text.alertFix}</p>
                          <p className="mt-1 text-sm leading-[1.5] whitespace-pre-wrap">{alert.prompt_sugerido}</p>
                          <div className="mt-2">
                            <CopyButton value={alert.prompt_sugerido} label={text.copyShort} />
                          </div>
                        </div>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="border-t border-line px-5 py-4 text-right sm:px-6">
          <button type="button" onClick={onClose} className={`${pillSecondary} h-10 px-5 text-sm`}>
            {text.close}
          </button>
        </div>
      </aside>
    </div>
  );
}
