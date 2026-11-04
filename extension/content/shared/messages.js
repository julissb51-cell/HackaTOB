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

  function normalizeMessageText(text) {
    return String(text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function stripSpeakerLabel(text) {
    return normalizeMessageText(text).replace(/^(?:you said|dijiste|t[uú] dijiste|usted dijo|copilot said|copilot dijo)\s*:\s*/i, "");
  }

  function isHiddenChrome(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = String(node.tagName || "").toLowerCase();
    if (tag === "script" || tag === "style" || tag === "noscript" || tag === "svg") return true;
    const className = typeof node.className === "string" ? node.className : "";
    return /(?:^|\s)(?:sr-only|visually-hidden)(?:\s|$)|srOnly|visuallyHidden|VisuallyHidden|screenReader|ScreenReader/.test(className);
  }

  function visibleText(node) {
    if (!node || isHiddenChrome(node)) return "";
    if (node.nodeType === 3) return node.textContent || "";
    if (node.nodeType !== 1) return "";
    let text = "";
    for (const child of node.childNodes || []) text += `${visibleText(child)} `;
    return text;
  }

  function plain(node) {
    return stripSpeakerLabel(visibleText(node));
  }

  function readText(node, selectors) {
    if (!node) return { text: "", selector: "" };
    for (const selector of selectors || []) {
      let target = null;
      try {
        target = node.matches?.(selector) ? node : queryOne(node, selector);
      } catch {
        target = null;
      }
      const value = plain(target);
      if (value) return { text: value, selector };
    }
    return { text: plain(node), selector: "" };
  }

  function textFrom(node, selectors) {
    return readText(node, selectors).text;
  }

  function treeTop(node) {
    let current = node;
    const seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      if (current.nodeType === 9) return current;
      const root = typeof current.getRootNode === "function" ? current.getRootNode() : null;
      if (root && root.host) {
        current = root.host;
        continue;
      }
      if (current.parentNode) {
        current = current.parentNode;
        continue;
      }
      return current.ownerDocument || current;
    }
    return node;
  }

  function documentOrder(nodes) {
    const order = new Map();
    let next = 0;
    const seen = new Set();
    const walk = (node) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      order.set(node, next);
      next += 1;
      for (const child of node.childNodes || []) walk(child);
      if (node.shadowRoot) walk(node.shadowRoot);
    };
    for (const node of nodes) walk(treeTop(node));
    for (const node of nodes) if (!order.has(node)) walk(node);
    return order;
  }

  function dedupeMessages(messages) {
    const clusters = [];
    for (const message of messages || []) {
      if (!message?.node || !normalizeMessageText(message.text)) continue;
      let placed = false;
      for (const cluster of clusters) {
        if (cluster.some((other) => inside(message.node, other.node) || inside(other.node, message.node))) {
          cluster.push(message);
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push([message]);
    }
    const picked = clusters.map((cluster) => {
      const inners = cluster.filter((item) => !cluster.some((other) => other !== item && inside(other.node, item.node)));
      return inners[inners.length - 1] || cluster[cluster.length - 1];
    });
    const order = documentOrder(picked.map((item) => item.node));
    picked.sort((a, b) => (order.get(a.node) || 0) - (order.get(b.node) || 0));
    const seen = new Set();
    const unique = [];
    for (const message of picked) {
      const key = `${message.role}|${normalizeMessageText(message.text)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(message);
    }
    return unique;
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
          const read = readText(bubble || turn, site.userTextSelectors);
          if (read.text) messages.push({ node: bubble || turn, role: "user", text: read.text, selector: read.selector });
        }
        const assistantNode = assistant && assistant !== bubble && !inside(assistant, bubble) ? assistant : null;
        if (explicit === "assistant" || (assistantNode && explicit !== "user")) {
          const read = readText(assistantNode || turn, site.assistantTextSelectors);
          if (read.text) messages.push({ node: assistantNode || turn, role: "assistant", text: read.text, selector: read.selector });
        }
      }
      if (messages.length) return dedupeMessages(messages);
    }

    for (const node of collect(root, site.userSelectors, false)) {
      const read = readText(node, site.userTextSelectors);
      if (read.text) messages.push({ node, role: "user", text: read.text, selector: read.selector });
    }
    for (const node of collect(root, site.assistantSelectors, false)) {
      const nodeSelector = (site.assistantSelectors || []).find((selector) => {
        try {
          return node.matches?.(selector);
        } catch {
          return false;
        }
      }) || "";
      const read = readText(node, site.assistantTextSelectors);
      if (read.text) messages.push({ node, role: "assistant", text: read.text, selector: read.selector || nodeSelector });
    }
    return dedupeMessages(messages);
  }

  return { listChatMessages, dedupeMessages, inside, textFrom, collect, queryAll, queryOne, normalizeMessageText };
});
