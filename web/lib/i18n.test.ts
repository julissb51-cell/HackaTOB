import assert from "node:assert/strict";
import test from "node:test";
import { copy } from "../components/copy";
import { langCookie, langFromCookieHeader, parseLang } from "./i18n";

test("el idioma por defecto es español y solo en cambia a inglés", () => {
  assert.equal(parseLang(null), "es");
  assert.equal(parseLang(undefined), "es");
  assert.equal(parseLang(""), "es");
  assert.equal(parseLang("es"), "es");
  assert.equal(parseLang("EN"), "es");
  assert.equal(parseLang("en"), "en");
});

test("la cookie de idioma se lee y no guarda otra cosa", () => {
  assert.equal(langFromCookieHeader(null), null);
  assert.equal(langFromCookieHeader("otra=1"), null);
  assert.equal(langFromCookieHeader("enlaza_lang=en"), "en");
  assert.equal(langFromCookieHeader("foo=bar; enlaza_lang=es"), "es");
  assert.equal(langCookie("es", false), "enlaza_lang=es; Path=/; Max-Age=31536000; SameSite=Lax");
  assert.match(langCookie("en", true), /^enlaza_lang=en; Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/);
});

test("español e inglés tienen las mismas frases", () => {
  assert.deepEqual(Object.keys(copy.es).sort(), Object.keys(copy.en).sort());
  assert.equal(copy.es.noDate, "Sin fecha");
  assert.equal(copy.en.noDate, "No date");
});
