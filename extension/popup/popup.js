const core = globalThis.EnlazaCore;

const formView = document.querySelector("#view-form");
const consentView = document.querySelector("#view-consent");
const connectedView = document.querySelector("#view-connected");
const inviteInput = document.querySelector("#invite");
const memberInput = document.querySelector("#member");
const formError = document.querySelector("#form-error");
const consentSummary = document.querySelector("#consent-summary");
const who = document.querySelector("#who");
const sendStatus = document.querySelector("#send-status");
const retryButton = document.querySelector("#retry");

let viewLock = "";
let draft = null;
let filled = false;

function show(name) {
  formView.hidden = name !== "form";
  consentView.hidden = name !== "consent";
  connectedView.hidden = name !== "connected";
}

function showFormError(message) {
  formError.hidden = !message;
  formError.textContent = message || "";
}

function failedItems(outbox) {
  return (outbox || []).filter((item) => item.status === "failed");
}

async function render() {
  const state = await chrome.storage.local.get(["session", "context", "contextMeta", "outbox", "capture"]);
  const session = state.session;
  if (!filled && session) {
    if (session.invite) inviteInput.value = session.invite;
    if (session.member) memberInput.value = session.member;
    filled = true;
  }
  if (viewLock === "consent") return;
  if (!session?.connected) {
    show("form");
    return;
  }
  show("connected");
  who.textContent = `${session.member} · sala ${session.salaId}`;
  const bits = [];
  bits.push(`Eventos enviados: ${state.capture?.sent || 0}.`);
  if (state.capture?.lastError) bits.push(state.capture.lastError);
  if (state.contextMeta?.error) bits.push(state.contextMeta.error);
  else if (state.context?.parte) bits.push(`Tu parte: ${state.context.parte}`);
  else bits.push("Pidiendo el contexto de la sala…");
  const failed = failedItems(state.outbox);
  const pending = (state.outbox || []).filter((item) => item.status === "pending").length;
  if (failed.length) {
    bits.push(failed.length === 1 ? "1 envío falló." : `${failed.length} envíos fallaron.`);
  } else if (pending) {
    bits.push("Enviando…");
  }
  sendStatus.textContent = bits.join(" ");
  retryButton.hidden = failed.length === 0;
}

async function connect(next) {
  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: "enlaza.connect",
      session: {
        invite: next.invite,
        member: next.member,
        salaId: next.salaId,
        token: next.token,
      },
    });
  } catch {
    response = { ok: false, error: "No se pudo conectar. Recarga la extensión." };
  }
  viewLock = "";
  draft = null;
  if (!response?.ok) {
    show("form");
    showFormError(response?.error || "No se pudo conectar.");
    return;
  }
  await render();
}

document.querySelector("#connect").addEventListener("click", async () => {
  const invite = core.parseInvite(inviteInput.value);
  const member = core.parseMember(memberInput.value);
  if (!invite.ok) {
    showFormError(invite.error);
    return;
  }
  if (!member.ok) {
    showFormError(member.error);
    return;
  }
  showFormError("");
  draft = {
    invite: inviteInput.value.trim(),
    salaId: invite.salaId,
    token: invite.token,
    member: member.name,
  };
  const stored = await chrome.storage.local.get("session");
  const session = stored.session;
  if (session?.consent && session.consentKey === core.consentKey(draft.salaId, draft.member)) {
    await connect(draft);
    return;
  }
  consentSummary.textContent = `Sala ${draft.salaId}. Entras como ${draft.member}.`;
  viewLock = "consent";
  show("consent");
});

document.querySelector("#accept").addEventListener("click", async () => {
  if (!draft) {
    viewLock = "";
    show("form");
    return;
  }
  document.querySelector("#accept").disabled = true;
  try {
    await connect(draft);
  } finally {
    document.querySelector("#accept").disabled = false;
  }
});

document.querySelector("#cancel").addEventListener("click", () => {
  viewLock = "";
  draft = null;
  show("form");
});

document.querySelector("#disconnect").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "enlaza.disconnect" });
  viewLock = "";
  await render();
});

retryButton.addEventListener("click", async () => {
  retryButton.disabled = true;
  try {
    await chrome.runtime.sendMessage({ type: "enlaza.retry" });
  } finally {
    retryButton.disabled = false;
    await render();
  }
});

document.querySelector("#open-context").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id && chrome.sidePanel?.open) await chrome.sidePanel.open({ tabId: tab.id });
    else if (tab?.windowId && chrome.sidePanel?.open) await chrome.sidePanel.open({ windowId: tab.windowId });
    else throw new Error("sin panel");
  } catch {
    sendStatus.textContent = "Abre el panel lateral de Chrome para ver el contexto.";
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") render();
});

render();
