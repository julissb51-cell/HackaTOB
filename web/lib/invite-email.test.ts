import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter, isEmail } from "./invite-email";

test("validates emails", () => {
  assert.equal(isEmail("ana@ejemplo.com"), true);
  assert.equal(isEmail("ana@ejemplo"), false);
  assert.equal(isEmail("ana ejemplo@x.com"), false);
  assert.equal(isEmail("<x>@x.com"), false);
});

test("rate limits per key", () => {
  const allow = createRateLimiter(2, 1000);
  assert.equal(allow("u", 0), true);
  assert.equal(allow("u", 10), true);
  assert.equal(allow("u", 20), false);
  assert.equal(allow("v", 20), true);
  assert.equal(allow("u", 1500), true);
});
