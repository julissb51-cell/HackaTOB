import { buildContext } from "./context-from-events";
import type { ContextResponse, MemberRecord, RoomInfo, StoredEvent } from "./room-types";

/**
 * Contexto que ve el miembro dentro de la sala.
 * Hoy devuelve lo mismo que GET /api/rooms/:id/context.
 * Fase 5: sustituir el cuerpo por el analista de lib/ai.ts (Gemini o Grok),
 * llamado desde el servidor. La firma se queda.
 */
export function previewMemberContext(input: {
  room: RoomInfo;
  members: MemberRecord[];
  events: StoredEvent[];
  member: string;
}): ContextResponse {
  return buildContext(input);
}
