import "server-only";
import { createSupabaseServiceClient } from "./supabase/server";
import { MembershipError, type MembershipStore, type MemberRow, type StoredRoom } from "./room-membership";

type RoomRow = {
  id: string;
  token: string;
  topic: string;
  due_date: string | null;
  parts: unknown;
  created_by: string | null;
  language: string | null;
};

type MemberDbRow = {
  id: string;
  name: string;
  part: string | null;
  user_id: string | null;
};

export const supabaseMembershipStore: MembershipStore = {
  getRoom,
  insertRoom,
  updateRoom,
  renameRoom,
  setMemberPart,
  deleteRoom,
  listMembers,
  insertMember,
  claimMember,
};

async function getRoom(id: string): Promise<StoredRoom | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, token, topic, due_date, parts, created_by, language")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("rooms.select", error.code);
    throw new MembershipError("save");
  }
  if (!data) return null;
  const row = data as RoomRow;
  return {
    id: row.id,
    token: row.token,
    topic: row.topic,
    dueDate: row.due_date,
    parts: readParts(row.parts),
    createdBy: row.created_by,
    language: row.language === "en" ? "en" : "es",
  };
}

async function insertRoom(room: {
  id: string;
  token: string;
  topic: string;
  dueDate: string | null;
  parts: string[];
  createdBy: string;
  language: "es" | "en";
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("rooms").insert({
    id: room.id,
    token: room.token,
    topic: room.topic,
    due_date: room.dueDate,
    parts: room.parts,
    created_by: room.createdBy,
    language: room.language,
  });
  if (!error) return;
  console.error("rooms.insert", error.code);
  if (error.code === "23505") throw new MembershipError("taken");
  if (error.code === "23514") throw new MembershipError("invalid");
  throw new MembershipError("save");
}

async function updateRoom(id: string, patch: {
  topic?: string;
  dueDate?: string | null;
  parts?: string[];
  language?: "es" | "en";
  token?: string;
}): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.topic !== undefined) row.topic = patch.topic;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.parts !== undefined) row.parts = patch.parts;
  if (patch.language !== undefined) row.language = patch.language;
  if (patch.token !== undefined) row.token = patch.token;
  if (Object.keys(row).length === 0) return;
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("rooms").update(row).eq("id", id);
  if (!error) return;
  console.error("rooms.update", error.code);
  if (error.code === "23505") throw new MembershipError("taken");
  if (error.code === "23514") throw new MembershipError("invalid");
  throw new MembershipError("save");
}

async function renameRoom(id: string, nextId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("rooms").update({ id: nextId }).eq("id", id);
  if (!error) return;
  console.error("rooms.rename", error.code);
  if (error.code === "23505") throw new MembershipError("taken");
  if (error.code === "23514") throw new MembershipError("invalid");
  throw new MembershipError("save");
}

async function setMemberPart(roomId: string, name: string, part: string | null): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("members").update({ part }).eq("room_id", roomId).eq("name", name);
  if (!error) return;
  console.error("members.part", error.code);
  throw new MembershipError("save");
}

async function deleteRoom(id: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) {
    console.error("rooms.delete", error.code);
    throw new MembershipError("save");
  }
}

async function listMembers(roomId: string): Promise<MemberRow[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, name, part, user_id")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("members.list", error.code);
    throw new MembershipError("save");
  }
  return ((data ?? []) as MemberDbRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    part: row.part,
    userId: row.user_id,
  }));
}

async function insertMember(member: { roomId: string; name: string; userId: string; part: string | null }): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("members").insert({
    room_id: member.roomId,
    name: member.name,
    part: member.part,
    user_id: member.userId,
  });
  if (!error) return;
  console.error("members.insert", error.code);
  if (error.code === "23505") throw new MembershipError("taken");
  throw new MembershipError("save");
}

async function claimMember(memberId: string, userId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("members")
    .update({ user_id: userId })
    .eq("id", memberId)
    .is("user_id", null)
    .select("id");
  if (error) {
    console.error("members.claim", error.code);
    throw new MembershipError("save");
  }
  return ((data ?? []) as { id: string }[]).length > 0;
}

function readParts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const parts: string[] = [];
  for (const item of value) {
    if (typeof item === "string") parts.push(item);
  }
  return parts;
}
