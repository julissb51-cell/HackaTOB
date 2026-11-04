import assert from "node:assert/strict";
import test from "node:test";
import { parseEvent } from "./event-body";
import { aiLabel, isCaptureAi } from "./room-types";

test("grok es una fuente de IA aceptada", () => {
  assert.equal(isCaptureAi("grok"), true);
  const parsed = parseEvent({
    event_id: "evt-grok-1",
    tipo: "prompt",
    miembro: "Ana",
    ia: "grok",
    conversation_id: "c1",
    texto: "hola",
    tiempo: "2026-11-04T11:00:00-06:00",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.event.ai, "grok");
});

test("las IA se muestran con su nombre", () => {
  assert.equal(aiLabel("chatgpt"), "ChatGPT");
  assert.equal(aiLabel("gemini"), "Gemini");
  assert.equal(aiLabel("claude"), "Claude");
  assert.equal(aiLabel("copilot"), "Copilot");
  assert.equal(aiLabel("grok"), "Grok");
  assert.equal(aiLabel("enlaza"), "Enlaza");
});
