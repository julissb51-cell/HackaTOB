"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setSuggestionStatus } from "./analysis-db";
import { loadRoomBoard } from "./board";
import { currentAccount } from "./current-account";
import { sortEventsNewestFirst } from "./room-feed";
import { createRoomFor, joinRoomFor, readRoomForMember } from "./room-membership";
import { supabaseMembershipStore } from "./room-membership-db";
import { acceptSuggestionFor, saveSettings, setRoomToken } from "./room-settings";
import { supabaseRoomStore } from "./room-store";
import {
  NO_DATE,
  isInviteToken,
  parseCustomToken,
  parseDueDate,
  parseMemberPart,
  parseParts,
  parseRoomId,
  parseRoomLanguage,
  parseTopic,
  type CreateState,
  type JoinState,
} from "./room-fields";
import type { RoomBoard } from "./board-view";
import type { StoredEvent } from "./room-types";
import { rememberRoomToken } from "./room-token-cookie";
import { createRoomToken } from "./room-token";
import { scheduleRoomAnalysis } from "./run-analysis";
import { isProtectedRoom } from "./room-protection";
import { createSupabaseServiceClient } from "./supabase/server";

export type SettingsState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "recent" }
  | { status: "error"; code: "topic" | "parts" | "date" | "id" | "token" | "auth" | "taken" | "forbidden" | "save" };

export async function createRoomAction(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const account = await currentAccount();
  if (!account) return { status: "error", code: "auth" };

  const topic = parseTopic(String(formData.get("topic") ?? ""));
  if (!topic) return { status: "error", code: "topic" };

  try {
    const created = await createRoomFor(supabaseMembershipStore, account, { topic });
    if (!created.ok) return { status: "error", code: created.code };
    await rememberRoomToken(created.id, created.token);
    return { status: "created", id: created.id, token: created.token, path: created.path };
  } catch {
    return { status: "error", code: "save" };
  }
}

const UNTITLED_ROOM = { es: "Sala sin título", en: "Untitled room" } as const;

/** "Nueva sala": crea la sala al instante con un nombre por defecto y la abre. */
export async function quickCreateRoomAction(formData: FormData): Promise<void> {
  const account = await currentAccount();
  if (!account) redirect("/auth/login?next=/rooms");
  const lang = formData.get("lang") === "en" ? "en" : "es";
  let id: string | null = null;
  try {
    const created = await createRoomFor(supabaseMembershipStore, account, { topic: UNTITLED_ROOM[lang] });
    if (created.ok) {
      await rememberRoomToken(created.id, created.token);
      id = created.id;
    }
  } catch {
    id = null;
  }
  redirect(id ? `/rooms/${id}?nueva=1` : "/rooms?error=create");
}

/** Cambia solo el título de la sala (edición en línea). */
export async function renameTopicAction(roomId: string, rawTopic: string): Promise<{ ok: boolean; topic?: string }> {
  const account = await currentAccount();
  if (!account) return { ok: false };
  const id = parseRoomId(roomId);
  const topic = parseTopic(rawTopic);
  if (!id || !topic) return { ok: false };
  try {
    const access = await readRoomForMember(supabaseMembershipStore, account.id, id);
    if (!access.ok) return { ok: false };
    await supabaseMembershipStore.updateRoom(id, { topic });
  } catch {
    return { ok: false };
  }
  revalidatePath(`/rooms/${id}`);
  return { ok: true, topic };
}

export async function readRoomSnapshotAction(
  roomId: string,
): Promise<{ ok: true; events: StoredEvent[]; members: { name: string; part: string | null }[] } | { ok: false }> {
  const id = parseRoomId(roomId);
  if (!id) return { ok: false };
  const account = await currentAccount();
  if (!account) return { ok: false };
  try {
    const view = await readRoomForMember(supabaseMembershipStore, account.id, id);
    if (!view.ok) return { ok: false };
    const events = sortEventsNewestFirst(await supabaseRoomStore.listEvents(id));
    return {
      ok: true,
      events,
      members: view.members.map((member) => ({ name: member.name, part: member.part })),
    };
  } catch {
    return { ok: false };
  }
}

export async function readRoomBoardAction(roomId: string): Promise<{ ok: true; board: RoomBoard } | { ok: false }> {
  const id = parseRoomId(roomId);
  if (!id) return { ok: false };
  const account = await currentAccount();
  if (!account) return { ok: false };
  try {
    const view = await readRoomForMember(supabaseMembershipStore, account.id, id);
    if (!view.ok) return { ok: false };
    return { ok: true, board: await loadRoomBoard(account, view.room, view.members) };
  } catch {
    return { ok: false };
  }
}

export async function joinInviteAction(roomId: string, token: string): Promise<JoinState> {
  const id = parseRoomId(roomId);
  if (!id || !isInviteToken(token)) return { ok: false, code: "link" };
  const account = await currentAccount();
  if (!account) return { ok: false, code: "auth" };
  try {
    const joined = await joinRoomFor(supabaseMembershipStore, account, id, token);
    if (!joined.ok) return joined;
    await rememberRoomToken(id, token);
    return { ok: true };
  } catch {
    return { ok: false, code: "save" };
  }
}

export async function saveSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const account = await currentAccount();
  if (!account) return { status: "error", code: "auth" };
  const roomId = parseRoomId(String(formData.get("room_id") ?? ""));
  if (!roomId) return { status: "error", code: "id" };
  const topic = parseTopic(String(formData.get("topic") ?? ""));
  if (!topic) return { status: "error", code: "topic" };
  const parts = parseParts(strings(formData, "parts"));
  if (!parts) return { status: "error", code: "parts" };

  const noDate = formData.get("sin_fecha") === "on";
  const rawDate = String(formData.get("date") ?? "").trim();
  let dueDate: string | null;
  if (noDate) dueDate = NO_DATE;
  else if (!rawDate) dueDate = null;
  else {
    const parsed = parseDueDate(rawDate, false);
    if (!parsed) return { status: "error", code: "date" };
    dueDate = parsed;
  }

  const language = parseRoomLanguage(String(formData.get("language") ?? "es"));
  const rawNext = String(formData.get("next_id") ?? "").trim();
  const nextId = rawNext ? parseRoomId(rawNext) : null;
  if (rawNext && !nextId) return { status: "error", code: "id" };

  const names = strings(formData, "member_name");
  const memberPartValues = strings(formData, "member_part");
  const memberParts: { name: string; part: string | null }[] = [];
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index]?.trim() ?? "";
    if (!name) continue;
    const part = parseMemberPart(memberPartValues[index] ?? "");
    if (part === "invalid") return { status: "error", code: "parts" };
    memberParts.push({ name, part });
  }

  let saved;
  try {
    saved = await saveSettings(supabaseMembershipStore, account.id, roomId, {
      topic,
      parts,
      dueDate,
      language,
      nextId,
      memberParts,
    });
  } catch {
    return { status: "error", code: "save" };
  }
  if (!saved.ok) return { status: "error", code: saved.code === "missing" ? "forbidden" : saved.code };
  if (saved.id !== roomId) {
    await rememberRoomToken(saved.id, saved.token);
    redirect(`/rooms/${saved.id}`);
  }
  revalidatePath(`/rooms/${saved.id}`);
  return { status: "saved" };
}

export async function regenerateTokenAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  return writeToken(formData, createRoomToken());
}

export async function customTokenAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const token = parseCustomToken(String(formData.get("custom_token") ?? ""));
  if (!token) return { status: "error", code: "token" };
  return writeToken(formData, token);
}

export async function acceptSuggestionAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const ready = await memberRoom(formData);
  if (!ready.ok) return ready.state;
  const access = await readRoomForMember(supabaseMembershipStore, ready.account.id, ready.roomId);
  if (!access.ok) return { status: "error", code: access.code === "save" ? "save" : "forbidden" };
  let suggestion;
  try {
    const board = await loadRoomBoard({ id: ready.account.id, name: access.members.find((member) => member.userId === ready.account.id)?.name ?? "" }, access.room, access.members);
    suggestion = board.suggestion;
  } catch {
    return { status: "error", code: "save" };
  }
  if (!suggestion) return { status: "error", code: "save" };
  const accepted = await acceptSuggestionFor(supabaseMembershipStore, ready.account.id, ready.roomId, suggestion);
  if (!accepted.ok) return { status: "error", code: accepted.code === "missing" ? "forbidden" : accepted.code };
  await setSuggestionStatus(ready.roomId, "aceptada");
  revalidatePath(`/rooms/${ready.roomId}`);
  return { status: "saved" };
}

export async function dismissSuggestionAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const ready = await memberRoom(formData);
  if (!ready.ok) return ready.state;
  await setSuggestionStatus(ready.roomId, "descartada");
  revalidatePath(`/rooms/${ready.roomId}`);
  return { status: "saved" };
}

export async function analyzeNowAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const ready = await memberRoom(formData);
  if (!ready.ok) return ready.state;
  const outcome = await scheduleRoomAnalysis(ready.roomId, { force: true });
  if (outcome === "failed") return { status: "error", code: "save" };
  revalidatePath(`/rooms/${ready.roomId}`);
  if (outcome === "recent") return { status: "recent" };
  return { status: "saved" };
}

async function writeToken(formData: FormData, token: string): Promise<SettingsState> {
  const ready = await memberRoom(formData);
  if (!ready.ok) return ready.state;
  const saved = await setRoomToken(supabaseMembershipStore, ready.account.id, ready.roomId, token);
  if (!saved.ok) return { status: "error", code: saved.code === "missing" ? "forbidden" : saved.code };
  await rememberRoomToken(ready.roomId, token);
  revalidatePath(`/rooms/${ready.roomId}`);
  return { status: "saved" };
}

async function memberRoom(formData: FormData): Promise<
  | { ok: true; account: { id: string }; roomId: string }
  | { ok: false; state: SettingsState }
> {
  const account = await currentAccount();
  if (!account) return { ok: false, state: { status: "error", code: "auth" } };
  const roomId = parseRoomId(String(formData.get("room_id") ?? ""));
  if (!roomId) return { ok: false, state: { status: "error", code: "id" } };
  const access = await readRoomForMember(supabaseMembershipStore, account.id, roomId);
  if (!access.ok) return { ok: false, state: { status: "error", code: access.code === "save" ? "save" : "forbidden" } };
  return { ok: true, account, roomId };
}

function strings(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}

/** Borra la sala (y por cascada sus eventos, análisis y miembros). Solo quien la creó; nunca las demo. */
export async function deleteRoomAction(roomId: string): Promise<{ ok: boolean; code?: "auth" | "forbidden" | "protected" | "save" }> {
  const account = await currentAccount();
  if (!account) return { ok: false, code: "auth" };
  const id = parseRoomId(roomId);
  if (!id) return { ok: false, code: "forbidden" };
  if (isProtectedRoom(id)) return { ok: false, code: "protected" };
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.from("rooms").delete().eq("id", id).eq("created_by", account.id).select("id");
    if (error) return { ok: false, code: "save" };
    if (!data || data.length === 0) return { ok: false, code: "forbidden" };
  } catch {
    return { ok: false, code: "save" };
  }
  revalidatePath("/rooms");
  return { ok: true };
}

/** Quita a la persona de una sala ajena (no borra nada más). */
export async function leaveRoomAction(roomId: string): Promise<{ ok: boolean }> {
  const account = await currentAccount();
  if (!account) return { ok: false };
  const id = parseRoomId(roomId);
  if (!id) return { ok: false };
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("members").delete().eq("room_id", id).eq("user_id", account.id);
    if (error) return { ok: false };
  } catch {
    return { ok: false };
  }
  revalidatePath("/rooms");
  return { ok: true };
}
