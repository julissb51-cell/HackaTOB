import type { RoomWarning, StoredEvent } from "./room-types";

type StorageItem = { id: string; label: string; pattern: RegExp; family: string };

const STORAGE: StorageItem[] = [
  { id: "json", label: "JSON", pattern: /\bjson\b/, family: "archivo-json" },
  { id: "csv", label: "CSV", pattern: /\bcsv\b/, family: "archivo-csv" },
  { id: "sqlite", label: "SQLite", pattern: /\bsqlite3?\b/, family: "sqlite" },
  { id: "mysql", label: "MySQL", pattern: /\bmysql\b|\bmariadb\b/, family: "mysql" },
  { id: "postgres", label: "PostgreSQL", pattern: /\bpostgres(ql)?\b/, family: "postgres" },
  { id: "supabase", label: "Supabase", pattern: /\bsupabase\b/, family: "postgres" },
  { id: "mongodb", label: "MongoDB", pattern: /\bmongo(db)?\b/, family: "mongodb" },
  { id: "firebase", label: "Firebase", pattern: /\bfirebase\b|\bfirestore\b/, family: "firebase" },
  { id: "localstorage", label: "localStorage", pattern: /\blocalstorage\b/, family: "localstorage" },
];

export type StorageConflictInput = {
  room: { language?: "es" | "en" | null };
  members: { name: string; part: string | null }[];
  events: readonly StoredEvent[];
};

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

/** Familias de almacenamiento nombradas en un texto. */
export function familiesMentioned(text: string): string[] {
  const folded = fold(text);
  return STORAGE.filter((item) => item.pattern.test(folded)).map((item) => item.family);
}

/** La última tecnología nombrada en el texto. Si el mensaje cierra en SQLite, esa es la decisión. */
function choiceIn(text: string): StorageItem | null {
  const folded = fold(text);
  let best: { pos: number; item: StorageItem } | null = null;
  for (const item of STORAGE) {
    const re = new RegExp(item.pattern.source, "g");
    let found: RegExpExecArray | null;
    while ((found = re.exec(folded))) {
      if (!best || found.index >= best.pos) best = { pos: found.index, item };
    }
  }
  return best?.item ?? null;
}

/** La decisión vigente de cada miembro: la del evento más reciente que nombra una forma de guardar. */
function storageByMember(events: readonly StoredEvent[]): Map<string, StorageItem> {
  const result = new Map<string, StorageItem>();
  const ordered = [...events].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  for (const event of ordered) {
    const item = choiceIn(event.text);
    if (item) result.set(event.member, item);
  }
  return result;
}

/** Contradicción cuando los miembros guardan los datos de formas distintas. Un aviso por miembro afectado. */
export function storageConflicts(input: StorageConflictInput): RoomWarning[] {
  const english = input.room.language === "en";
  const byMember = storageByMember(input.events);
  const families = new Set([...byMember.values()].map((item) => item.family));
  if (families.size < 2) return [];
  const join = (names: string[]) => names.join(english ? " and " : " y ");
  const result: RoomWarning[] = [];
  for (const [member, mine] of byMember) {
    const others = [...byMember.entries()].filter(([, item]) => item.family !== mine.family);
    const otherText = unique(others.map(([, item]) => item.label))
      .map((label) => `${english ? "the work of " : "en lo de "}${join(others.filter(([, item]) => item.label === label).map(([name]) => name))} ${english ? "uses" : "se usa"} ${label}`)
      .join("; ");
    const parts = [member, ...others.map(([name]) => name)]
      .map((name) => input.members.find((m) => m.name === name)?.part)
      .filter((part): part is string => Boolean(part));
    result.push({
      tipo: "contradiccion",
      destinatario: member,
      partes: unique(parts),
      mensaje: english
        ? `${member}'s work uses ${mine.label} for the data, but ${otherText}. Agree on one way to store the data.`
        : `En lo de ${member} los datos van en ${mine.label}, pero ${otherText}. Pónganse de acuerdo en una sola forma de guardar los datos.`,
      prompt_sugerido: english
        ? `My team stores the data in ${others[0][1].label} and I used ${mine.label}. Help me compare both and adapt my part to the option we choose.`
        : `En mi equipo guardan los datos en ${others[0][1].label} y yo usé ${mine.label}. Ayúdame a comparar las dos opciones y a adaptar mi parte a la que elijamos.`,
    });
  }
  return result;
}
