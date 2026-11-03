"use server";

import { currentAccount } from "./current-account";
import { createRoomFor, joinRoomFor } from "./room-membership";
import { supabaseMembershipStore } from "./room-membership-db";
import {
  isInviteToken,
  parseDueDate,
  parseParts,
  parseRoomId,
  parseTopic,
  type CreateState,
  type JoinState,
} from "./room-fields";
import { rememberRoomToken } from "./room-token-cookie";

export async function createRoomAction(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const account = await currentAccount();
  if (!account) return { status: "error", code: "auth" };

  const topic = parseTopic(String(formData.get("topic") ?? ""));
  if (!topic) return { status: "error", code: "topic" };
  const parts = parseParts(formData.getAll("parts").filter((value): value is string => typeof value === "string"));
  if (!parts) return { status: "error", code: "parts" };
  const dueDate = parseDueDate(String(formData.get("date") ?? ""), formData.get("sin_fecha") === "on");
  if (!dueDate) return { status: "error", code: "date" };

  const rawId = String(formData.get("room_id") ?? "").trim();
  const roomId = rawId ? parseRoomId(rawId) : null;
  if (rawId && !roomId) return { status: "error", code: "id" };

  try {
    const created = await createRoomFor(supabaseMembershipStore, account, { topic, parts, dueDate, roomId });
    if (!created.ok) return { status: "error", code: created.code };
    await rememberRoomToken(created.id, created.token);
    return { status: "created", id: created.id, token: created.token, path: created.path };
  } catch {
    return { status: "error", code: "save" };
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
