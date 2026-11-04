import type { RoomProgress } from "./progress";

export const AI_NAMES = ["chatgpt", "gemini", "cursor", "claude", "copilot"] as const;
export const EVENT_TYPES = ["prompt", "respuesta", "archivo"] as const;

export type AiName = (typeof AI_NAMES)[number];
export type EventType = (typeof EVENT_TYPES)[number];

export function isAiName(value: string): value is AiName {
  return (AI_NAMES as readonly string[]).includes(value);
}

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

export type RoomRecord = {
  id: string;
  token: string;
  topic: string;
  projectName: string | null;
  dueDate: string | null;
};

export type RoomInfo = {
  id: string;
  topic: string;
  projectName: string | null;
  dueDate: string | null;
};

export type MemberRecord = {
  name: string;
  part: string | null;
};

export type StoredEvent = {
  eventId: string;
  roomId: string;
  member: string;
  ai: AiName;
  type: EventType;
  conversationId: string;
  conversationName: string | null;
  text: string;
  createdAt: string;
};

export type WarningType = "falta" | "contradiccion" | "duplicado";

export type WarningPriority = "urgente" | "pronto" | "puede_esperar";

export type RoomWarning = {
  tipo: WarningType;
  mensaje: string;
  destinatario: string;
  partes: string[];
  prompt_sugerido: string;
  /** Opcional: urgente, pronto o puede_esperar. */
  prioridad?: WarningPriority;
};

export type ContextResponse = {
  resumen: string;
  parte: string;
  prompt_sugerido: string;
  advertencias: RoomWarning[];
};

export type AnalysisMember = {
  nombre: string;
  resumen: string;
  parte: string;
  prompt_sugerido: string;
  advertencias: RoomWarning[];
};

export type AnalysisChat = {
  conversationId: string;
  nombre: string;
};

export type AnalysisSuggestion = {
  partes: string[];
  fecha: string | null;
  asignaciones: { nombre: string; parte: string }[];
};

export type SuggestionStatus = "ninguna" | "pendiente" | "aceptada" | "descartada";

export type SavedAnalysis = {
  fuente: "ia" | "reglas";
  resumen: string;
  miembros: AnalysisMember[];
  alertas: RoomWarning[];
  chats: AnalysisChat[];
  sugerencia: AnalysisSuggestion | null;
  sugerenciaEstado: SuggestionStatus;
  consejo: string;
  idioma: "es" | "en";
  pending: boolean;
  ranAt: string;
  avance?: RoomProgress | null;
};

export type RoomStore = {
  getRoom(id: string): Promise<RoomRecord | null>;
  insertEvent(event: StoredEvent): Promise<void>;
  ensureMember(roomId: string, name: string, suggestedPart: string | null): Promise<void>;
  listMembers(roomId: string): Promise<MemberRecord[]>;
  listEvents(roomId: string): Promise<StoredEvent[]>;
  readAnalysis?(roomId: string): Promise<SavedAnalysis | null>;
};
