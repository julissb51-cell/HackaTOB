import "server-only";
import {
  applyChatNames,
  claimAnalysisRun,
  markAnalysisPending,
  readSavedAnalysis,
  rememberEventCount,
  saveAnalysis,
} from "./analysis-db";
import { complete, getAiProvider, type AiMessage } from "./ai";
import { nextSuggestionStatus, produceReport, type AnalystMessage } from "./analyst";
import { computeProgress, mergeChecklist } from "./progress";
import { supabaseMembershipStore } from "./room-membership-db";
import { supabaseRoomStore } from "./room-store";

const ANALYSIS_TIMEOUT_MS = 50_000;
const inflight = new Map<string, Promise<boolean>>();
const dirty = new Map<string, number>();

export function scheduleRoomAnalysis(
  roomId: string,
  options?: { force?: boolean; markPending?: boolean },
): Promise<boolean> {
  const force = options?.force === true;
  const markPending = options?.markPending === true;
  if (markPending) dirty.set(roomId, (dirty.get(roomId) ?? 0) + 1);
  if (!force) {
    const current = inflight.get(roomId);
    if (current) return current;
  }
  const run = execute(roomId, force, markPending).catch((error: unknown) => {
    console.error("analisis", error instanceof Error ? error.message : error);
    return false;
  });
  if (!force) inflight.set(roomId, run);
  void run.finally(() => {
    if (inflight.get(roomId) === run) inflight.delete(roomId);
  });
  return run;
}

export function trackAnalysis(roomId: string, options?: { force?: boolean; markPending?: boolean }): Promise<void> {
  return scheduleRoomAnalysis(roomId, options).then((ok) => {
    if (!ok) console.error("analisis", "no corrió");
  });
}

async function execute(roomId: string, force: boolean, markPending: boolean): Promise<boolean> {
  const seen = dirty.get(roomId) ?? 0;
  const claim = await claimAnalysisRun(roomId, force);
  if (claim === "skip") {
    if (markPending) await markAnalysisPending(roomId);
    return true;
  }

  const room = await supabaseMembershipStore.getRoom(roomId);
  if (!room) {
    console.error("analisis", "sala inexistente");
    return false;
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
      previousChecklist: previous?.avance?.items,
    },
    completeAnalyst,
  );
  if (produced.fuente === "reglas" && previous?.fuente === "ia" && analystConfigured()) {
    // La IA falló esta vez: se deja el último análisis de IA en vez de cambiarlo por reglas.
    console.error("analisis", "se mantiene el análisis de IA anterior");
    await rememberEventCount(roomId, events.length);
    if ((dirty.get(roomId) ?? 0) !== seen) await markAnalysisPending(roomId);
    return true;
  }
  // Solo se reutiliza la lista anterior si viene de la misma fuente (IA o reglas), para no mezclar listas distintas.
  const sameSource = previous?.fuente === produced.fuente;
  const items = mergeChecklist(sameSource ? previous?.avance?.items ?? [] : [], produced.report.checklist ?? []);
  const avance = computeProgress({
    items,
    parts: room.parts,
    alertas: produced.report.alertas,
    previous: previous?.avance ?? null,
    language: room.language,
  });
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
  return true;
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
