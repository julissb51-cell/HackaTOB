import { isRoomId } from "./room-fields";
import { isAiName, isEventType, type StoredEvent } from "./room-types";

export const POLL_MS = 5000;

export type LiveStatus = "connecting" | "live" | "polling" | "offline";

export type PartStatus = "empty" | "waiting" | "active";

export type PartSummary = {
  name: string;
  members: string[];
  eventCount: number;
  status: PartStatus;
};

export type FeedMember = { name: string; part: string | null };

export type FeedEventRef = { member: string; conversationName: string | null };

const TEXT_LIMIT = 100_000;

export function realtimeFilter(roomId: string): string | null {
  if (!isRoomId(roomId)) return null;
  return `room_id=eq.${roomId}`;
}

export function realtimeFailed(status: string): boolean {
  return status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED";
}

const COSTA_RICA_OFFSET_MS = -6 * 60 * 60 * 1000;

export function formatEventTime(iso: string): string {
  // Un Z es UTC. El resto ya trae la hora local en los dígitos (contrato: offset).
  if (/Z$/i.test(iso)) {
    const instant = Date.parse(iso);
    if (!Number.isNaN(instant)) {
      const wall = new Date(instant + COSTA_RICA_OFFSET_MS);
      const pad = (value: number) => String(value).padStart(2, "0");
      return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())} ${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`;
    }
  }
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : iso;
}

export function sortEventsNewestFirst(events: readonly StoredEvent[]): StoredEvent[] {
  return events
    .map((event, index) => ({ event, index, time: eventTime(event.createdAt) }))
    .sort((a, b) => b.time - a.time || a.index - b.index)
    .map((item) => item.event);
}

export function eventsKey(events: readonly StoredEvent[]): string {
  return events.map((event) => `${event.eventId}\0${event.createdAt}\0${event.text.length}\0${event.type}`).join("\n");
}

export function membersKey(members: readonly FeedMember[]): string {
  return members.map((member) => `${member.name}\0${member.part ?? ""}`).join("\n");
}

export function mergeSnapshots(current: readonly StoredEvent[], incoming: readonly StoredEvent[]): StoredEvent[] {
  const map = new Map<string, StoredEvent>();
  for (const event of incoming) map.set(event.eventId, event);
  for (const event of current) if (!map.has(event.eventId)) map.set(event.eventId, event);
  return sortEventsNewestFirst([...map.values()]);
}

export function eventFromRow(row: unknown, roomId: string): StoredEvent | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const eventId = textField(value.event_id);
  const rowRoom = textField(value.room_id);
  const member = textField(value.member);
  const ai = textField(value.ai);
  const type = textField(value.type);
  const conversationId = textField(value.conversation_id);
  const createdAt = textField(value.created_at);
  if (!eventId || !member || !ai || !type || !conversationId || !createdAt) return null;
  if (typeof value.text !== "string" || value.text.length > TEXT_LIMIT) return null;
  if (rowRoom && rowRoom !== roomId) return null;
  if (!isAiName(ai) || !isEventType(type)) return null;
  let conversationName: string | null = null;
  if (value.conversation_name != null && value.conversation_name !== "") {
    conversationName = textField(value.conversation_name);
    if (!conversationName) return null;
  }
  return {
    eventId,
    roomId,
    member,
    ai,
    type,
    conversationId,
    conversationName,
    text: value.text,
    createdAt,
  };
}

export function applyRealtimeChange(
  events: readonly StoredEvent[],
  payload: { eventType?: string; new?: unknown; old?: unknown },
  roomId: string,
): StoredEvent[] {
  if (payload.eventType === "DELETE") {
    const oldRow = payload.old;
    if (!oldRow || typeof oldRow !== "object") return [...events];
    const record = oldRow as Record<string, unknown>;
    const eventId = textField(record.event_id);
    const oldRoom = textField(record.room_id);
    if (!eventId || (oldRoom && oldRoom !== roomId)) return [...events];
    return events.filter((event) => event.eventId !== eventId);
  }

  const incoming = eventFromRow(payload.new, roomId);
  if (!incoming) return [...events];
  const next = events.filter((event) => event.eventId !== incoming.eventId);
  next.push(incoming);
  return sortEventsNewestFirst(next);
}

export function filterEvents(events: readonly StoredEvent[], member: string | null): StoredEvent[] {
  if (!member) return [...events];
  return events.filter((event) => event.member === member);
}

export function feedMembers(members: readonly FeedMember[], events: readonly { member: string }[]): string[] {
  const names: string[] = [];
  for (const member of members) if (!names.includes(member.name)) names.push(member.name);
  for (const event of events) if (!names.includes(event.member)) names.push(event.member);
  return names;
}

export function summarizeParts(
  parts: readonly string[],
  members: readonly FeedMember[],
  events: readonly FeedEventRef[],
): PartSummary[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const part = name.trim();
    if (!part || seen.has(part)) return;
    seen.add(part);
    names.push(part);
  };
  for (const part of parts) add(part);
  const extras = members
    .map((member) => member.part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .sort((a, b) => a.localeCompare(b, "es"));
  for (const part of extras) add(part);

  const partNames = new Set(names);
  const memberPart = new Map(members.map((member) => [member.name, member.part?.trim() || null]));

  return names.map((name) => {
    const assigned = members.filter((member) => member.part?.trim() === name).map((member) => member.name);
    let eventCount = 0;
    for (const event of events) {
      const owned = memberPart.get(event.member);
      if (owned && partNames.has(owned)) {
        if (owned === name) eventCount += 1;
        continue;
      }
      if ((event.conversationName?.trim() ?? "") === name) eventCount += 1;
    }
    const status: PartStatus = eventCount > 0 ? "active" : assigned.length > 0 ? "waiting" : "empty";
    return { name, members: assigned, eventCount, status };
  });
}

function eventTime(value: string): number {
  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function textField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > 500) return null;
  return text;
}
