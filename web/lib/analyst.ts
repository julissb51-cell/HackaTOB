import { buildContext } from "./context-from-events";
import { parseDueDate, parseParts } from "./room-fields";
import type {
  AnalysisChat,
  AnalysisMember,
  AnalysisSuggestion,
  ContextResponse,
  RoomWarning,
  SavedAnalysis,
  StoredEvent,
  SuggestionStatus,
  WarningType,
} from "./room-types";

export const ANALYSIS_INTERVAL_MS = 30_000;
export const ANALYST_LIMITS = {
  maxEvents: 40,
  maxEventChars: 1_200,
  maxPromptChars: 24_000,
} as const;

const WARNING_TYPES = new Set<WarningType>(["falta", "contradiccion", "duplicado"]);

export type AnalysisRoom = {
  id: string;
  topic: string;
  dueDate: string | null;
  parts: string[];
  language: "es" | "en";
};

export type AnalysisInput = {
  room: AnalysisRoom;
  members: { name: string; part: string | null }[];
  events: StoredEvent[];
};

export type AnalystMessage = {
  role: "system" | "user";
  content: string;
};

export type AnalystReport = {
  resumen: string;
  miembros: AnalysisMember[];
  alertas: RoomWarning[];
  chats: AnalysisChat[];
  sugerencia: AnalysisSuggestion | null;
  consejo: string;
};

type TextComplete = (messages: AnalystMessage[]) => Promise<string>;

export function analysisDue(ranAtMs: number | null, now: number, force: boolean): boolean {
  if (force) return true;
  if (ranAtMs === null || Number.isNaN(ranAtMs)) return true;
  return now - ranAtMs >= ANALYSIS_INTERVAL_MS;
}

export function buildAnalystMessages(input: AnalysisInput): AnalystMessage[] {
  const language = input.room.language === "en" ? "inglés" : "español";
  const { events, omitted, trimmed } = clipEvents(input.events);
  const lines: string[] = [
    `Tema: ${input.room.topic || "(sin tema)"}`,
    `Fecha de entrega: ${input.room.dueDate?.trim() || "(sin definir)"}`,
    `Partes de la sala: ${input.room.parts.length > 0 ? input.room.parts.join(", ") : "(ninguna)"}`,
    `Idioma de todos los textos: ${language}.`,
    "",
    "Miembros:",
  ];
  if (input.members.length === 0) lines.push("- (nadie)");
  for (const member of input.members) {
    lines.push(`- ${member.name}: ${member.part?.trim() || "sin parte"}`);
  }
  lines.push("", "Eventos, del más antiguo al más nuevo:");
  if (omitted > 0 || trimmed) {
    const skipped = omitted > 0 ? `Se omitieron ${omitted} eventos más antiguos. ` : "";
    lines.push(`${skipped}Los textos largos se cortaron.`);
  }
  if (events.length === 0) lines.push("(todavía no hay eventos)");
  events.forEach((event, index) => {
    const title = event.conversationName?.trim() || "(sin nombre)";
    lines.push(
      `${index + 1}. ${event.createdAt} | ${event.member} | ${event.type} | ${event.ai} | ${event.conversationId} | ${title}`,
    );
    lines.push(event.text);
  });

  return [
    {
      role: "system",
      content: [
        "Eres el analista de una sala de Enlaza. Respondes solo con un objeto JSON, sin markdown.",
        "No inventes eventos ni personas. Usa los nombres tal como aparecen.",
        "Escribe resumen, partes, avisos, prompts y títulos en el idioma pedido.",
        "tipo de un aviso es falta, contradiccion o duplicado.",
        "En cada análisis revisa siempre estas tres cosas, comparando a todos los miembros entre sí:",
        "1. contradiccion: dos personas afirman o deciden cosas que no pueden ser ciertas a la vez (tecnología, formato de datos, alcance, fechas, nombres). Cita qué dijo cada uno.",
        "2. duplicado: dos o más personas hicieron o pidieron el mismo entregable o la misma sección (por ejemplo requisitos, diagrama de clases, introducción). Nombra a quiénes y qué se repite.",
        "3. falta: un entregable que el proyecto necesita y nadie está cubriendo. Compara con las partes de la sala y con lo típico del tipo de proyecto (por ejemplo pruebas o casos de prueba, manual de usuario, conclusiones, bibliografía, presentación, despliegue). También cuenta la fecha sin definir o alguien que no compartió trabajo.",
        "Solo avisa de lo que se apoya en los eventos o en lo que el proyecto claramente necesita. No avises por números sueltos que no se contradicen.",
        "Cada aviso va al miembro que debe actuar (destinatario), con un mensaje concreto de una o dos frases y un prompt_sugerido que esa persona pueda pegar en su IA.",
        "Pon los avisos de cada miembro en su lista advertencias y todos los avisos del equipo, sin repetir, en alertas.",
        "prompt_sugerido de cada miembro: el siguiente paso más útil para su parte, que tenga en cuenta los avisos y lo que hacen los demás.",
        "consejo: siempre una o dos frases para todo el equipo con la acción más importante ahora (por ejemplo quién se queda con qué para no duplicar y qué falta asignar). Nunca vacío.",
        "Si la sala ya tiene partes, sugerencia.partes y sugerencia.asignaciones van vacías.",
        "Si la fecha ya está definida, sugerencia.fecha_entrega es null.",
        "Cada chat recibe un nombre corto, de hasta 6 palabras.",
        'Forma: {"resumen":"","consejo":"","miembros":[{"nombre":"","resumen":"","parte":"","prompt_sugerido":"","advertencias":[{"tipo":"falta","mensaje":"","destinatario":"","partes":[],"prompt_sugerido":""}]}],"alertas":[{"tipo":"duplicado","mensaje":"","destinatario":"","partes":[],"prompt_sugerido":""}],"chats":[{"conversation_id":"","nombre":""}],"sugerencia":{"partes":[],"fecha_entrega":null,"asignaciones":[{"nombre":"","parte":""}]}}',
      ].join("\n"),
    },
    { role: "user", content: fitPrompt(lines.join("\n")) },
  ];
}

export function parseAnalystOutput(raw: string, knownConversationIds: readonly string[]): AnalystReport | null {
  const value = extractJson(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const resumen = cleanText(record.resumen, 2_000);
  const miembros = readMembers(record.miembros);
  const chats = readChats(record.chats, knownConversationIds);
  const fromList = readWarnings(record.alertas, 12);
  const alertas = dedupeWarnings([...fromList, ...miembros.flatMap((member) => member.advertencias)]).slice(0, 12);
  const sugerencia = readSuggestion(record.sugerencia);
  const consejo = cleanText(record.consejo, 600);
  if (!resumen && miembros.length === 0 && chats.length === 0) return null;
  return { resumen, miembros, alertas, chats, sugerencia, consejo };
}

export function buildFallbackReport(input: AnalysisInput): AnalystReport {
  const miembros = rulesMembers(input);
  const resumen =
    miembros[0]?.resumen ||
    (input.room.topic.trim() ? `El equipo trabaja en ${input.room.topic.trim()}.` : "La sala todavía no tiene tema.");
  return {
    resumen,
    miembros,
    alertas: dedupeWarnings(miembros.flatMap((member) => member.advertencias)).slice(0, 12),
    chats: fallbackChats(input.events),
    sugerencia: limitSuggestion(detectSuggestion(input), input.room),
    consejo: "",
  };
}

export async function produceReport(
  input: AnalysisInput,
  completeText: TextComplete,
): Promise<{ report: AnalystReport; fuente: "ia" | "reglas" }> {
  const rules = buildFallbackReport(input);
  try {
    const parsed = parseAnalystOutput(await completeText(buildAnalystMessages(input)), conversationIds(input.events));
    if (!parsed) {
      console.error("analisis", "respuesta ilegible");
      return { report: rules, fuente: "reglas" };
    }
    return { report: mergeWithFallback(parsed, rules, input), fuente: "ia" };
  } catch (error) {
    console.error("analisis", error instanceof Error ? error.message : error);
    return { report: rules, fuente: "reglas" };
  }
}

export function contextFromSaved(
  saved: SavedAnalysis | null,
  member: string,
  fallback: ContextResponse,
): ContextResponse {
  if (!saved || saved.fuente !== "ia") return fallback;
  const found =
    saved.miembros.find((item) => item.nombre === member) ??
    saved.miembros.find((item) => item.nombre.toLocaleLowerCase("es") === member.toLocaleLowerCase("es"));
  if (!found) return fallback;
  return {
    resumen: found.resumen || saved.resumen || fallback.resumen,
    parte: found.parte || fallback.parte,
    prompt_sugerido: found.prompt_sugerido || fallback.prompt_sugerido,
    advertencias: found.advertencias,
  };
}

export function limitSuggestion(
  suggestion: AnalysisSuggestion | null,
  room: { parts: string[]; dueDate: string | null },
): AnalysisSuggestion | null {
  if (!suggestion) return null;
  const needParts = room.parts.length === 0;
  const needDate = !room.dueDate?.trim();
  const next: AnalysisSuggestion = {
    partes: needParts ? suggestion.partes : [],
    fecha: needDate ? suggestion.fecha : null,
    asignaciones: needParts ? suggestion.asignaciones : [],
  };
  if (next.partes.length === 0 && !next.fecha && next.asignaciones.length === 0) return null;
  return next;
}

export function nextSuggestionStatus(
  previous: { sugerenciaEstado: SuggestionStatus; sugerencia: AnalysisSuggestion | null } | null,
  suggestion: AnalysisSuggestion | null,
): SuggestionStatus {
  if (!suggestion) return "ninguna";
  if (
    previous &&
    (previous.sugerenciaEstado === "descartada" || previous.sugerenciaEstado === "aceptada") &&
    sameSuggestion(previous.sugerencia, suggestion)
  ) {
    return previous.sugerenciaEstado;
  }
  return "pendiente";
}

export function sameSuggestion(left: AnalysisSuggestion | null, right: AnalysisSuggestion | null): boolean {
  if (!left || !right) return left === right;
  if (left.fecha !== right.fecha) return false;
  if (normalizeList(left.partes) !== normalizeList(right.partes)) return false;
  const a = left.asignaciones.map((item) => `${item.nombre}\u0000${item.parte}`).sort();
  const b = right.asignaciones.map((item) => `${item.nombre}\u0000${item.parte}`).sort();
  return a.join("\u0001") === b.join("\u0001");
}

export function acceptedRoomUpdate(
  room: { parts: string[]; dueDate: string | null },
  members: { name: string; part: string | null }[],
  suggestion: AnalysisSuggestion,
): { parts: string[]; dueDate: string | null; memberParts: { name: string; part: string }[] } {
  const memberParts: { name: string; part: string }[] = [];
  if (room.parts.length === 0) {
    for (const item of suggestion.asignaciones) {
      const member = members.find((entry) => entry.name === item.nombre);
      if (!member || member.part?.trim()) continue;
      memberParts.push({ name: member.name, part: item.parte });
    }
  }
  return {
    parts: room.parts.length === 0 && suggestion.partes.length > 0 ? suggestion.partes : room.parts,
    dueDate: room.dueDate?.trim() ? room.dueDate : suggestion.fecha ?? room.dueDate,
    memberParts,
  };
}

export function clipText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, Math.max(0, max - 3))}...`;
}

export function fallbackChats(events: readonly StoredEvent[]): AnalysisChat[] {
  const groups = new Map<string, StoredEvent[]>();
  for (const event of events) {
    const list = groups.get(event.conversationId) ?? [];
    list.push(event);
    groups.set(event.conversationId, list);
  }
  const chats: AnalysisChat[] = [];
  for (const [conversationId, list] of groups) {
    const named = list.find((event) => event.conversationName?.trim());
    const source = list.find((event) => event.type === "prompt") ?? list[0];
    chats.push({
      conversationId,
      nombre: clipTitle(named?.conversationName?.trim() || source?.text || "Chat"),
    });
  }
  return chats;
}

function mergeWithFallback(parsed: AnalystReport, rules: AnalystReport, input: AnalysisInput): AnalystReport {
  const byName = new Map(parsed.miembros.map((member) => [member.nombre, member]));
  const byFold = new Map(parsed.miembros.map((member) => [member.nombre.toLocaleLowerCase("es"), member]));
  const source = input.members.length > 0 ? input.members : rules.miembros.map((member) => ({ name: member.nombre, part: member.parte }));
  const miembros = source.map((member) => {
    const ai = byName.get(member.name) ?? byFold.get(member.name.toLocaleLowerCase("es"));
    if (ai) return { ...ai, nombre: member.name };
    return rules.miembros.find((item) => item.nombre === member.name) ?? emptyMember(member.name, member.part);
  });
  return {
    resumen: parsed.resumen || rules.resumen,
    miembros,
    alertas: parsed.alertas,
    chats: mergeChats(parsed.chats, rules.chats),
    sugerencia: limitSuggestion(parsed.sugerencia, input.room),
    consejo: parsed.consejo || teamAdvice(parsed.alertas),
  };
}

function mergeChats(ai: AnalysisChat[], rules: AnalysisChat[]): AnalysisChat[] {
  const names = new Map(rules.map((chat) => [chat.conversationId, chat.nombre]));
  for (const chat of ai) names.set(chat.conversationId, chat.nombre);
  return [...names.entries()].map(([conversationId, nombre]) => ({ conversationId, nombre }));
}

function rulesMembers(input: AnalysisInput): AnalysisMember[] {
  const members = input.members.length > 0 ? input.members : namesFromEvents(input.events);
  return members.map((member) => {
    const context = buildContext({
      room: { id: input.room.id, topic: input.room.topic, projectName: null, dueDate: input.room.dueDate },
      members: input.members,
      events: input.events,
      member: member.name,
    });
    return { nombre: member.name, ...context };
  });
}

function namesFromEvents(events: readonly StoredEvent[]): { name: string; part: string | null }[] {
  const names: { name: string; part: string | null }[] = [];
  for (const event of events) {
    if (!names.some((member) => member.name === event.member)) names.push({ name: event.member, part: null });
  }
  return names;
}

function detectSuggestion(input: AnalysisInput): AnalysisSuggestion | null {
  const needParts = input.room.parts.length === 0;
  const needDate = !input.room.dueDate?.trim();
  if (!needParts && !needDate) return null;
  const asignaciones: AnalysisSuggestion["asignaciones"] = [];
  if (needParts) {
    for (const member of input.members) {
      const stored = member.part?.trim();
      const named = input.events.find((event) => event.member === member.name && event.conversationName?.trim());
      const parte = stored || named?.conversationName?.trim() || "";
      const parsed = parte ? parseParts([parte]) : null;
      if (parsed && parsed[0]) asignaciones.push({ nombre: member.name, parte: parsed[0] });
    }
  }
  const partes = needParts ? unique(asignaciones.map((item) => item.parte)).slice(0, 30) : [];
  const fecha = needDate ? findDate(input.events) : null;
  if (partes.length === 0 && !fecha && asignaciones.length === 0) return null;
  return { partes, fecha, asignaciones };
}

function findDate(events: readonly StoredEvent[]): string | null {
  for (const event of events) {
    for (const match of event.text.matchAll(/(?<!\d)(\d{4}-\d{2}-\d{2})(?!\d)/g)) {
      const date = parseDueDate(match[1] ?? "", false);
      if (date) return date;
    }
  }
  return null;
}

function clipEvents(events: readonly StoredEvent[]): { events: StoredEvent[]; omitted: number; trimmed: boolean } {
  const sorted = [...events].sort((a, b) => eventTime(a) - eventTime(b));
  let trimmed = sorted.some((event) => event.text.trim().length > ANALYST_LIMITS.maxEventChars);
  const kept = sorted.slice(-ANALYST_LIMITS.maxEvents).map((event) => ({
    ...event,
    text: clipText(event.text, ANALYST_LIMITS.maxEventChars),
  }));
  let omitted = sorted.length - kept.length;
  while (kept.length > 1 && serializeEvents(kept).length > ANALYST_LIMITS.maxPromptChars) {
    kept.shift();
    omitted += 1;
  }
  if (kept.length === 1 && serializeEvents(kept).length > ANALYST_LIMITS.maxPromptChars) {
    const only = kept[0];
    if (only) {
      kept[0] = { ...only, text: clipText(only.text, 800) };
      trimmed = true;
    }
  }
  return { events: kept, omitted, trimmed };
}

function fitPrompt(text: string): string {
  if (text.length <= ANALYST_LIMITS.maxPromptChars) return text;
  return `${text.slice(0, ANALYST_LIMITS.maxPromptChars - 40)}\n\n[el texto se cortó]`;
}

function serializeEvents(events: readonly StoredEvent[]): string {
  return events.map((event) => `${event.conversationId}\n${event.text}`).join("\n");
}

function eventTime(event: StoredEvent): number {
  const time = Date.parse(event.createdAt);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function conversationIds(events: readonly StoredEvent[]): string[] {
  return unique(events.map((event) => event.conversationId));
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1]?.trim() || trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function readMembers(value: unknown): AnalysisMember[] {
  if (!Array.isArray(value)) return [];
  const members: AnalysisMember[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const nombre = cleanText(record.nombre, 80);
    if (!nombre) continue;
    members.push({
      nombre,
      resumen: cleanText(record.resumen, 2_000),
      parte: cleanText(record.parte, 120) || "sin parte",
      prompt_sugerido: cleanText(record.prompt_sugerido, 2_000),
      advertencias: readWarnings(record.advertencias, 6),
    });
    if (members.length >= 30) break;
  }
  return members;
}

function readWarnings(value: unknown, max: number): RoomWarning[] {
  if (!Array.isArray(value)) return [];
  const warnings: RoomWarning[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const tipo = record.tipo;
    if (typeof tipo !== "string" || !WARNING_TYPES.has(tipo as WarningType)) continue;
    const mensaje = cleanText(record.mensaje, 500);
    if (!mensaje) continue;
    const partes = Array.isArray(record.partes)
      ? record.partes.filter((part): part is string => typeof part === "string").map((part) => cleanText(part, 120)).filter(Boolean).slice(0, 8)
      : [];
    warnings.push({
      tipo: tipo as WarningType,
      mensaje,
      destinatario: cleanText(record.destinatario, 80) || "equipo",
      partes: partes.length > 0 ? partes : ["sala"],
      prompt_sugerido: cleanText(record.prompt_sugerido, 2_000),
    });
    if (warnings.length >= max) break;
  }
  return warnings;
}

function readChats(value: unknown, knownConversationIds: readonly string[]): AnalysisChat[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(knownConversationIds);
  const chats: AnalysisChat[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const conversationId = cleanText(record.conversation_id ?? record.conversationId, 200);
    const nombre = clipTitle(cleanText(record.nombre, 80));
    if (!conversationId || !nombre || seen.has(conversationId) || (known.size > 0 && !known.has(conversationId))) continue;
    seen.add(conversationId);
    chats.push({ conversationId, nombre });
  }
  return chats;
}

function readSuggestion(value: unknown): AnalysisSuggestion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const partes = Array.isArray(record.partes)
    ? parseParts(record.partes.filter((part): part is string => typeof part === "string")) ?? []
    : [];
  const fechaRaw = record.fecha_entrega ?? record.fecha;
  const fecha = typeof fechaRaw === "string" ? parseDueDate(fechaRaw, false) : null;
  const asignaciones: AnalysisSuggestion["asignaciones"] = [];
  if (Array.isArray(record.asignaciones)) {
    for (const item of record.asignaciones) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const nombre = cleanText(row.nombre, 80);
      const parsed = typeof row.parte === "string" ? parseParts([row.parte]) : null;
      if (!nombre || !parsed?.[0]) continue;
      if (asignaciones.some((entry) => entry.nombre === nombre)) continue;
      asignaciones.push({ nombre, parte: parsed[0] });
      if (asignaciones.length >= 30) break;
    }
  }
  if (partes.length === 0 && !fecha && asignaciones.length === 0) return null;
  return { partes, fecha, asignaciones };
}

function emptyMember(nombre: string, part: string | null): AnalysisMember {
  return {
    nombre,
    resumen: "",
    parte: part?.trim() || "sin parte",
    prompt_sugerido: "",
    advertencias: [],
  };
}

function dedupeWarnings(warnings: RoomWarning[]): RoomWarning[] {
  const seen = new Set<string>();
  const result: RoomWarning[] = [];
  for (const warning of warnings) {
    const key = `${warning.tipo}\u0000${warning.destinatario}\u0000${warning.mensaje}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(warning);
  }
  return result;
}

function clipTitle(text: string): string {
  const flat = text.replace(/[#*_>`[\]]/g, " ").replace(/\s+/g, " ").trim();
  const words = flat.split(" ").filter(Boolean).slice(0, 6).join(" ");
  if (!words) return "Chat";
  return words.length > 60 ? `${words.slice(0, 57)}...` : words;
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function normalizeList(items: string[]): string {
  return [...items].sort((a, b) => a.localeCompare(b, "es")).join("\u0000");
}

function teamAdvice(alertas: RoomWarning[]): string {
  const first = alertas[0];
  if (!first) return "";
  return first.prompt_sugerido || first.mensaje;
}
