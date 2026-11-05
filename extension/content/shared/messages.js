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
    const flat = String(text || "")
      .normalize("NFC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const mid = Math.floor(flat.length / 2);
    if (mid >= 8 && flat.length % 2 === 1 && flat[mid] === " " && flat.slice(0, mid) === flat.slice(mid + 1)) {
      return flat.slice(0, mid);
    }
    return flat;
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

  function hashText(text) {
    let hash = 2166136261;
    const value = String(text ?? "");
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function seenKey(role, text) {
    return `${role}|${hashText(normalizeMessageText(text))}`;
  }

  function isUserTurn(node) {
    if (!node || node.nodeType !== 1) return false;
    const testid = node.getAttribute?.("data-testid") || "";
    const content = node.getAttribute?.("data-content") || "";
    const role = node.getAttribute?.("data-message-author-role") || node.getAttribute?.("data-turn") || "";
    if (testid === "chatQuestion") return true;
    if (content === "user-message" || content === "user") return true;
    return role === "user";
  }

  function insideUserTurn(node) {
    let current = node;
    const seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      if (isUserTurn(current)) return true;
      if (current.parentElement) {
        current = current.parentElement;
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

  function containsUserTurn(node) {
    if (!node) return false;
    for (const selector of ["[data-testid='chatQuestion']", "[data-content='user-message']", "[data-content='user']", "[data-message-author-role='user']", "[data-turn='user']"]) {
      if (queryAll(node, selector).some((found) => found !== node)) return true;
    }
    return false;
  }

  function filterAssistantEchoes(messages) {
    const users = (messages || []).filter((message) => message?.role === "user");
    const userTexts = new Set(users.map((message) => normalizeMessageText(message.text)));
    return (messages || []).filter((message) => {
      if (message?.role !== "assistant") return true;
      if (userTexts.has(normalizeMessageText(message.text))) return false;
      if (insideUserTurn(message.node) || containsUserTurn(message.node)) return false;
      if (users.some((user) => inside(message.node, user.node) || inside(user.node, message.node))) return false;
      return true;
    });
  }

  function mergeSeen(messages, persisted) {
    const seen = new Set(Array.isArray(persisted) ? persisted : []);
    for (const message of messages || []) {
      if (!message?.text) continue;
      seen.add(seenKey(message.role, message.text));
    }
    return [...seen];
  }

  function freshMessages(messages, seenKeys) {
    const seen = new Set(seenKeys || []);
    return (messages || []).filter((message) => message?.text && !seen.has(seenKey(message.role, message.text)));
  }

  function group(selectors) {
    const list = (selectors || []).filter(Boolean);
    return list.length ? list.join(", ") : "";
  }

  function turnKey(conversationId, role, index, text) {
    return `${conversationId || ""}|${role}|${index}|${hashText(normalizeMessageText(text))}`;
  }

  function uniqueTop(nodes) {
    return (nodes || []).filter((node) => !nodes.some((other) => other !== node && inside(node, other)));
  }

  function sortByDocument(nodes) {
    const order = documentOrder(nodes);
    return nodes.slice().sort((a, b) => (order.get(a) || 0) - (order.get(b) || 0));
  }

  function nextElementDeep(node) {
    if (!node) return null;
    const inner = node.shadowRoot?.firstElementChild || node.firstElementChild;
    if (inner) return inner;
    let current = node;
    const seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      if (current.nextElementSibling) return current.nextElementSibling;
      const root = typeof current.getRootNode === "function" ? current.getRootNode() : null;
      if (root && root.host) {
        current = root.host;
        continue;
      }
      current = current.parentElement;
    }
    return null;
  }

  function isComposerNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.id === "m365-chat-editor-target-element") return true;
    return node.getAttribute?.("contenteditable") === "true";
  }

  function isReplyNode(node) {
    if (!node || node.nodeType !== 1 || insideUserTurn(node)) return false;
    const testid = node.getAttribute?.("data-testid") || "";
    const content = node.getAttribute?.("data-content") || "";
    const className = typeof node.className === "string" ? node.className : "";
    return testid === "markdown-reply" || testid === "chatOutput" || testid === "copilot-message-reply-div" || testid === "chat-response-message" || testid === "response-message" || content === "ai-message" || content === "assistant" || className.split(/\s+/).includes("bot-turn") || className.split(/\s+/).includes("ac-textBlock");
  }

  function followingAssistant(userNode, userText) {
    const wanted = normalizeMessageText(userText);
    let current = nextElementDeep(userNode);
    const seen = new Set();
    while (current && !seen.has(current) && seen.size < 500) {
      seen.add(current);
      if (isComposerNode(current)) return null;
      const testid = current.getAttribute?.("data-testid") || "";
      if (testid === "chatQuestion" || isUserTurn(current)) {
        const text = normalizeMessageText(plain(current));
        if (text && text !== wanted) return null;
      } else if (isReplyNode(current)) {
        const replyId = current.getAttribute?.("data-testid") || "";
        const hasMarkdown = replyId !== "markdown-reply" && queryOne(current, "[data-testid='markdown-reply']");
        if (!hasMarkdown) {
          const text = normalizeMessageText(plain(current));
          if (text && text !== wanted) return current;
        }
      }
      current = nextElementDeep(current);
    }
    return null;
  }

  function listPairedMessages(root, site) {
    const users = sortByDocument(uniqueTop(queryAll(root, group(site.userSelectors))));
    const collapsed = [];
    for (const node of users) {
      const read = readText(node, site.userTextSelectors);
      const prev = collapsed[collapsed.length - 1];
      if (prev && normalizeMessageText(prev.text) === normalizeMessageText(read.text)) continue;
      if (!read.text) continue;
      collapsed.push({ node, text: read.text, selector: read.selector || (site.userSelectors || [])[0] || "" });
    }
    const messages = [];
    for (const user of collapsed) {
      messages.push({ node: user.node, role: "user", text: user.text, selector: user.selector });
      const reply = followingAssistant(user.node, user.text);
      if (!reply) continue;
      const answer = readText(reply, site.assistantTextSelectors);
      const text = answer.text || plain(reply);
      if (!text || normalizeMessageText(text) === normalizeMessageText(user.text)) continue;
      messages.push({
        node: reply,
        role: "assistant",
        text,
        selector: answer.selector || reply.getAttribute?.("data-testid") || "",
      });
    }
    const seenAssistant = new Set(messages.filter((message) => message.role === "assistant").map((message) => normalizeMessageText(message.text)));
    const userTexts = new Set(messages.filter((message) => message.role === "user").map((message) => normalizeMessageText(message.text)));
    for (const node of collect(root, site.assistantSelectors, false)) {
      if (insideUserTurn(node)) continue;
      const answer = readText(node, site.assistantTextSelectors);
      const text = answer.text || plain(node);
      const norm = normalizeMessageText(text);
      if (!norm || userTexts.has(norm) || seenAssistant.has(norm)) continue;
      seenAssistant.add(norm);
      messages.push({
        node,
        role: "assistant",
        text,
        selector: answer.selector || node.getAttribute?.("data-testid") || "",
      });
    }
    for (const found of repliesAboveActions(root)) {
      const norm = normalizeMessageText(found.text);
      if (!norm || userTexts.has(norm) || seenAssistant.has(norm)) continue;
      if (insideUserTurn(found.node)) continue;
      seenAssistant.add(norm);
      messages.push({ node: found.node, role: "assistant", text: found.text, selector: "acciones" });
    }
    return messages;
  }

  function repliesAboveActions(root) {
    const buttons = queryAll(root, "button[aria-label], button[title]");
    const action = /copiar|copy|me gusta|like|no me gusta|dislike|thumbs|regenerar|regenerate|intentar de nuevo|try again/i;
    const found = [];
    const seen = new Set();
    for (const button of buttons) {
      const label = `${button.getAttribute?.("aria-label") || ""} ${button.getAttribute?.("title") || ""}`;
      if (!action.test(label)) continue;
      let node = button;
      for (let depth = 0; depth < 6 && node; depth += 1) {
        let prev = node.previousElementSibling;
        while (prev) {
          if (!isComposerNode(prev) && !insideUserTurn(prev)) {
            const text = plain(prev);
            const norm = normalizeMessageText(text);
            if (norm.length >= 12 && !seen.has(norm)) {
              seen.add(norm);
              found.push({ node: prev, text });
              prev = null;
              node = null;
              break;
            }
          }
          prev = prev?.previousElementSibling || null;
        }
        if (!node) break;
        node = node.parentElement;
      }
    }
    return found;
  }

  function listChatMessages(root, site) {
    if (site?.pairTurns) return listPairedMessages(root, site);
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
      if (messages.length) return dedupeMessages(filterAssistantEchoes(messages));
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
    return dedupeMessages(filterAssistantEchoes(messages));
  }

  return {
    listChatMessages,
    dedupeMessages,
    filterAssistantEchoes,
    seenKey,
    turnKey,
    mergeSeen,
    freshMessages,
    inside,
    textFrom,
    collect,
    queryAll,
    queryOne,
    normalizeMessageText,
  };
});
