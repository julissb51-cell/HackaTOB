import assert from "node:assert/strict";
import test from "node:test";
import { ANALYSIS_INTERVAL_MS, redactForModel, shouldAnalyze } from "./model-guard";

const now = 1_000_000;

test("el análisis automático espera 30 segundos aunque se pida a mano", () => {
  const recent = {
    force: true,
    pending: true,
    ranAtMs: now - 1_000,
    now,
    savedEvents: 1,
    eventCount: 4,
  };
  assert.equal(shouldAnalyze(recent), "cooldown");
  assert.equal(shouldAnalyze({ ...recent, force: false }), "cooldown");
  assert.equal(
    shouldAnalyze({ ...recent, ranAtMs: now - ANALYSIS_INTERVAL_MS, force: false, pending: false, savedEvents: 4, eventCount: 4 }),
    "unchanged",
  );
  assert.equal(
    shouldAnalyze({ ...recent, ranAtMs: now - ANALYSIS_INTERVAL_MS, force: true, pending: false, savedEvents: 4, eventCount: 4 }),
    "run",
  );
  assert.equal(
    shouldAnalyze({ ...recent, ranAtMs: now - ANALYSIS_INTERVAL_MS, force: false, pending: true, savedEvents: 4, eventCount: 4 }),
    "run",
  );
});

test("la copia al modelo omite formas obvias de secreto y deja el resto del texto", () => {
  const source = "Los datos van en datos.json. La clave es sk-abcDEF1234567890xyz987 y AIzaSyA1234567890abcdefghi.";
  const redacted = redactForModel(source);
  assert.equal(redacted.changed, true);
  assert.match(redacted.text, /datos\.json/);
  assert.equal(redacted.text.includes("sk-abcDEF"), false);
  assert.equal(redacted.text.includes("AIza"), false);
  assert.equal(redactForModel("sigue con SQLite").changed, false);
  assert.equal(source.includes("sk-abcDEF"), true);
});
