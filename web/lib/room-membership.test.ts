import assert from "node:assert/strict";
import test from "node:test";
import {
  MembershipError,
  createRoomFor,
  joinRoomFor,
  memberPlacement,
  readRoomForMember,
  type Account,
  type MemberRow,
  type MembershipStore,
  type RoomUpdate,
  type StoredRoom,
} from "./room-membership";

const ANA: Account = { id: "11111111-1111-4111-8111-111111111111", name: "Ana" };
const LUIS: Account = { id: "22222222-2222-4222-8222-222222222222", name: "Luis" };

test("crear la sala deja al creador como miembro y el token no cambia", async () => {
  const store = memoryStore();
  const created = await createRoomFor(store.store, ANA, {
    topic: " App   de tareas ",
    parts: [" Pantalla ", "Datos", "Pantalla"],
    dueDate: "2026-11-06",
    roomId: "equipo",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  assert.equal(created.id, "equipo");
  assert.equal(created.path, `/join/equipo?t=${created.token}`);
  const room = await store.store.getRoom("equipo");
  assert.equal(room?.topic, "App de tareas");
  assert.deepEqual(room?.parts, ["Pantalla", "Datos"]);
  assert.equal(room?.dueDate, "2026-11-06");
  assert.equal(room?.token, created.token);
  assert.deepEqual(await store.store.listMembers("equipo"), [
    { id: "member-1", name: "Ana", part: null, userId: ANA.id },
  ]);

  const again = await createRoomFor(store.store, LUIS, {
    topic: "Otra",
    parts: [],
    dueDate: "sin fecha",
    roomId: "equipo",
  });
  assert.deepEqual(again, { ok: false, code: "taken" });
  assert.equal((await store.store.getRoom("equipo"))?.token, created.token);
});

test("la sala nueva puede quedar sin partes y sin fecha", async () => {
  const store = memoryStore();
  const created = await createRoomFor(store.store, ANA, { topic: "Solo el tema" });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const room = await store.store.getRoom(created.id);
  assert.equal(room?.topic, "Solo el tema");
  assert.equal(room?.dueDate, null);
  assert.deepEqual(room?.parts, []);
  assert.equal(room?.language, "es");
  assert.ok(room?.token);
});

test("la invitación une una vez y un token malo no entra", async () => {
  const store = memoryStore();
  const created = await createRoomFor(store.store, ANA, {
    topic: "Tema",
    parts: [],
    dueDate: "sin fecha",
    roomId: null,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const bad = await joinRoomFor(store.store, LUIS, created.id, "token-malo");
  assert.deepEqual(bad, { ok: false, code: "token" });
  const missing = await joinRoomFor(store.store, LUIS, "no-existe", created.token);
  assert.deepEqual(missing, { ok: false, code: "token" });
  assert.equal((await store.store.listMembers(created.id)).length, 1);

  const joined = await joinRoomFor(store.store, LUIS, created.id, created.token);
  const repeat = await joinRoomFor(store.store, LUIS, created.id, created.token);
  assert.deepEqual(joined, { ok: true });
  assert.deepEqual(repeat, { ok: true });
  assert.deepEqual(
    (await store.store.listMembers(created.id)).map((member) => member.name),
    ["Ana", "Luis"],
  );

  const view = await readRoomForMember(store.store, LUIS.id, created.id);
  assert.equal(view.ok, true);
  const hidden = await readRoomForMember(store.store, "33333333-3333-4333-8333-333333333333", created.id);
  assert.deepEqual(hidden, { ok: false, code: "forbidden" });
});

test("si el nombre ya está libre de cuenta, se enlaza; si no, se distingue", () => {
  const open: MemberRow = { id: "m1", name: "Ana", part: "Pantalla", userId: null };
  assert.deepEqual(memberPlacement([open], ANA), { kind: "claim", memberId: "m1" });

  const taken: MemberRow = { id: "m2", name: "Ana", part: null, userId: LUIS.id };
  assert.deepEqual(memberPlacement([taken], ANA), { kind: "insert", name: "Ana 2" });
  assert.deepEqual(memberPlacement([taken], LUIS), { kind: "already" });
});

test("entrar reclama el miembro que ya tenía ese nombre", async () => {
  const store = memoryStore();
  store.rooms.push({
    id: "demo",
    token: "token-de-prueba",
    topic: "Tema",
    dueDate: "2026-11-06",
    parts: [],
    createdBy: null,
    language: "es",
  });
  store.members.push({ id: "m1", roomId: "demo", name: "Ana", part: "Pantalla", userId: null });

  const joined = await joinRoomFor(store.store, ANA, "demo", "token-de-prueba");
  assert.deepEqual(joined, { ok: true });
  assert.equal(store.members.length, 1);
  assert.equal(store.members[0]?.userId, ANA.id);
  assert.equal(store.members[0]?.part, "Pantalla");
});

function memoryStore() {
  const rooms: StoredRoom[] = [];
  const members: (MemberRow & { roomId: string })[] = [];
  let sequence = 0;

  const store: MembershipStore = {
    async getRoom(id) {
      return rooms.find((room) => room.id === id) ?? null;
    },
    async insertRoom(room) {
      if (rooms.some((item) => item.id === room.id || item.token === room.token)) {
        throw new MembershipError("taken");
      }
      rooms.push({ ...room, parts: [...room.parts], language: room.language });
    },
    async updateRoom(id, patch: RoomUpdate) {
      const room = rooms.find((item) => item.id === id);
      if (!room) throw new MembershipError("save");
      if (patch.token && rooms.some((item) => item.id !== id && item.token === patch.token)) {
        throw new MembershipError("taken");
      }
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
      for (const member of members) {
        if (member.roomId === id) member.roomId = nextId;
      }
    },
    async setMemberPart(roomId, name, part) {
      const member = members.find((item) => item.roomId === roomId && item.name === name);
      if (member) member.part = part;
    },
    async deleteRoom(id) {
      const roomIndex = rooms.findIndex((room) => room.id === id);
      if (roomIndex >= 0) rooms.splice(roomIndex, 1);
      for (let index = members.length - 1; index >= 0; index -= 1) {
        if (members[index]?.roomId === id) members.splice(index, 1);
      }
    },
    async listMembers(roomId) {
      return members
        .filter((member) => member.roomId === roomId)
        .map(({ id, name, part, userId }) => ({ id, name, part, userId }));
    },
    async insertMember(member) {
      if (members.some((item) => item.roomId === member.roomId && item.userId === member.userId)) {
        throw new MembershipError("taken");
      }
      sequence += 1;
      members.push({ id: `member-${sequence}`, roomId: member.roomId, name: member.name, part: member.part, userId: member.userId });
    },
    async claimMember(memberId, userId) {
      const member = members.find((item) => item.id === memberId && item.userId === null);
      if (!member) return false;
      member.userId = userId;
      return true;
    },
  };

  return { store, rooms, members };
}
