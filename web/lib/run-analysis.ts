import "server-only";
import {
  applyChatNames,
  claimAnalysisRun,
  markAnalysisPending,
  readAnalysisGate,
  readSavedAnalysis,
  rememberEventCount,
  saveAnalysis,
  saveProgress,
} from "./analysis-db";
import { complete, getAiProvider, type AiMessage } from "./ai";
import { nextSuggestionStatus, produceReport, type AnalystMessage } from "./analyst";
import { shouldAnalyze } from "./model-guard";
import { computeProgress, mergeChecklist, reusableChecklist } from "./progress";
import { supabaseMembershipStore } from "./room-membership-db";
import { supabaseRoomStore } from "./room-store";

const ANALYSIS_TIMEOUT_MS = 50_000;
const inflight = new Map<string, Promise<AnalysisOutcome>>();
const dirty = new Map<string, number>();

export type AnalysisOutcome = "ran" | "recent" | "failed";

export function scheduleRoomAnalysis(
  roomId: string,
  options?: { force?: boolean; markPending?: boolean },
): Promise<AnalysisOutcome> {
  const force = options?.force === true;
  const markPending = options?.markPending === true;
  if (markPending) dirty.set(roomId, (dirty.get(roomId) ?? 0) + 1);
  const current = inflight.get(roomId);
  if (current) return current;
  const run = execute(roomId, force, markPending).catch((error: unknown) => {
    console.error("analisis", error instanceof Error ? error.name : "error");
    return "failed" as const;
  });
  inflight.set(roomId, run);
  void run.finally(() => {
    if (inflight.get(roomId) === run) inflight.delete(roomId);
  });
  return run;
}

export function trackAnalysis(roomId: string, options?: { force?: boolean; markPending?: boolean }): Promise<void> {
  return scheduleRoomAnalysis(roomId, options).then((outcome) => {
    if (outcome === "failed") console.error("analisis", "no corrió");
  });
}

async function execute(roomId: string, force: boolean, markPending: boolean): Promise<AnalysisOutcome> {
  const seen = dirty.get(roomId) ?? 0;
  if (!force) {
    const gate = await readAnalysisGate(roomId);
    if (gate) {
      const currentEvents = await supabaseRoomStore.listEvents(roomId);
      const decision = shouldAnalyze({
        force: false,
        pending: gate.pending,
        ranAtMs: gate.ranAtMs,
        now: Date.now(),
        savedEvents: gate.eventos,
        eventCount: currentEvents.length,
      });
      if (decision === "cooldown" && markPending && currentEvents.length !== gate.eventos) {
        await markAnalysisPending(roomId);
      }
      if (decision !== "run") return "recent";
    }
  }
  const claim = await claimAnalysisRun(roomId);
  if (claim === "skip") {
    if (markPending) await markAnalysisPending(roomId);
    return "recent";
  }

  const room = await supabaseMembershipStore.getRoom(roomId);
  if (!room) {
    console.error("analisis", "sala inexistente");
    return "failed";
  }
  const [members, events] = await Promise.all([
    supabaseMembershipStore.listMembers(roomId),
    supabaseRoomStore.listEvents(roomId),
  ]);
  await rememberEventCount(roomId, events.length);
  const previous = await readSavedAnalysis(roomId);
  const produced = await produceReport(
    {
      room: {
        id: room.id,
        topic: room.topic,
        dueDate: room.dueDate,
        parts: room.parts,
        language: room.language,
      },
      members: members.map((member) => ({ name: member.name, part: member.part })),
      events,
      previousChecklist: reusableChecklist(previous, "ia"),
    },
    completeAnalyst,
  );
  if (produced.fuente === "reglas" && previous?.fuente === "ia" && analystConfigured()) {
    // La IA falló esta vez: se deja el último análisis de IA en vez de cambiarlo por reglas.
    console.error("analisis", "se mantiene el análisis de IA anterior");
    if (!previous.avance) {
      // Sin avance guardado todavía: se calcula con la lista por reglas para no dejar la barra vacía.
      await saveProgress(
        roomId,
        {
          ...computeProgress({
            items: produced.report.checklist ?? [],
            parts: room.parts,
            alertas: previous.alertas ?? produced.report.alertas,
            previous: null,
            language: room.language,
          }),
          lista: "reglas",
        },
      );
    }
    await rememberEventCount(roomId, events.length);
    await markAnalysisPending(roomId);
    return "ran";
  }
  // Solo se reutiliza la lista anterior si viene de la misma fuente; una lista de IA reemplaza a la de reglas.
  const items = mergeChecklist(reusableChecklist(previous, produced.fuente), produced.report.checklist ?? []);
  const avance = computeProgress({
    items,
    parts: room.parts,
    alertas: produced.report.alertas,
    previous: previous?.avance ?? null,
    language: room.language,
  });
  avance.lista = produced.fuente;
  await saveAnalysis({
    avance,
    roomId,
    report: produced.report,
    fuente: produced.fuente,
    sugerenciaEstado: nextSuggestionStatus(previous, produced.report.sugerencia),
    idioma: room.language,
    eventos: events.length,
  });
  if ((dirty.get(roomId) ?? 0) !== seen) await markAnalysisPending(roomId);
  await applyChatNames(roomId, produced.report.chats);
  return "ran";
}

async function completeAnalyst(messages: AnalystMessage[]): Promise<string> {
  if (!analystConfigured()) throw new Error("sin clave");
  const chat: AiMessage[] = messages.map((message) => ({ role: message.role, content: message.content }));
  return complete(chat, { json: true, timeoutMs: ANALYSIS_TIMEOUT_MS });
}

function analystConfigured(): boolean {
  try {
    const provider = getAiProvider();
    const key = provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.XAI_API_KEY;
    return Boolean(key?.trim());
  } catch (error) {
    console.error("analisis", error instanceof Error ? error.message : error);
    return false;
  }
}
