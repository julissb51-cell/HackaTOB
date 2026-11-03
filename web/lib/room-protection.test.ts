import assert from "node:assert/strict";
import test from "node:test";
import { isProtectedRoom, removalFor } from "./room-protection";

test("protects the demo rooms", () => {
  for (const id of ["demo", "demo-final", "demo-ensayo", "prueba-f6"]) assert.equal(isProtectedRoom(id), true);
  assert.equal(isProtectedRoom("mi-sala"), false);
});

test("owners delete, others leave, demos are locked for owners", () => {
  assert.equal(removalFor("mi-sala", true), "delete");
  assert.equal(removalFor("mi-sala", false), "leave");
  assert.equal(removalFor("demo-final", true), "protected");
});
