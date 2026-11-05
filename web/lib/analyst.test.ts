import assert from "node:assert/strict";
import test from "node:test";
import {
  addMissedOverlaps,
  dedupeSimilar,
  storageConflicts,
  deliverableOverlaps,
  ANALYSIS_INTERVAL_MS,
  ANALYST_LIMITS,
  acceptedRoomUpdate,
  analysisDue,
  buildAnalystMessages,
  buildFallbackReport,
  nextSuggestionStatus,
  parseAnalystOutput,
  produceReport,
  type AnalysisInput,
} from "./analyst";
import type { StoredEvent } from "./room-types";

test("el prompt pide el idioma de la sala y corta el texto largo", () => {
  const input = sample();
  input.events = [
    event({
      eventId: "evt_largo",
      text: "x".repeat(50_000),
    }),
  ];
  const messages = buildAnalystMessages(input);
  const user = messages.find((message) => message.role === "user")?.content ?? "";
  assert.match(messages[0]?.content ?? "", /JSON/);
  assert.match(user, /español/);
  assert.match(user, /cortaron|cortó/);
  assert.ok(user.length <= ANALYST_LIMITS.maxPromptChars);
  assert.equal(user.includes("x".repeat(2_000)), false);

  input.room.language = "en";
  const english = buildAnalystMessages(input).find((message) => message.role === "user")?.content ?? "";
  assert.match(english, /inglés/);
});

test("el JSON con basura alrededor se lee y se descarta un aviso inválido", () => {
  const raw = `aquí va\n\`\`\`json\n${JSON.stringify({
    resumen: "El equipo cerró la pantalla.",
    miembros: [
      {
        nombre: "Ana",
        resumen: "Ana sigue la pantalla.",
        parte: "Pantalla",
        prompt_sugerido: "Sigue la pantalla.",
        advertencias: [
          { tipo: "nota", mensaje: "esto no entra", destinatario: "Ana", partes: [], prompt_sugerido: "" },
          {
            tipo: "duplicado",
            mensaje: "Ana y Luis diseñaron la lista.",
            destinatario: "Ana",
            partes: ["Pantalla"],
            prompt_sugerido: "Deja la lista en la pantalla.",
          },
        ],
      },
    ],
    chats: [
      { conversation_id: "chatgpt_abc123", nombre: "Pantalla de la sala compartida" },
      { conversation_id: "inventado", nombre: "No existe" },
    ],
    sugerencia: { partes: ["Pantalla"], fecha_entrega: "2026-11-20", asignaciones: [{ nombre: "Ana", parte: "Pantalla" }] },
  })}\n\`\`\`\nlisto`;

  const report = parseAnalystOutput(raw, ["chatgpt_abc123"]);
  assert.equal(report?.resumen, "El equipo cerró la pantalla.");
  assert.equal(report?.miembros[0]?.advertencias.length, 1);
  assert.equal(report?.miembros[0]?.advertencias[0]?.tipo, "duplicado");
  assert.deepEqual(report?.chats, [{ conversationId: "chatgpt_abc123", nombre: "Pantalla de la sala compartida" }]);
  assert.equal(report?.sugerencia?.fecha, "2026-11-20");
  assert.equal(parseAnalystOutput("no es json", ["chatgpt_abc123"]), null);
});

test("si el proveedor falla o responde mal, quedan las reglas", async () => {
  const input = sample();
  const timeout = await produceReport(input, async () => {
    throw new Error("el analista no respondió a tiempo");
  });
  assert.equal(timeout.fuente, "reglas");
  assert.match(timeout.report.resumen, /App para repartir/);
  assert.equal(timeout.report.miembros.find((member) => member.nombre === "Ana")?.parte, "Pantalla de la sala");

  const garbage = await produceReport(input, async () => "hola");
  assert.equal(garbage.fuente, "reglas");
  assert.ok(garbage.report.chats.some((chat) => chat.conversationId === "chatgpt_abc123"));
});

test("un JSON válido reemplaza el resumen y conserva la forma", async () => {
  const input = sample();
  const result = await produceReport(input, async () =>
    JSON.stringify({
      resumen: "Resumen del analista.",
      miembros: [
        {
          nombre: "Ana",
          resumen: "Ana tiene la pantalla.",
          parte: "Pantalla de la sala",
          prompt_sugerido: "Sigue con la pantalla.",
          advertencias: [],
        },
      ],
      alertas: [],
      chats: [{ conversation_id: "chatgpt_abc123", nombre: "Pantalla lista" }],
      sugerencia: { partes: [], fecha_entrega: null, asignaciones: [] },
    }),
  );
  assert.equal(result.fuente, "ia");
  assert.equal(result.report.resumen, "Resumen del analista.");
  assert.equal(result.report.miembros.find((member) => member.nombre === "Luis")?.parte, "Datos");
  const named = result.report.chats.find((chat) => chat.conversationId === "cursor_def456");
  assert.ok(named && named.nombre.length > 0);
  assert.equal(result.report.sugerencia, null);
});

test("la sugerencia no pisa partes ni una fecha ya elegida", () => {
  const suggestion = {
    partes: ["Otra"],
    fecha: "2026-12-01",
    asignaciones: [{ nombre: "Ana", parte: "Otra" }],
  };
  const kept = acceptedRoomUpdate(
    { parts: ["Pantalla"], dueDate: "sin fecha" },
    [{ name: "Ana", part: "Pantalla" }],
    suggestion,
  );
  assert.deepEqual(kept.parts, ["Pantalla"]);
  assert.equal(kept.dueDate, "sin fecha");
  assert.deepEqual(kept.memberParts, []);

  const filled = acceptedRoomUpdate({ parts: [], dueDate: null }, [{ name: "Ana", part: null }], suggestion);
  assert.deepEqual(filled.parts, ["Otra"]);
  assert.equal(filled.dueDate, "2026-12-01");
  assert.deepEqual(filled.memberParts, [{ name: "Ana", part: "Otra" }]);
});

test("sin partes ni fecha, las reglas proponen una división y un día", () => {
  const input = sample();
  input.room.parts = [];
  input.room.dueDate = null;
  input.events.push(
    event({
      eventId: "evt_fecha",
      member: "Luis",
      type: "archivo",
      conversationId: "cursor_def456",
      text: "La entrega quedó para 2026-11-20 en el archivo.",
    }),
  );
  const report = buildFallbackReport(input);
  assert.ok(report.sugerencia?.partes.includes("Pantalla de la sala"));
  assert.equal(report.sugerencia?.fecha, "2026-11-20");
  assert.equal(report.chats.find((chat) => chat.conversationId === "chatgpt_abc123")?.nombre, "Pantalla de la sala");

  input.room.dueDate = "sin fecha";
  assert.equal(buildFallbackReport(input).sugerencia?.fecha ?? null, null);
});

test("el análisis corre como máximo cada 30 segundos, salvo a mano", () => {
  const now = 1_000_000;
  assert.equal(analysisDue(null, now, false), true);
  assert.equal(analysisDue(now - 10_000, now, false), false);
  assert.equal(analysisDue(now - ANALYSIS_INTERVAL_MS, now, false), true);
  assert.equal(analysisDue(now - 1_000, now, true), true);
  assert.equal(
    nextSuggestionStatus(
      { sugerenciaEstado: "descartada", sugerencia: { partes: ["Datos"], fecha: null, asignaciones: [] } },
      { partes: ["Datos"], fecha: null, asignaciones: [] },
    ),
    "descartada",
  );
  assert.equal(
    nextSuggestionStatus(
      { sugerenciaEstado: "descartada", sugerencia: { partes: ["Datos"], fecha: null, asignaciones: [] } },
      { partes: ["Pantalla"], fecha: null, asignaciones: [] },
    ),
    "pendiente",
  );
});

function sample(): AnalysisInput {
  return {
    room: {
      id: "demo",
      topic: "App para repartir tareas de un trabajo",
      dueDate: "2026-11-06",
      parts: ["Pantalla de la sala", "Datos"],
      language: "es",
    },
    members: [
      { name: "Ana", part: "Pantalla de la sala" },
      { name: "Luis", part: "Datos" },
    ],
    events: [
      event({
        eventId: "evt_demo_001",
        text: "Arma la pantalla de una sala compartida para un equipo de estudiantes.",
        conversationName: "Pantalla de la sala",
      }),
      event({
        eventId: "evt_demo_003",
        member: "Luis",
        ai: "cursor",
        type: "archivo",
        conversationId: "cursor_def456",
        conversationName: "Modelo de la sala",
        text: "Cada sala guarda tema, miembros y fecha.",
        createdAt: "2026-11-03T09:20:00-06:00",
      }),
    ],
  };
}

function event(overrides: Partial<StoredEvent> & { eventId: string; text: string }): StoredEvent {
  return {
    eventId: overrides.eventId,
    roomId: "demo",
    member: overrides.member ?? "Ana",
    ai: overrides.ai ?? "chatgpt",
    type: overrides.type ?? "prompt",
    conversationId: overrides.conversationId ?? "chatgpt_abc123",
    conversationName: overrides.conversationName ?? null,
    text: overrides.text,
    createdAt: overrides.createdAt ?? "2026-11-03T09:15:00-06:00",
  };
}

test("deliverableOverlaps flags each deliverable two members asked for", () => {
  const ev = (id: string, member: string, text: string, min: number): StoredEvent => ({
    eventId: id, roomId: "r", member, ai: "chatgpt", type: "prompt", conversationId: "c-" + member,
    conversationName: null, text, createdAt: new Date(Date.UTC(2026, 0, 1, 0, min)).toISOString(),
  }) as StoredEvent;
  const input = {
    room: { id: "r", topic: "Biblioteca", dueDate: null, parts: [], language: "es" as const },
    members: [{ name: "Ana", part: "Informe" }, { name: "Luis", part: "Código" }],
    events: [
      ev("1", "Luis", "Escríbeme los requisitos funcionales y un diagrama de clases.", 1),
      ev("2", "Ana", "Escribe la sección de requisitos y descríbeme el diagrama de clases.", 2),
      ev("3", "Ana", "Ayúdame con la introducción.", 3),
    ],
  };
  const found = deliverableOverlaps(input);
  assert.equal(found.length, 2);
  assert.ok(found.every((w) => w.tipo === "duplicado" && w.destinatario === "Ana"));
  const report = { resumen: "x", miembros: [], chats: [], sugerencia: null, consejo: "",
    alertas: [{ tipo: "duplicado" as const, destinatario: "Ana", partes: [], mensaje: "Ana repite los requisitos de Luis.", prompt_sugerido: "" }] };
  const merged = addMissedOverlaps(report, input);
  assert.equal(merged.alertas.length, 2);
  assert.ok(merged.alertas[1].mensaje.includes("diagrama de clases"));
});

const evt = (id: string, member: string, type: string, text: string, min: number): StoredEvent =>
  ({
    eventId: id, roomId: "r", member, ai: "chatgpt", type, conversationId: "c-" + member,
    conversationName: null, text, createdAt: new Date(Date.UTC(2026, 0, 1, 0, min)).toISOString(),
  }) as StoredEvent;
const libraryInput = {
  room: { id: "r", topic: "Biblioteca", dueDate: null, parts: [], language: "es" as const },
  members: [{ name: "Ana", part: "Informe escrito" }, { name: "Luis", part: "Código" }],
  events: [
    evt("1", "Luis", "prompt", "Quiero guardar los datos en una base SQLite.", 1),
    evt("2", "Luis", "respuesta", "Usa el módulo sqlite3 de Python.", 2),
    evt("3", "Ana", "respuesta", "Los datos se guardan en un archivo datos.json. Se eligió JSON.", 3),
  ],
};

test("storageConflicts gives each member a contradiccion naming both and both technologies", () => {
  const found = storageConflicts(libraryInput);
  assert.deepEqual(found.map((w) => w.destinatario).sort(), ["Ana", "Luis"]);
  for (const warning of found) {
    assert.equal(warning.tipo, "contradiccion");
    assert.match(warning.mensaje, /Ana/);
    assert.match(warning.mensaje, /Luis/);
    assert.match(warning.mensaje, /JSON/);
    assert.match(warning.mensaje, /SQLite/);
    assert.doesNotMatch(warning.mensaje, /guarda los datos/);
  }
});

test("storageConflicts lists several members without broken verb agreement", () => {
  const three = { ...libraryInput, events: [...libraryInput.events, evt("9", "Sofía", "prompt", "Dame el script SQLite de las tablas.", 9)] };
  const ana = storageConflicts(three).find((w) => w.destinatario === "Ana");
  assert.ok(ana);
  assert.match(ana.mensaje, /Luis y Sofía se usa SQLite|Sofía y Luis se usa SQLite/);
  assert.doesNotMatch(ana.mensaje, / y \S+ usa /);
});

test("storageConflicts follows the latest storage decision, not the older mentions", () => {
  const aligned = {
    ...libraryInput,
    events: [
      ...libraryInput.events,
      evt("4", "Ana", "respuesta", "Dejamos datos.json. Los datos van en SQLite, en biblioteca.db.", 4),
    ],
  };
  assert.equal(storageConflicts(aligned).length, 0);
  const back = {
    ...aligned,
    events: [...aligned.events, evt("5", "Ana", "respuesta", "Volvemos a guardar todo en datos.json.", 5)],
  };
  assert.deepEqual(storageConflicts(back).map((warning) => warning.destinatario).sort(), ["Ana", "Luis"]);
});

test("storageConflicts stays quiet when everyone uses the same storage or compatible ones", () => {
  const same = { ...libraryInput, events: [evt("1", "Ana", "prompt", "uso SQLite", 1), evt("2", "Luis", "prompt", "sqlite3 también", 2)] };
  assert.equal(storageConflicts(same).length, 0);
  const compatible = { ...libraryInput, events: [evt("1", "Ana", "prompt", "uso Supabase", 1), evt("2", "Luis", "prompt", "PostgreSQL", 2)] };
  assert.equal(storageConflicts(compatible).length, 0);
});

test("addMissedOverlaps adds the storage contradiction only where the AI missed it", () => {
  const aiWarning = { tipo: "contradiccion" as const, destinatario: "Ana", partes: [], mensaje: "Ana usa datos.json pero Luis guarda en SQLite.", prompt_sugerido: "" };
  const report = { resumen: "x", miembros: [], chats: [], sugerencia: null, consejo: "", alertas: [aiWarning] };
  const merged = addMissedOverlaps(report, libraryInput);
  const conflicts = merged.alertas.filter((w) => w.tipo === "contradiccion");
  assert.equal(conflicts.length, 2);
  assert.equal(conflicts.filter((w) => w.destinatario === "Ana").length, 1);
  assert.ok(conflicts.some((w) => w.destinatario === "Luis"));
});

test("dedupeSimilar folds repeated alerts about the same deliverable", () => {
  const make = (mensaje: string) => ({ tipo: "duplicado" as const, destinatario: "Ana", partes: [], mensaje, prompt_sugerido: "" });
  const out = dedupeSimilar([
    make("Tanto Ana como Luis generaron la lista de requisitos funcionales."),
    make("Los requisitos funcionales ya fueron solicitados por Luis."),
    make("Ana y Luis pidieron el diagrama de clases."),
  ]);
  assert.equal(out.length, 2);
});
