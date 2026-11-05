import type { ContextResponse, MemberRecord, RoomInfo, RoomWarning, StoredEvent } from "./room-types";
import { storageConflicts } from "./storage-conflict";

const STOP = new Set([
  "sobre",
  "entre",
  "desde",
  "hasta",
  "todos",
  "todas",
  "puede",
  "pueden",
  "hacer",
  "donde",
  "cuando",
  "porque",
  "tambien",
  "tiene",
  "tienen",
  "estan",
  "estas",
  "estos",
  "segun",
  "seria",
  "hacia",
  "mismo",
  "misma",
  "otros",
  "otras",
  "contra",
  "aunque",
  "durante",
  "mientras",
  "nuestro",
  "nuestra",
  "ustedes",
  "alguna",
  "algunos",
  "algunas",
]);

const NUMBER_RE = /\d{1,3}(?:\.\d{3})+|\d+/g;

export function buildContext(input: {
  room: RoomInfo;
  members: MemberRecord[];
  events: StoredEvent[];
  member: string;
}): ContextResponse {
  const members = [...input.members].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const events = sortedEvents(input.events);
  const part = partFor(input.member, members, events);
  return {
    resumen: buildResumen(input.room, members, events),
    parte: part,
    prompt_sugerido: buildPrompt(input.member, part, input.room, members),
    advertencias: buildWarnings(input.room, input.member, part, members, events),
  };
}

function buildResumen(room: RoomInfo, members: MemberRecord[], events: StoredEvent[]): string {
  const sentences: string[] = [];
  const topic = room.topic.trim() || room.projectName?.trim() || "";
  sentences.push(topic ? `El equipo trabaja en ${topic}.` : "La sala todavía no tiene tema.");

  if (members.length === 0) {
    sentences.push("La sala todavía no tiene miembros.");
  } else {
    const bits = members.map((member) => {
      const part = member.part?.trim();
      return part ? `${member.name} hace ${part}` : `${member.name} todavía no tiene parte`;
    });
    sentences.push(`${bits.join(". ")}.`);
  }

  if (events.length === 0) {
    sentences.push("Todavía no hay eventos.");
  } else {
    const last = events[events.length - 1];
    const noun = events.length === 1 ? "evento" : "eventos";
    sentences.push(`Hay ${events.length} ${noun}. El último es de ${last.member}: ${snippet(last.text)}`);
  }

  return sentences.join(" ");
}

function buildPrompt(memberName: string, part: string, room: RoomInfo, members: MemberRecord[]): string {
  const lead = part === "sin parte" ? "Elige tu parte en la sala y sigue con ella." : `Sigue con ${part}.`;
  const topic = room.topic.trim() || room.projectName?.trim() || "";
  const topicSentence = topic ? ` El trabajo es ${topic}.` : "";
  const avoid = members
    .filter((member) => member.name !== memberName && member.part?.trim())
    .map((member) => `No cambies ${member.part?.trim()}: eso lo está haciendo ${member.name}.`)
    .join(" ");
  return `${lead}${topicSentence}${avoid ? ` ${avoid}` : ""}`;
}

function buildWarnings(
  room: RoomInfo,
  memberName: string,
  part: string,
  members: MemberRecord[],
  events: StoredEvent[],
): RoomWarning[] {
  const warnings: RoomWarning[] = [];
  const due = room.dueDate?.trim() ?? "";
  if (!due || due === "sin fecha") {
    warnings.push({
      tipo: "falta",
      mensaje: "La sala no tiene fecha de entrega.",
      destinatario: memberName,
      partes: [part],
      prompt_sugerido: "Confirma con el equipo la fecha de entrega y anótala en la sala.",
    });
  }

  if (!events.some((event) => event.member === memberName)) {
    warnings.push({
      tipo: "falta",
      mensaje: `${memberName} todavía no compartió eventos en la sala.`,
      destinatario: memberName,
      partes: [part],
      prompt_sugerido: `Comparte un prompt, una respuesta o un archivo de ${part} para que el equipo lo vea.`,
    });
  }

  const silent = members.filter(
    (member) => member.name !== memberName && !events.some((event) => event.member === member.name),
  );
  if (silent.length > 0) {
    const names = silent.map((member) => member.name);
    warnings.push({
      tipo: "falta",
      mensaje:
        names.length === 1
          ? `${names[0]} todavía no compartió trabajo en la sala.`
          : `${joinEs(names)} todavía no compartieron trabajo en la sala.`,
      destinatario: memberName,
      partes: partsOf(names, members, part),
      prompt_sugerido: `Pregunta a ${joinEs(names)} cómo va su parte antes de seguir.`,
    });
  }

  warnings.push(...contradictions(memberName, members, events));
  warnings.push(...duplicates(memberName, part, members, events));
  const mine = memberName.toLocaleLowerCase("es");
  const storage = storageConflicts({
    room: { language: "es" },
    members,
    events,
  }).filter((warning) => warning.destinatario.toLocaleLowerCase("es") === mine);
  return [...storage, ...warnings].slice(0, 8);
}

function contradictions(memberName: string, members: MemberRecord[], events: StoredEvent[]): RoomWarning[] {
  const grouped = new Map<string, Array<{ value: string; member: string }>>();
  for (const event of events) {
    for (const claim of claimsFrom(event)) {
      const list = grouped.get(claim.keyword) ?? [];
      list.push({ value: claim.value, member: claim.member });
      grouped.set(claim.keyword, list);
    }
  }

  const warnings: RoomWarning[] = [];
  for (const keyword of [...grouped.keys()].sort((a, b) => a.localeCompare(b, "es"))) {
    const claims = grouped.get(keyword) ?? [];
    const values: string[] = [];
    const authors: string[] = [];
    for (const claim of claims) {
      if (!values.includes(claim.value)) values.push(claim.value);
      if (!authors.includes(claim.member)) authors.push(claim.member);
    }
    if (values.length < 2 || !authors.includes(memberName)) continue;
    if (!peopleDisagree(claims)) continue;
    warnings.push({
      tipo: "contradiccion",
      mensaje: `Hay cifras distintas para «${keyword}»: ${joinEs(values)}.`,
      destinatario: memberName,
      partes: partsOf(authors, members, memberName),
      prompt_sugerido: `Revisa con el equipo la cifra de ${keyword} y deja un solo número.`,
    });
  }
  return warnings;
}

function claimsFrom(event: StoredEvent): Array<{ keyword: string; value: string; member: string }> {
  const text = event.text.replace(/\d{4}-\d{2}-\d{2}(?:t[\d:.+-]*)?/gi, " ");
  const found: Array<{ keyword: string; value: string; member: string }> = [];
  for (const match of text.matchAll(NUMBER_RE)) {
    const raw = match[0];
    if (/^\d{4}$/.test(raw)) {
      const year = Number(raw);
      if (year >= 1900 && year <= 2100) continue;
    }
    const value = normalizeNumber(raw);
    if (!value) continue;
    const before = text.slice(Math.max(0, (match.index ?? 0) - 1), match.index ?? 0);
    // RF1, v2, item_3: es un identificador, no una cifra.
    if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_#-]/.test(before)) continue;
    const start = (match.index ?? 0) + raw.length;
    // "1. registrar" o "2) buscar": es un número de lista.
    if (/^[.)]\s/.test(text.slice(start, start + 2))) continue;
    const word = text.slice(start, start + 30).match(/^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{5,})/);
    if (!word) continue;
    const keyword = fold(word[1]);
    if (STOP.has(keyword)) continue;
    found.push({ keyword, value, member: event.member });
  }
  return found;
}

// Con cifras chicas (1, 2, 3...) solo hay contradicción si personas distintas dan cifras distintas y cada una
// sostiene una sola cifra. Si alguien ya usa varias, son números sueltos.
function peopleDisagree(claims: Array<{ value: string; member: string }>): boolean {
  // Cifras grandes (100.000 vs 10.000) sí cuentan aunque las diga la misma persona.
  if (claims.every((claim) => Number(claim.value) >= 10)) return true;
  const byMember = new Map<string, Set<string>>();
  for (const claim of claims) {
    const set = byMember.get(claim.member) ?? new Set<string>();
    set.add(claim.value);
    byMember.set(claim.member, set);
  }
  if (byMember.size < 2) return false;
  if ([...byMember.values()].some((set) => set.size > 1)) return false;
  return new Set([...byMember.values()].map((set) => [...set][0])).size > 1;
}

function normalizeNumber(raw: string): string | null {
  const digits = /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return String(value);
}

function duplicates(
  memberName: string,
  part: string,
  members: MemberRecord[],
  events: StoredEvent[],
): RoomWarning[] {
  const prompts = events.filter((event) => event.type === "prompt");
  const mine = prompts.filter((event) => event.member === memberName);
  if (mine.length === 0) return [];
  const others = [...new Set(prompts.map((event) => event.member).filter((name) => name !== memberName))].sort(
    (a, b) => a.localeCompare(b, "es"),
  );
  const warnings: RoomWarning[] = [];
  for (const other of others) {
    const theirs = prompts.filter((event) => event.member === other);
    let best: { shared: string[]; jaccard: number } | null = null;
    for (const left of mine) {
      for (const right of theirs) {
        const score = comparePrompts(left.text, right.text);
        const better =
          !best ||
          score.shared.length > best.shared.length ||
          (score.shared.length === best.shared.length && score.jaccard > best.jaccard);
        if (better) best = score;
      }
    }
    if (!best || best.shared.length < 3 || best.jaccard < 0.45) continue;
    const otherPart = members.find((member) => member.name === other)?.part?.trim() || other;
    warnings.push({
      tipo: "duplicado",
      mensaje: `${memberName} y ${other} pidieron a sus IAs algo muy parecido: ${best.shared.slice(0, 4).join(", ")}.`,
      destinatario: memberName,
      partes: unique([part, otherPart]),
      prompt_sugerido: `Sigue con ${part}. Avisa a ${other} para no repetir el mismo trabajo.`,
    });
  }
  return warnings;
}

function comparePrompts(left: string, right: string): { shared: string[]; jaccard: number } {
  const a = words(left);
  const b = new Set(words(right).map((word) => word.fold));
  const shared = a.filter((word) => b.has(word.fold));
  const union = new Set([...a.map((word) => word.fold), ...b]);
  return {
    shared: shared.map((word) => word.raw),
    jaccard: union.size === 0 ? 0 : shared.length / union.size,
  };
}

function words(text: string): Array<{ fold: string; raw: string }> {
  const result: Array<{ fold: string; raw: string }> = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g)) {
    const raw = match[0];
    const folded = fold(raw);
    if (folded.length < 5 || STOP.has(folded) || seen.has(folded)) continue;
    seen.add(folded);
    result.push({ fold: folded, raw });
  }
  return result;
}

function partFor(memberName: string, members: MemberRecord[], events: StoredEvent[]): string {
  const stored = members.find((member) => member.name === memberName)?.part?.trim();
  if (stored) return stored;
  const named = events.find((event) => event.member === memberName && event.conversationName?.trim());
  if (named?.conversationName?.trim()) return named.conversationName.trim();
  return "sin parte";
}

function partsOf(names: string[], members: MemberRecord[], fallback: string): string[] {
  const parts = names.map((name) => members.find((member) => member.name === name)?.part?.trim() || name);
  const uniqueParts = unique(parts);
  return uniqueParts.length > 0 ? uniqueParts : [fallback];
}

function sortedEvents(events: StoredEvent[]): StoredEvent[] {
  return events
    .map((event, index) => ({ event, index, time: eventTime(event) }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map((item) => item.event);
}

function eventTime(event: StoredEvent): number {
  const time = Date.parse(event.createdAt);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function snippet(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 140) return flat;
  return `${flat.slice(0, 137)}...`;
}

function joinEs(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function fold(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}
