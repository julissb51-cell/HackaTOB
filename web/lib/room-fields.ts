export const NO_DATE = "sin fecha";

const CONTROL = /[\u0000-\u001F\u007F]/;
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const ROOM_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const RESERVED_IDS = new Set(["new", "api", "auth", "join", "rooms", "room"]);
const USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreateErrorCode = "topic" | "parts" | "date" | "id" | "auth" | "taken" | "save";

export type CreateState =
  | { status: "idle" }
  | { status: "error"; code: CreateErrorCode }
  | { status: "created"; id: string; token: string; path: string };

export type JoinErrorCode = "link" | "token" | "auth" | "save";

export type JoinState = { ok: true } | { ok: false; code: JoinErrorCode };

export function parseTopic(value: string): string | null {
  const topic = value.trim().replace(/\s+/g, " ");
  if (!topic || topic.length > 200 || CONTROL.test(topic)) return null;
  return topic;
}

export function parseParts(values: readonly string[]): string[] | null {
  const parts: string[] = [];
  for (const raw of values) {
    const part = raw.trim().replace(/\s+/g, " ");
    if (!part) continue;
    if (part.length > 120 || CONTROL.test(part) || parts.includes(part)) {
      if (part.length > 120 || CONTROL.test(part)) return null;
      continue;
    }
    parts.push(part);
  }
  if (parts.length > 30) return null;
  return parts;
}

export function parseDueDate(date: string, noDate: boolean): string | null {
  if (noDate) return NO_DATE;
  const value = date.trim();
  if (!DATE_RE.test(value)) return null;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return value;
}

export function parseCustomToken(value: string): string | null {
  const token = value.trim();
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(token)) return null;
  return token;
}

export function parseMemberPart(value: string): string | null | "invalid" {
  const part = value.trim().replace(/\s+/g, " ");
  if (!part) return null;
  if (part.length > 120 || CONTROL.test(part)) return "invalid";
  return part;
}

export function parseRoomLanguage(value: string): "es" | "en" {
  return value === "en" ? "en" : "es";
}

export function parseRoomId(value: string): string | null {
  const id = value.trim().toLowerCase();
  if (!ROOM_ID_RE.test(id) || RESERVED_IDS.has(id)) return null;
  return id;
}

export function isRoomId(value: string): boolean {
  return parseRoomId(value) === value;
}

export function isInviteToken(value: string): boolean {
  return value.length > 0 && value.length <= 500 && !CONTROL.test(value);
}

export function isUserId(value: string): boolean {
  return USER_ID_RE.test(value);
}

export function invitePath(id: string, token: string): string {
  return `/join/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`;
}

export function readInviteToken(source: URLSearchParams | Record<string, string | string[] | undefined>): string {
  const read = (key: string): string => {
    if (source instanceof URLSearchParams) return source.get(key)?.trim() ?? "";
    const value = source[key];
    const first = Array.isArray(value) ? value[0] : value;
    return first?.trim() ?? "";
  };
  return read("t") || read("token");
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/";
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\") || decoded.includes("..")) {
    return "/";
  }
  if (decoded.includes("://") || decoded.includes("\0") || decoded.length > 2000) return "/";
  const path = decoded.split("?")[0] ?? "";
  const allowed = path === "/" || path === "/rooms" || path === "/rooms/new" || path.startsWith("/join/") || path.startsWith("/rooms/");
  if (!allowed || path === "/rooms/") return "/";
  return decoded;
}

export function roomTokenStorageKey(roomId: string): string {
  return `enlaza.token.${roomId}`;
}

export function roomTokenCookieName(roomId: string): string {
  return `enlaza_tok_${roomId}`;
}

export function accountName(input: {
  email?: string | null;
  user_metadata?: { full_name?: unknown; name?: unknown } | null;
}): string {
  const meta = input.user_metadata ?? {};
  const candidates: unknown[] = [meta.full_name, meta.name];
  if (input.email) candidates.push(input.email.split("@")[0]);
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const name = candidate.trim().replace(/\s+/g, " ");
    if (!name || name.length > 80 || CONTROL.test(name)) continue;
    return name;
  }
  return "Miembro";
}
