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

  function deepest(nodes) {
    return nodes.filter((node) => !nodes.some((other) => other !== node && node.contains(other)));
  }

  function collect(root, selectors) {
    const found = [];
    const seen = new Set();
    for (const selector of selectors || []) {
      for (const node of queryAll(root, selector)) {
        if (seen.has(node)) continue;
        seen.add(node);
        found.push(node);
      }
    }
    return deepest(found);
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
    const turns = collect(root, site.turnSelectors);
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
      if (messages.length) return messages;
    }

    for (const node of collect(root, site.userSelectors)) {
      const text = textFrom(node, site.userTextSelectors);
      if (text) messages.push({ node, role: "user", text });
    }
    for (const node of collect(root, site.assistantSelectors)) {
      const text = textFrom(node, site.assistantTextSelectors);
      if (text) messages.push({ node, role: "assistant", text });
    }
    return messages;
  }

  return { listChatMessages, textFrom, collect, queryAll, queryOne, normalizeMessageText };
});
