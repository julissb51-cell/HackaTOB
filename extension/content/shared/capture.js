(function () {
  "use strict";

  const FAST_MS = 1000;
  const SLOW_MS = 2500;
  const USER_MS = 300;
  const ID_WAIT_MS = 12000;

  function start(site) {
    if (!site || globalThis.__enlazaCaptureStarted) return;
    globalThis.__enlazaCaptureStarted = true;

    const dom = globalThis.EnlazaDom;
    const core = globalThis.EnlazaCore;
    let active = false;
    let armedKey = null;
    let sentCounts = new Map();
    let nodeSent = new WeakMap();
    let meta = new WeakMap();
    let waiting = [];
    let scanTimer = 0;
    let followTimer = 0;
    let pollTimer = 0;
    const observed = new WeakSet();
    let observer = null;
    let lastComposer = "";
    let lastWatchKey = "";
    let lastWatchAt = 0;
    let settling = false;
    let armTimer = 0;

    function listMessages() {
      return globalThis.EnlazaMessages.listChatMessages(document, site);
    }

    function lastAssistant(messages) {
      const assistants = messages.filter((message) => message.role === "assistant");
      return assistants[assistants.length - 1] || null;
    }

    function isStreaming() {
      if ((site.stopSelectors || []).some((selector) => dom.queryAllDeep(selector).length > 0)) return true;
      return dom.queryAllDeep("button[aria-label], button[data-testid]").some((button) => {
        const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("data-testid") || ""}`.toLowerCase();
        return /stop streaming|stop generating|detener respuesta|detener la respuesta|stop-button|composer-stop/.test(label);
      });
    }

    function composerText(element) {
      if (!element) return "";
      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) return element.value.trim();
      return (element.innerText || element.textContent || "").replace(/\u00a0/g, " ").trim();
    }

    function isPlaceholder(text) {
      const value = text.trim().toLowerCase();
      if (!value) return true;
      const known = [
        "pregunta a chatgpt",
        "message chatgpt",
        "ask chatgpt",
        "ask anything",
        ...(site.placeholders || []),
      ];
      return known.includes(value);
    }

    function eventPath(event) {
      if (typeof event.composedPath === "function") return event.composedPath();
      return [event.target];
    }

    function queuePromptFromComposer() {
      if (!active) return;
      const text = composerText(findComposer()) || lastComposer;
      if (isPlaceholder(text)) return;
      const keyName = countKey("user", text);
      const inDom = countInDom(listMessages(), "user", text);
      const already = sentCounts.get(keyName) || 0;
      if (already > inDom) return;
      sentCounts.set(keyName, inDom + 1);
      lastComposer = "";
      enqueue({ tipo: "prompt", texto: core.truncateText(text) });
    }

    function isSendControl(event) {
      const path = eventPath(event);
      for (const node of path) {
        if (!node?.matches) continue;
        for (const selector of site.sendSelectors || []) {
          try {
            if (node.matches(selector)) return true;
          } catch {
            // Sigue con el resto de selectores.
          }
        }
        const label = `${node.getAttribute?.("aria-label") || ""} ${node.getAttribute?.("data-testid") || ""} ${node.getAttribute?.("data-test-id") || ""}`.toLowerCase();
        if (/\b(send prompt|send message|enviar prompt|enviar mensaje)\b/.test(label) || label.includes("send-button")) {
          return true;
        }
      }
      return false;
    }

    function eventInComposer(event) {
      const composer = findComposer();
      if (!composer) return false;
      return eventPath(event).some((node) => node === composer || (node?.nodeType === 1 && composer.contains(node)));
    }

    function reportWatch() {
      const now = Date.now();
      let users = 0;
      let assistants = 0;
      let error = "";
      try {
        const messages = listMessages();
        users = messages.filter((message) => message.role === "user").length;
        assistants = messages.filter((message) => message.role === "assistant").length;
      } catch {
        error = "No pude leer el chat.";
      }
      const snapshot = { ia: site.ia, active, users, assistants, href: location.href, error };
      const key = JSON.stringify(snapshot);
      if (key === lastWatchKey) return;
      lastWatchKey = key;
      lastWatchAt = now;
      chrome.runtime.sendMessage({ type: "enlaza.watch", watch: snapshot }).catch(() => {});
    }

    function normalize(text) {
      return globalThis.EnlazaMessages.normalizeMessageText(text);
    }

    function countKey(role, text) {
      return `${role}|${core.hashText(normalize(text))}`;
    }

    function countInDom(messages, role, text) {
      const wanted = normalize(text);
      return messages.filter((message) => message.role === role && normalize(message.text) === wanted).length;
    }

    function snapshot() {
      return listMessages().map((message) => `${message.role}:${normalize(message.text)}`).join("\n");
    }

    function arm(key) {
      const messages = listMessages();
      const streamingTail = isStreaming() ? lastAssistant(messages) : null;
      sentCounts = new Map();
      nodeSent = new WeakMap();
      meta = new WeakMap();
      waiting = [];
      for (const message of messages) {
        if (!message.text) continue;
        if (streamingTail && message.node === streamingTail.node) continue;
        const keyName = countKey(message.role, message.text);
        sentCounts.set(keyName, (sentCounts.get(keyName) || 0) + 1);
        nodeSent.set(message.node, normalize(message.text));
      }
      armedKey = key;
    }

    function fallbackConversationId() {
      const storageKey = `enlaza.fallback.${site.ia}`;
      try {
        const existing = sessionStorage.getItem(storageKey);
        if (existing) return existing;
        const created = `${site.ia}_local_${core.newEventId().slice(4, 16)}`;
        sessionStorage.setItem(storageKey, created);
        return created;
      } catch {
        return `${site.ia}_local_sin_id`;
      }
    }

    function noteConversationChange() {
      const key = site.conversationId(location.href) || "";
      if (armedKey === null) {
        arm(key);
        return;
      }
      if (key === armedKey) return;
      if (armedKey === "" && key) {
        armedKey = key;
        return;
      }
      settling = true;
      armedKey = key;
      const previous = snapshot();
      clearTimeout(armTimer);
      armTimer = setTimeout(() => finishArm(key, previous, 0), 350);
    }

    function finishArm(key, previous, tries) {
      const current = site.conversationId(location.href) || "";
      if (current !== key) return;
      const now = snapshot();
      if (now === previous && tries < 4) {
        armTimer = setTimeout(() => finishArm(key, previous, tries + 1), 350);
        return;
      }
      arm(key);
      settling = false;
      scheduleScan();
    }

    function deliver(capture, attempt) {
      const trySend = attempt || 0;
      chrome.runtime.sendMessage({ type: "enlaza.capture", capture }).catch(() => {
        if (trySend < 2) setTimeout(() => deliver(capture, trySend + 1), 800 * (trySend + 1));
      });
    }

    function deliverNow(partial, conversationId) {
      const fields = core.deriveChatFields(partial.texto, document.title);
      deliver({
        event_id: partial.event_id,
        tipo: partial.tipo,
        texto: partial.texto,
        ia: site.ia,
        conversation_id: conversationId,
        nombre_chat: fields.nombre_chat,
        resumen: fields.resumen,
        palabra_clave: fields.palabra_clave,
      });
    }

    function enqueue(partial) {
      const item = {
        ...partial,
        event_id: partial.event_id || core.newEventId(),
        since: Date.now(),
        delivered: false,
      };
      const conversationId = site.conversationId(location.href);
      if (conversationId) {
        item.delivered = true;
        deliverNow(item, conversationId);
        return;
      }
      waiting.push(item);
    }

    function flushWaiting() {
      const conversationId = site.conversationId(location.href);
      const now = Date.now();
      const keep = [];
      for (const item of waiting) {
        if (item.delivered) continue;
        if (conversationId || now - item.since >= ID_WAIT_MS) {
          item.delivered = true;
          deliverNow(item, conversationId || fallbackConversationId());
        } else {
          keep.push(item);
        }
      }
      waiting = keep;
    }

    function stateFor(node) {
      let state = meta.get(node);
      if (!state) {
        state = { lastText: "", lastChange: Date.now(), sawStream: false };
        meta.set(node, state);
      }
      return state;
    }

    function readyDelay(message, tail, streaming) {
      const state = stateFor(message.node);
      if (message.text !== state.lastText) {
        state.lastText = message.text;
        state.lastChange = Date.now();
      }
      if (!message.text) return 400;
      if (message.role === "assistant" && tail && message.node === tail.node && streaming) {
        state.sawStream = true;
        return FAST_MS;
      }
      const need = message.role === "user" ? USER_MS : state.sawStream ? FAST_MS : SLOW_MS;
      const age = Date.now() - state.lastChange;
      if (age < need) return need - age;
      return 0;
    }

    function claim(message, messages) {
      const previous = nodeSent.get(message.node);
      const next = normalize(message.text);
      if (previous && normalize(previous) === next) return false;
      if (previous && next.length <= normalize(previous).length) return false;
      const keyName = countKey(message.role, message.text);
      const inDom = countInDom(messages, message.role, message.text);
      const already = sentCounts.get(keyName) || 0;
      if (inDom <= already) {
        nodeSent.set(message.node, next);
        return false;
      }
      sentCounts.set(keyName, already + 1);
      nodeSent.set(message.node, next);
      return true;
    }

    function scan() {
      clearTimeout(followTimer);
      if (!active) {
        reportWatch();
        return;
      }
      noteConversationChange();
      attachShadows(document);
      const messages = listMessages();
      if (settling) {
        reportWatch();
        return;
      }
      const tail = lastAssistant(messages);
      const streaming = isStreaming();
      let nextWait = 0;
      for (const message of messages) {
        const delay = readyDelay(message, tail, streaming);
        if (!message.text) continue;
        if (delay > 0) {
          nextWait = nextWait === 0 ? delay : Math.min(nextWait, delay);
          continue;
        }
        if (!claim(message, messages)) continue;
        enqueue({
          tipo: message.role === "user" ? "prompt" : "respuesta",
          texto: core.truncateText(message.text),
        });
      }
      flushWaiting();
      if (waiting.length) nextWait = nextWait === 0 ? 500 : Math.min(nextWait, 500);
      if (nextWait > 0) followTimer = setTimeout(scan, nextWait);
      reportWatch();
    }

    function scheduleScan() {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scan, 200);
    }

    function attachShadows(root) {
      if (!observer || !root?.querySelectorAll) return;
      const nodes = root.querySelectorAll("*");
      for (const node of nodes) {
        if (!node.shadowRoot || observed.has(node.shadowRoot)) continue;
        observed.add(node.shadowRoot);
        observer.observe(node.shadowRoot, { childList: true, subtree: true, characterData: true });
        attachShadows(node.shadowRoot);
      }
    }

    function findComposer() {
      for (const selector of site.composerSelectors || []) {
        let nodes = [];
        try {
          nodes = dom.queryAllDeep(selector);
        } catch {
          continue;
        }
        const visible = nodes.filter(dom.isVisible);
        const pool = visible.length ? visible : nodes;
        if (pool[0]) return pool[0];
      }
      return null;
    }

    function insertText(text) {
      const value = String(text || "");
      if (!value.trim()) return "No hay texto para insertar.";
      const element = findComposer();
      if (!element) return "No encontré la caja de texto de este chat.";
      element.focus();
      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        const start = element.selectionStart ?? element.value.length;
        const end = element.selectionEnd ?? element.value.length;
        element.setRangeText(value, start, end, "end");
        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        return "";
      }
      placeCaret(element);
      const landed = () => composerText(element).includes(value.slice(0, Math.min(40, value.length)));
      if (document.execCommand("insertText", false, value) && landed()) return "";
      const before = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: value,
      });
      element.dispatchEvent(before);
      if (before.defaultPrevented || landed()) return "";
      return "Encontré la caja, pero este chat no dejó insertar el texto.";
    }

    function placeCaret(element) {
      const root = element.getRootNode?.() || document;
      const selection = typeof root.getSelection === "function" ? root.getSelection() : window.getSelection();
      if (!selection) return;
      const range = typeof root.createRange === "function" ? root.createRange() : document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message) return;
      if (message.type === "enlaza.insert") {
        const error = insertText(message.text);
        sendResponse({ ok: !error, error });
        return;
      }
      if (message.type === "enlaza.ping") {
        let users = 0;
        let assistants = 0;
        try {
          const messages = listMessages();
          users = messages.filter((item) => item.role === "user").length;
          assistants = messages.filter((item) => item.role === "assistant").length;
        } catch {
          sendResponse({ ok: false, reason: "sin lector" });
          return;
        }
        sendResponse({ ok: true, ia: site.ia, active, users, assistants, href: location.href });
      }
    });

    function onComposerKey(event) {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing || !eventInComposer(event)) return;
      queuePromptFromComposer();
    }

    function onComposerClick(event) {
      if (!isSendControl(event)) return;
      queuePromptFromComposer();
    }

    function onComposerInput(event) {
      if (!eventInComposer(event)) return;
      const text = composerText(findComposer());
      if (!isPlaceholder(text)) lastComposer = text;
    }

    function onComposerSubmit(event) {
      if (!eventInComposer(event) && !event.target?.contains?.(findComposer())) return;
      queuePromptFromComposer();
    }

    async function refreshActive() {
      const stored = await chrome.storage.local.get("session");
      const session = stored.session;
      const next = Boolean(session?.connected && session?.consent);
      const becameActive = next && !active;
      active = next;
      if (!active) {
        settling = false;
        clearTimeout(armTimer);
        armedKey = null;
        waiting = [];
        return;
      }
      if (becameActive || armedKey === null) arm(site.conversationId(location.href) || "");
      scheduleScan();
    }

    function boot() {
      observer = new MutationObserver(() => scheduleScan());
      const root = document.documentElement || document.body;
      if (root) observer.observe(root, { childList: true, subtree: true, characterData: true });
      pollTimer = setInterval(scan, 1000);
      document.addEventListener("keydown", onComposerKey, true);
      document.addEventListener("click", onComposerClick, true);
      document.addEventListener("input", onComposerInput, true);
      document.addEventListener("submit", onComposerSubmit, true);
      refreshActive();
      reportWatch();
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.session) refreshActive();
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }

  globalThis.EnlazaCapture = { start };
})();
