import { buildFallbackReport, clipText, type AnalystReport } from "./analyst";
import { invitePath } from "./room-fields";
import type { AnalysisSuggestion, RoomWarning, SavedAnalysis, StoredEvent } from "./room-types";
import type { MemberRow, StoredRoom } from "./room-membership";

export type BoardEvent = {
  eventId: string;
  member: string;
  ai: string;
  type: string;
  conversationId: string;
  chatName: string;
  text: string;
  createdAt: string;
};

export type RoomBoard = {
  id: string;
  topic: string;
  dueDate: string | null;
  parts: string[];
  token: string;
  path: string;
  language: "es" | "en";
  members: { name: string; part: string | null }[];
  resumen: string;
  consejo: string;
  alertas: RoomWarning[];
  miembros: { nombre: string; parte: string; prompt_sugerido: string; resumen: string }[];
  chats: { conversationId: string; nombre: string }[];
  events: BoardEvent[];
  suggestion: AnalysisSuggestion | null;
  suggestionFromAi: boolean;
  fuente: "ia" | "reglas";
  pending: boolean;
  viewerName: string;
};

export function toBoard(input: {
  room: StoredRoom;
  members: MemberRow[];
  events: StoredEvent[];
  saved: SavedAnalysis | null;
  viewerName: string;
}): RoomBoard {
  const live = buildFallbackReport({
    room: {
      id: input.room.id,
      topic: input.room.topic,
      dueDate: input.room.dueDate,
      parts: input.room.parts,
      language: input.room.language,
    },
    members: input.members.map((member) => ({ name: member.name, part: member.part })),
    events: input.events,
  });
  const useAi = input.saved?.fuente === "ia";
  const report: AnalystReport = useAi && input.saved
    ? {
        resumen: input.saved.resumen,
        miembros: input.saved.miembros,
        alertas: input.saved.alertas,
        chats: input.saved.chats,
        sugerencia: input.saved.sugerencia,
        consejo: input.saved.consejo,
      }
    : live;
  const suggestion = visibleSuggestion(input.saved, useAi ? input.saved?.sugerencia ?? null : live.sugerencia);
  const chatNames = new Map(report.chats.map((chat) => [chat.conversationId, chat.nombre]));

  return {
    id: input.room.id,
    topic: input.room.topic,
    dueDate: input.room.dueDate,
    parts: input.room.parts,
    token: input.room.token,
    path: invitePath(input.room.id, input.room.token),
    language: input.room.language,
    members: input.members.map((member) => ({ name: member.name, part: member.part })),
    resumen: report.resumen,
    consejo: report.consejo,
    alertas: report.alertas,
    miembros: report.miembros.map((member) => ({
      nombre: member.nombre,
      parte: member.parte,
      prompt_sugerido: member.prompt_sugerido,
      resumen: member.resumen,
    })),
    chats: report.chats,
    events: [...input.events]
      .sort((a, b) => eventTime(b) - eventTime(a))
      .slice(0, 20)
      .map((event) => ({
        eventId: event.eventId,
        member: event.member,
        ai: event.ai,
        type: event.type,
        conversationId: event.conversationId,
        chatName: event.conversationName?.trim() || chatNames.get(event.conversationId) || event.conversationId,
        text: clipText(event.text, 180),
        createdAt: event.createdAt,
      })),
    suggestion: suggestion.suggestion,
    suggestionFromAi: suggestion.fromAi,
    fuente: useAi ? "ia" : "reglas",
    pending: input.saved?.pending === true,
    viewerName: input.viewerName,
  };
}

function visibleSuggestion(
  saved: SavedAnalysis | null,
  candidate: AnalysisSuggestion | null,
): { suggestion: AnalysisSuggestion | null; fromAi: boolean } {
  if (!candidate) return { suggestion: null, fromAi: false };
  if (saved && (saved.sugerenciaEstado === "aceptada" || saved.sugerenciaEstado === "descartada")) {
    return { suggestion: null, fromAi: false };
  }
  return { suggestion: candidate, fromAi: saved?.fuente === "ia" };
}

function eventTime(event: StoredEvent): number {
  const time = Date.parse(event.createdAt);
  return Number.isNaN(time) ? 0 : time;
}
