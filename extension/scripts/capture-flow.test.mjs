import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { parseHTML } = require(process.env.LINKEDOM || "/tmp/enlaza-dom/node_modules/linkedom");

function assertEvents(events, expected, label) {
  const got = events.map((event) => `${event.ia}:${event.tipo}:${event.texto}`).join(" || ");
  for (const item of expected) {
    const hits = events.filter((event) => event.ia === item.ia && event.tipo === item.tipo && event.texto.includes(item.text));
    if (hits.length !== 1) {
      throw new Error(`${label}: esperaba un ${item.tipo} con «${item.text}». Llegó: ${got || "(nada)"}`);
    }
  }
}

async function runScenario({ startUrl, selectors, siteName, play, trackScripts, prepare, leadMs = 5000 }) {
  const { window } = parseHTML("<!doctype html><html><head></head><body></body></html>");
  const document = window.document;
  const events = [];
  const timers = [];
  let now = 1_000_000;
  let seq = 1;
  let scripts = 0;
  const store = { session: { connected: true, consent: true, member: "Ana" } };
  const location = { href: startUrl };
  const realCreate = document.createElement.bind(document);
  document.createElement = (tag, options) => {
    if (String(tag).toLowerCase() === "script") scripts += 1;
    return realCreate(tag, options);
  };
  function later(fn, ms, interval) {
    const id = seq++;
    timers.push({ id, at: now + (ms || 0), fn, interval: Boolean(interval), ms: ms || 0 });
    return id;
  }
  function clearTimer(id) {
    const index = timers.findIndex((timer) => timer.id === id);
    if (index >= 0) timers.splice(index, 1);
  }
  const sandbox = {
    console,
    URL,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    setTimeout: (fn, ms) => later(fn, ms, false),
    setInterval: (fn, ms) => later(fn, ms, true),
    clearTimeout: clearTimer,
    clearInterval: clearTimer,
    document,
    location,
    window,
    Node: window.Node,
    HTMLElement: window.HTMLElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    HTMLInputElement: window.HTMLInputElement,
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    sessionStorage: { getItem: () => null, setItem() {} },
    chrome: {
      runtime: {
        sendMessage(message) {
          if (message?.type === "enlaza.capture") events.push(message.capture);
          return Promise.resolve();
        },
        onMessage: { addListener() {} },
      },
      storage: {
        local: {
          async get(key) {
            if (typeof key === "string") return { [key]: store[key] };
            return { ...store };
          },
          async set(patch) {
            Object.assign(store, patch);
          },
        },
        onChanged: { addListener() {} },
      },
    },
  };
  sandbox.globalThis = sandbox;
  for (const file of [
    "lib/core.js",
    "content/shared/dom.js",
    "content/shared/messages.js",
    "content/shared/capture.js",
    selectors,
  ]) {
    runInNewContext(readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
  }
  sandbox.EnlazaDom.isVisible = () => true;
  if (prepare) prepare({ document, location });
  sandbox.EnlazaCapture.start(sandbox[siteName]);

  async function flush() {
    for (let step = 0; step < 40; step += 1) await Promise.resolve();
  }

  async function advance(ms) {
    const target = now + ms;
    await flush();
    for (let guard = 0; guard < 8000; guard += 1) {
      const due = timers.filter((timer) => timer.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at;
      const index = timers.indexOf(due);
      timers.splice(index, 1);
      if (due.interval) timers.push({ id: due.id, at: now + due.ms, fn: due.fn, interval: true, ms: due.ms });
      const result = due.fn();
      if (result && typeof result.then === "function") await result;
      await flush();
    }
    now = target;
    await flush();
  }

  await advance(leadMs);
  await play({ document, location, advance });
  return { events, scripts: trackScripts ? scripts : 0 };
}

const chatgpt = await runScenario({
  startUrl: "https://chatgpt.com/",
  selectors: "content/chatgpt/selectors.js",
  siteName: "EnlazaChatgptSite",
  async play({ document, location, advance }) {
    document.body.innerHTML = `<div data-turn-key="exchange">
      <div data-turn="user"><div data-user-message-bubble><div class="whitespace-pre-wrap">que es una hackaton</div></div></div>
    </div>`;
    await advance(2000);
    location.href = "https://chatgpt.com/c/abc123";
    document.body.innerHTML = `<div data-turn-key="exchange">
      <div data-turn="user"><div data-user-message-bubble><div class="whitespace-pre-wrap">que es una hackaton</div></div></div>
      <div data-content-search-unit-key="a:assistant"><div class="markdown">Una hack</div></div>
      <button data-testid="stop-button" aria-label="Detener"></button>
    </div>`;
    await advance(400);
    document.querySelector(".markdown").textContent = "Una hackaton es un evento donde un equipo construye un prototipo.";
    await advance(6000);
  },
});
assertEvents(chatgpt.events, [
  { ia: "chatgpt", tipo: "prompt", text: "que es una hackaton" },
  { ia: "chatgpt", tipo: "respuesta", text: "Una hackaton es un evento donde un equipo construye un prototipo." },
], "chatgpt");

const gemini = await runScenario({
  startUrl: "https://gemini.google.com/app",
  selectors: "content/gemini/selectors.js",
  siteName: "EnlazaGeminiSite",
  async play({ document, location, advance }) {
    document.body.innerHTML = `<user-query><div class="query-text">cómo puedo armar un pitch para una hackaton?</div></user-query>`;
    await advance(2000);
    location.href = "https://gemini.google.com/app/pitch-1";
    document.body.innerHTML = `<user-query><div class="query-text">cómo puedo armar un pitch para una hackaton?</div></user-query>
      <model-response><message-content class="model-response-text markdown">Empieza</message-content></model-response>
      <button data-testid="stop-button" aria-label="Detener respuesta"></button>`;
    await advance(400);
    document.querySelector("message-content").textContent = "Empieza por el problema del equipo y cierra con el pedido.";
    await advance(6000);
  },
});
assertEvents(gemini.events, [
  { ia: "gemini", tipo: "prompt", text: "cómo puedo armar un pitch para una hackaton?" },
  { ia: "gemini", tipo: "respuesta", text: "Empieza por el problema del equipo y cierra con el pedido." },
], "gemini");

const claude = await runScenario({
  startUrl: "https://claude.ai/chat/6aea3d77-c8d8-83e8-ada3-561359e03e25",
  selectors: "content/claude/selectors.js",
  siteName: "EnlazaClaudeSite",
  async play({ document, advance }) {
    document.body.innerHTML = `<div data-testid="user-message">qué hora es actualmente en lisboa?</div>
      <div data-testid="assistant-message" data-is-streaming="true"><div class="standard-markdown">Lisboa</div></div>`;
    await advance(400);
    const reply = document.querySelector(".standard-markdown");
    reply.textContent = "Lisboa va 6 horas adelante de Costa Rica.";
    reply.parentElement.setAttribute("data-is-streaming", "false");
    await advance(6000);
  },
});
assertEvents(claude.events, [
  { ia: "claude", tipo: "prompt", text: "qué hora es actualmente en lisboa?" },
  { ia: "claude", tipo: "respuesta", text: "Lisboa va 6 horas adelante de Costa Rica." },
], "claude");

const copilot = await runScenario({
  startUrl: "https://copilot.microsoft.com/",
  selectors: "content/copilot/selectors.js",
  siteName: "EnlazaCopilotSite",
  trackScripts: true,
  async play({ advance }) {
    await advance(200);
  },
});
if (copilot.scripts !== 0) throw new Error(`Copilot no debe inyectar script (${copilot.scripts})`);

const reloaded = await runScenario({
  startUrl: "https://gemini.google.com/app/pitch-1",
  selectors: "content/gemini/selectors.js",
  siteName: "EnlazaGeminiSite",
  prepare({ document }) {
    document.body.innerHTML = `<user-query><div class="query-text">como armar un pitch</div></user-query>
      <model-response><message-content class="model-response-text">Tablero Kanban interactivo y colaborativo.</message-content></model-response>`;
  },
  async play({ document, advance }) {
    document.body.innerHTML = `<user-query><div class="query-text">como armar un pitch</div></user-query>
      <model-response><message-content class="model-response-text">Tablero Kanban interactivo y colaborativo.</message-content></model-response>
      <user-query><div class="query-text">Escribi 3 consejos cortos para el equipo.</div></user-query>
      <model-response><message-content class="model-response-text">Centralicen la documentacion.</message-content></model-response>
      <model-response><message-content class="model-response-text">Centralicen la documentacion. Asignen un responsable.</message-content></model-response>`;
    await advance(8000);
  },
});
const oldReply = reloaded.events.filter((event) => event.texto.includes("Tablero Kanban"));
if (oldReply.length !== 0) throw new Error(`reenvió historial: ${oldReply.map((event) => event.texto).join(" | ")}`);
const freshReplies = reloaded.events.filter((event) => event.tipo === "respuesta");
if (freshReplies.length !== 1 || !freshReplies[0].texto.includes("Asignen un responsable")) {
  throw new Error(freshReplies.map((event) => event.texto).join(" | ") || "(sin respuesta)");
}
const freshPrompts = reloaded.events.filter((event) => event.tipo === "prompt" && event.texto.includes("3 consejos"));
if (freshPrompts.length !== 1) throw new Error(`prompts ${freshPrompts.length}`);

const freshChat = [
  {
    label: "chatgpt nuevo",
    ia: "chatgpt",
    startUrl: "https://chatgpt.com/",
    nextUrl: "https://chatgpt.com/c/nuevo-1",
    selectors: "content/chatgpt/selectors.js",
    siteName: "EnlazaChatgptSite",
    prompt: "que es una hackaton",
    reply: "Una hackaton es un evento corto.",
    html(prompt, reply) {
      return `<div data-turn="user"><div data-user-message-bubble><div class="whitespace-pre-wrap">${prompt}</div></div></div>
        <div data-turn="assistant"><div class="markdown">${reply}</div></div>`;
    },
  },
  {
    label: "gemini nuevo",
    ia: "gemini",
    startUrl: "https://gemini.google.com/app",
    nextUrl: "https://gemini.google.com/app/nuevo-1",
    selectors: "content/gemini/selectors.js",
    siteName: "EnlazaGeminiSite",
    prompt: "como armar un pitch",
    reply: "Empieza por el problema.",
    html(prompt, reply) {
      return `<user-query><div class="query-text">${prompt}</div></user-query>
        <model-response><message-content class="model-response-text">${reply}</message-content></model-response>`;
    },
  },
  {
    label: "claude nuevo",
    ia: "claude",
    startUrl: "https://claude.ai/new",
    nextUrl: "https://claude.ai/chat/6aea3d77-c8d8-83e8-ada3-561359e03e25",
    selectors: "content/claude/selectors.js",
    siteName: "EnlazaClaudeSite",
    prompt: "resumi en 3 pasos supabase",
    reply: "Instala, crea el env y conecta.",
    html(prompt, reply) {
      return `<div data-testid="user-message">${prompt}</div>
        <div data-testid="assistant-message"><div class="standard-markdown">${reply}</div></div>`;
    },
  },
];
for (const site of freshChat) {
  const run = await runScenario({
    startUrl: site.startUrl,
    selectors: site.selectors,
    siteName: site.siteName,
    leadMs: 350,
    async play({ document, location, advance }) {
      location.href = site.nextUrl;
      document.body.innerHTML = site.html(site.prompt, site.reply);
      await advance(8000);
    },
  });
  const captures = run.events.filter((event) => event.tipo === "prompt" || event.tipo === "respuesta");
  const prompts = captures.filter((event) => event.tipo === "prompt" && event.texto.includes(site.prompt));
  const replies = captures.filter((event) => event.tipo === "respuesta" && event.texto.includes(site.reply));
  if (prompts.length !== 1 || replies.length !== 1) {
    throw new Error(`${site.label}: ${captures.map((event) => `${event.tipo}:${event.texto}`).join(" || ") || "(sendMessage no recibió enlaza.capture)"}`);
  }
}

const oldChat = await runScenario({
  startUrl: "https://chatgpt.com/",
  selectors: "content/chatgpt/selectors.js",
  siteName: "EnlazaChatgptSite",
  async play({ document, location, advance }) {
    location.href = "https://chatgpt.com/c/viejo";
    document.body.innerHTML = `<div data-turn="user"><div data-user-message-bubble><div class="whitespace-pre-wrap">primer tema</div></div></div>
      <div data-turn="assistant"><div class="markdown">respuesta vieja uno</div></div>
      <div data-turn="user"><div data-user-message-bubble><div class="whitespace-pre-wrap">segundo tema</div></div></div>
      <div data-turn="assistant"><div class="markdown">respuesta vieja dos</div></div>`;
    await advance(8000);
  },
});
if (oldChat.events.length !== 0) {
  throw new Error(`un chat viejo no debe vaciarse al abrirlo: ${oldChat.events.map((event) => event.texto).join(" | ")}`);
}

const loggedOut = await runScenario({
  startUrl: "https://chatgpt.com/",
  selectors: "content/chatgpt/selectors.js",
  siteName: "EnlazaChatgptSite",
  leadMs: 350,
  async play({ document, location, advance }) {
    document.title = "ChatGPT: Chat, Work, Create & Code with AI";
    location.href = "https://chatgpt.com/c/arana-1";
    document.body.innerHTML = `<article data-testid="conversation-turn-2">
        <div data-message-author-role="user"><div class="whitespace-pre-wrap">cuantas patas tiene una arana</div></div>
      </article>
      <article data-testid="conversation-turn-3">
        <div data-message-author-role="assistant"><div class="markdown">Una</div></div>
        <button data-testid="stop-button" aria-label="Stop streaming"></button>
      </article>
      <article data-testid="conversation-turn-4">
        <div data-message-author-role="assistant"><div class="markdown">Una araña tiene 8 patas!</div></div>
      </article>`;
    await advance(500);
    const stop = document.querySelector('[data-testid="stop-button"]');
    if (stop) stop.remove();
    document.querySelectorAll(".markdown")[1].textContent = "Una araña tiene 8 patas!";
    await advance(8000);
  },
});
const spiderPrompts = loggedOut.events.filter((event) => event.tipo === "prompt" && event.texto.includes("cuantas patas tiene una arana"));
const spiderReplies = loggedOut.events.filter((event) => event.tipo === "respuesta" && event.texto.includes("8 patas"));
if (spiderPrompts.length !== 1 || spiderReplies.length !== 1) {
  throw new Error(loggedOut.events.map((event) => `${event.tipo}:${event.texto}`).join(" || ") || "(nada)");
}
if (spiderPrompts[0].nombre_chat !== "cuantas patas tiene una arana") {
  throw new Error(spiderPrompts[0].nombre_chat || "(sin titulo)");
}

console.log("capture-flow ok");
