import { isCaptureAi, isEventType, type AiName, type EventType } from "./room-types";

export const TEXT_LIMIT = 100_000;

const LOCAL_TIME =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$/;
const EVENT_ID = /^[A-Za-z0-9_-]{1,200}$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export type ParsedEvent = {
  eventId: string;
  member: string;
  ai: AiName;
  type: EventType;
  conversationId: string;
  conversationName: string | null;
  text: string;
  createdAt: string;
  suggestedPart: string | null;
};

export function parseEvent(body: unknown): { ok: true; event: ParsedEvent } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "cuerpo no válido" };
  }
  const record = body as Record<string, unknown>;

  const eventId = requiredToken(pick(record, ["event_id"]), "falta event_id", "event_id no válido");
  if (!eventId.ok) return eventId;
  if (!EVENT_ID.test(eventId.value)) return { ok: false, error: "event_id no válido" };

  const type = requiredChoice(
    pick(record, ["tipo", "type"]),
    "falta tipo",
    "tipo no válido",
    isEventType,
  );
  if (!type.ok) return type;

  const member = requiredName(pick(record, ["miembro", "member"]), "falta miembro", "miembro no válido");
  if (!member.ok) return member;

  const ai = requiredChoice(pick(record, ["ia", "ai"]), "falta ia", "ia no válida", isCaptureAi);
  if (!ai.ok) return ai;

  const conversationId = requiredPlain(
    pick(record, ["conversation_id"]),
    "falta conversation_id",
    "conversation_id no válido",
    500,
  );
  if (!conversationId.ok) return conversationId;

  const text = requiredText(pick(record, ["texto", "text"]));
  if (!text.ok) return text;

  const createdAt = requiredPlain(pick(record, ["tiempo", "created_at"]), "falta tiempo", "tiempo no válido", 40);
  if (!createdAt.ok) return createdAt;
  if (!LOCAL_TIME.test(createdAt.value)) return { ok: false, error: "tiempo no válido" };

  const conversationName = optionalString(
    pick(record, ["nombre_chat", "conversation_name"]),
    "nombre_chat no válido",
    "nombre_chat demasiado largo",
    200,
  );
  if (!conversationName.ok) return conversationName;

  const project = optionalString(pick(record, ["proyecto", "project"]), "proyecto no válido", "proyecto demasiado largo", 200);
  if (!project.ok) return project;

  const summary = optionalString(pick(record, ["resumen"]), "resumen no válido", "resumen demasiado largo", 2000);
  if (!summary.ok) return summary;

  const keyword = optionalString(
    pick(record, ["palabra_clave"]),
    "palabra_clave no válida",
    "palabra_clave demasiado larga",
    80,
  );
  if (!keyword.ok) return keyword;

  return {
    ok: true,
    event: {
      eventId: eventId.value,
      member: member.value,
      ai: ai.value,
      type: type.value,
      conversationId: conversationId.value,
      conversationName: conversationName.value,
      text: text.value,
      createdAt: createdAt.value,
      suggestedPart: conversationName.value,
    },
  };
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  }
  return undefined;
}

function requiredToken(
  value: unknown,
  missing: string,
  invalid: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (value === undefined) return { ok: false, error: missing };
  if (typeof value !== "string") return { ok: false, error: invalid };
  const trimmed = value.trim();
  if (!trimmed || CONTROL.test(trimmed)) return { ok: false, error: invalid };
  return { ok: true, value: trimmed };
}

function requiredName(
  value: unknown,
  missing: string,
  invalid: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const parsed = requiredToken(value, missing, invalid);
  if (!parsed.ok) return parsed;
  if (parsed.value.length > 120) return { ok: false, error: invalid };
  return parsed;
}

function requiredPlain(
  value: unknown,
  missing: string,
  invalid: string,
  max: number,
): { ok: true; value: string } | { ok: false; error: string } {
  const parsed = requiredToken(value, missing, invalid);
  if (!parsed.ok) return parsed;
  if (parsed.value.length > max) return { ok: false, error: invalid };
  return parsed;
}

function requiredChoice<T extends string>(
  value: unknown,
  missing: string,
  invalid: string,
  check: (value: string) => value is T,
): { ok: true; value: T } | { ok: false; error: string } {
  if (value === undefined) return { ok: false, error: missing };
  if (typeof value !== "string" || !check(value.trim())) return { ok: false, error: invalid };
  return { ok: true, value: value.trim() as T };
}

function requiredText(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (value === undefined) return { ok: false, error: "falta texto" };
  if (typeof value !== "string" || CONTROL.test(value)) return { ok: false, error: "texto no válido" };
  if (exceedsTextLimit(value)) return { ok: false, error: "texto demasiado largo" };
  return { ok: true, value };
}

function optionalString(
  value: unknown,
  invalid: string,
  tooLong: string,
  max: number,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string" || CONTROL.test(value)) return { ok: false, error: invalid };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > max) return { ok: false, error: tooLong };
  return { ok: true, value: trimmed };
}

function exceedsTextLimit(value: string): boolean {
  if (value.length <= TEXT_LIMIT) return false;
  if (value.length > TEXT_LIMIT * 2) return true;
  return [...value].length > TEXT_LIMIT;
}
