import assert from "node:assert/strict";
import test from "node:test";
import { acceptSuggestionFor, saveSettings, setRoomToken } from "./room-settings";
import {
  MembershipError,
  type MemberRow,
  type MembershipStore,
  type RoomUpdate,
  type StoredRoom,
} from "./room-membership";

const ANA = "11111111-1111-4111-8111-111111111111";
const LUIS = "22222222-2222-4222-8222-222222222222";

test("cualquier miembro edita partes y fecha; un código ocupado no reemplaza el id", async () => {
  const store = memoryStore();
  const hidden = await saveSettings(store.store, LUIS, "demo", {
    topic: "Intruso",
    parts: ["Robo"],
    dueDate: "2026-12-01",
    language: "en",
    nextId: "otro",
    memberParts: [],
  });
  assert.deepEqual(hidden, { ok: false, code: "forbidden" });
  assert.equal((await store.store.getRoom("demo"))?.topic, "Tema");

  const saved = await saveSettings(store.store, ANA, "demo", {
    topic: "Tema nuevo",
    parts: ["Pantalla", "Datos"],
    dueDate: "2026-11-06",
    language: "en",
    nextId: "demo",
    memberParts: [{ name: "Ana", part: "Pantalla" }],
  });
  assert.deepEqual(saved, { ok: true, id: "demo", token: "token-de-prueba" });
  const room = await store.store.getRoom("demo");
  assert.equal(room?.topic, "Tema nuevo");
  assert.deepEqual(room?.parts, ["Pantalla", "Datos"]);
  assert.equal(room?.dueDate, "2026-11-06");
  assert.equal(room?.language, "en");
  assert.equal(store.members[0]?.part, "Pantalla");

  store.rooms.push({
    id: "ocupado",
    token: "otro-token",
    topic: "Otra",
    dueDate: null,
    parts: [],
    createdBy: null,
    language: "es",
  });
  const taken = await saveSettings(store.store, ANA, "demo", {
    topic: "Tema nuevo",
    parts: [],
    dueDate: null,
    language: "es",
    nextId: "ocupado",
    memberParts: [],
  });
  assert.deepEqual(taken, { ok: false, code: "taken" });
  assert.equal((await store.store.getRoom("demo"))?.id, "demo");
});

test("el token se puede cambiar y quien no es miembro no lo toca", async () => {
  const store = memoryStore();
  const denied = await setRoomToken(store.store, LUIS, "demo", "codigo-nuevo-largo");
  assert.deepEqual(denied, { ok: false, code: "forbidden" });

  const changed = await setRoomToken(store.store, ANA, "demo", "codigo-nuevo-largo");
  assert.deepEqual(changed, { ok: true, id: "demo", token: "codigo-nuevo-largo" });
  assert.equal((await store.store.getRoom("demo"))?.token, "codigo-nuevo-largo");
});

test("aceptar la sugerencia llena lo vacío y no pisa una fecha explícita", async () => {
  const store = memoryStore();
  const room = store.rooms[0];
  if (!room) return;
  room.dueDate = "sin fecha";
  room.parts = [];
  store.members[0]!.part = null;

  const accepted = await acceptSuggestionFor(store.store, ANA, "demo", {
    partes: ["Pantalla"],
    fecha: "2026-11-20",
    asignaciones: [{ nombre: "Ana", parte: "Pantalla" }],
  });
  assert.equal(accepted.ok, true);
  assert.deepEqual((await store.store.getRoom("demo"))?.parts, ["Pantalla"]);
  assert.equal((await store.store.getRoom("demo"))?.dueDate, "sin fecha");
  assert.equal(store.members[0]?.part, "Pantalla");
});

function memoryStore() {
  const rooms: StoredRoom[] = [
    {
      id: "demo",
      token: "token-de-prueba",
      topic: "Tema",
      dueDate: null,
      parts: [],
      createdBy: ANA,
      language: "es",
    },
  ];
  const members: (MemberRow & { roomId: string })[] = [
    { id: "m1", roomId: "demo", name: "Ana", part: null, userId: ANA },
  ];

  const store: MembershipStore = {
    async getRoom(id) {
      return rooms.find((room) => room.id === id) ?? null;
    },
    async insertRoom() {
      throw new MembershipError("save");
    },
    async updateRoom(id, patch: RoomUpdate) {
      const room = rooms.find((item) => item.id === id);
      if (!room) throw new MembershipError("save");
      if (patch.topic !== undefined) room.topic = patch.topic;
      if (patch.dueDate !== undefined) room.dueDate = patch.dueDate;
      if (patch.parts !== undefined) room.parts = [...patch.parts];
      if (patch.language !== undefined) room.language = patch.language;
      if (patch.token !== undefined) room.token = patch.token;
    },
    async renameRoom(id, nextId) {
      if (rooms.some((item) => item.id === nextId)) throw new MembershipError("taken");
      const room = rooms.find((item) => item.id === id);
      if (!room) throw new MembershipError("save");
      room.id = nextId;
    },
    async setMemberPart(roomId, name, part) {
      const member = members.find((item) => item.roomId === roomId && item.name === name);
      if (member) member.part = part;
    },
    async deleteRoom() {},
    async listMembers(roomId) {
      return members.filter((member) => member.roomId === roomId).map(({ id, name, part, userId }) => ({ id, name, part, userId }));
    },
    async insertMember() {
      throw new MembershipError("save");
    },
    async claimMember() {
      return false;
    },
  };

  return { store, rooms, members };
}
