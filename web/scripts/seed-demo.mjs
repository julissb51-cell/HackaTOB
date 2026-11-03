// Crea la sala demo (id demo, token token-de-prueba).
//
// Uso, desde web/:
//   npm run seed
//
// Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del entorno o de web/.env.local.
// No cambia el tipo de events.event_id. Si esa columna sigue siendo uuid,
// ejecuta supabase/seed-demo.sql en el SQL Editor.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, ".env"));

const url = process.env.SUPABASE_URL?.trim() ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
if (!url || !key || url.includes("TU_PROYECTO") || key.startsWith("tu_clave")) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en web/.env.local.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const room = await supabase.from("rooms").upsert(
  {
    id: "demo",
    topic: "App para repartir tareas de un trabajo",
    project_name: "Enlaza",
    due_date: "2026-11-06",
    token: "token-de-prueba",
  },
  { onConflict: "id" },
);
if (room.error) fail("No se pudo guardar la sala", room.error.message);

const removed = await supabase.from("members").delete().eq("room_id", "demo");
if (removed.error) fail("No se pudieron actualizar los miembros", removed.error.message);

const members = await supabase.from("members").insert([
  { room_id: "demo", name: "Ana", part: "Pantalla de la sala" },
  { room_id: "demo", name: "Luis", part: "Datos" },
]);
if (members.error) fail("No se pudieron crear los miembros", members.error.message);

console.log("Sala demo lista. Id: demo. Token: token-de-prueba.");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function fail(message, detail) {
  console.error(message);
  if (detail) console.error(detail);
  process.exit(1);
}
