const core = globalThis.EnlazaCore;
const app = document.querySelector("#app");
const tagline = document.querySelector("#tagline");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function addActions(parent, text) {
  const row = el("div", "row prompt-actions");
  const copy = el("button", "secondary", "Copiar");
  const insert = el("button", "primary", "Insertar en el chat");
  copy.type = "button";
  insert.type = "button";
  const note = el("p", "status");
  copy.addEventListener("click", async () => {
    const ok = await copyText(text);
    note.textContent = ok ? "Copiado." : "No se pudo copiar.";
  });
  insert.addEventListener("click", async () => {
    insert.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({ type: "enlaza.insert", text });
      note.textContent = response?.ok
        ? "Listo. Quedó en la caja de texto, sin enviar."
        : response?.error || "No se pudo insertar.";
    } catch {
      note.textContent = "No se pudo insertar.";
    } finally {
      insert.disabled = false;
    }
  });
  row.append(copy, insert);
  parent.append(row, note);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function renderPrompt(parent, text) {
  if (!text) {
    parent.append(el("p", "meta", "Todavía no hay un prompt sugerido."));
    return;
  }
  parent.append(el("p", "prompt", text));
  addActions(parent, text);
}

function pageLine(page) {
  if (!page || page.reason === "otra") return "Abre ChatGPT, Gemini, Claude o Copilot para capturar.";
  if (!page.ok || page.reason === "sin lector") {
    return "No está el lector en esta pestaña. En Extensiones pulsa Actualizar en Enlaza y recarga el chat.";
  }
  const names = { gemini: "Gemini", chatgpt: "ChatGPT", claude: "Claude", copilot: "Copilot" };
  const ia = names[page.ia] || "Este chat";
  const mode = page.active ? "La sesión está conectada." : "Falta conectar la sala para enviar.";
  if (!page.users && !page.assistants) {
    return `${ia}: el lector está, pero no ve mensajes en esta página. ${mode}`;
  }
  return `${ia}: ve ${page.users} prompts y ${page.assistants} respuestas. ${mode}`;
}

function renderCapture(state, page) {
  const card = el("div", "card");
  const sent = state.capture?.sent || 0;
  card.append(el("h2", "", "Captura"), el("p", "", `Eventos enviados: ${sent}`));
  if (state.capture?.lastPreview) {
    const tipo = state.capture.lastTipo === "respuesta" ? "respuesta" : "prompt";
    card.append(el("p", "meta", `Último ${tipo}: ${state.capture.lastPreview}`));
  }
  if (state.capture?.lastError) card.append(el("p", "banner", state.capture.lastError));
  card.append(el("p", "meta", pageLine(page)));
  return card;
}

function render(state, page) {
  app.replaceChildren();
  app.append(renderCapture(state, page));
  const session = state.session;
  if (!session?.connected) {
    tagline.textContent = "Sin conectar";
    const card = el("div", "card");
    card.append(
      el("h2", "", "Sala"),
      el("p", "", "Conéctate desde el ícono de Enlaza. Pega el enlace de invitación y tu nombre."),
    );
    app.append(card);
    return;
  }

  tagline.textContent = `${session.member} · sala ${session.salaId}`;
  if (state.contextMeta?.error) app.append(el("p", "banner", state.contextMeta.error));

  const context = state.context;
  if (!context) {
    const empty = el("div", "card");
    empty.append(
      el("h2", "", "Contexto"),
      el("p", "", "Todavía no llega el contexto. Se pide al conectar y otra vez cada 30 segundos."),
    );
    app.append(empty);
  } else {
    const resumen = el("div", "card");
    resumen.append(el("h2", "", "Resumen"), el("p", "", context.resumen || "La sala todavía no tiene resumen."));
    const parte = el("div", "card");
    parte.append(el("h2", "", "Mi parte"), el("p", "", context.parte || "Todavía no tienes parte."));
    const avisos = el("div", "card");
    avisos.append(el("h2", "", "Avisos"));
    const warnings = Array.isArray(context.advertencias) ? context.advertencias : [];
    if (!warnings.length) {
      avisos.append(el("p", "", "No hay avisos."));
    } else {
      for (const warning of warnings) {
        const kind = core.warningKind(warning?.tipo);
        const block = el("div", `aviso ${kind}`);
        const pill = el("span", `pill ${kind}`, core.warningLabel(warning?.tipo));
        block.append(pill, el("p", "", warning?.mensaje || ""));
        if (Array.isArray(warning?.partes) && warning.partes.length) {
          block.append(el("p", "meta", warning.partes.join(" · ")));
        }
        if (warning?.prompt_sugerido) renderPrompt(block, warning.prompt_sugerido);
        avisos.append(block);
      }
    }
    const prompt = el("div", "card");
    prompt.append(el("h2", "", "Prompt sugerido"));
    renderPrompt(prompt, context.prompt_sugerido || "");
    app.append(resumen, parte, avisos, prompt);
  }

  const footer = el("div", "row");
  const refresh = el("button", "secondary", "Actualizar");
  refresh.type = "button";
  const when = state.contextMeta?.at
    ? `Actualizado ${new Date(state.contextMeta.at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : "Se actualiza cada 30 segundos.";
  const stamp = el("p", "meta", when);
  refresh.addEventListener("click", async () => {
    refresh.disabled = true;
    stamp.textContent = "Actualizando…";
    try {
      await chrome.runtime.sendMessage({ type: "enlaza.refresh" });
    } finally {
      refresh.disabled = false;
    }
  });
  footer.append(refresh);
  app.append(footer, stamp);
}

async function paint() {
  const state = await chrome.storage.local.get(["session", "context", "contextMeta", "capture"]);
  let page = null;
  try {
    const response = await chrome.runtime.sendMessage({ type: "enlaza.status" });
    page = response?.page || null;
    if (response?.capture) state.capture = response.capture;
  } catch {
    page = { ok: false, reason: "sin lector" };
  }
  render(state, page);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") paint();
});

paint().then(() => {
  chrome.runtime.sendMessage({ type: "enlaza.refresh" }).catch(() => {});
});

setInterval(() => {
  chrome.runtime.sendMessage({ type: "enlaza.refresh" }).catch(() => {});
}, 30000);
