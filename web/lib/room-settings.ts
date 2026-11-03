import { acceptedRoomUpdate } from "./analyst";
import { MembershipError, readRoomForMember, type MembershipStore } from "./room-membership";
import type { AnalysisSuggestion } from "./room-types";

export type SettingsInput = {
  topic: string;
  parts: string[];
  dueDate: string | null;
  language: "es" | "en";
  nextId: string | null;
  memberParts: { name: string; part: string | null }[];
};

export type SettingsResult =
  | { ok: true; id: string; token: string }
  | { ok: false; code: "missing" | "forbidden" | "taken" | "save" };

export async function saveSettings(
  store: MembershipStore,
  accountId: string,
  roomId: string,
  input: SettingsInput,
): Promise<SettingsResult> {
  const access = await readRoomForMember(store, accountId, roomId);
  if (!access.ok) return { ok: false, code: access.code === "forbidden" ? "forbidden" : access.code };
  const names = new Set(access.members.map((member) => member.name));
  try {
    await store.updateRoom(roomId, {
      topic: input.topic,
      dueDate: input.dueDate,
      parts: input.parts,
      language: input.language,
    });
    for (const member of input.memberParts) {
      if (!names.has(member.name)) continue;
      await store.setMemberPart(roomId, member.name, member.part);
    }
    if (input.nextId && input.nextId !== roomId) {
      await store.renameRoom(roomId, input.nextId);
      return { ok: true, id: input.nextId, token: access.room.token };
    }
    return { ok: true, id: roomId, token: access.room.token };
  } catch (error) {
    if (error instanceof MembershipError && error.code === "taken") return { ok: false, code: "taken" };
    return { ok: false, code: "save" };
  }
}

export async function setRoomToken(
  store: MembershipStore,
  accountId: string,
  roomId: string,
  token: string,
): Promise<SettingsResult> {
  const access = await readRoomForMember(store, accountId, roomId);
  if (!access.ok) return { ok: false, code: access.code === "forbidden" ? "forbidden" : access.code };
  try {
    await store.updateRoom(roomId, { token });
    return { ok: true, id: roomId, token };
  } catch (error) {
    if (error instanceof MembershipError && error.code === "taken") return { ok: false, code: "taken" };
    return { ok: false, code: "save" };
  }
}

export async function acceptSuggestionFor(
  store: MembershipStore,
  accountId: string,
  roomId: string,
  suggestion: AnalysisSuggestion,
): Promise<SettingsResult> {
  const access = await readRoomForMember(store, accountId, roomId);
  if (!access.ok) return { ok: false, code: access.code === "forbidden" ? "forbidden" : access.code };
  const next = acceptedRoomUpdate(
    access.room,
    access.members.map((member) => ({ name: member.name, part: member.part })),
    suggestion,
  );
  try {
    await store.updateRoom(roomId, { parts: next.parts, dueDate: next.dueDate });
    for (const member of next.memberParts) {
      await store.setMemberPart(roomId, member.name, member.part);
    }
    return { ok: true, id: roomId, token: access.room.token };
  } catch (error) {
    if (error instanceof MembershipError && error.code === "taken") return { ok: false, code: "taken" };
    return { ok: false, code: "save" };
  }
}
