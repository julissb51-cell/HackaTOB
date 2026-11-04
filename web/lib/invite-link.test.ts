import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInviteLink } from "./invite-link";

test("acepta URL completa y ruta", () => {
  assert.equal(parseInviteLink("https://enlaza-green.vercel.app/join/demo?t=abc"), "/join/demo?t=abc");
  assert.equal(parseInviteLink("  /join/demo-final?t=x%20y "), "/join/demo-final?t=x%20y");
});

test("rechaza formatos inválidos", () => {
  for (const bad of ["", "hola", "/rooms/demo?t=a", "/join/demo", "/join/demo?t=", "javascript:alert(1)", "/join/a/b?t=x"]) {
    assert.equal(parseInviteLink(bad), null, bad);
  }
});
