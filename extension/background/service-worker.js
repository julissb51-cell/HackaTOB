importScripts("../lib/core.js", "../lib/files.js");

const core = globalThis.EnlazaCore;
const filesApi = globalThis.EnlazaFiles;
const CHAT_HOSTS = ["chatgpt.com", "gemini.google.com", "claude.ai"];

function isChatHost(host) {
  return CHAT_HOSTS.includes(host);
}
const ALARM = "enlaza-context";
const RETRIES = 3;
const REFRESH_GAP_MS = 20000;

let chain = Promise.resolve();
let lastFetch = 0;

function enqueue(work) {
  const run = chain.then(work, work);
  chain = run.then(
    () => {},
    () => {},
  );
  return run;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roomUrl(salaId, suffix) {
  return `${core.API_BASE}/api/rooms/${encodeURIComponent(salaId)}${suffix}`;
}

async function readSession() {
  const stored = await chrome.storage.local.get("session");
  return stored.session || null;
}

async function readOutbox() {
  const stored = await chrome.storage.local.get("outbox");
  return Array.isArray(stored.outbox) ? stored.outbox : [];
}

async function readSentIds() {
  const stored = await chrome.storage.local.get("sentIds");
  return Array.isArray(stored.sentIds) ? stored.sentIds : [];
}

function emptyCapture() {
  return { sent: 0, lastError: "", lastSentAt: 0, lastTipo: "", lastPreview: "", watch: null };
}

async function readCapture() {
  const stored = await chrome.storage.local.get("capture");
  return { ...emptyCapture(), ...(stored.capture || {}) };
}

async function paintBadge(capture) {
  const sent = capture?.sent || 0;
  const unauthorized = /token no es válido/i.test(capture?.lastError || "");
  const text = unauthorized ? "!" : sent > 0 ? String(Math.min(sent, 99)) : capture?.lastError ? "!" : "";
  try {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: capture?.lastError ? "#8f2d2d" : "#12775b" });
    const title = capture?.lastError
      ? `Enlaza · ${capture.lastError}`
      : sent
        ? `Enlaza · ${sent} eventos enviados`
        : "Enlaza";
    await chrome.action.setTitle({ title });
  } catch {
    // El badge es una ayuda visual. Si el navegador lo rechaza, el panel igual muestra el conteo.
  }
}

async function writeCapture(patch) {
  const next = { ...(await readCapture()), ...patch };
  await chrome.storage.local.set({ capture: next });
  await paintBadge(next);
  return next;
}

async function noteSent(event) {
  const capture = await readCapture();
  const preview = String(event.texto || "").replace(/\s+/g, " ").trim().slice(0, 80);
  await writeCapture({
    sent: (capture.sent || 0) + 1,
    lastError: "",
    lastSentAt: Date.now(),
    lastTipo: event.tipo || "",
    lastPreview: preview,
  });
}

async function noteFailure(error) {
  if (!error) return;
  await writeCapture({ lastError: error });
}

async function rememberSent(eventId) {
  const ids = await readSentIds();
  if (!ids.includes(eventId)) ids.push(eventId);
  await chrome.storage.local.set({ sentIds: ids.slice(-400) });
}

async function request(url, init) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (response.ok) return { ok: true, status: response.status, body };
    return {
      ok: false,
      status: response.status,
      error: core.explainHttp(response.status, body?.error),
    };
  } catch {
    return { ok: false, status: 0, error: core.explainHttp(0, "sin conexión") };
  }
}

async function withRetries(run) {
  let last = { ok: false, status: 0, error: core.explainHttp(0, "sin conexión") };
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    last = await run();
    if (last.ok) return last;
    if (last.status === 400 || last.status === 401 || last.status === 409) return last;
    if (attempt < RETRIES) await delay(350 * attempt);
  }
  return last;
}

async function postEvent(session, event) {
  return withRetries(() =>
    request(roomUrl(session.salaId, "/events"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-room-token": session.token,
      },
      body: JSON.stringify(event),
    }),
  );
}

async function fetchContext(session) {
  const suffix = `/context?member=${encodeURIComponent(session.member)}`;
  return withRetries(() =>
    request(roomUrl(session.salaId, suffix), {
      headers: { "x-room-token": session.token },
    }),
  );
}

async function ensureAlarm(connected) {
  await chrome.alarms.clear(ALARM);
  if (!connected) return;
  try {
    await chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
  } catch {
    await chrome.alarms.create(ALARM, { periodInMinutes: 1 });
  }
}

async function refreshContext(force) {
  const now = Date.now();
  if (!force && now - lastFetch < REFRESH_GAP_MS) return { ok: true, skipped: true };
  const session = await readSession();
  if (!session?.connected || !session.consent) return { ok: false, error: "Sin conexión." };
  lastFetch = now;
  const result = await fetchContext(session);
  if (!result.ok) {
    await noteFailure(result.error);
    await chrome.storage.local.set({
      contextMeta: { ok: false, error: result.error, at: Date.now() },
    });
    return result;
  }
  const capture = await readCapture();
  if (/token no es válido/i.test(capture.lastError || "")) await writeCapture({ lastError: "" });
  await chrome.storage.local.set({
    context: result.body,
    contextMeta: { ok: true, error: "", at: Date.now() },
  });
  return result;
}

async function flushOutbox() {
  const session = await readSession();
  if (!session?.connected || !session.consent) return;
  const sentIds = new Set(await readSentIds());
  const outbox = await readOutbox();
  const remain = [];
  let freshError = "";
  for (const item of outbox) {
    if (!item?.event?.event_id) continue;
    if (item.status === "failed") {
      remain.push(item);
      continue;
    }
    if (sentIds.has(item.event.event_id)) continue;
    const result = await postEvent(session, item.event);
    if (result.ok) {
      const fresh = !sentIds.has(item.event.event_id);
      sentIds.add(item.event.event_id);
      if (fresh) await noteSent(item.event);
      continue;
    }
    item.status = "failed";
    item.error = result.error;
    item.auth = result.status === 401;
    item.attempts = RETRIES;
    freshError = result.error;
    remain.push(item);
  }
  await chrome.storage.local.set({
    outbox: remain.slice(-10),
    sentIds: [...sentIds].slice(-400),
    lastSendError: freshError,
  });
  if (freshError) await noteFailure(freshError);
}

async function onCapture(capture) {
  const session = await readSession();
  if (!session?.connected || !session.consent) {
    await noteFailure("Sin conexión.");
    return { ok: false, error: "Sin conexión.", retry: false };
  }
  const event = core.buildEvent({ ...capture, miembro: session.member });
  const problem = core.validateEvent(event);
  if (problem) {
    await noteFailure(problem);
    return { ok: false, error: problem, retry: false };
  }
  const sentIds = await readSentIds();
  if (sentIds.includes(event.event_id)) return { ok: true, duplicate: true };
  const outbox = await readOutbox();
  if (!outbox.some((item) => item.event?.event_id === event.event_id)) {
    outbox.push({ event, status: "pending", attempts: 0, error: "" });
    await chrome.storage.local.set({ outbox: outbox.slice(-10) });
  }
  await flushOutbox();
  const still = (await readOutbox()).find((item) => item.event?.event_id === event.event_id);
  if (!still) return { ok: true };
  return { ok: false, error: still.error || "No se pudo enviar.", retry: true, queued: true };
}

async function onConnect(input) {
  const invite = core.parseInvite(input?.invite);
  const member = core.parseMember(input?.member);
  if (!invite.ok) return { ok: false, error: invite.error };
  if (!member.ok) return { ok: false, error: member.error };
  const previous = await readSession();
  const changed = previous && (previous.salaId !== invite.salaId || previous.member !== member.name);
  const session = {
    connected: true,
    consent: true,
    consentKey: core.consentKey(invite.salaId, member.name),
    salaId: invite.salaId,
    token: invite.token,
    member: member.name,
    invite: String(input.invite || "").trim(),
  };
  const patch = { session, lastSendError: "" };
  if (changed) {
    patch.context = null;
    patch.contextMeta = null;
    patch.outbox = [];
    patch.sentIds = [];
    patch.capture = emptyCapture();
  } else {
    const outbox = await readOutbox();
    for (const item of outbox) {
      if (item.status === "failed") {
        item.status = "pending";
        item.attempts = 0;
        item.error = "";
        item.auth = false;
      }
    }
    patch.outbox = outbox;
  }
  await chrome.storage.local.set(patch);
  if (changed) await paintBadge(emptyCapture());
  else await paintBadge(await readCapture());
  lastFetch = 0;
  await ensureAlarm(true);
  await refreshContext(true);
  await flushOutbox();
  return { ok: true };
}

async function onDisconnect() {
  const previous = await readSession();
  const session = previous ? { ...previous, connected: false } : null;
  await chrome.storage.local.set({
    session,
    context: null,
    contextMeta: null,
    lastSendError: "",
  });
  await writeCapture({ lastError: "" });
  await ensureAlarm(false);
  return { ok: true };
}

async function onRetry() {
  const outbox = await readOutbox();
  for (const item of outbox) {
    if (item.status === "failed") {
      item.status = "pending";
      item.attempts = 0;
      item.error = "";
    }
  }
  await chrome.storage.local.set({ outbox, lastSendError: "" });
  await flushOutbox();
  return { ok: true };
}

function chatHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function onInsert(text) {
  const value = String(text || "");
  if (!value.trim()) return { ok: false, error: "No hay texto para insertar." };
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  let tab = tabs.find((item) => item.id && item.url) || tabs[0] || null;
  if (!tab?.url) {
    const all = await chrome.tabs.query({ active: true });
    tab = all.find((item) => isChatHost(chatHost(item.url || ""))) || null;
  }
  const host = chatHost(tab?.url || "");
  if (!tab?.id || !isChatHost(host)) {
    return { ok: false, error: "Abre ChatGPT, Gemini o Claude para insertar el prompt." };
  }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "enlaza.insert", text: value });
    if (response?.ok) return { ok: true };
    return { ok: false, error: response?.error || "No encontré la caja de texto de este chat." };
  } catch {
    return { ok: false, error: "No pude hablar con la página. Recarga el chat." };
  }
}

function filesUrl(session) {
  return roomUrl(session.salaId, `/files?member=${encodeURIComponent(session.member)}`);
}

function decodeBase64(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function requireSession() {
  const session = await readSession();
  if (!session?.connected || !session.consent || !session.token || !session.salaId) {
    return { ok: false, error: "no_session" };
  }
  return session;
}

async function onLink(payload) {
  const session = await requireSession();
  if (session.ok === false) return session;
  const url = filesApi.cleanShareUrl(payload?.url);
  if (!url) return { ok: false, status: 400, error: "url no válida" };
  const name = typeof payload?.name === "string" ? payload.name.trim().slice(0, 200) : "";
  const result = await withRetries(() =>
    request(filesUrl(session), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-room-token": session.token,
      },
      body: JSON.stringify(name ? { url, name } : { url }),
    }),
  );
  if (result.status === 409) return { ok: true, duplicate: true, status: 409 };
  if (result.status === 401) await noteFailure(result.error);
  if (!result.ok) return { ok: false, status: result.status, error: result.error || "No se pudo enviar. Puedes reintentar." };
  return { ok: true, status: result.status, archivo: result.body?.archivo || null };
}

async function signUpload(session, name, size, mime) {
  return withRetries(() =>
    request(filesUrl(session), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-room-token": session.token,
      },
      body: JSON.stringify({ name, size, mime }),
    }),
  );
}

async function putBytes(signedUrl, bytes, mime) {
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": mime },
    body: bytes,
  });
  return response.ok;
}

async function onFile(payload) {
  const session = await requireSession();
  if (session.ok === false) return session;
  const file = payload?.file || {};
  let bytes;
  try {
    bytes = decodeBase64(file.bytes);
  } catch {
    return { ok: false, status: 400, error: "cuerpo ilegible" };
  }
  const sizeError = filesApi.checkSize(bytes.byteLength);
  if (sizeError) return { ok: false, status: 400, error: sizeError };
  const name = String(file.name || "archivo").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 200) || "archivo";
  const mime = filesApi.mimeOrDefault(file.mime);
  let sign = await signUpload(session, name, bytes.byteLength, mime);
  if (sign.status === 401) await noteFailure(sign.error);
  if (!sign.ok || !sign.body?.upload?.signedUrl || !sign.body?.upload?.path) {
    return { ok: false, status: sign.status, error: sign.error || "No se pudo preparar la subida." };
  }
  let uploaded = await putBytes(sign.body.upload.signedUrl, bytes, mime);
  if (!uploaded) {
    sign = await signUpload(session, name, bytes.byteLength, mime);
    if (!sign.ok || !sign.body?.upload?.signedUrl) {
      return { ok: false, status: sign.status, error: sign.error || "No se pudo preparar la subida." };
    }
    uploaded = await putBytes(sign.body.upload.signedUrl, bytes, mime);
    if (!uploaded) return { ok: false, status: 0, error: "No se pudo subir el archivo. Puedes reintentar." };
  }
  const saved = await withRetries(() =>
    request(filesUrl(session), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-room-token": session.token,
      },
      body: JSON.stringify({ name, size: bytes.byteLength, mime, path: sign.body.upload.path }),
    }),
  );
  if (saved.status === 401) await noteFailure(saved.error);
  if (!saved.ok) return { ok: false, status: saved.status, error: saved.error || "No se pudo guardar el archivo. Puedes reintentar." };
  return { ok: true, status: saved.status, archivo: saved.body?.archivo || null };
}

async function onWatch(watch) {
  await writeCapture({
    watch: {
      ia: watch?.ia || "",
      active: Boolean(watch?.active),
      users: Number(watch?.users) || 0,
      assistants: Number(watch?.assistants) || 0,
      href: String(watch?.href || ""),
      error: String(watch?.error || ""),
      at: Date.now(),
    },
  });
  return { ok: true };
}

async function onStatus() {
  const capture = await readCapture();
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  let tab = tabs.find((item) => item.id && item.url) || tabs[0] || null;
  if (!tab?.url) {
    const all = await chrome.tabs.query({ active: true });
    tab = all.find((item) => isChatHost(chatHost(item.url || ""))) || null;
  }
  const host = chatHost(tab?.url || "");
  if (!tab?.id || !isChatHost(host)) {
    return { ok: true, capture, page: { ok: false, reason: "otra" } };
  }
  try {
    const page = await chrome.tabs.sendMessage(tab.id, { type: "enlaza.ping" });
    return { ok: true, capture, page: page?.ok ? page : { ok: false, reason: "sin lector", host } };
  } catch {
    return { ok: true, capture, page: { ok: false, reason: "sin lector", host } };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message?.type;
  const task = () => {
    if (type === "enlaza.capture") return onCapture(message.capture);
    if (type === "enlaza.connect") return onConnect(message.session);
    if (type === "enlaza.disconnect") return onDisconnect();
    if (type === "enlaza.retry") return onRetry();
    if (type === "enlaza.refresh") return refreshContext(true);
    if (type === "enlaza.insert") return onInsert(message.text);
    if (type === "enlaza.watch") return onWatch(message.watch);
    if (type === "enlaza.status") return onStatus();
    if (type === "enlaza.link") return onLink(message);
    if (type === "enlaza.file") return onFile(message);
    return Promise.resolve({ ok: false, error: "Acción desconocida." });
  };
  enqueue(task)
    .then((result) => sendResponse(result))
    .catch(() => sendResponse({ ok: false, error: "No se pudo completar la acción." }));
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM) return;
  enqueue(async () => {
    await refreshContext(false);
    await flushOutbox();
  });
});

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
  enqueue(() => ensureAlarmFromSession());
});

async function requeueAfterRestart() {
  const outbox = await readOutbox();
  let changed = false;
  for (const item of outbox) {
    if (item?.status === "failed" && !item.auth) {
      item.status = "pending";
      item.attempts = 0;
      item.error = "";
      changed = true;
    }
  }
  if (changed) await chrome.storage.local.set({ outbox });
}

async function ensureAlarmFromSession() {
  const session = await readSession();
  await paintBadge(await readCapture());
  await requeueAfterRestart();
  await ensureAlarm(Boolean(session?.connected && session?.consent));
  if (session?.connected && session?.consent) {
    await flushOutbox();
    await refreshContext(false);
  }
}

enqueue(() => ensureAlarmFromSession());

setInterval(() => {
  enqueue(async () => {
    await refreshContext(false);
    await flushOutbox();
  });
}, 30000);
