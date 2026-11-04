import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const messages = require(path.join(root, "content/shared/messages.js"));
const core = require(path.join(root, "lib/core.js"));
const files = require(path.join(root, "lib/files.js"));

if (messages.normalizeMessageText("  que   dia\nes ") !== "que dia es") {
  throw new Error("normalize");
}
if (core.warningKind("Contradicción") !== "contradiccion") throw new Error("contradiccion");
if (core.warningKind("duplicado") !== "duplicado") throw new Error("duplicado");
if (core.warningKind("falta") !== "falta") throw new Error("falta");
if (core.warningLabel("contradiccion") !== "Contradicción") throw new Error("etiqueta");
if (!core.AI_NAMES.includes("grok")) throw new Error("falta grok");
if (files.MAX_FILE_BYTES !== 10_485_760) throw new Error("tope");
if (files.checkSize(files.MAX_FILE_BYTES + 1) !== "el archivo pasa de 10 MB") throw new Error("10 mb");
if (files.checkSize(0) !== "size no válido") throw new Error("size");
if (!files.cleanShareUrl("https://example.com/informe.pdf")) throw new Error("url");
if (files.cleanShareUrl("javascript:alert(1)")) throw new Error("url mala");
if (files.mimeOrDefault("no") !== "application/octet-stream") throw new Error("mime");

const { readFileSync } = await import("node:fs");
const { runInNewContext } = await import("node:vm");
const chatgptSource = readFileSync(path.join(root, "content/chatgpt/selectors.js"), "utf8");
const sandbox = { globalThis: {} };
sandbox.globalThis = sandbox;
runInNewContext(chatgptSource, sandbox);
const chatgpt = sandbox.EnlazaChatgptSite;
if (chatgpt.composerSelectors[0] !== 'form div.ProseMirror[contenteditable="true"]') throw new Error("composer");
if (chatgpt.composerSelectors[1] !== "#prompt-textarea") throw new Error("composer respaldo");
if (chatgpt.fileAnchorSelectors[0] !== 'button[aria-label="Añadir archivos y más"]') throw new Error("ancla");
if (!chatgpt.fileAnchorSelectors.includes('button[aria-label="Add files and more"]')) throw new Error("ancla en");
if (chatgpt.fileFooterSelectors[0] !== '[class*="ComposerLayoutFooter"]') throw new Error("footer");
if (core.chatNameFrom("Biblioteca - Claude", "hola") !== "Biblioteca") throw new Error("titulo claude");
if (core.chatNameFrom("Claude", "hola") !== "hola") throw new Error("titulo generico");
const claudeSource = readFileSync(path.join(root, "content/claude/selectors.js"), "utf8");
const claudeBox = { globalThis: {}, URL };
claudeBox.globalThis = claudeBox;
runInNewContext(claudeSource, claudeBox);
const claudeSite = claudeBox.EnlazaClaudeSite;
if (claudeSite.conversationId("https://claude.ai/chat/6aea3d77-c8d8-83e8-ada3-561359e03e25") !== "6aea3d77-c8d8-83e8-ada3-561359e03e25") {
  throw new Error("conversation claude");
}
if (claudeSite.ia !== "claude") throw new Error("ia claude");
console.log("avisos ok");

let parseHTML;
try {
  ({ parseHTML } = require(process.env.LINKEDOM || "/tmp/enlaza-dom/node_modules/linkedom"));
} catch {
  console.log("messages.test: sin linkedom, se omitió el DOM");
  process.exit(0);
}

const site = {
  turnSelectors: [
    "[data-turn-key]",
    "[data-testid^='conversation-turn-']",
    "article[data-turn]",
    "[data-turn='user']",
    "[data-turn='assistant']",
  ],
  userSelectors: [
    "[data-user-message-bubble]",
    '[data-message-author-role="user"]',
    '[data-testid="user-message"]',
    '[data-turn="user"]',
  ],
  assistantSelectors: [
    '[data-content-search-unit-key$=":assistant"]',
    '[data-message-author-role="assistant"]',
    '[data-testid="assistant-message"]',
    '[data-turn="assistant"]',
    ".agent-turn",
  ],
  userTextSelectors: ["[data-user-message-bubble]", ".whitespace-pre-wrap", ".text-message"],
  assistantTextSelectors: [".markdown", ".prose", '[class*="markdown"]', ".whitespace-pre-wrap"],
};

const modern = parseHTML(`<!doctype html><body>
  <div data-message-author-role="user"></div>
  <div data-turn-key="u1">
    <div data-user-message-bubble><div class="whitespace-pre-wrap">que dia es</div></div>
  </div>
  <div data-turn-key="a1">
    <div data-content-search-unit-key="a1:assistant">
      <div class="markdown">Hoy es martes 3 de noviembre de 2026.</div>
    </div>
  </div>
</body>`);

const found = messages.listChatMessages(modern.document, site);
const roles = found.map((item) => `${item.role}:${item.text}`);
if (roles.length !== 2) {
  console.error(roles);
  throw new Error("el DOM nuevo no devolvió prompt y respuesta");
}
if (!roles[0].startsWith("user:que dia es")) throw new Error(roles[0]);
if (!roles[1].includes("Hoy es martes")) throw new Error(roles[1]);

const legacy = parseHTML(`<!doctype html><body>
  <div data-message-author-role="user"><div class="whitespace-pre-wrap">hola</div></div>
  <div data-message-author-role="assistant"><div class="markdown">respuesta</div></div>
</body>`);
const old = messages.listChatMessages(legacy.document, site).map((item) => `${item.role}:${item.text}`);
if (old.join("|") !== "user:hola|assistant:respuesta") throw new Error(old.join("|"));

const gemini = {
  userSelectors: ["user-query", "user-query-content", ".query-text", '[data-test-id="user-query"]'],
  assistantSelectors: ["model-response", "message-content.model-response-text", "message-content", '[data-test-id="model-response"]'],
  userTextSelectors: [".query-text", ".query-text-line", "user-query-content"],
  assistantTextSelectors: ["message-content.model-response-text", "message-content", ".markdown"],
};
const geminiDom = parseHTML(`<!doctype html><body>
  <user-query><div class="query-text">que hora es</div></user-query>
  <model-response>
    <message-content class="model-response-text markdown">Son las tres.</message-content>
  </model-response>
  <rich-textarea><div class="ql-editor" contenteditable="true"></div></rich-textarea>
</body>`);
const geminiMessages = messages.listChatMessages(geminiDom.document, gemini).map((item) => `${item.role}:${item.text}`);
if (geminiMessages.join("|") !== "user:que hora es|assistant:Son las tres.") throw new Error(geminiMessages.join("|"));

const claudeDom = parseHTML(`<!doctype html><body>
  <div data-testid="user-message">hola</div>
  <div data-testid="assistant-message" data-is-streaming="false">
    <div class="standard-markdown">Listo, hola.</div>
  </div>
  <div data-testid="chat-input" class="tiptap ProseMirror" contenteditable="true"></div>
</body>`);
const claudeMessages = messages.listChatMessages(claudeDom.document, claudeSite).map((item) => `${item.role}:${item.text}`);
if (claudeMessages.join("|") !== "user:hola|assistant:Listo, hola.") throw new Error(claudeMessages.join("|"));

console.log("messages ok");
console.log(roles.join(" | "));
