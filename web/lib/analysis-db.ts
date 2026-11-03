import "server-only";
import { ANALYSIS_INTERVAL_MS, analysisDue, type AnalystReport } from "./analyst";
import type { AnalysisChat, AnalysisSuggestion, SavedAnalysis, SuggestionStatus } from "./room-types";
import { createSupabaseServiceClient } from "./supabase/server";

type AnalysisRow = {
  resumen: string;
  miembros: unknown;
  alertas: unknown;
  chats: unknown;
  sugerencia: unknown;
  sugerencia_estado: string;
  fuente: string;
  idioma: string;
  ran_at: string;
  pending: boolean;
};

export async function readSavedAnalysis(roomId: string): Promise<SavedAnalysis | null> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("room_analysis")
      .select("resumen, miembros, alertas, chats, sugerencia, sugerencia_estado, fuente, idioma, ran_at, pending")
      .eq("room_id", roomId)
      .maybeSingle();
    if (error) {
      if (!isMissingTable(error)) console.error("analysis.select", error.code);
      return null;
    }
    if (!data) return null;
    return parseRow(data as AnalysisRow);
  } catch (error) {
    console.error("analysis.select", error instanceof Error ? error.name : "error");
    return null;
  }
}

export async function claimAnalysisRun(roomId: string, force: boolean): Promise<"run" | "skip"> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const existing = await supabase.from("room_analysis").select("ran_at").eq("room_id", roomId).maybeSingle();
  if (existing.error) {
    if (isMissingTable(existing.error)) return "skip";
    throw existing.error;
  }
  if (!existing.data) {
    const inserted = await supabase
      .from("room_analysis")
      .insert({ room_id: roomId, ran_at: now, pending: false })
      .select("room_id");
    if (inserted.error?.code === "23505") return force ? "run" : "skip";
    if (inserted.error) {
      if (isMissingTable(inserted.error)) return "skip";
      throw inserted.error;
    }
    return "run";
  }

  const ranAt = Date.parse((existing.data as { ran_at: string }).ran_at);
  if (!analysisDue(ranAt, Date.now(), force)) return "skip";

  let update = supabase.from("room_analysis").update({ ran_at: now, pending: false }).eq("room_id", roomId);
  if (!force) update = update.lt("ran_at", new Date(Date.now() - ANALYSIS_INTERVAL_MS).toISOString());
  const claimed = await update.select("room_id");
  if (claimed.error) {
    if (isMissingTable(claimed.error)) return "skip";
    throw claimed.error;
  }
  return (claimed.data ?? []).length > 0 ? "run" : "skip";
}

export async function rememberEventCount(roomId: string, eventos: number): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("room_analysis").update({ eventos }).eq("room_id", roomId);
    if (error && !isMissingTable(error)) console.error("analysis.eventos", error.code);
  } catch (error) {
    console.error("analysis.eventos", error instanceof Error ? error.message : error);
  }
}

export async function markAnalysisPending(roomId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("room_analysis").update({ pending: true }).eq("room_id", roomId);
  if (error && !isMissingTable(error)) console.error("analysis.pending", error.code);
}

export async function saveAnalysis(input: {
  roomId: string;
  report: AnalystReport;
  fuente: "ia" | "reglas";
  sugerenciaEstado: SuggestionStatus;
  idioma: "es" | "en";
  eventos: number;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const row = {
    resumen: input.report.resumen,
    miembros: input.report.miembros,
    alertas: input.report.alertas,
    chats: input.report.chats,
    sugerencia: input.report.sugerencia,
    sugerencia_estado: input.sugerenciaEstado,
    fuente: input.fuente,
    idioma: input.idioma,
    eventos: input.eventos,
    ran_at: new Date().toISOString(),
    pending: false,
  };
  const updated = await supabase.from("room_analysis").update(row).eq("room_id", input.roomId).select("room_id");
  if (updated.error) {
    console.error("analysis.save", updated.error.code);
    throw updated.error;
  }
  if ((updated.data ?? []).length > 0) return;
  const inserted = await supabase.from("room_analysis").insert({ room_id: input.roomId, ...row });
  if (inserted.error && inserted.error.code !== "23505") {
    console.error("analysis.save", inserted.error.code);
    throw inserted.error;
  }
}

export async function setSuggestionStatus(roomId: string, estado: SuggestionStatus): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const updated = await supabase
    .from("room_analysis")
    .update({ sugerencia_estado: estado })
    .eq("room_id", roomId)
    .select("room_id");
  if (updated.error) {
    if (!isMissingTable(updated.error)) console.error("analysis.estado", updated.error.code);
    return;
  }
  if ((updated.data ?? []).length > 0) return;
  const inserted = await supabase.from("room_analysis").insert({ room_id: roomId, sugerencia_estado: estado });
  if (inserted.error && inserted.error.code !== "23505" && !isMissingTable(inserted.error)) {
    console.error("analysis.estado", inserted.error.code);
  }
}

export async function applyChatNames(roomId: string, chats: AnalysisChat[]): Promise<void> {
  const supabase = createSupabaseServiceClient();
  for (const chat of chats.slice(0, 40)) {
    if (!chat.nombre.trim()) continue;
    const { error } = await supabase
      .from("events")
      .update({ conversation_name: chat.nombre })
      .eq("room_id", roomId)
      .eq("conversation_id", chat.conversationId)
      .is("conversation_name", null);
    if (error) {
      console.error("events.chat", error.code);
      return;
    }
  }
}

function parseRow(row: AnalysisRow): SavedAnalysis | null {
  if (row.fuente !== "ia" && row.fuente !== "reglas") return null;
  const estado = suggestionStatus(row.sugerencia_estado);
  return {
    fuente: row.fuente,
    resumen: typeof row.resumen === "string" ? row.resumen : "",
    miembros: Array.isArray(row.miembros) ? (row.miembros as SavedAnalysis["miembros"]) : [],
    alertas: Array.isArray(row.alertas) ? (row.alertas as SavedAnalysis["alertas"]) : [],
    chats: Array.isArray(row.chats) ? (row.chats as SavedAnalysis["chats"]) : [],
    sugerencia: isSuggestion(row.sugerencia) ? row.sugerencia : null,
    sugerenciaEstado: estado,
    idioma: row.idioma === "en" ? "en" : "es",
    pending: row.pending === true,
    ranAt: typeof row.ran_at === "string" ? row.ran_at : new Date(0).toISOString(),
  };
}

function suggestionStatus(value: string): SavedAnalysis["sugerenciaEstado"] {
  if (value === "pendiente" || value === "aceptada" || value === "descartada" || value === "ninguna") return value;
  return "ninguna";
}

function isSuggestion(value: unknown): value is AnalysisSuggestion {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.partes) && (record.fecha === null || typeof record.fecha === "string") && Array.isArray(record.asignaciones);
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (error.message ?? "").includes("room_analysis") && (error.code === "PGRST200" || error.message?.includes("schema cache") === true);
}
