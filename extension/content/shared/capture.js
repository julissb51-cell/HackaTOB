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

    function messageNodes(selectors) {
      const nodes = dom.findFirst(selectors);
      return nodes.filter((node) => !nodes.some((other) => other !== node && other.contains(node)));
    }

    function readText(node, selectors) {
      for (const selector of selectors) {
        let target = null;
        if (node.matches?.(selector)) target = node;
        else target = dom.queryDeep(selector, node);
        const value = target?.innerText?.replace(/\u00a0/g, " ").trim();
        if (value) return value;
      }
      return node.innerText?.replace(/\u00a0/g, " ").trim() || "";
    }

    function listMessages() {
      const users = messageNodes(site.userSelectors).map((node) => ({
        node,
        role: "user",
        text: readText(node, site.userTextSelectors),
      }));
      const assistants = messageNodes(site.assistantSelectors).map((node) => ({
        node,
        role: "assistant",
        text: readText(node, site.assistantTextSelectors),
      }));
      return users.concat(assistants);
    }

    function lastAssistant(messages) {
      const assistants = messages.filter((message) => message.role === "assistant");
      return assistants[assistants.length - 1] || null;
    }

    function isStreaming() {
      return site.stopSelectors.some((selector) => dom.queryAllDeep(selector).length > 0);
    }

    function countKey(role, text) {
      return `${role}|${core.hashText(text)}`;
    }

    function countInDom(messages, role, text) {
      return messages.filter((message) => message.role === role && message.text === text).length;
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
        nodeSent.set(message.node, message.text);
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
      arm(key);
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
      if (previous === message.text) return false;
      if (previous && message.text.length <= previous.length) return false;
      const keyName = countKey(message.role, message.text);
      const inDom = countInDom(messages, message.role, message.text);
      const already = sentCounts.get(keyName) || 0;
      if (inDom <= already) {
        nodeSent.set(message.node, message.text);
        return false;
      }
      sentCounts.set(keyName, already + 1);
      nodeSent.set(message.node, message.text);
      return true;
    }

    function scan() {
      if (!active) return;
      clearTimeout(followTimer);
      noteConversationChange();
      attachShadows(document);
      const messages = listMessages();
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
      const found = [];
      for (const selector of site.composerSelectors) found.push(...dom.queryAllDeep(selector));
      const visible = found.filter(dom.isVisible);
      const pool = visible.length ? visible : found;
      return pool[pool.length - 1] || null;
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
      const selection = window.getSelection();
      if (!selection || !element.contains(selection.anchorNode)) {
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      if (document.execCommand("insertText", false, value)) return "";
      const before = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: value,
      });
      element.dispatchEvent(before);
      if (before.defaultPrevented) return "";
      return "Encontré la caja, pero este chat no dejó insertar el texto.";
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || message.type !== "enlaza.insert") return;
      const error = insertText(message.text);
      sendResponse({ ok: !error, error });
    });

    async function refreshActive() {
      const stored = await chrome.storage.local.get("session");
      const session = stored.session;
      const next = Boolean(session?.connected && session?.consent);
      const becameActive = next && !active;
      active = next;
      if (!active) {
        armedKey = null;
        waiting = [];
        return;
      }
      if (becameActive || armedKey === null) arm(site.conversationId(location.href) || "");
      scheduleScan();
    }

    function boot() {
      observer = new MutationObserver(() => scheduleScan());
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      }
      pollTimer = setInterval(() => {
        if (active) scan();
      }, 1000);
      refreshActive();
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
