import "server-only";
import { applyChatNames, claimAnalysisRun, markAnalysisPending, readSavedAnalysis, saveAnalysis } from "./analysis-db";
import { complete, getAiProvider, type AiMessage } from "./ai";
import { nextSuggestionStatus, produceReport, type AnalystMessage } from "./analyst";
import { supabaseMembershipStore } from "./room-membership-db";
import { supabaseRoomStore } from "./room-store";

const ANALYSIS_TIMEOUT_MS = 25_000;
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
    console.error("analisis", error instanceof Error ? error.name : "error");
    return false;
  });
  if (!force) inflight.set(roomId, run);
  void run.finally(() => {
    if (inflight.get(roomId) === run) inflight.delete(roomId);
  });
  return run;
}

async function execute(roomId: string, force: boolean, markPending: boolean): Promise<boolean> {
  const seen = dirty.get(roomId) ?? 0;
  const claim = await claimAnalysisRun(roomId, force);
  if (claim === "skip") {
    if (markPending) await markAnalysisPending(roomId);
    return true;
  }

  const room = await supabaseMembershipStore.getRoom(roomId);
  if (!room) return false;
  const [members, events] = await Promise.all([
    supabaseMembershipStore.listMembers(roomId),
    supabaseRoomStore.listEvents(roomId),
  ]);
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
    },
    completeAnalyst,
  );
  await saveAnalysis({
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
  } catch {
    return false;
  }
}
