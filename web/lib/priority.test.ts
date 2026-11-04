import assert from "node:assert/strict";
import test from "node:test";
import { countByPriority, defaultPriority, readPriority, sortByPriority, withPriorities } from "./priority";
import { reusableChecklist } from "./progress";
import type { RoomWarning } from "./room-types";

const w = (tipo: RoomWarning["tipo"], mensaje = "Falta el informe", prioridad?: RoomWarning["prioridad"]): RoomWarning => ({ tipo, mensaje, destinatario: "Ana", partes: [], prompt_sugerido: "", prioridad });
const now = new Date("2026-11-04T12:00:00Z");

test("prioridad por defecto", () => {
  assert.equal(defaultPriority(w("contradiccion"), null, now), "urgente");
  assert.equal(defaultPriority(w("duplicado"), null, now), "pronto");
  assert.equal(defaultPriority(w("falta"), "2026-11-06", now), "urgente");
  assert.equal(defaultPriority(w("falta"), "2026-12-30", now), "pronto");
  assert.equal(defaultPriority(w("falta", "Falta la bibliografía"), "2026-11-05", now), "puede_esperar");
});

test("lee alias y respeta la prioridad dada", () => {
  assert.equal(readPriority("alta"), "urgente");
  assert.equal(readPriority("low"), "puede_esperar");
  assert.equal(readPriority("x"), undefined);
  assert.equal(withPriorities([w("contradiccion", "x", "puede_esperar")], null)[0].prioridad, "puede_esperar");
});

test("ordena y cuenta por prioridad", () => {
  const list = withPriorities([w("duplicado"), w("falta", "Falta el formato"), w("contradiccion")], null, now);
  assert.deepEqual(sortByPriority(list).map((a) => a.tipo), ["contradiccion", "duplicado", "falta"]);
  assert.deepEqual(countByPriority(list), { urgente: 1, pronto: 1, puede_esperar: 1 });
});

test("una lista de IA reemplaza la de reglas (sin duplicar)", () => {
  const items = [{ parte: "A", texto: "1", hecho: true, evidencia: "" }];
  const prev = { fuente: "reglas" as const, avance: { valor: 0, anterior: null, delta: 0, partes: [], items, penalizacion: 0, lista: "reglas" as const } };
  assert.deepEqual(reusableChecklist(prev as never, "ia"), []);
  assert.equal(reusableChecklist(prev as never, "reglas").length, 1);
});
