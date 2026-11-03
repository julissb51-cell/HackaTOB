import { tokensMatch } from "./tokens";
import {
  NO_DATE,
  invitePath,
  isInviteToken,
  isUserId,
  parseDueDate,
  parseParts,
  parseRoomId,
  parseTopic,
  type CreateErrorCode,
} from "./room-fields";
import { createRoomToken, generateRoomId } from "./room-token";

export class MembershipError extends Error {
  constructor(readonly code: "taken" | "invalid" | "save") {
    super(code);
  }
}

export type Account = { id: string; name: string };

export type MemberRow = {
  id: string;
  name: string;
  part: string | null;
  userId: string | null;
};

export type StoredRoom = {
  id: string;
  token: string;
  topic: string;
  dueDate: string | null;
  parts: string[];
  createdBy: string | null;
  language: "es" | "en";
};

export type RoomUpdate = {
  topic?: string;
  dueDate?: string | null;
  parts?: string[];
  language?: "es" | "en";
  token?: string;
};

export type MembershipStore = {
  getRoom(id: string): Promise<StoredRoom | null>;
  insertRoom(room: {
    id: string;
    token: string;
    topic: string;
    dueDate: string | null;
    parts: string[];
    createdBy: string;
    language: "es" | "en";
  }): Promise<void>;
  updateRoom(id: string, patch: RoomUpdate): Promise<void>;
  renameRoom(id: string, nextId: string): Promise<void>;
  setMemberPart(roomId: string, name: string, part: string | null): Promise<void>;
  deleteRoom(id: string): Promise<void>;
  listMembers(roomId: string): Promise<MemberRow[]>;
  insertMember(member: { roomId: string; name: string; userId: string; part: string | null }): Promise<void>;
  claimMember(memberId: string, userId: string): Promise<boolean>;
};

export type MemberPlacement =
  | { kind: "already" }
  | { kind: "claim"; memberId: string }
  | { kind: "insert"; name: string };

export function memberPlacement(members: readonly MemberRow[], account: Account): MemberPlacement {
  if (members.some((member) => member.userId === account.id)) return { kind: "already" };
  const sameName = members.filter((member) => member.name === account.name);
  if (sameName.length === 1 && sameName[0]?.userId === null) {
    return { kind: "claim", memberId: sameName[0].id };
  }
  if (sameName.length === 0) return { kind: "insert", name: account.name };
  const taken = new Set(members.map((member) => member.name));
  for (let n = 2; n <= 50; n += 1) {
    const suffix = ` ${n}`;
    const name = `${account.name.slice(0, 80 - suffix.length)}${suffix}`;
    if (!taken.has(name)) return { kind: "insert", name };
  }
  return { kind: "insert", name: `${account.id.slice(0, 8)}` };
}

export async function createRoomFor(
  store: MembershipStore,
  account: Account,
  input: { topic: string; parts?: readonly string[]; dueDate?: string | null; roomId?: string | null },
): Promise<{ ok: true; id: string; token: string; path: string } | { ok: false; code: CreateErrorCode }> {
  if (!isUserId(account.id)) return { ok: false, code: "auth" };
  const topic = parseTopic(input.topic);
  if (!topic) return { ok: false, code: "topic" };
  const parts = parseParts(input.parts ?? []);
  if (!parts) return { ok: false, code: "parts" };
  const dueDate = normalizeDueDate(input.dueDate);
  if (dueDate === "invalid") return { ok: false, code: "date" };
  const requestedId = input.roomId ? parseRoomId(input.roomId) : null;
  if (input.roomId && !requestedId) return { ok: false, code: "id" };

  const attempts = requestedId ? 1 : 5;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const id = requestedId ?? generateRoomId();
    const token = createRoomToken();
    try {
      await store.insertRoom({ id, token, topic, dueDate, parts, createdBy: account.id, language: "es" });
    } catch (error) {
      if (error instanceof MembershipError && error.code === "taken" && !requestedId) continue;
      return failureCode(error, requestedId ? "taken" : "save");
    }

    try {
      await placeMember(store, id, account);
    } catch (error) {
      await store.deleteRoom(id).catch(() => undefined);
      return failureCode(error, "save");
    }
    return { ok: true, id, token, path: invitePath(id, token) };
  }
  return { ok: false, code: "taken" };
}

export async function joinRoomFor(
  store: MembershipStore,
  account: Account,
  roomId: string,
  token: string,
): Promise<{ ok: true } | { ok: false; code: "token" | "auth" | "save" }> {
  if (!isUserId(account.id)) return { ok: false, code: "auth" };
  let room: StoredRoom | null;
  try {
    room = await store.getRoom(roomId);
  } catch {
    return { ok: false, code: "save" };
  }
  if (!room || !isInviteToken(token) || !tokensMatch(room.token, token)) return { ok: false, code: "token" };
  try {
    await placeMember(store, roomId, account);
    return { ok: true };
  } catch (error) {
    if (error instanceof MembershipError && error.code === "taken") return { ok: true };
    return { ok: false, code: "save" };
  }
}

export async function readRoomForMember(
  store: MembershipStore,
  accountId: string,
  roomId: string,
): Promise<{ ok: true; room: StoredRoom; members: MemberRow[] } | { ok: false; code: "missing" | "forbidden" | "save" }> {
  let room: StoredRoom | null;
  try {
    room = await store.getRoom(roomId);
  } catch {
    return { ok: false, code: "save" };
  }
  if (!room) return { ok: false, code: "missing" };
  let members: MemberRow[];
  try {
    members = await store.listMembers(roomId);
  } catch {
    return { ok: false, code: "save" };
  }
  const allowed = room.createdBy === accountId || members.some((member) => member.userId === accountId);
  if (!allowed) return { ok: false, code: "forbidden" };
  return { ok: true, room, members };
}

async function placeMember(store: MembershipStore, roomId: string, account: Account): Promise<void> {
  const members = await store.listMembers(roomId);
  const placement = memberPlacement(members, account);
  if (placement.kind === "already") return;
  if (placement.kind === "claim") {
    const claimed = await store.claimMember(placement.memberId, account.id);
    if (claimed) return;
    const again = memberPlacement(await store.listMembers(roomId), account);
    if (again.kind === "already") return;
    if (again.kind !== "insert") throw new MembershipError("save");
    await store.insertMember({ roomId, name: again.name, userId: account.id, part: null });
    return;
  }
  await store.insertMember({ roomId, name: placement.name, userId: account.id, part: null });
}

function normalizeDueDate(value: string | null | undefined): string | null | "invalid" {
  if (value == null || value.trim() === "") return null;
  if (value === NO_DATE) return NO_DATE;
  return parseDueDate(value, false) ?? "invalid";
}

function failureCode(error: unknown, takenCode: CreateErrorCode): { ok: false; code: CreateErrorCode } {
  if (error instanceof MembershipError && error.code === "taken") return { ok: false, code: takenCode };
  return { ok: false, code: "save" };
}
