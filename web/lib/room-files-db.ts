import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServiceClient } from "./supabase/server";
import {
  ACTIVITY_AI,
  ACTIVITY_CONVERSATION,
  costaRicaIso,
  FILES_BUCKET,
  activityText,
  detectLinks,
  isFileKind,
  kindFromUrl,
  nameFromUrl,
  storageFileName,
  type FileKind,
  type FileSource,
  type RoomFile,
} from "./room-files-core";

const COLUMNS = "id, room_id, kind, name, url, storage_path, size_bytes, mime, added_by, added_by_user, source, created_at";

type FileRow = {
  id: string;
  room_id: string;
  kind: string;
  name: string;
  url: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  mime: string | null;
  added_by: string;
  added_by_user: string | null;
  source: string;
  created_at: string;
};

export type FileRecord = RoomFile & { roomId: string; storagePath: string | null };

function toFile(row: FileRow): FileRecord | null {
  if (!isFileKind(row.kind)) return null;
  return {
    id: row.id,
    roomId: row.room_id,
    kind: row.kind,
    name: row.name,
    url: row.url,
    uploaded: Boolean(row.storage_path),
    storagePath: row.storage_path,
    size: row.size_bytes,
    mime: row.mime,
    addedBy: row.added_by,
    addedByUser: row.added_by_user,
    source: row.source === "detectado" ? "detectado" : "manual",
    createdAt: row.created_at,
  };
}

export function publicFile(file: FileRecord): RoomFile {
  const { roomId: _room, storagePath: _path, ...rest } = file;
  void _room;
  void _path;
  return rest;
}

export async function listRoomFiles(roomId: string, limit = 200): Promise<FileRecord[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("room_files")
    .select(COLUMNS)
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("room_files.select", error.code);
    throw new Error("no se pudo leer archivos");
  }
  return (data as FileRow[]).map(toFile).filter((file): file is FileRecord => file !== null);
}

export async function readRoomFile(roomId: string, fileId: string): Promise<FileRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return null;
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("room_files").select(COLUMNS).eq("room_id", roomId).eq("id", fileId).maybeSingle();
  if (error) {
    console.error("room_files.select", error.code);
    throw new Error("no se pudo leer el archivo");
  }
  return data ? toFile(data as FileRow) : null;
}

export type NewFile = {
  roomId: string;
  kind: FileKind;
  name: string;
  url: string | null;
  storagePath: string | null;
  size: number | null;
  mime: string | null;
  addedBy: string;
  addedByUser: string | null;
  source: FileSource;
  sourceEventId?: string | null;
};

/** Inserta un archivo. Devuelve null si el enlace ya estaba en la sala. */
export async function insertRoomFile(file: NewFile): Promise<FileRecord | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("room_files")
    .insert({
      room_id: file.roomId,
      kind: file.kind,
      name: file.name,
      url: file.url,
      storage_path: file.storagePath,
      size_bytes: file.size,
      mime: file.mime,
      added_by: file.addedBy,
      added_by_user: file.addedByUser,
      source: file.source,
      source_event_id: file.sourceEventId ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") return null;
    console.error("room_files.insert", error.code);
    throw new Error("no se pudo guardar el archivo");
  }
  return toFile(data as FileRow);
}

export async function deleteRoomFile(file: FileRecord): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("room_files").delete().eq("id", file.id).eq("room_id", file.roomId);
  if (error) {
    console.error("room_files.delete", error.code);
    throw new Error("no se pudo borrar el archivo");
  }
  if (file.storagePath) {
    const removed = await supabase.storage.from(FILES_BUCKET).remove([file.storagePath]);
    if (removed.error) console.error("room_files.storage.remove", removed.error.name);
  }
}

export async function signUpload(roomId: string, name: string): Promise<{ path: string; signedUrl: string } | null> {
  const supabase = createSupabaseServiceClient();
  const path = `${roomId}/${randomUUID()}/${storageFileName(name)}`;
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("room_files.sign_upload", error?.name ?? "sin datos");
    return null;
  }
  return { path, signedUrl: data.signedUrl };
}

/** Comprueba que el objeto subido existe y devuelve su tamaño real. */
export async function uploadedSize(path: string): Promise<number | null> {
  const supabase = createSupabaseServiceClient();
  const slash = path.lastIndexOf("/");
  const { data, error } = await supabase.storage
    .from(FILES_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 10 });
  if (error || !data) return null;
  const object = data.find((item) => item.name === path.slice(slash + 1));
  const size = (object?.metadata as { size?: unknown } | undefined)?.size;
  return typeof size === "number" ? size : null;
}

export async function signDownload(path: string, name: string): Promise<string | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, 60, { download: name });
  if (error || !data) return null;
  return data.signedUrl;
}

/** Línea de actividad en el feed de la sala: un evento tipo archivo con ia enlaza. */
export async function writeActivity(file: FileRecord, language: "es" | "en"): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("events").insert({
    event_id: `archivo-${file.id}`,
    room_id: file.roomId,
    member: file.addedBy,
    ai: ACTIVITY_AI,
    type: "archivo",
    conversation_id: ACTIVITY_CONVERSATION,
    conversation_name: language === "en" ? "Room files" : "Archivos de la sala",
    text: activityText(language, file.addedBy, file),
    created_at: costaRicaIso(),
  });
  if (error && error.code !== "23505") console.error("events.insert archivo", error.code);
}

/** Guarda los enlaces de un prompt capturado como "detectado". Nunca los visita. */
export async function saveDetectedLinks(roomId: string, member: string, eventId: string, text: string): Promise<number> {
  const links = detectLinks(text);
  if (links.length === 0) return 0;
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("room_files")
    .upsert(
      links.map((url) => ({
        room_id: roomId,
        kind: kindFromUrl(url),
        name: nameFromUrl(url),
        url,
        added_by: member,
        source: "detectado",
        source_event_id: eventId,
      })),
      { onConflict: "room_id,url", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    console.error("room_files.detect", error.code);
    return 0;
  }
  return data?.length ?? 0;
}
