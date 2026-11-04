/** Archivos y enlaces de la sala: tipos y reglas puras (sin red ni base de datos). */
export const FILE_KINDS = ["docs", "drive", "figma", "pdf", "image", "file", "link"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
export type FileSource = "manual" | "detectado";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILES_BUCKET = "room-files";
export const ACTIVITY_AI = "enlaza";
export const ACTIVITY_CONVERSATION = "enlaza-archivos";

export type RoomFile = {
  id: string;
  kind: FileKind;
  name: string;
  /** Enlace externo; null si es un archivo subido. */
  url: string | null;
  uploaded: boolean;
  size: number | null;
  mime: string | null;
  addedBy: string;
  addedByUser: string | null;
  source: FileSource;
  createdAt: string;
};

export function isFileKind(value: string): value is FileKind {
  return (FILE_KINDS as readonly string[]).includes(value);
}

export function kindFromUrl(url: string): FileKind {
  if (/^https?:\/\/docs\.google\.com\/(document|spreadsheets|presentation|forms)\//i.test(url)) return "docs";
  if (/^https?:\/\/drive\.google\.com\//i.test(url)) return "drive";
  if (/^https?:\/\/([a-z0-9-]+\.)*figma\.com\//i.test(url)) return "figma";
  if (/\.pdf($|[?#])/i.test(url)) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg)($|[?#])/i.test(url)) return "image";
  return "link";
}

export function kindFromFile(name: string, mime = ""): FileKind {
  if (/\.pdf$/i.test(name) || mime === "application/pdf") return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name) || mime.startsWith("image/")) return "image";
  if (/\.(docx?|odt|rtf|txt|md|pptx?|odp|xlsx?|ods|csv)$/i.test(name)) return "docs";
  return "file";
}

/** Valida un enlace pegado o detectado. Devuelve la URL normalizada o null. */
export function cleanUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 2000 || /[\s\u0000-\u001F\u007F]/.test(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!parsed.hostname.includes(".") || parsed.username || parsed.password) return null;
  return parsed.toString();
}

export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

export function nameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.length > 1 ? parsed.pathname : "";
    const label = host + (path.length > 40 ? `${path.slice(0, 40)}…` : path);
    return label.slice(0, 200);
  } catch {
    return url.slice(0, 200);
  }
}

/** Nombre seguro para la ruta del objeto en Storage. */
export function storageFileName(name: string): string {
  const base = name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "");
  return (base || "archivo").slice(-120);
}

const URL_RE = /https?:\/\/[^\s<>()[\]{}"'`]+/gi;

/** Enlaces dentro de un prompt capturado. Solo se guardan; nunca se visitan. */
export function detectLinks(text: string, limit = 5): string[] {
  const found: string[] = [];
  for (const match of text.match(URL_RE) ?? []) {
    const url = cleanUrl(match.replace(/[.,;:!?…]+$/, ""));
    if (!url || found.includes(url)) continue;
    found.push(url);
    if (found.length >= limit) break;
  }
  return found;
}

export function activityText(lang: "es" | "en", who: string, file: { name: string; url: string | null }): string {
  const line = lang === "en" ? `${who} added “${file.name}” to Files` : `${who} agregó «${file.name}» a Archivos`;
  return file.url ? `${line}\n${file.url}` : line;
}

export type ContextFile = {
  nombre: string;
  tipo: FileKind;
  url: string | null;
  subido: boolean;
  agregado_por: string;
  origen: FileSource;
  fecha: string;
};

/** Lo que /context devuelve: los 20 más recientes, sin URLs firmadas. */
export function contextFiles(files: readonly RoomFile[]): ContextFile[] {
  return [...files]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)
    .map((file) => ({
      nombre: file.name,
      tipo: file.kind,
      url: file.url,
      subido: file.uploaded,
      agregado_por: file.addedBy,
      origen: file.source,
      fecha: file.createdAt,
    }));
}

export type FileDraft =
  | { kind: "link"; url: string; name: string }
  | { kind: "upload"; name: string; size: number; mime: string };

/** Valida el cuerpo de POST /files. */
export function parseFileBody(body: unknown): { ok: true; draft: FileDraft; step: "sign" | "save"; path?: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "cuerpo no válido" };
  const record = body as Record<string, unknown>;
  if (typeof record.url === "string") {
    const url = cleanUrl(record.url);
    if (!url) return { ok: false, error: "url no válida" };
    return { ok: true, step: "save", draft: { kind: "link", url, name: cleanName(record.name) || nameFromUrl(url) } };
  }
  const name = cleanName(record.name);
  if (!name) return { ok: false, error: "falta name" };
  const size = record.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) return { ok: false, error: "size no válido" };
  if (size > MAX_FILE_BYTES) return { ok: false, error: "el archivo pasa de 10 MB" };
  const mime = typeof record.mime === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(record.mime) ? record.mime.slice(0, 120) : "application/octet-stream";
  const draft: FileDraft = { kind: "upload", name, size, mime };
  if (record.path === undefined) return { ok: true, step: "sign", draft };
  if (typeof record.path !== "string" || record.path.length > 400) return { ok: false, error: "path no válido" };
  return { ok: true, step: "save", draft, path: record.path };
}

export function pathBelongsToRoom(path: string, roomId: string): boolean {
  const parts = path.split("/");
  return parts.length === 3 && parts[0] === roomId && /^[0-9a-f-]{36}$/.test(parts[1]) && /^[\w.-]{1,120}$/.test(parts[2]);
}
