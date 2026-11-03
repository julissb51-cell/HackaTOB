import "server-only";
import { createSupabaseServiceClient } from "./supabase/server";

export type UserRoom = {
  id: string;
  topic: string;
  token: string;
  createdAt: string;
  lastActivity: string;
  members: number;
  events: number;
  owner: boolean;
};

/** Salas que la persona creó o a las que se unió, la más reciente primero. */
export async function listUserRooms(userId: string): Promise<UserRoom[]> {
  const supabase = createSupabaseServiceClient();
  const [mine, created] = await Promise.all([
    supabase.from("members").select("room_id").eq("user_id", userId),
    supabase.from("rooms").select("id").eq("created_by", userId),
  ]);
  if (mine.error || created.error) throw new Error("rooms.list");
  const ids = [
    ...new Set([
      ...((mine.data ?? []) as { room_id: string }[]).map((row) => row.room_id),
      ...((created.data ?? []) as { id: string }[]).map((row) => row.id),
    ]),
  ];
  if (ids.length === 0) return [];

  const [rooms, members, events] = await Promise.all([
    supabase.from("rooms").select("id, topic, token, created_at, created_by").in("id", ids),
    supabase.from("members").select("room_id").in("room_id", ids),
    supabase.from("events").select("room_id, created_at").in("room_id", ids).order("created_at", { ascending: false }).limit(5000),
  ]);
  if (rooms.error || members.error || events.error) throw new Error("rooms.list");

  const memberCount = new Map<string, number>();
  for (const row of (members.data ?? []) as { room_id: string }[]) {
    memberCount.set(row.room_id, (memberCount.get(row.room_id) ?? 0) + 1);
  }
  const eventCount = new Map<string, number>();
  const lastEvent = new Map<string, string>();
  for (const row of (events.data ?? []) as { room_id: string; created_at: string }[]) {
    eventCount.set(row.room_id, (eventCount.get(row.room_id) ?? 0) + 1);
    if (!lastEvent.has(row.room_id)) lastEvent.set(row.room_id, row.created_at);
  }

  type Row = { id: string; topic: string; token: string; created_at: string; created_by: string | null };
  return ((rooms.data ?? []) as Row[])
    .map((row) => ({
      id: row.id,
      topic: row.topic,
      token: row.token,
      createdAt: row.created_at,
      lastActivity: lastEvent.get(row.id) ?? row.created_at,
      members: memberCount.get(row.id) ?? 0,
      events: eventCount.get(row.id) ?? 0,
      owner: row.created_by === userId,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
