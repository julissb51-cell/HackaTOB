import assert from "node:assert/strict";
import test from "node:test";
import { computeProgress, mergeChecklist, readChecklist, roundTo5, rulesChecklist, type ChecklistItem } from "./progress";
import type { RoomWarning } from "./room-types";

const item = (parte: string, texto: string, hecho: boolean): ChecklistItem => ({ parte, texto, hecho, evidencia: "" });
const warn = (tipo: RoomWarning["tipo"]): RoomWarning => ({ tipo, mensaje: "x", destinatario: "Ana", partes: [], prompt_sugerido: "" });

test("avance por parte y total con pesos iguales, redondeado a 5", () => {
  const items = [item("A", "1", true), item("A", "2", false), item("B", "1", true), item("B", "2", true), item("B", "3", true), item("B", "4", false)];
  const result = computeProgress({ items, parts: ["A", "B"], alertas: [], previous: null });
  assert.deepEqual(result.partes.map((p) => p.avance), [50, 75]);
  assert.equal(result.valor, 65); // 62.5 -> 65
  assert.equal(result.delta, 0);
  assert.equal(result.anterior, null);
});

test("penaliza 3 por contradicción y 1 por duplicado, con tope de 15", () => {
  const items = [item("A", "1", true)];
  assert.equal(computeProgress({ items, parts: ["A"], alertas: [warn("contradiccion"), warn("duplicado"), warn("falta")], previous: null }).penalizacion, 4);
  const many = Array.from({ length: 8 }, () => warn("contradiccion"));
  const result = computeProgress({ items, parts: ["A"], alertas: many, previous: null });
  assert.equal(result.penalizacion, 15);
  assert.equal(result.valor, 85);
});

test("partes sin lista no cuentan y el valor no baja de 0", () => {
  const result = computeProgress({ items: [item("A", "1", false)], parts: ["A", "B"], alertas: [warn("contradiccion")], previous: null });
  assert.equal(result.valor, 0);
  assert.equal(result.partes[1].total, 0);
});

test("roundTo5", () => {
  assert.equal(roundTo5(47.4), 45);
  assert.equal(roundTo5(47.5), 50);
});

test("el cambio por análisis tiene tope de ±15 y guarda el anterior", () => {
  const before = computeProgress({ items: [item("A", "1", false), item("A", "2", false)], parts: ["A"], alertas: [], previous: null });
  const after = computeProgress({ items: [item("A", "1", true), item("A", "2", true)], parts: ["A"], alertas: [], previous: before });
  assert.equal(after.bruto, 100);
  assert.equal(after.valor, 15);
  assert.equal(after.anterior, 0);
  assert.equal(after.delta, 15);
  assert.match(after.motivo, /listo/i);
  const down = computeProgress({ items: [item("A", "1", false)], parts: ["A"], alertas: [], previous: { ...after, valor: 80 } });
  assert.equal(down.valor, 65);
  assert.equal(down.delta, -15);
});

test("mergeChecklist conserva textos anteriores, agrega nuevos y no vuelve a pendiente", () => {
  const previous = [item("Informe", "Introducción", true), item("Informe", "Objetivos", false)];
  const next = [item("informe", "introduccion", false), item("Informe", "Objetivos", true), item("Informe", "Conclusiones", false)];
  const merged = mergeChecklist(previous, next);
  assert.deepEqual(merged.map((i) => [i.parte, i.texto, i.hecho]), [
    ["Informe", "Introducción", true],
    ["Informe", "Objetivos", true],
    ["Informe", "Conclusiones", false],
  ]);
});

test("mergeChecklist mantiene un entregable aunque la IA lo omita", () => {
  const merged = mergeChecklist([item("A", "Pruebas", false)], [item("A", "Menú", true)]);
  assert.deepEqual(merged.map((i) => i.texto), ["Pruebas", "Menú"]);
});

test("readChecklist acepta la forma por partes y alinea nombres", () => {
  const items = readChecklist([{ parte: "código", items: [{ texto: "Pruebas", hecho: true, evidencia: "tests" }, { texto: "" }] }], ["Código"]);
  assert.deepEqual(items, [{ parte: "Código", texto: "Pruebas", hecho: true, evidencia: "tests" }]);
  assert.deepEqual(readChecklist("x", []), []);
});

test("rulesChecklist marca hecho solo con respuestas o archivos del dueño de la parte", () => {
  const base = { roomId: "r", ai: "chatgpt" as const, conversationId: "c", conversationName: null, createdAt: "2026-01-01T00:00:00Z" };
  const items = rulesChecklist({
    parts: ["Informe escrito"],
    members: [{ name: "Ana", part: "Informe escrito" }, { name: "Luis", part: "Código" }],
    events: [
      { ...base, eventId: "1", member: "Ana", type: "prompt", text: "Escribe los objetivos" },
      { ...base, eventId: "2", member: "Ana", type: "respuesta", text: "Introducción: el sistema..." },
      { ...base, eventId: "3", member: "Luis", type: "respuesta", text: "Requisitos funcionales" },
    ],
    language: "es",
  });
  const done = items.filter((i) => i.hecho).map((i) => i.texto);
  assert.deepEqual(done, ["Introducción"]);
});
