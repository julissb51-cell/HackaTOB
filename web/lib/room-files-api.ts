import "server-only";
import { currentAccount } from "./current-account";
import { json } from "./http";
import { parseRoomId } from "./room-fields";
import {
  deleteRoomFile,
  insertRoomFile,
  listRoomFiles,
  publicFile,
  readRoomFile,
  signDownload,
  signUpload,
  uploadedSize,
  writeActivity,
} from "./room-files-db";
import { MAX_FILE_BYTES, cleanName, kindFromFile, kindFromUrl, parseFileBody, pathBelongsToRoom } from "./room-files-core";
import { readRoomForMember, type StoredRoom } from "./room-membership";
import { supabaseMembershipStore } from "./room-membership-db";
import { tokensMatch } from "./tokens";

type Access =
  | { via: "account"; room: StoredRoom; accountId: string; name: string; owner: boolean }
  | { via: "token"; room: StoredRoom; name: string };

/** Miembro con sesión de Google, o la extensión / un script con x-room-token. */
async function resolveAccess(request: Request, rawId: string): Promise<Access | Response> {
  const id = parseRoomId(rawId);
  if (!id) return json(request, { error: "sala no válida" }, 400);
  const header = request.headers.get("x-room-token")?.trim() ?? "";
  if (header) {
    if (header.length > 500) return json(request, { error: "no autorizado" }, 401);
    let room: StoredRoom | null;
    try {
      room = await supabaseMembershipStore.getRoom(id);
    } catch {
      return json(request, { error: "no se pudo leer la sala" }, 500);
    }
    if (!room || !tokensMatch(room.token, header)) return json(request, { error: "no autorizado" }, 401);
    const member = cleanName(new URL(request.url).searchParams.get("member") ?? "").slice(0, 120);
    return { via: "token", room, name: member || "Extensión" };
  }
  const account = await currentAccount();
  if (!account) return json(request, { error: "no autorizado" }, 401);
  const view = await readRoomForMember(supabaseMembershipStore, account.id, id);
  if (!view.ok) {
    if (view.code === "save") return json(request, { error: "no se pudo leer la sala" }, 500);
    return json(request, { error: view.code === "missing" ? "sala no encontrada" : "no autorizado" }, view.code === "missing" ? 404 : 403);
  }
  const viewer = view.members.find((member) => member.userId === account.id);
  return {
    via: "account",
    room: view.room,
    accountId: account.id,
    name: viewer?.name ?? account.name,
    owner: view.room.createdBy === account.id,
  };
}

function canDelete(access: Access, file: { addedByUser: string | null }): boolean {
  if (access.via !== "account") return false;
  return access.owner || (file.addedByUser !== null && file.addedByUser === access.accountId);
}

export async function getFiles(request: Request, rawId: string): Promise<Response> {
  const access = await resolveAccess(request, rawId);
  if (access instanceof Response) return access;
  try {
    const files = await listRoomFiles(access.room.id);
    return json(
      request,
      { archivos: files.map((file) => ({ ...publicFile(file), canDelete: canDelete(access, file) })) },
      200,
    );
  } catch {
    return json(request, { error: "no se pudo leer archivos" }, 500);
  }
}

/**
 * POST { url, name? } guarda un enlace.
 * POST { name, size, mime } devuelve { upload: { path, signedUrl } } para subir el archivo a Storage.
 * POST { name, size, mime, path } registra el archivo ya subido.
 */
export async function postFile(request: Request, rawId: string): Promise<Response> {
  const access = await resolveAccess(request, rawId);
  if (access instanceof Response) return access;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: "cuerpo ilegible" }, 400);
  }
  const parsed = parseFileBody(body);
  if (!parsed.ok) return json(request, { error: parsed.error }, 400);
  const roomId = access.room.id;
  const addedByUser = access.via === "account" ? access.accountId : null;

  try {
    if (parsed.draft.kind === "upload" && parsed.step === "sign") {
      const upload = await signUpload(roomId, parsed.draft.name);
      if (!upload) return json(request, { error: "no se pudo preparar la subida" }, 500);
      return json(request, { upload }, 200);
    }

    let saved;
    if (parsed.draft.kind === "link") {
      saved = await insertRoomFile({
        roomId,
        kind: kindFromUrl(parsed.draft.url),
        name: parsed.draft.name,
        url: parsed.draft.url,
        storagePath: null,
        size: null,
        mime: null,
        addedBy: access.name,
        addedByUser,
        source: "manual",
      });
      if (!saved) return json(request, { error: "ese enlace ya está en la sala" }, 409);
    } else {
      const path = parsed.path ?? "";
      if (!pathBelongsToRoom(path, roomId)) return json(request, { error: "path no válido" }, 400);
      const size = await uploadedSize(path);
      if (size === null) return json(request, { error: "no se encontró el archivo subido" }, 400);
      if (size > MAX_FILE_BYTES) return json(request, { error: "el archivo pasa de 10 MB" }, 400);
      saved = await insertRoomFile({
        roomId,
        kind: kindFromFile(parsed.draft.name, parsed.draft.mime),
        name: parsed.draft.name,
        url: null,
        storagePath: path,
        size,
        mime: parsed.draft.mime,
        addedBy: access.name,
        addedByUser,
        source: "manual",
      });
      if (!saved) return json(request, { error: "no se pudo guardar el archivo" }, 500);
    }
    await writeActivity(saved, access.room.language);
    return json(request, { archivo: { ...publicFile(saved), canDelete: canDelete(access, saved) } }, 201);
  } catch {
    return json(request, { error: "no se pudo guardar el archivo" }, 500);
  }
}

/** GET /files/[fileId]: abre el enlace o descarga el archivo con una URL firmada de 60 s. */
export async function openFile(request: Request, rawId: string, fileId: string): Promise<Response> {
  const access = await resolveAccess(request, rawId);
  if (access instanceof Response) return access;
  try {
    const file = await readRoomFile(access.room.id, fileId);
    if (!file) return json(request, { error: "archivo no encontrado" }, 404);
    const target = file.url ?? (file.storagePath ? await signDownload(file.storagePath, file.name) : null);
    if (!target) return json(request, { error: "no se pudo abrir el archivo" }, 500);
    return new Response(null, { status: 302, headers: { location: target, "cache-control": "private, no-store" } });
  } catch {
    return json(request, { error: "no se pudo abrir el archivo" }, 500);
  }
}

export async function removeFile(request: Request, rawId: string, fileId: string): Promise<Response> {
  const access = await resolveAccess(request, rawId);
  if (access instanceof Response) return access;
  try {
    const file = await readRoomFile(access.room.id, fileId);
    if (!file) return json(request, { error: "archivo no encontrado" }, 404);
    if (!canDelete(access, file)) return json(request, { error: "solo quien lo agregó o el dueño de la sala puede borrarlo" }, 403);
    await deleteRoomFile(file);
    return json(request, { ok: true }, 200);
  } catch {
    return json(request, { error: "no se pudo borrar el archivo" }, 500);
  }
}
