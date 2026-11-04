import type { RoomWarning, StoredEvent } from "./room-types";

/** Un entregable esperado de una parte, con si ya hay evidencia de que está hecho. */
export type ChecklistItem = {
  parte: string;
  texto: string;
  hecho: boolean;
  evidencia: string;
};

export type PartProgress = { parte: string; hechos: number; total: number; avance: number };

export type RoomProgress = {
  items: ChecklistItem[];
  partes: PartProgress[];
  bruto: number;
  penalizacion: number;
  valor: number;
  anterior: number | null;
  delta: number;
  motivo: string;
  calculadoEn: string;
};

export const PROGRESS_LIMITS = {
  itemsPerPart: 10,
  maxPenalty: 15,
  maxStep: 15,
  contradiction: 3,
  duplicate: 1,
} as const;

export function itemKey(parte: string, texto: string): string {
  return `${fold(parte)}\u0000${fold(texto)}`;
}

function fold(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Lee la lista que devuelve la IA: [{parte, items:[{texto, hecho, evidencia}]}] o una lista plana. */
export function readChecklist(value: unknown, parts: readonly string[]): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  const out: ChecklistItem[] = [];
  const known = new Map(parts.map((part) => [fold(part), part]));
  const push = (parte: unknown, item: unknown) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const texto = typeof record.texto === "string" ? record.texto.trim().slice(0, 120) : "";
    const rawPart = typeof parte === "string" ? parte.trim() : "";
    if (!texto || !rawPart) return;
    out.push({
      parte: known.get(fold(rawPart)) ?? rawPart.slice(0, 60),
      texto,
      hecho: record.hecho === true,
      evidencia: typeof record.evidencia === "string" ? record.evidencia.trim().slice(0, 200) : "",
    });
  };
  for (const entry of value.slice(0, 20)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (Array.isArray(record.items)) for (const item of record.items.slice(0, 20)) push(record.parte, item);
    else push(record.parte, record);
  }
  return dedupeItems(out);
}

function dedupeItems(items: readonly ChecklistItem[]): ChecklistItem[] {
  const seen = new Map<string, ChecklistItem>();
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = itemKey(item.parte, item.texto);
    const existing = seen.get(key);
    if (existing) {
      if (item.hecho && !existing.hecho) seen.set(key, { ...existing, hecho: true, evidencia: item.evidencia || existing.evidencia });
      continue;
    }
    const n = counts.get(fold(item.parte)) ?? 0;
    if (n >= PROGRESS_LIMITS.itemsPerPart) continue;
    counts.set(fold(item.parte), n + 1);
    seen.set(key, item);
  }
  return [...seen.values()];
}

/**
 * Estabiliza la lista: se conservan los entregables anteriores (con su texto), solo se agregan nuevos,
 * y algo ya hecho no vuelve a pendiente.
 */
export function mergeChecklist(previous: readonly ChecklistItem[], next: readonly ChecklistItem[]): ChecklistItem[] {
  const nextByKey = new Map(next.map((item) => [itemKey(item.parte, item.texto), item]));
  const merged: ChecklistItem[] = previous.map((item) => {
    const fresh = nextByKey.get(itemKey(item.parte, item.texto));
    if (item.hecho) return item;
    if (fresh?.hecho) return { ...item, hecho: true, evidencia: fresh.evidencia };
    return item;
  });
  const used = new Set(previous.map((item) => itemKey(item.parte, item.texto)));
  for (const item of next) if (!used.has(itemKey(item.parte, item.texto))) merged.push(item);
  return dedupeItems(merged);
}

export function roundTo5(value: number): number {
  return Math.round(value / 5) * 5;
}

/** Calcula el avance en código: por parte hechos/total, total con pesos iguales, menos avisos, redondeado a 5 y con tope de cambio. */
export function computeProgress(input: {
  items: readonly ChecklistItem[];
  parts: readonly string[];
  alertas: readonly RoomWarning[];
  previous: RoomProgress | null;
  language?: "es" | "en";
  now?: Date;
}): RoomProgress {
  const names = input.parts.length > 0 ? [...input.parts] : [...new Set(input.items.map((item) => item.parte))];
  const partes: PartProgress[] = names.map((parte) => {
    const list = input.items.filter((item) => fold(item.parte) === fold(parte));
    const hechos = list.filter((item) => item.hecho).length;
    return { parte, hechos, total: list.length, avance: list.length > 0 ? Math.round((hechos / list.length) * 100) : 0 };
  });
  const counted = partes.filter((part) => part.total > 0);
  const base = counted.length > 0 ? counted.reduce((sum, part) => sum + part.avance, 0) / counted.length : 0;
  const contradictions = input.alertas.filter((warning) => warning.tipo === "contradiccion").length;
  const duplicates = input.alertas.filter((warning) => warning.tipo === "duplicado").length;
  const penalizacion = Math.min(
    PROGRESS_LIMITS.maxPenalty,
    contradictions * PROGRESS_LIMITS.contradiction + duplicates * PROGRESS_LIMITS.duplicate,
  );
  const bruto = clamp(roundTo5(base - penalizacion), 0, 100);
  const anterior = input.previous ? input.previous.valor : null;
  const valor =
    anterior === null ? bruto : clamp(bruto, anterior - PROGRESS_LIMITS.maxStep, anterior + PROGRESS_LIMITS.maxStep);
  return {
    items: [...input.items],
    partes,
    bruto,
    penalizacion,
    valor,
    anterior,
    delta: anterior === null ? 0 : valor - anterior,
    motivo: progressReason(input.previous?.items ?? [], input.items, penalizacion, input.previous?.penalizacion ?? 0, input.language ?? "es"),
    calculadoEn: (input.now ?? new Date()).toISOString(),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function progressReason(
  before: readonly ChecklistItem[],
  after: readonly ChecklistItem[],
  penalty: number,
  previousPenalty: number,
  language: "es" | "en",
): string {
  const done = new Set(before.filter((item) => item.hecho).map((item) => itemKey(item.parte, item.texto)));
  const newlyDone = after.filter((item) => item.hecho && !done.has(itemKey(item.parte, item.texto)));
  const known = new Set(before.map((item) => itemKey(item.parte, item.texto)));
  const added = after.filter((item) => !known.has(itemKey(item.parte, item.texto)) && !item.hecho);
  const en = language === "en";
  const parts: string[] = [];
  if (newlyDone.length > 0) {
    const names = newlyDone.slice(0, 2).map((item) => item.texto.toLocaleLowerCase(en ? "en" : "es")).join(", ");
    parts.push(en ? `done: ${names}${newlyDone.length > 2 ? "…" : ""}` : `listo: ${names}${newlyDone.length > 2 ? "…" : ""}`);
  }
  if (before.length > 0 && added.length > 0) parts.push(en ? `${added.length} new to-dos` : `${added.length} pendientes nuevos`);
  if (penalty > previousPenalty) parts.push(en ? "new contradictions or duplicates" : "nuevas contradicciones o duplicados");
  if (penalty < previousPenalty) parts.push(en ? "fewer contradictions" : "menos contradicciones");
  if (parts.length === 0) return en ? "No changes since the last analysis" : "Sin cambios desde el último análisis";
  const text = parts.join(" · ");
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/* ---------- Lista por reglas (sin IA) ---------- */

type Template = { match: RegExp; items: { es: string; en: string; evidence: RegExp }[] };

const TEMPLATES: Template[] = [
  {
    match: /informe|documento|reporte|report|escrito|paper|ensayo|essay/,
    items: [
      { es: "Introducción", en: "Introduction", evidence: /introducci|introduction/ },
      { es: "Objetivos", en: "Objectives", evidence: /objetivo|objective/ },
      { es: "Requisitos", en: "Requirements", evidence: /requisito|requerimiento|requirement/ },
      { es: "Diseño", en: "Design", evidence: /dise[nñ]o|design|diagrama|persistencia/ },
      { es: "Conclusiones", en: "Conclusions", evidence: /^(?!.*falta).*conclusi/ },
      { es: "Bibliografía", en: "Bibliography", evidence: /^(?!.*falta).*(bibliograf|referencias apa|references)/ },
    ],
  },
  {
    match: /c[oó]digo|code|programa|desarrollo|backend|frontend|app|software/,
    items: [
      { es: "Requisitos y clases", en: "Requirements and classes", evidence: /clase|class|requisito|rf1/ },
      { es: "Base de datos", en: "Database", evidence: /create table|sqlite|base de datos|database|tabla/ },
      { es: "Funciones principales", en: "Main functions", evidence: /\bdef |function |funci[oó]n /i },
      { es: "Interfaz o menú", en: "Interface or menu", evidence: /men[uú]|interfaz|interface|pantalla|screen/ },
      { es: "Pruebas", en: "Tests", evidence: /unittest|pytest|caso de prueba|test case|\btests?\b/ },
    ],
  },
  {
    match: /presentaci|diapositiva|slides|exposici|presentation|pitch/,
    items: [
      { es: "Estructura de diapositivas", en: "Slide outline", evidence: /diapositiva|slide/ },
      { es: "Contenido técnico", en: "Technical content", evidence: /script|tabla|diagrama|c[oó]digo|code/ },
      { es: "Demo del sistema", en: "System demo", evidence: /demo|demostraci/ },
      { es: "Cierre y conclusiones", en: "Closing", evidence: /cierre|closing|conclusi[oó]n de la presentaci/ },
    ],
  },
];

const GENERIC: Template["items"] = [
  { es: "Primer avance", en: "First draft", evidence: /./ },
  { es: "Versión completa", en: "Complete version", evidence: /versi[oó]n (final|completa)|final version/ },
  { es: "Revisión final", en: "Final review", evidence: /revisi[oó]n|review/ },
];

/** Lista por reglas: entregables típicos de cada parte; hecho si hay una respuesta o archivo que lo muestra. */
export function rulesChecklist(input: {
  parts: readonly string[];
  members: readonly { name: string; part: string | null }[];
  events: readonly StoredEvent[];
  language: "es" | "en";
}): ChecklistItem[] {
  const parts = input.parts.length > 0 ? input.parts : [...new Set(input.members.map((m) => m.part).filter((p): p is string => Boolean(p)))];
  const out: ChecklistItem[] = [];
  for (const parte of parts) {
    const template = TEMPLATES.find((entry) => entry.match.test(fold(parte)))?.items ?? GENERIC;
    const owners = new Set(input.members.filter((m) => m.part && fold(m.part) === fold(parte)).map((m) => m.name));
    const evidence = input.events.filter((event) => event.type !== "prompt" && (owners.size === 0 || owners.has(event.member)));
    for (const item of template) {
      const found = evidence.find((event) => item.evidence.test(event.text.toLocaleLowerCase("es")));
      out.push({
        parte,
        texto: input.language === "en" ? item.en : item.es,
        hecho: Boolean(found),
        evidencia: found ? found.text.slice(0, 120) : "",
      });
    }
  }
  return out;
}

export function readProgress(value: unknown): RoomProgress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.valor !== "number" || !Array.isArray(record.items) || !Array.isArray(record.partes)) return null;
  return {
    items: (record.items as ChecklistItem[]).filter((item) => item && typeof item.texto === "string" && typeof item.parte === "string"),
    partes: record.partes as PartProgress[],
    bruto: typeof record.bruto === "number" ? record.bruto : record.valor,
    penalizacion: typeof record.penalizacion === "number" ? record.penalizacion : 0,
    valor: record.valor,
    anterior: typeof record.anterior === "number" ? record.anterior : null,
    delta: typeof record.delta === "number" ? record.delta : 0,
    motivo: typeof record.motivo === "string" ? record.motivo : "",
    calculadoEn: typeof record.calculadoEn === "string" ? record.calculadoEn : new Date(0).toISOString(),
  };
}
