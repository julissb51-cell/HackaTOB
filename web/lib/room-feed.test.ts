import assert from "node:assert/strict";
import test from "node:test";
import { previewMemberContext } from "./room-analysis";
import {
  POLL_MS,
  applyRealtimeChange,
  eventFromRow,
  feedMembers,
  filterEvents,
  formatEventTime,
  mergeSnapshots,
  realtimeFailed,
  realtimeFilter,
  sortEventsNewestFirst,
  summarizeParts,
} from "./room-feed";
import type { StoredEvent } from "./room-types";

function event(partial: Partial<StoredEvent> & Pick<StoredEvent, "eventId" | "member" | "createdAt">): StoredEvent {
  return {
    roomId: "demo",
    ai: "chatgpt",
    type: "prompt",
    conversationId: "chatgpt_abc",
    conversationName: null,
    text: "Hola",
    ...partial,
  };
}

const row = {
  event_id: "evt_demo_001",
  room_id: "demo",
  member: "Ana",
  ai: "chatgpt",
  type: "prompt",
  conversation_id: "chatgpt_abc123",
  conversation_name: "Pantalla de la sala",
  text: "Arma la pantalla",
  created_at: "2026-11-03T09:15:00-06:00",
};

test("el feed ordena lo más nuevo primero y arma el filtro de realtime", () => {
  assert.equal(POLL_MS, 5000);
  assert.equal(realtimeFilter("demo"), "room_id=eq.demo");
  assert.equal(realtimeFilter("new"), null);
  assert.equal(realtimeFilter("Demo"), null);
  assert.equal(realtimeFailed("CHANNEL_ERROR"), true);
  assert.equal(realtimeFailed("TIMED_OUT"), true);
  assert.equal(realtimeFailed("CLOSED"), true);
  assert.equal(realtimeFailed("SUBSCRIBED"), false);
  assert.equal(formatEventTime("2026-11-03T09:15:00-06:00"), "2026-11-03 09:15");
  assert.equal(formatEventTime("2026-11-04T21:00:00.402Z"), "2026-11-04 15:00");
  assert.equal(formatEventTime("2026-11-05T02:00:00Z"), "2026-11-04 20:00");
  assert.equal(formatEventTime("sin hora"), "sin hora");

  const newest = sortEventsNewestFirst([
    event({ eventId: "a", member: "Ana", createdAt: "2026-11-03T09:15:00-06:00" }),
    event({ eventId: "b", member: "Luis", createdAt: "2026-11-03T09:20:00-06:00" }),
    event({ eventId: "c", member: "Ana", createdAt: "no-es-fecha" }),
  ]);
  assert.deepEqual(
    newest.map((item) => item.eventId),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    filterEvents(newest, "Ana").map((item) => item.eventId),
    ["a", "c"],
  );
});

test("un cambio de realtime entra, se actualiza o sale de la sala", () => {
  const parsed = eventFromRow(row, "demo");
  assert.ok(parsed);
  assert.equal(parsed?.conversationName, "Pantalla de la sala");
  assert.equal(eventFromRow({ ...row, room_id: "otra" }, "demo"), null);
  assert.equal(eventFromRow({ ...row, ai: "ninguna" }, "demo"), null);
  assert.equal(eventFromRow({ ...row, conversation_name: "" }, "demo")?.conversationName, null);

  const first = applyRealtimeChange([], { eventType: "INSERT", new: row }, "demo");
  assert.equal(first.length, 1);
  const updated = applyRealtimeChange(first, { eventType: "UPDATE", new: { ...row, text: "Listo" } }, "demo");
  assert.equal(updated[0]?.text, "Listo");
  const ignored = applyRealtimeChange(updated, { eventType: "INSERT", new: { ...row, event_id: "evt_otra", room_id: "otra" } }, "demo");
  assert.equal(ignored.length, 1);
  const removed = applyRealtimeChange(ignored, { eventType: "DELETE", old: { event_id: "evt_demo_001", room_id: "demo" } }, "demo");
  assert.equal(removed.length, 0);

  const kept = mergeSnapshots(
    [event({ eventId: "nuevo", member: "Ana", createdAt: "2026-11-03T10:00:00-06:00" })],
    [event({ eventId: "viejo", member: "Luis", createdAt: "2026-11-03T09:00:00-06:00" })],
  );
  assert.deepEqual(
    kept.map((item) => item.eventId),
    ["nuevo", "viejo"],
  );
});

test("cada parte junta a sus miembros y cuenta sus eventos una vez", () => {
  const parts = summarizeParts(
    ["Pantalla", "Datos", "Avisos"],
    [
      { name: "Ana", part: "Pantalla" },
      { name: "Luis", part: "Datos" },
      { name: "Sol", part: null },
    ],
    [
      { member: "Ana", conversationName: "Datos" },
      { member: "Ana", conversationName: "Pantalla" },
      { member: "Luis", conversationName: "Datos" },
      { member: "Sol", conversationName: "Avisos" },
    ],
  );

  assert.deepEqual(parts, [
    { name: "Pantalla", members: ["Ana"], eventCount: 2, status: "active" },
    { name: "Datos", members: ["Luis"], eventCount: 1, status: "active" },
    { name: "Avisos", members: [], eventCount: 1, status: "active" },
  ]);

  const waiting = summarizeParts(["Mapa"], [{ name: "Ana", part: "Mapa" }], []);
  assert.equal(waiting[0]?.status, "waiting");
  assert.equal(waiting[0]?.eventCount, 0);

  const extra = summarizeParts([], [{ name: "Luis", part: "Notas" }], []);
  assert.deepEqual(extra, [{ name: "Notas", members: ["Luis"], eventCount: 0, status: "waiting" }]);

  assert.deepEqual(feedMembers([{ name: "Ana", part: null }], [{ member: "Luis" }, { member: "Ana" }]), ["Ana", "Luis"]);
});

test("la vista previa del miembro coincide con el contexto fijo", () => {
  const context = previewMemberContext({
    room: { id: "demo", topic: "App", projectName: null, dueDate: "2026-11-06" },
    members: [{ name: "Ana", part: "Pantalla" }],
    events: [],
    member: "Ana",
  });
  assert.equal(context.parte, "Pantalla");
  assert.match(context.resumen, /App/);
  assert.match(context.prompt_sugerido, /Pantalla/);
  assert.ok(Array.isArray(context.advertencias));
});
