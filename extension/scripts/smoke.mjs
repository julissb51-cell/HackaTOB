import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const core = require(path.join(root, "lib", "core.js"));

let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

const join = core.parseInvite("https://enlaza-green.vercel.app/join/demo?t=token-de-prueba");
check("invite join ?t=", join.ok && join.salaId === "demo" && join.token === "token-de-prueba");

const room = core.parseInvite("https://enlaza-green.vercel.app/room/demo?token=token-de-prueba");
check("invite room ?token=", room.ok && room.salaId === "demo" && room.token === "token-de-prueba");

const encoded = core.parseInvite("https://enlaza-green.vercel.app/join/demo?t=token%2Bde%2Bprueba");
check("invite decodifica el token", encoded.ok && encoded.token === "token+de+prueba");

const evil = core.parseInvite("https://evil.example/join/demo?t=token-de-prueba");
check("invite rechaza otro host", evil.ok === false);

const missing = core.parseInvite("https://enlaza-green.vercel.app/join/demo");
check("invite sin token", missing.ok === false);

const member = core.parseMember("  Ana  ");
check("nombre Ana", member.ok && member.name === "Ana");

const when = core.localIso(new Date("2026-11-03T15:15:00Z"));
check("tiempo ISO con desfase", core.LOCAL_TIME.test(when), when);

const cleaned = core.buildEvent({
  event_id: "evt_control",
  tipo: "prompt",
  miembro: "Ana",
  ia: "chatgpt",
  conversation_id: "chatgpt_abc",
  texto: "hola\u0001mundo",
  tiempo: "2026-11-03T09:15:00-06:00",
});
check("quita caracteres de control", cleaned.texto === "holamundo");
check("valida el evento limpio", core.validateEvent(cleaned) === "");

const huge = core.buildEvent({
  event_id: "evt_huge",
  tipo: "respuesta",
  miembro: "Ana",
  ia: "gemini",
  conversation_id: "gem_1",
  texto: "😀".repeat(core.TEXT_LIMIT + 3),
  tiempo: "2026-11-03T09:15:00-06:00",
});
check("trunca a 100000 caracteres", Array.from(huge.texto).length === core.TEXT_LIMIT);
check("el truncado sigue siendo válido", core.validateEvent(huge) === "");
check("no manda el alias source", huge.source === undefined && huge.ia === "gemini" && huge.tipo === "respuesta");

const fields = core.deriveChatFields("Arma la pantalla de la sala", "Nuevo chat - ChatGPT");
check("arma nombre_chat desde el prompt", fields.nombre_chat.startsWith("Arma la pantalla"));
check("arma palabra_clave", fields.palabra_clave === "arma" || fields.palabra_clave.length > 0);

const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8"));
check("manifest v3", manifest.manifest_version === 3);
check("service worker", manifest.background?.service_worker === "background/service-worker.js");
check("host de la API", manifest.host_permissions?.includes("https://enlaza-green.vercel.app/*"));
const referenced = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.side_panel.default_path,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  ...manifest.content_scripts.flatMap((script) => script.js),
];
for (const file of referenced) {
  check(`existe ${file}`, statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile?.() === true);
}

const scripts = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "node_modules") walk(full);
    } else if (name.endsWith(".js")) scripts.push(full);
  }
}
walk(root);
check("hay scripts de la extensión", scripts.length >= 8);

const base = core.API_BASE;
const salaId = "demo";
const token = "token-de-prueba";
const stamp = Date.now();
const prompt = core.buildEvent({
  event_id: `evt_ext_${stamp}_p`,
  tipo: "prompt",
  miembro: "Ana",
  ia: "chatgpt",
  conversation_id: `chatgpt_ext_${stamp}`,
  texto: "Prueba de la extensión Enlaza. Confirma el formato del contrato: prompt de Ana.",
  nombre_chat: "Prueba de la extensión",
  resumen: "Confirma el formato del contrato",
  palabra_clave: "prueba",
  proyecto: "Enlaza",
});
const respuesta = core.buildEvent({
  event_id: `evt_ext_${stamp}_r`,
  tipo: "respuesta",
  miembro: "Ana",
  ia: "chatgpt",
  conversation_id: prompt.conversation_id,
  texto: "La extensión puede mostrar el resumen, la parte, los avisos y un prompt para copiar.",
  nombre_chat: "Prueba de la extensión",
  resumen: "Describe lo que muestra la extensión",
  palabra_clave: "extension",
  tiempo: core.localIso(new Date()),
});

check("payload de prueba válido", core.validateEvent(prompt) === "" && core.validateEvent(respuesta) === "");

async function send(event, roomToken = token) {
  const response = await fetch(`${base}/api/rooms/${salaId}/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-room-token": roomToken,
    },
    body: JSON.stringify(event),
  });
  const text = await response.text();
  console.log(`POST ${response.status} ${event.tipo} ${event.event_id}`);
  console.log(text);
  return { status: response.status, text };
}

async function readContext(roomToken = token) {
  const response = await fetch(
    `${base}/api/rooms/${salaId}/context?member=${encodeURIComponent("Ana")}`,
    { headers: { "x-room-token": roomToken } },
  );
  const text = await response.text();
  console.log(`GET context ${response.status}`);
  console.log(text);
  return { status: response.status, text };
}

console.log("--- payload ---");
console.log(JSON.stringify(prompt, null, 2));

try {
  const first = await send(prompt);
  check("POST prompt 200", first.status === 200 && JSON.parse(first.text).ok === true, first.text);
  const second = await send(respuesta);
  check("POST respuesta 200", second.status === 200 && JSON.parse(second.text).ok === true, second.text);
  const duplicate = await send(prompt);
  check("reenviar el mismo event_id sigue en 200", duplicate.status === 200 && JSON.parse(duplicate.text).ok === true, duplicate.text);
  const context = await readContext();
  const body = JSON.parse(context.text);
  check("GET context 200", context.status === 200, context.text);
  check("contexto trae resumen", typeof body.resumen === "string" && body.resumen.length > 0);
  check("contexto trae parte", typeof body.parte === "string");
  check("contexto trae prompt_sugerido", typeof body.prompt_sugerido === "string");
  check("contexto trae advertencias", Array.isArray(body.advertencias));
  const denied = await readContext("token-malo");
  check("token malo es 401", denied.status === 401 && JSON.parse(denied.text).error === "no autorizado", denied.text);
} catch (error) {
  failed += 1;
  console.error(`FAIL  red — ${error instanceof Error ? error.message : error}`);
}

if (failed) {
  console.error(`\n${failed} comprobaciones fallaron`);
  process.exit(1);
}
console.log("\nsmoke ok");
