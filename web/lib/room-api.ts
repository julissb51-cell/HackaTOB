import { buildContext } from "./context-from-events";
import { parseEvent } from "./event-body";
import { json, optionsResponse } from "./http";
import { RoomStoreError } from "./room-store-error";
import type { RoomStore, StoredEvent } from "./room-types";
import { tokensMatch } from "./tokens";

export { optionsResponse };

const UNAUTHORIZED = { error: "no autorizado" };

export async function postEvent(request: Request, roomId: string, store: RoomStore): Promise<Response> {
  const room = await readRoom(request, roomId, store);
  if (room instanceof Response) return room;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(request, { error: "cuerpo ilegible" }, 400);
  }

  const parsed = parseEvent(payload);
  if (!parsed.ok) return json(request, { error: parsed.error }, 400);

  const event: StoredEvent = {
    eventId: parsed.event.eventId,
    roomId,
    member: parsed.event.member,
    ai: parsed.event.ai,
    type: parsed.event.type,
    conversationId: parsed.event.conversationId,
    conversationName: parsed.event.conversationName,
    text: parsed.event.text,
    createdAt: parsed.event.createdAt,
  };

  try {
    await store.insertEvent(event);
    await store.ensureMember(roomId, event.member, parsed.event.suggestedPart);
  } catch (error) {
    return failure(request, error, "no se pudo guardar");
  }

  return json(request, { ok: true }, 200);
}

export async function getRoomContext(request: Request, roomId: string, store: RoomStore): Promise<Response> {
  const room = await readRoom(request, roomId, store);
  if (room instanceof Response) return room;

  const member = new URL(request.url).searchParams.get("member")?.trim() ?? "";
  if (!member) return json(request, { error: "falta member" }, 400);
  if (member.length > 120 || /[\u0000-\u001F\u007F]/.test(member)) {
    return json(request, { error: "member no válido" }, 400);
  }

  try {
    const [members, events] = await Promise.all([store.listMembers(roomId), store.listEvents(roomId)]);
    return json(
      request,
      buildContext({
        room: {
          id: room.id,
          topic: room.topic,
          projectName: room.projectName,
          dueDate: room.dueDate,
        },
        members,
        events,
        member,
      }),
      200,
    );
  } catch (error) {
    return failure(request, error, "no se pudo leer la sala");
  }
}

async function readRoom(request: Request, roomId: string, store: RoomStore) {
  let room;
  try {
    room = await store.getRoom(roomId);
  } catch (error) {
    return failure(request, error, "no se pudo leer la sala");
  }

  const provided = headerToken(request);
  if (!room || !provided || !tokensMatch(room.token, provided)) {
    return json(request, UNAUTHORIZED, 401);
  }
  return room;
}

function headerToken(request: Request): string {
  const value = request.headers.get("x-room-token");
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return "";
  return trimmed;
}

function failure(request: Request, error: unknown, fallback: string): Response {
  if (error instanceof RoomStoreError) {
    return json(request, { error: error.message }, error.status);
  }
  console.error(fallback, error instanceof Error ? error.name : "error");
  return json(request, { error: fallback }, 500);
}
