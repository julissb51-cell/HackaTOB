(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  root.EnlazaMessages = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function queryAll(root, selector) {
    if (!root || !selector || !root.querySelectorAll) return [];
    const out = [];
    const seen = new Set();
    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      if (!current || seen.has(current) || !current.querySelectorAll) continue;
      seen.add(current);
      try {
        for (const node of current.querySelectorAll(selector)) out.push(node);
        for (const node of current.querySelectorAll("*")) {
          if (node.shadowRoot) stack.push(node.shadowRoot);
        }
      } catch {
        // Un selector inválido no debe tumbar el lector.
      }
    }
    return out;
  }

  function queryOne(root, selector) {
    if (!selector) return null;
    if (root?.matches?.(selector)) return root;
    return queryAll(root, selector)[0] || null;
  }

  function inside(node, ancestor) {
    if (!node || !ancestor || node === ancestor) return false;
    let current = node;
    const seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      if (current === ancestor) return true;
      if (current.parentNode) {
        current = current.parentNode;
        continue;
      }
      const root = typeof current.getRootNode === "function" ? current.getRootNode() : null;
      if (root && root.host) {
        current = root.host;
        continue;
      }
      break;
    }
    return false;
  }

  function keep(nodes, outer) {
    return nodes.filter((node) => !nodes.some((other) => other !== node && (outer ? inside(node, other) : inside(other, node))));
  }

  function collect(root, selectors, outer) {
    const found = [];
    const seen = new Set();
    for (const selector of selectors || []) {
      for (const node of queryAll(root, selector)) {
        if (seen.has(node)) continue;
        seen.add(node);
        found.push(node);
      }
    }
    return keep(found, outer);
  }

  function dedupeMessages(messages) {
    const kept = [];
    for (const message of messages || []) {
      if (!message?.node) continue;
      let nested = false;
      for (let index = 0; index < kept.length; index += 1) {
        const other = kept[index];
        if (inside(message.node, other.node)) {
          nested = true;
          break;
        }
        if (inside(other.node, message.node)) {
          kept[index] = message;
          nested = true;
          break;
        }
      }
      if (nested) continue;
      kept.push(message);
    }
    kept.sort((a, b) => {
      const pos = a.node.compareDocumentPosition?.(b.node) || 0;
      if (pos & 4) return -1;
      if (pos & 2) return 1;
      return 0;
    });
    const unique = [];
    for (const message of kept) {
      const prev = unique[unique.length - 1];
      const sameText = prev && prev.role === message.role && prev.role === "assistant" && normalizeMessageText(prev.text) === normalizeMessageText(message.text);
      if (sameText) continue;
      unique.push(message);
    }
    return unique;
  }

  function normalizeMessageText(text) {
    return String(text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function plain(node) {
    return normalizeMessageText(node?.innerText || node?.textContent || "");
  }

  function textFrom(node, selectors) {
    if (!node) return "";
    for (const selector of selectors || []) {
      const target = node.matches?.(selector) ? node : queryOne(node, selector);
      const value = plain(target);
      if (value) return value;
    }
    return plain(node);
  }

  function group(selectors) {
    const list = (selectors || []).filter(Boolean);
    return list.length ? list.join(", ") : "";
  }

  function listChatMessages(root, site) {
    const messages = [];
    const turns = collect(root, site.turnSelectors, false);
    const userSelector = group(site.userSelectors);
    const assistantSelector = group(site.assistantSelectors);
    if (turns.length) {
      for (const turn of turns) {
        const explicit = turn.getAttribute?.("data-turn") || turn.getAttribute?.("data-message-author-role") || "";
        const bubble = queryOne(turn, userSelector);
        const assistant = queryOne(turn, assistantSelector);
        if (explicit === "user" || bubble) {
          const text = textFrom(bubble || turn, site.userTextSelectors);
          if (text) messages.push({ node: bubble || turn, role: "user", text });
        }
        const assistantNode = assistant && assistant !== bubble && !bubble?.contains(assistant) ? assistant : null;
        if (explicit === "assistant" || (assistantNode && explicit !== "user")) {
          const text = textFrom(assistantNode || turn, site.assistantTextSelectors);
          if (text) messages.push({ node: assistantNode || turn, role: "assistant", text });
        }
      }
      if (messages.length) return dedupeMessages(messages);
    }

    for (const node of collect(root, site.userSelectors, true)) {
      const text = textFrom(node, site.userTextSelectors);
      if (text) messages.push({ node, role: "user", text });
    }
    for (const node of collect(root, site.assistantSelectors, true)) {
      const text = textFrom(node, site.assistantTextSelectors);
      if (text) messages.push({ node, role: "assistant", text });
    }
    return dedupeMessages(messages);
  }

  return { listChatMessages, dedupeMessages, inside, textFrom, collect, queryAll, queryOne, normalizeMessageText };
});
