import assert from "node:assert/strict";
import test from "node:test";
import { requestOrigin } from "./public-origin";
import {
  NO_DATE,
  accountName,
  invitePath,
  parseDueDate,
  parseParts,
  parseRoomId,
  parseTopic,
  readInviteToken,
  safeNextPath,
} from "./room-fields";
import { createRoomToken, generateRoomId } from "./room-token";

test("el tema, las partes y la fecha se normalizan", () => {
  assert.equal(parseTopic("  App   compartida  "), "App compartida");
  assert.equal(parseTopic("   "), null);
  assert.equal(parseTopic("a".repeat(201)), null);
  assert.equal(parseTopic("li\u0001nea"), null);

  assert.deepEqual(parseParts([" Pantalla ", "", "Pantalla", "Datos"]), ["Pantalla", "Datos"]);
  assert.equal(parseParts(["a".repeat(121)]), null);
  assert.equal(parseParts(Array.from({ length: 31 }, (_, index) => `parte ${index}`)), null);

  assert.equal(parseDueDate("2026-11-06", false), "2026-11-06");
  assert.equal(parseDueDate("2026-02-31", false), null);
  assert.equal(parseDueDate("ayer", true), NO_DATE);
});

test("el id se puede elegir o se genera, y el token es fijo y largo", () => {
  assert.equal(parseRoomId(" Demo "), "demo");
  assert.equal(parseRoomId("new"), null);
  assert.equal(parseRoomId("a-"), null);
  assert.equal(parseRoomId(""), null);

  const ids = new Set(Array.from({ length: 20 }, () => generateRoomId()));
  assert.equal(ids.size, 20);
  for (const id of ids) assert.equal(parseRoomId(id), id);

  const token = createRoomToken();
  assert.equal(token.length, 43);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(createRoomToken(), token);
});

test("el enlace acepta t o token y el regreso no sale del sitio", () => {
  assert.equal(invitePath("demo", "abc"), "/join/demo?t=abc");
  assert.equal(invitePath("demo", "a+b"), "/join/demo?t=a%2Bb");
  assert.equal(readInviteToken(new URLSearchParams("t=uno")), "uno");
  assert.equal(readInviteToken(new URLSearchParams("token=dos")), "dos");
  assert.equal(readInviteToken({ token: "tres" }), "tres");

  assert.equal(safeNextPath("/join/demo?t=abc"), "/join/demo?t=abc");
  assert.equal(safeNextPath("/rooms/new"), "/rooms/new");
  assert.equal(safeNextPath("https://evil.example"), "/");
  assert.equal(safeNextPath("//evil.example"), "/");
  assert.equal(safeNextPath("/%2F%2Fevil.example"), "/");
  assert.equal(safeNextPath("/rooms/../auth/logout"), "/");
});

test("el nombre visible sale de la cuenta de Google", () => {
  assert.equal(accountName({ user_metadata: { full_name: " Ana López " }, email: "ana@example.com" }), "Ana López");
  assert.equal(accountName({ user_metadata: { name: "Luis" } }), "Luis");
  assert.equal(accountName({ email: "persona@example.com" }), "persona");
  assert.equal(accountName({}), "Miembro");
});

test("el origen público usa el host reenviado solo si es un host", () => {
  const request = new Request("http://localhost:3000/auth/callback", {
    headers: { "x-forwarded-host": "enlaza.vercel.app", "x-forwarded-proto": "https" },
  });
  assert.equal(requestOrigin(request), "https://enlaza.vercel.app");

  const odd = new Request("http://localhost:3000/auth/callback", {
    headers: { "x-forwarded-host": "evil.example\\@localhost" },
  });
  assert.equal(requestOrigin(odd), "http://localhost:3000");
});
