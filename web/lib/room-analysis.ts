import { buildContext } from "./context-from-events";
import type { ContextResponse, MemberRecord, RoomInfo, StoredEvent } from "./room-types";

/**
 * Contexto de reglas, el mismo que GET /api/rooms/:id/context sin analista.
 * La sala lo usa cuando todavía no hay un análisis de Gemini o Grok.
 */
export function previewMemberContext(input: {
  room: RoomInfo;
  members: MemberRecord[];
  events: StoredEvent[];
  member: string;
}): ContextResponse {
  return buildContext(input);
}
