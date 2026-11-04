import "server-only";
import { readSavedAnalysis } from "./analysis-db";
import { listRoomFiles, publicFile, saveDetectedLinks } from "./room-files-db";
import { createSupabaseServiceClient } from "./supabase/server";
import { RoomStoreError } from "./room-store-error";
import { isAiName, isEventType, type RoomRecord, type RoomStore, type SavedAnalysis, type StoredEvent } from "./room-types";

const EVENT_COLUMNS =
  "event_id, room_id, member, ai, type, conversation_id, conversation_name, text, created_at";

type RoomRow = {
  id: string;
  token: string;
  topic: string;
  project_name: string | null;
  due_date: string | null;
};

type MemberRow = {
  id: string;
  name: string;
  part: string | null;
};

type EventRow = {
  event_id: string;
  room_id: string;
  member: string;
  ai: string;
  type: string;
  conversation_id: string;
  conversation_name: string | null;
  text: string;
  created_at: string;
};

export const supabaseRoomStore: RoomStore = {
  getRoom,
  insertEvent,
  ensureMember,
  listMembers,
  listEvents,
  readAnalysis,
  saveDetectedLinks,
  listFiles: async (roomId) => (await listRoomFiles(roomId, 20)).map(publicFile),
};

async function getRoom(id: string): Promise<RoomRecord | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, token, topic, project_name, due_date")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("rooms.select", error.code);
    throw new RoomStoreError("no se pudo leer la sala", 500);
  }
  if (!data) return null;
  const row = data as RoomRow;
  return {
    id: row.id,
    token: row.token,
    topic: row.topic,
    projectName: row.project_name,
    dueDate: row.due_date,
  };
}

async function insertEvent(event: StoredEvent): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("events").insert({
    event_id: event.eventId,
    room_id: event.roomId,
    member: event.member,
    ai: event.ai,
    type: event.type,
    conversation_id: event.conversationId,
    conversation_name: event.conversationName,
    text: event.text,
    created_at: event.createdAt,
  });
  if (!error) return;

  if (error.code === "23505") {
    const existing = await supabase.from("events").select("room_id").eq("event_id", event.eventId).maybeSingle();
    if (existing.error || !existing.data) {
      console.error("events.select", existing.error?.code ?? "sin fila");
      throw new RoomStoreError("no se pudo guardar", 500);
    }
    const row = existing.data as { room_id: string };
    if (row.room_id === event.roomId) return;
    throw new RoomStoreError("evento repetido", 409);
  }

  console.error("events.insert", error.code);
  if (error.code === "23514" || error.code === "22P02" || error.code === "23503") {
    throw new RoomStoreError("evento no válido", 400);
  }
  throw new RoomStoreError("no se pudo guardar", 500);
}

async function ensureMember(roomId: string, name: string, suggestedPart: string | null): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, part")
    .eq("room_id", roomId)
    .eq("name", name)
    .limit(1);
  if (error) {
    console.error("members.select", error.code);
    throw new RoomStoreError("no se pudo guardar", 500);
  }

  const existing = ((data ?? []) as Pick<MemberRow, "id" | "part">[])[0];
  if (!existing) {
    const inserted = await supabase.from("members").insert({
      room_id: roomId,
      name,
      part: suggestedPart,
    });
    if (inserted.error) {
      console.error("members.insert", inserted.error.code);
      throw new RoomStoreError("no se pudo guardar", 500);
    }
    return;
  }

  if (!existing.part && suggestedPart) {
    const updated = await supabase.from("members").update({ part: suggestedPart }).eq("id", existing.id);
    if (updated.error) {
      console.error("members.update", updated.error.code);
      throw new RoomStoreError("no se pudo guardar", 500);
    }
  }
}

async function listMembers(roomId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("members").select("name, part").eq("room_id", roomId);
  if (error) {
    console.error("members.list", error.code);
    throw new RoomStoreError("no se pudo leer la sala", 500);
  }
  return ((data ?? []) as Pick<MemberRow, "name" | "part">[]).map((row) => ({
    name: row.name,
    part: row.part,
  }));
}

async function listEvents(roomId: string): Promise<StoredEvent[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("events.list", error.code);
    throw new RoomStoreError("no se pudo leer la sala", 500);
  }

  const events: StoredEvent[] = [];
  for (const row of (data ?? []) as EventRow[]) {
    if (!isAiName(row.ai) || !isEventType(row.type)) continue;
    events.push({
      eventId: row.event_id,
      roomId: row.room_id,
      member: row.member,
      ai: row.ai,
      type: row.type,
      conversationId: row.conversation_id,
      conversationName: row.conversation_name,
      text: row.text,
      createdAt: row.created_at,
    });
  }
  return events;
}

async function readAnalysis(roomId: string): Promise<SavedAnalysis | null> {
  return readSavedAnalysis(roomId);
}
