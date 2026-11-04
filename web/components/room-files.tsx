"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_FILE_BYTES, type FileKind, type RoomFile } from "@/lib/room-files-core";
import { useLanguage } from "./language";
import { Symbol, iconButton, pillPrimary, pillSecondary } from "./symbol";

/** Archivos y enlaces de la sala, guardados en Supabase (bucket privado room-files). */
export type { FileKind, RoomFile };
type Item = RoomFile & { canDelete?: boolean };
const KIND_ORDER: FileKind[] = ["docs", "drive", "figma", "pdf", "image", "file", "link"];
const KIND_ICON: Record<FileKind, string> = {
  docs: "description",
  drive: "add_to_drive",
  figma: "draw",
  pdf: "picture_as_pdf",
  image: "image",
  file: "draft",
  link: "link",
};
const COPY = {
  es: {
    button: "Archivos",
    title: "Archivos de la sala",
    remove: "Quitar",
    removeConfirm: (name: string) => `¿Quitar «${name}» de la sala?`,
    tooBig: "El archivo pasa de 10 MB.",
    badLink: "Pega un enlace que empiece con https://",
    duplicate: "Ese enlace ya está en la sala.",
    failed: "No se pudo guardar. Intenta de nuevo.",
    saving: "Guardando…",
    loading: "Cargando…",
    add: "Agregar",
    upload: "Subir archivo",
    paste: "Pegar enlace",
    linkPlaceholder: "https://docs.google.com/…",
    namePlaceholder: "Nombre (opcional)",
    save: "Agregar a la sala",
    cancel: "Cancelar",
    detected: "detectado",
    detectedHint: "Encontrado en un prompt capturado",
    by: (name: string) => `Agregado por ${name}`,
    empty: "Todavía no hay archivos ni enlaces.",
    limit: "Máx. 10 MB por archivo",
    close: "Cerrar",
    kinds: { docs: "Documentos", drive: "Google Drive", figma: "Figma", pdf: "PDF", image: "Imágenes", file: "Otros archivos", link: "Enlaces" } as Record<FileKind, string>,
  },
  en: {
    button: "Files",
    title: "Room files",
    remove: "Remove",
    removeConfirm: (name: string) => `Remove “${name}” from the room?`,
    tooBig: "The file is over 10 MB.",
    badLink: "Paste a link that starts with https://",
    duplicate: "That link is already in the room.",
    failed: "Couldn't save. Try again.",
    saving: "Saving…",
    loading: "Loading…",
    add: "Add",
    upload: "Upload file",
    paste: "Paste link",
    linkPlaceholder: "https://docs.google.com/…",
    namePlaceholder: "Name (optional)",
    save: "Add to room",
    cancel: "Cancel",
    detected: "detected",
    detectedHint: "Found in a captured prompt",
    by: (name: string) => `Added by ${name}`,
    empty: "No files or links yet.",
    limit: "Max 10 MB per file",
    close: "Close",
    kinds: { docs: "Documents", drive: "Google Drive", figma: "Figma", pdf: "PDF", image: "Images", file: "Other files", link: "Links" } as Record<FileKind, string>,
  },
};
export function useFilesCopy() {
  const { lang } = useLanguage();
  return COPY[lang === "en" ? "en" : "es"];
}

function fmtSize(n?: number | null) {
  if (!n) return null;
  return n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`;
}
function fmtDate(iso: string, lang: string) {
  return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-CR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Costa_Rica" });
}

export function FilesButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  const t = useFilesCopy();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm font-semibold transition-colors hover:bg-structural/60"
    >
      <Symbol name="folder_open" className="text-[20px] text-link" />
      {t.button}
      <span className="rounded-full bg-structural px-2 text-xs text-muted tabular-nums">{count}</span>
    </button>
  );
}

async function fetchFiles(roomId: string): Promise<Item[] | null> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/files`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { archivos?: Item[] };
    return data.archivos ?? [];
  } catch {
    return null;
  }
}

export function useRoomFiles(roomId: string) {
  const [files, setFiles] = useState<Item[] | null>(null);
  const reload = useCallback(async () => {
    const list = await fetchFiles(roomId);
    if (list) setFiles(list);
  }, [roomId]);
  useEffect(() => {
    let live = true;
    fetchFiles(roomId).then((list) => {
      if (live && list) setFiles(list);
    });
    return () => {
      live = false;
    };
  }, [roomId]);
  return { files, reload, setFiles };
}

export function FilesDrawer({
  open,
  onClose,
  roomId,
  files,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  files: Item[] | null;
  onChanged: () => void;
}) {
  const t = useFilesCopy();
  const { lang } = useLanguage();
  const [adding, setAdding] = useState<null | "menu" | "link">(null);
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const base = `/api/rooms/${encodeURIComponent(roomId)}/files`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  const groups = useMemo(() => {
    const list = files ?? [];
    return KIND_ORDER.map((kind) => ({
      kind,
      items: list.filter((f) => f.kind === kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    })).filter((g) => g.items.length > 0);
  }, [files]);

  if (!open) return null;

  const post = async (body: unknown) =>
    fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  const done = () => {
    setLink("");
    setName("");
    setAdding(null);
    onChanged();
  };

  const addLink = async () => {
    const url = link.trim();
    setError(null);
    if (!/^https?:\/\//i.test(url)) return setError(t.badLink);
    setBusy(true);
    try {
      const res = await post({ url, name: name.trim() || undefined });
      if (res.status === 409) return setError(t.duplicate);
      if (!res.ok) return setError(res.status === 400 ? t.badLink : t.failed);
      done();
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const addFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) return setError(t.tooBig);
    setBusy(true);
    try {
      const meta = { name: file.name, size: file.size, mime: file.type || "application/octet-stream" };
      const signed = await post(meta);
      if (!signed.ok) return setError(signed.status === 400 ? t.tooBig : t.failed);
      const { upload } = (await signed.json()) as { upload: { path: string; signedUrl: string } };
      const put = await fetch(upload.signedUrl, { method: "PUT", headers: { "content-type": meta.mime, "x-upsert": "false" }, body: file });
      if (!put.ok) return setError(t.failed);
      const saved = await post({ ...meta, path: upload.path });
      if (!saved.ok) return setError(t.failed);
      done();
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (file: Item) => {
    if (!window.confirm(t.removeConfirm(file.name))) return;
    try {
      const res = await fetch(`${base}/${file.id}`, { method: "DELETE" });
      if (res.ok) onChanged();
      else setError(t.failed);
    } catch {
      setError(t.failed);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onMouseDown={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label={t.title} className="absolute inset-y-0 right-0 flex w-full max-w-[600px] flex-col bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <h2 className="inline-flex items-center gap-2 text-2xl font-[650] tracking-[-0.4px]">
            <Symbol name="folder_open" className="text-link" />
            {t.title}
          </h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setError(null); setAdding(adding ? null : "menu"); }} className={`${pillPrimary} h-10 gap-1.5 px-4 text-sm`}>
              <Symbol name="add" className="text-[18px]" />
              {t.add}
            </button>
            <button type="button" onClick={onClose} aria-label={t.close} className={iconButton}>
              <Symbol name="close" />
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-6">
          {error ? (
            <p role="alert" className="rounded-2xl bg-urg-bg px-4 py-3 text-sm font-semibold text-urg-ink">{error}</p>
          ) : null}
          {busy ? <p className="text-sm text-muted">{t.saving}</p> : null}
          {adding ? (
            <section className="rounded-[28px] bg-structural p-3">
              <div className="rounded-[20px] bg-surface p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => fileInput.current?.click()} className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-line p-4 text-left hover:bg-structural/60`}>
                    <Symbol name="upload_file" className="text-[24px] text-link" />
                    <span>
                      <span className="block font-semibold">{t.upload}</span>
                      <span className="block text-xs text-muted">{t.limit}</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => setAdding("link")} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left hover:bg-structural/60 ${adding === "link" ? "border-link" : "border-line"}`}>
                    <Symbol name="add_link" className="text-[24px] text-link" />
                    <span>
                      <span className="block font-semibold">{t.paste}</span>
                      <span className="block text-xs text-muted">Drive, Docs, Figma…</span>
                    </span>
                  </button>
                </div>
                <input ref={fileInput} type="file" className="sr-only" onChange={(e) => void addFile(e.target.files?.[0])} />
                {adding === "link" ? (
                  <div className="mt-3 space-y-2">
                    <input autoFocus value={link} onChange={(e) => setLink(e.target.value)} placeholder={t.linkPlaceholder} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[15px] outline-none focus:border-link" />
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[15px] outline-none focus:border-link" />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setAdding(null)} className={`${pillSecondary} h-10 px-4 text-sm`}>{t.cancel}</button>
                      <button type="button" onClick={() => void addLink()} disabled={busy} className={`${pillPrimary} h-10 px-4 text-sm disabled:opacity-60`}>{t.save}</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
          {files === null ? <p className="text-sm text-muted">{t.loading}</p> : groups.length === 0 ? <p className="text-sm text-muted">{t.empty}</p> : null}
          {groups.map((group) => (
            <section key={group.kind}>
              <h3 className="inline-flex items-center gap-2 font-semibold">
                {t.kinds[group.kind]}
                <span className="rounded-full bg-structural px-2 text-sm text-muted">{group.items.length}</span>
              </h3>
              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
                {group.items.map((file) => (
                  <li key={file.id} className="flex items-center gap-3 p-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-structural text-link">
                      <Symbol name={KIND_ICON[file.kind]} className="text-[20px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <a href={`${base}/${file.id}`} target="_blank" rel="noreferrer" className="truncate font-semibold tracking-[-0.1px] hover:text-link">{file.name}</a>
                        {file.source === "detectado" ? (
                          <span title={t.detectedHint} className="inline-flex items-center gap-1 rounded-full bg-structural px-2 py-0.5 text-[11px] font-semibold text-link">
                            <Symbol name="auto_awesome" className="text-[12px]" />
                            {t.detected}
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {t.by(file.addedBy)} · {fmtDate(file.createdAt, lang)}
                        {fmtSize(file.size) ? ` · ${fmtSize(file.size)}` : ""}
                      </span>
                    </span>
                    <a href={`${base}/${file.id}`} target="_blank" rel="noreferrer" aria-label={file.name} className={iconButton}>
                      <Symbol name={file.uploaded ? "download" : "open_in_new"} />
                    </a>
                    {file.canDelete ? (
                      <button type="button" onClick={() => void remove(file)} aria-label={`${t.remove}: ${file.name}`} title={t.remove} className={iconButton}>
                        <Symbol name="delete" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
