import assert from "node:assert/strict";
import test from "node:test";
import { gmailHref, inviteEmailText, isEmail, mailtoHref } from "./invite-email";

test("validates emails", () => {
  assert.equal(isEmail("ana@ejemplo.com"), true);
  assert.equal(isEmail("ana@ejemplo"), false);
  assert.equal(isEmail("ana ejemplo@x.com"), false);
  assert.equal(isEmail("<x>@x.com"), false);
});

test("builds mailto and gmail links", () => {
  const t = inviteEmailText("es", "Plan & más", "https://x.app/join?r=1&t=2");
  assert.equal(t.subject, "Te invito a mi sala de Enlaza: Plan & más");
  const m = mailtoHref("ana@x.com", t.subject, t.body);
  assert.ok(m.startsWith("mailto:ana@x.com?subject="));
  assert.ok(!m.includes(" ") && !m.includes("&t=2"));
  const g = new URL(gmailHref("ana@x.com", t.subject, t.body));
  assert.equal(g.searchParams.get("view"), "cm");
  assert.equal(g.searchParams.get("to"), "ana@x.com");
  assert.equal(g.searchParams.get("su"), t.subject);
  assert.ok(g.searchParams.get("body")?.includes("https://x.app/join?r=1&t=2"));
  assert.equal(inviteEmailText("en", "A", "u").subject, "Join my Enlaza room: A");
});
