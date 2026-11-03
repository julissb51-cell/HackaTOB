import "server-only";
import { readSavedAnalysis } from "./analysis-db";
import { toBoard, type RoomBoard } from "./board-view";
import type { Account, MemberRow, StoredRoom } from "./room-membership";
import { supabaseRoomStore } from "./room-store";

export async function loadRoomBoard(account: Account, room: StoredRoom, members: MemberRow[]): Promise<RoomBoard> {
  const [events, saved] = await Promise.all([supabaseRoomStore.listEvents(room.id), readSavedAnalysis(room.id)]);
  const viewer = members.find((member) => member.userId === account.id);
  return toBoard({
    room,
    members,
    events,
    saved,
    viewerName: viewer?.name ?? account.name,
  });
}
