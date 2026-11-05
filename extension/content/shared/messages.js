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

  function skipNode(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = String(node.tagName || "").toLowerCase();
    if (tag === "script" || tag === "style" || tag === "noscript" || tag === "svg" || tag === "button" || tag === "textarea" || tag === "input" || tag === "select") {
      return true;
    }
    if (node.getAttribute?.("aria-hidden") === "true") return true;
    const role = node.getAttribute?.("role") || "";
    if (role === "button" || role === "toolbar") return true;
    return isHiddenChrome(node);
  }

  function isToolbar(node) {
    if (!node || node.nodeType !== 1 || skipNode(node)) return false;
    const tag = String(node.tagName || "").toLowerCase();
    if (tag === "pre" || tag === "code" || tag === "p" || tag === "ul" || tag === "ol" || tag === "li") return false;
    if (node.querySelector?.("pre")) return false;
    const className = typeof node.className === "string" ? node.className : "";
    if (/toolbar|code-header|codeHeader|code-block-header|code-block__header|code-action/i.test(className)) return true;
    if (!node.querySelector?.("button, [role='button']")) return false;
    const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
    return text.length <= 80;
  }

  function classLanguage(node) {
    const className = typeof node?.className === "string" ? node.className : "";
    const match = className.match(/(?:^|\s)(?:language|lang)-([A-Za-z0-9_+-]+)/);
    return match ? match[1] : "";
  }

  function looksLikeLanguage(text) {
    if (!text || /^(copy|copied|copiar|copiado|copy code)$/i.test(text)) return false;
    return /^[A-Za-z][A-Za-z0-9.+#-]{0,23}$/.test(text);
  }

  function toolbarLanguage(header) {
    if (!header) return "";
    let out = "";
    const walk = (node) => {
      if (!node) return;
      if (node.nodeType === 3) {
        out += node.textContent || "";
        return;
      }
      if (node.nodeType !== 1 || skipNode(node)) return;
      if (node !== header && isToolbar(node)) return;
      for (const child of node.childNodes || []) walk(child);
    };
    walk(header);
    const tokens = out.replace(/\s+/g, " ").trim().split(" ").filter(looksLikeLanguage);
    return tokens[0] || "";
  }

  function findCodeHeader(pre) {
    const inside = [...(pre.children || [])].find((child) => child.tagName !== "CODE" && (isToolbar(child) || child.querySelector?.("button, [role='button']")));
    if (inside) return inside;
    if (isToolbar(pre.previousElementSibling)) return pre.previousElementSibling;
    const parent = pre.parentElement;
    if (!parent) return null;
    return [...(parent.children || [])].find((child) => child !== pre && isToolbar(child)) || null;
  }

  function insidePre(node) {
    let current = node?.parentElement;
    while (current) {
      if (String(current.tagName || "").toLowerCase() === "pre") return true;
      current = current.parentElement;
    }
    return false;
  }

  function codeText(node) {
    let out = "";
    const walk = (current) => {
      if (!current) return;
      if (current.nodeType === 3) {
        out += current.textContent || "";
        return;
      }
      if (current.nodeType !== 1 || skipNode(current) || isToolbar(current)) return;
      if (String(current.tagName || "").toLowerCase() === "br") {
        out += "\n";
        return;
      }
      for (const child of current.childNodes || []) walk(child);
    };
    walk(node);
    return out.replace(/^\n+/, "").replace(/[ \t]+\n/g, "\n").replace(/\s+$/, "");
  }

  function renderPre(pre) {
    const code = [...(pre.children || [])].find((child) => String(child.tagName || "").toLowerCase() === "code") || pre.querySelector?.("code");
    const header = findCodeHeader(pre);
    const dataLanguage = pre.getAttribute?.("data-language") || code?.getAttribute?.("data-language") || "";
    const language = classLanguage(code) || classLanguage(pre) || classLanguage(pre.parentElement) || dataLanguage.trim() || toolbarLanguage(header);
    const text = codeText(code || pre);
    const fence = language ? `\`\`\`${language}` : "```";
    return `\n${fence}\n${text}\n\`\`\`\n\n`;
  }

  function collapseInline(text) {
    return String(text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ");
  }

  function renderInline(node) {
    if (!node) return "";
    if (node.nodeType === 3) return collapseInline(node.textContent || "");
    if (node.nodeType !== 1 || skipNode(node) || isToolbar(node)) return "";
    const tag = String(node.tagName || "").toLowerCase();
    if (tag === "br") return "\n";
    if (tag === "pre") return renderPre(node);
    if (tag === "code" && !insidePre(node)) {
      const code = collapseInline(node.textContent || "").trim();
      return code ? `\`${code}\`` : "";
    }
    if (tag === "strong" || tag === "b") {
      const inner = renderInlineChildren(node).trim();
      return inner ? `**${inner}**` : "";
    }
    if (tag === "em" || tag === "i") {
      const inner = renderInlineChildren(node).trim();
      return inner ? `*${inner}*` : "";
    }
    if (tag === "ul" || tag === "ol") return `\n${renderList(node).trim()}\n`;
    if (isTableNode(node)) return `\n${renderTable(node).trim()}\n`;
    return renderInlineChildren(node);
  }

  function renderInlineChildren(node) {
    let out = "";
    for (const child of node.childNodes || []) out += renderInline(child);
    return out;
  }

  function renderList(list) {
    const ordered = String(list.tagName || "").toLowerCase() === "ol";
    const start = Number(list.getAttribute?.("start"));
    const origin = Number.isFinite(start) && start > 0 ? start : 1;
    const items = [...(list.children || [])].filter((child) => String(child.tagName || "").toLowerCase() === "li");
    const lines = items.map((item, index) => `${ordered ? `${origin + index}. ` : "- "}${listItemText(item)}`);
    return `${lines.join("\n")}\n\n`;
  }

  function listItemText(item) {
    let out = "";
    for (const child of item.childNodes || []) {
      if (child.nodeType === 1 && /^(ul|ol)$/i.test(child.tagName || "")) {
        out += `\n${renderList(child).trimEnd()}`;
        continue;
      }
      out += renderInline(child);
    }
    return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function isTableNode(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = String(node.tagName || "").toLowerCase();
    const role = node.getAttribute?.("role") || "";
    return tag === "table" || role === "table" || role === "grid";
  }

  function isRowNode(node) {
    const tag = String(node.tagName || "").toLowerCase();
    const role = node.getAttribute?.("role") || "";
    return tag === "tr" || role === "row";
  }

  function isCellNode(node) {
    const tag = String(node.tagName || "").toLowerCase();
    const role = node.getAttribute?.("role") || "";
    return tag === "td" || tag === "th" || role === "cell" || role === "columnheader" || role === "rowheader";
  }

  function tableRows(table) {
    const rows = [];
    const walk = (node) => {
      for (const child of node.children || []) {
        if (isRowNode(child)) rows.push(child);
        else if (!isCellNode(child) && !isTableNode(child)) walk(child);
      }
    };
    walk(table);
    return rows;
  }

  function renderTable(table) {
    const matrix = tableRows(table).map((row) => [...(row.children || [])].filter(isCellNode).map((cell) => renderInline(cell).trim().replace(/\|/g, "\\|").replace(/\n+/g, " ")));
    const usable = matrix.filter((row) => row.some((cell) => cell));
    if (!usable.length) return "";
    const width = Math.max(...usable.map((row) => row.length));
    const lines = usable.map((row) => {
      const cells = row.slice();
      while (cells.length < width) cells.push("");
      return `| ${cells.join(" | ")} |`;
    });
    const rule = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
    lines.splice(1, 0, rule);
    return `${lines.join("\n")}\n\n`;
  }

  function hasBlockChild(node) {
    for (const child of node.children || []) {
      const tag = String(child.tagName || "").toLowerCase();
      if (/^(p|ul|ol|pre|blockquote|table|h1|h2|h3|h4|h5|h6|li)$/.test(tag) || isTableNode(child)) return true;
      if ((tag === "div" || tag === "section") && (hasBlockChild(child) || child.querySelector?.("p, ul, ol, pre, table"))) return true;
    }
    return false;
  }

  function renderBlocks(node) {
    let out = "";
    for (const child of node.childNodes || []) {
      if (child.nodeType === 3) {
        if (!String(child.textContent || "").trim()) continue;
        out += `${collapseInline(child.textContent).trim()}\n\n`;
        continue;
      }
      out += renderElement(child);
    }
    return out;
  }

  function renderElement(node) {
    if (!node || node.nodeType !== 1 || skipNode(node) || isToolbar(node)) return "";
    const tag = String(node.tagName || "").toLowerCase();
    if (tag === "pre") return renderPre(node);
    if (tag === "ul" || tag === "ol") return renderList(node);
    if (isTableNode(node)) return renderTable(node);
    if (tag === "p" || tag === "blockquote" || /^h[1-6]$/.test(tag)) {
      const inner = renderInline(node).trim();
      return inner ? `${inner}\n\n` : "";
    }
    if (hasBlockChild(node)) return renderBlocks(node);
    const inline = renderInline(node).trim();
    return inline ? `${inline}\n\n` : "";
  }

  function tidyMarkdown(value) {
    return String(value || "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function stripSpeakerPrefix(text) {
    return String(text || "").replace(/^(?:you said|dijiste|t[uú] dijiste|usted dijo|copilot said|copilot dijo)\s*:\s*/i, "");
  }

  function renderBlock(node) {
    if (!node) return "";
    if (node.nodeType === 3) return collapseInline(node.textContent || "").trim();
    if (node.nodeType !== 1 || skipNode(node)) return "";
    const tag = String(node.tagName || "").toLowerCase();
    if (tag === "pre") return tidyMarkdown(renderPre(node));
    if (tag === "ul" || tag === "ol") return tidyMarkdown(renderList(node));
    if (isTableNode(node)) return tidyMarkdown(renderTable(node));
    const className = typeof node.className === "string" ? node.className : "";
    if (/whitespace-pre/.test(className) && !hasBlockChild(node)) {
      return String(node.innerText || node.textContent || "").replace(/\u00a0/g, " ").trim();
    }
    if (hasBlockChild(node) || tag === "p" || /^h[1-6]$/.test(tag)) return tidyMarkdown(renderElement(node));
    return renderInline(node).trim();
  }

  function plain(node) {
    return stripSpeakerPrefix(renderBlock(node));
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

  function buttonLabel(button) {
    return `${button.getAttribute?.("aria-label") || ""} ${button.getAttribute?.("title") || ""} ${button.getAttribute?.("data-testid") || ""}`;
  }

  function textBefore(node) {
    const chunks = [];
    let prev = node?.previousElementSibling;
    while (prev) {
      if (!isComposerNode(prev) && !insideUserTurn(prev)) chunks.unshift(plain(prev));
      prev = prev.previousElementSibling;
    }
    return normalizeMessageText(chunks.filter(Boolean).join(" "));
  }

  function repliesAboveActions(root) {
    const found = [];
    const seen = new Set();
    const remember = (node, text) => {
      const norm = normalizeMessageText(text);
      if (norm.length < 12 || seen.has(norm) || insideUserTurn(node)) return;
      seen.add(norm);
      found.push({ node, text: norm });
    };
    try {
      const buttons = queryAll(root, "button, [role='button']");
      const action = /copiar|copy|regener|reintent|intentar de nuevo|try again/i;
      for (const button of buttons) {
        if (!action.test(buttonLabel(button))) continue;
        let node = button;
        for (let depth = 0; depth < 8 && node; depth += 1) {
          const text = textBefore(node);
          if (text.length >= 12) {
            remember(node.parentElement || node, text);
            break;
          }
          node = node.parentElement;
        }
      }
      const rows = queryAll(root, "div");
      for (const row of rows) {
        const kids = [...(row.children || [])];
        const iconButtons = kids.filter((child) => child.tagName === "BUTTON" && normalizeMessageText(child.innerText || "").length < 3);
        if (iconButtons.length < 2) continue;
        const labels = iconButtons.map(buttonLabel).join(" ");
        if (!action.test(labels)) continue;
        const text = textBefore(row);
        if (text) remember(row, text);
      }
    } catch {
      return found;
    }
    return found;
  }

  function messageIdentity(node) {
    let current = node;
    const seen = new Set();
    while (current && current.nodeType === 1 && !seen.has(current)) {
      seen.add(current);
      const source = current.getAttribute?.("data-dil-source-message-id") || "";
      if (source.trim()) return source.trim().split(/\s+/)[0];
      const ids = current.getAttribute?.("data-chatgpt-search-message-ids") || "";
      if (ids.trim()) return ids.trim().split(/\s+/)[0];
      current = current.parentElement;
    }
    return "";
  }

  function ownTurn(node) {
    let current = node;
    const seen = new Set();
    while (current && current.nodeType === 1 && !seen.has(current)) {
      seen.add(current);
      if (
        current.hasAttribute?.("data-talvt-turn-state") ||
        current.hasAttribute?.("data-turn-key") ||
        current.hasAttribute?.("data-content-search-turn-key") ||
        (current.getAttribute?.("data-testid") || "").startsWith("conversation-turn")
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return node;
  }

  function isNewChatgptTurn(node) {
    let current = node;
    const seen = new Set();
    while (current && current.nodeType === 1 && !seen.has(current)) {
      seen.add(current);
      if (
        current.hasAttribute?.("data-chatgpt-search-unit-key") ||
        current.hasAttribute?.("data-talvt-turn-state") ||
        current.hasAttribute?.("data-dil-source-message-id") ||
        current.getAttribute?.("data-markdown-text-style") === "assistant-message"
      ) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  function assistantFinished(node) {
    const turn = ownTurn(node);
    if (!turn || turn.nodeType !== 1) return false;
    if (turn.getAttribute?.("data-talvt-turn-state") === "complete") return true;
    let buttons = [];
    try {
      buttons = turn.querySelectorAll?.('button[aria-label="Copy"], button[aria-label="Copiar"]') || [];
    } catch {
      buttons = [];
    }
    for (const button of buttons) {
      const label = button.getAttribute?.("aria-label") || "";
      if (/message|mensaje/i.test(label)) continue;
      const buttonTurn = button.closest?.("[data-turn-key], [data-content-search-turn-key], [data-testid^='conversation-turn']");
      if (buttonTurn && buttonTurn !== turn && !turn.contains(button)) continue;
      return true;
    }
    return false;
  }

  function stamp(message) {
    const id = messageIdentity(message.node);
    const strict = message.role === "assistant" && isNewChatgptTurn(message.node);
    return {
      ...message,
      id,
      strict,
      done: strict ? assistantFinished(message.node) : true,
    };
  }

  function publishMessages(messages, site) {
    // El filtro de eco (un nodo de usuario dentro de la respuesta) es de Copilot.
    // En ChatGPT ese nodo es una cita y, si se aplica, la respuesta desaparece.
    if (site?.pairTurns || site?.ia === "copilot") return dedupeMessages(filterAssistantEchoes(messages));
    return dedupeMessages(messages);
  }

  function listChatMessages(root, site) {
    if (site?.pairTurns) {
      try {
        return listPairedMessages(root, site);
      } catch {
        return [];
      }
    }
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
          if (read.text) messages.push(stamp({ node: bubble || turn, role: "user", text: read.text, selector: read.selector }));
        }
        const assistantNode = assistant && assistant !== bubble && !inside(assistant, bubble) ? assistant : null;
        if (explicit === "assistant" || (assistantNode && explicit !== "user")) {
          const read = readText(assistantNode || turn, site.assistantTextSelectors);
          if (read.text) messages.push(stamp({ node: assistantNode || turn, role: "assistant", text: read.text, selector: read.selector }));
        }
      }
    }
    const sawAssistant = messages.some((message) => message.role === "assistant" && message.text);
    if (turns.length && sawAssistant) return publishMessages(messages, site);

    for (const node of collect(root, site.userSelectors, false)) {
      const read = readText(node, site.userTextSelectors);
      if (read.text) messages.push(stamp({ node, role: "user", text: read.text, selector: read.selector }));
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
      if (read.text) messages.push(stamp({ node, role: "assistant", text: read.text, selector: read.selector || nodeSelector }));
    }
    return publishMessages(messages, site);
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
