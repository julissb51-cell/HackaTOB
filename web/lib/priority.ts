import type { RoomWarning, WarningPriority } from "./room-types";

export const PRIORITIES: readonly WarningPriority[] = ["urgente", "pronto", "puede_esperar"];

const ALIASES: Record<string, WarningPriority> = {
  urgente: "urgente", alta: "urgente", alto: "urgente", high: "urgente", urgent: "urgente",
  pronto: "pronto", media: "pronto", medio: "pronto", medium: "pronto", soon: "pronto",
  puede_esperar: "puede_esperar", "puede esperar": "puede_esperar", baja: "puede_esperar", bajo: "puede_esperar",
  low: "puede_esperar", can_wait: "puede_esperar", "can wait": "puede_esperar",
};

/** Lee una prioridad escrita por la IA (acepta alias); devuelve undefined si no se reconoce. */
export function readPriority(value: unknown): WarningPriority | undefined {
  if (typeof value !== "string") return undefined;
  return ALIASES[value.trim().toLowerCase().replace(/-/g, "_")] ?? ALIASES[value.trim().toLowerCase()];
}

const MINOR = /bibliograf|referencias|formato|estilo|ortograf|portada|t[ií]tulo|nombre del chat|citas?\b|typo|formatting|cover page|bibliography|references/i;
const URGENT_DAYS = 3;

/** Días que faltan para la entrega (negativo si ya pasó); null si no hay fecha. */
export function daysUntil(dueDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const due = Date.parse(`${dueDate}T23:59:59Z`);
  if (Number.isNaN(due)) return null;
  return Math.floor((due - now.getTime()) / 86_400_000);
}

/** Prioridad por defecto cuando el aviso no trae una. */
export function defaultPriority(warning: Pick<RoomWarning, "tipo" | "mensaje">, dueDate: string | null | undefined, now: Date = new Date()): WarningPriority {
  if (warning.tipo === "contradiccion") return "urgente";
  if (warning.tipo === "duplicado") return MINOR.test(warning.mensaje) ? "puede_esperar" : "pronto";
  if (MINOR.test(warning.mensaje)) return "puede_esperar";
  const days = daysUntil(dueDate, now);
  return days !== null && days <= URGENT_DAYS ? "urgente" : "pronto";
}

export function withPriority<T extends RoomWarning>(warning: T, dueDate: string | null | undefined, now?: Date): T {
  const known = readPriority(warning.prioridad);
  return { ...warning, prioridad: known ?? defaultPriority(warning, dueDate, now) };
}

export function withPriorities<T extends RoomWarning>(list: readonly T[], dueDate: string | null | undefined, now?: Date): T[] {
  return list.map((warning) => withPriority(warning, dueDate, now));
}

export function priorityRank(priority: WarningPriority | undefined): number {
  const index = priority ? PRIORITIES.indexOf(priority) : -1;
  return index === -1 ? PRIORITIES.length : index;
}

/** Orden estable: urgente, pronto, puede esperar. */
export function sortByPriority<T extends RoomWarning>(list: readonly T[]): T[] {
  return list
    .map((warning, index) => ({ warning, index }))
    .sort((a, b) => priorityRank(a.warning.prioridad) - priorityRank(b.warning.prioridad) || a.index - b.index)
    .map((entry) => entry.warning);
}

export function countByPriority(list: readonly RoomWarning[]): Record<WarningPriority, number> {
  const counts: Record<WarningPriority, number> = { urgente: 0, pronto: 0, puede_esperar: 0 };
  for (const warning of list) counts[warning.prioridad ?? "pronto"] += 1;
  return counts;
}
