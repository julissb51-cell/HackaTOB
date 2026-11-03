import { RoomStoreError } from "./room-store-error";
import type { MemberRecord, RoomRecord, RoomStore, StoredEvent } from "./room-types";

type MemoryMember = { roomId: string; name: string; part: string | null };

export function createMemoryStore(options?: {
  rooms?: RoomRecord[];
  members?: MemoryMember[];
  events?: StoredEvent[];
}): { store: RoomStore; events: StoredEvent[]; members: MemoryMember[] } {
  const rooms = (options?.rooms ?? []).map((room) => ({ ...room }));
  const events = [...(options?.events ?? [])];
  const members = (options?.members ?? []).map((member) => ({ ...member }));

  const store: RoomStore = {
    async getRoom(id) {
      return rooms.find((room) => room.id === id) ?? null;
    },
    async insertEvent(event) {
      const existing = events.find((item) => item.eventId === event.eventId);
      if (existing) {
        if (existing.roomId === event.roomId) return;
        throw new RoomStoreError("evento repetido", 409);
      }
      events.push({ ...event });
    },
    async ensureMember(roomId, name, suggestedPart) {
      const existing = members.find((member) => member.roomId === roomId && member.name === name);
      if (!existing) {
        members.push({ roomId, name, part: suggestedPart });
        return;
      }
      if (!existing.part && suggestedPart) existing.part = suggestedPart;
    },
    async listMembers(roomId) {
      return members
        .filter((member) => member.roomId === roomId)
        .map((member): MemberRecord => ({ name: member.name, part: member.part }));
    },
    async listEvents(roomId) {
      return events.filter((event) => event.roomId === roomId).map((event) => ({ ...event }));
    },
  };

  return { store, events, members };
}
