import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
export const core = require(path.join(dir, "../lib/core.js"));

export async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  return JSON.parse(text);
}

export function loadConfig() {
  const file = path.join(dir, "enlaza.local.json");
  let saved = {};
  if (existsSync(file)) saved = JSON.parse(readFileSync(file, "utf8"));
  const baseUrl = String(process.env.ENLAZA_BASE_URL || process.env.BASE_URL || saved.baseUrl || core.API_BASE).replace(/\/$/, "");
  const salaId = String(process.env.ENLAZA_SALA || process.env.ROOM_ID || saved.salaId || saved.roomId || "").trim();
  const token = String(process.env.ENLAZA_TOKEN || process.env.ROOM_TOKEN || saved.token || "").trim();
  const member = String(process.env.ENLAZA_MEMBER || process.env.MEMBER || saved.member || "").trim();
  if (!salaId || !token || !member) {
    throw new Error("Falta sala, token o miembro. Copia enlaza.local.example.json a enlaza.local.json o define ENLAZA_SALA, ENLAZA_TOKEN y ENLAZA_MEMBER.");
  }
  return { baseUrl, salaId, token, member };
}

export function conversationId(input, ia) {
  const raw = input?.conversation_id || input?.session_id || input?.generation_id || "";
  const clean = core.clipPlain(raw, 500);
  if (clean) return clean;
  return `${ia}_${core.hashText(String(input?.cwd || "local"))}`;
}

export function eventId(ia, tipo, conversation, text) {
  const stamp = core.hashText(`${conversation}\n${tipo}\n${text}`);
  const edge = core.hashText(`${text.length}:${text.slice(0, 80)}:${text.slice(-80)}`);
  return `evt_${ia}_${tipo}_${stamp}${edge}`.slice(0, 200);
}

export function buildHookEvent(config, { ia, tipo, texto, conversation, title }) {
  const fields = core.deriveChatFields(texto, title || "");
  const event = core.buildEvent({
    event_id: eventId(ia, tipo, conversation, texto),
    tipo,
    miembro: config.member,
    ia,
    conversation_id: conversation,
    texto,
    nombre_chat: fields.nombre_chat,
    resumen: fields.resumen,
    palabra_clave: fields.palabra_clave,
  });
  const problem = core.validateEvent(event);
  if (problem) throw new Error(problem);
  return event;
}

export async function postEvent(config, event) {
  const url = `${config.baseUrl}/api/rooms/${encodeURIComponent(config.salaId)}/events`;
  let last = { status: 0, body: "sin conexión" };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-room-token": config.token,
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(20000),
      });
      last = { status: response.status, body: await response.text() };
      if (response.ok || response.status === 400 || response.status === 401) return last;
    } catch (error) {
      last = { status: 0, body: error instanceof Error ? error.message : "sin conexión" };
    }
  }
  return last;
}

export function assistantText(row) {
  if (!row || typeof row !== "object") return "";
  const message = row.message && typeof row.message === "object" ? row.message : row;
  const role = message.role || row.role || row.type;
  if (role !== "assistant") return "";
  const content = message.content ?? row.content ?? message.text;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part.text === "string") return part.text;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function lastAssistantFromTranscript(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\n/).filter((line) => line.trim());
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const text = assistantText(JSON.parse(lines[index]));
      if (text) return text;
    } catch {
      // Una línea rota no esconde las anteriores.
    }
  }
  return "";
}

export async function deliver(ia, tipo, texto, input, title) {
  const config = loadConfig();
  const event = buildHookEvent(config, {
    ia,
    tipo,
    texto,
    conversation: conversationId(input, ia),
    title,
  });
  const result = await postEvent(config, event);
  console.error(`enlaza ${result.status} ${ia} ${tipo} ${event.event_id} ${result.body}`);
  return result;
}

export function finish(body) {
  process.stdout.write(`${JSON.stringify(body)}\n`);
}
