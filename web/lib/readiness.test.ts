import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GET } from "../app/api/health/route";
import { realtimeFailed } from "./room-feed";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

test("el esquema público activa RLS y no abre las tablas a anon", () => {
  for (const table of ["rooms", "members", "events", "room_analysis"]) {
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(schema, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
  }
  assert.doesNotMatch(schema, /grant .* to anon/i);
});

test("el build del navegador no declara la clave de servicio ni las del analista", () => {
  const envBlock = nextConfig.slice(nextConfig.indexOf("env:"));
  assert.equal(envBlock.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(envBlock.includes("GEMINI_API_KEY"), false);
  assert.equal(envBlock.includes("XAI_API_KEY"), false);
});

test("un canal de realtime cerrado o con error pasa a sondeo", () => {
  assert.equal(realtimeFailed("CHANNEL_ERROR"), true);
  assert.equal(realtimeFailed("TIMED_OUT"), true);
  assert.equal(realtimeFailed("CLOSED"), true);
  assert.equal(realtimeFailed("SUBSCRIBED"), false);
});

test("salud no devuelve token ni texto de sala", async () => {
  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { ok: true });
  assert.equal(JSON.stringify(body).toLowerCase().includes("token"), false);
});
