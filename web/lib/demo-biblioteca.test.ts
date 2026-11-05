import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildContext } from "./context-from-events";
import { contextFromSaved, produceReport, type AnalysisInput } from "./analyst";
import { computeProgress } from "./progress";
import type { AiName, EventType, StoredEvent } from "./room-types";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/biblioteca-json-sqlite.json", import.meta.url), "utf8")) as {
  label: string;
  room: AnalysisInput["room"];
  members: AnalysisInput["members"];
  conflict: Array<{ member: string; ai: AiName; type: EventType; text: string }>;
  resolution: Array<{ member: string; ai: AiName; type: EventType; text: string }>;
};

function events(lines: typeof fixture.conflict): StoredEvent[] {
  return lines.map((line, index) => ({
    eventId: `muestra_${index + 1}`,
    roomId: fixture.room.id,
    member: line.member,
    ai: line.ai,
    type: line.type,
    conversationId: `chat-${line.member}`,
    conversationName: null,
    text: line.text,
    createdAt: new Date(Date.UTC(2026, 10, 5, 12, index)).toISOString(),
  }));
}

function input(lines: typeof fixture.conflict): AnalysisInput {
  return { room: fixture.room, members: fixture.members, events: events(lines) };
}

test("la muestra está marcada como ensayo local", () => {
  assert.match(fixture.label, /no se envía/i);
  assert.equal(fixture.room.id, "ensayo-local");
});

test("JSON contra SQLite avisa a Ana y a Luis, y se alinea cuando Ana cierra en SQLite", async () => {
  const conflict = input(fixture.conflict);
  const rules = await produceReport(conflict, async () => {
    throw new Error("gemini no disponible en este ensayo");
  });
  assert.equal(rules.fuente, "reglas");
  const storage = rules.report.alertas.filter((warning) => warning.tipo === "contradiccion");
  assert.deepEqual(storage.map((warning) => warning.destinatario).sort(), ["Ana", "Luis"]);
  for (const warning of storage) {
    assert.match(warning.mensaje, /JSON/);
    assert.match(warning.mensaje, /SQLite/);
  }
  const progress = computeProgress({
    items: rules.report.checklist ?? [],
    parts: fixture.room.parts,
    alertas: rules.report.alertas,
    previous: null,
  });
  assert.ok(progress.penalizacion >= 3);

  const ana = buildContext({
    room: { id: fixture.room.id, topic: fixture.room.topic, projectName: null, dueDate: fixture.room.dueDate },
    members: fixture.members,
    events: conflict.events,
    member: "Ana",
  });
  assert.equal(ana.parte, "Informe escrito");
  assert.ok(ana.advertencias.some((warning) => warning.tipo === "contradiccion" && warning.destinatario === "Ana"));
  assert.equal(ana.advertencias.some((warning) => warning.destinatario === "Luis"), false);

  const fromRules = contextFromSaved(
    {
      fuente: "reglas",
      resumen: "no debe reemplazar el resumen local",
      miembros: [],
      alertas: rules.report.alertas,
      chats: [],
      sugerencia: null,
      sugerenciaEstado: "ninguna",
      consejo: "",
      idioma: "es",
      pending: false,
      ranAt: "2026-11-05T12:00:00.000Z",
    },
    "Ana",
    ana,
    fixture.room.dueDate,
  );
  assert.match(fromRules.resumen, /Sistema de gestión de biblioteca/);
  assert.equal(fromRules.resumen.includes("no debe reemplazar"), false);
  assert.ok(fromRules.advertencias.some((warning) => warning.destinatario === "Ana" && warning.tipo === "contradiccion"));

  const aligned = input([...fixture.conflict, ...fixture.resolution]);
  const after = await produceReport(aligned, async () => {
    throw new Error("gemini no disponible en este ensayo");
  });
  assert.equal(after.report.alertas.filter((warning) => warning.tipo === "contradiccion").length, 0);
});
