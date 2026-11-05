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
const shot = "Captura de pantalla 2026-11-03 144840.png";
if (files.chooseAttachmentSource(shot, [shot], "") !== "stored") throw new Error("archivo guardado");
if (files.chooseAttachmentSource(shot, [], "data:image/png;base64,aaa") !== "image") throw new Error("miniatura");
if (files.chooseAttachmentSource("informe.pdf", [], "") !== "reattach") throw new Error("pdf");

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
const copilotSource = readFileSync(path.join(root, "content/copilot/selectors.js"), "utf8");
const copilotBox = { globalThis: {}, URL };
copilotBox.globalThis = copilotBox;
runInNewContext(copilotSource, copilotBox);
const copilotSite = copilotBox.EnlazaCopilotSite;
if (copilotSite.ia !== "copilot") throw new Error("ia copilot");
if (copilotSite.conversationId("https://copilot.com/chat/conversation/6aea3d77-c8d8-83e8-ada3-561359e03e25?n=1") !== "6aea3d77-c8d8-83e8-ada3-561359e03e25") {
  throw new Error("conversation copilot");
}
if (copilotSite.conversationId("https://copilot.microsoft.com/") !== "") throw new Error("conversation copilot vacia");
if (copilotSite.composerSelectors[0] !== "#m365-chat-editor-target-element") throw new Error("composer copilot");
if (copilotSite.fileAnchorSelectors[0] !== '[data-testid="PlusMenuButton"]') throw new Error("ancla copilot");
const geminiSource = readFileSync(path.join(root, "content/gemini/selectors.js"), "utf8");
const geminiBox = { globalThis: {}, URL };
geminiBox.globalThis = geminiBox;
runInNewContext(geminiSource, geminiBox);
const geminiSite = geminiBox.EnlazaGeminiSite;
if (geminiSite.fileAnchorSelectors[0] !== 'button[aria-label="Cargas y herramientas"]') throw new Error("ancla gemini");
if (!geminiSite.fileAnchorSelectors.includes('button[aria-label="Upload and tools"]')) throw new Error("ancla gemini en");
if (!geminiSite.fileAnchorSelectors.includes('button[aria-label="Open upload file menu"]')) throw new Error("ancla gemini vieja");
if (!geminiSite.fileAnchorSelectors.includes('button[aria-label="Cerrar el menú de cargas"]')) throw new Error("ancla gemini cerrar");
if (!geminiSite.fileAnchorSelectors.includes('button[aria-label="Close upload menu"]')) throw new Error("ancla gemini close");
if (geminiSite.composerScopeSelectors[0] !== "fieldset.input-area-fieldset") throw new Error("alcance gemini");
if (!geminiSite.composerScopeSelectors.includes("input-area-v2")) throw new Error("alcance gemini v2");
if (geminiSite.preferPickedFiles !== true) throw new Error("archivos gemini");
if (geminiSite.fileFooterSelectors[0] !== ".textarea-wrapper") throw new Error("footer gemini");
if (!geminiSite.fileFooterSelectors.includes(".text-input-field")) throw new Error("campo gemini");
if (!geminiSite.fileFooterSelectors.includes("fieldset.input-area-fieldset")) throw new Error("fieldset gemini");
if (geminiSite.composerSelectors[0] !== "rich-textarea .ql-editor") throw new Error("composer gemini");
if (geminiSite.userSelectors[0] !== "user-query") throw new Error("prompt gemini");
if (geminiSite.assistantSelectors[0] !== "model-response") throw new Error("respuesta gemini");
if (copilotSite.streamingSelectors[0] !== '[data-testid="loading-message"]') throw new Error("carga copilot");
if (copilotSite.pairTurns !== true) throw new Error("pareo copilot");
if (copilotSite.promptsFromComposer !== true) throw new Error("prompt desde el enter");
if (messages.normalizeMessageText("prueba final\n\nprueba final") !== "prueba final") throw new Error("texto gemelo");
if (messages.seenKey("user", "prueba final") !== messages.seenKey("user", "prueba final\n\nprueba final")) throw new Error("hash gemelo");
const sameChat = core.chooseChatTitle({
  pageTitle: "Hora actual en Lisboa - Claude",
  domTitle: "Hora actual en Lisboa",
  conversationId: "chat-1",
  previous: { id: "chat-1", title: "Hora actual en Lisboa" },
});
if (sameChat !== "Hora actual en Lisboa") throw new Error(sameChat);
const staleTitle = core.chooseChatTitle({
  pageTitle: "Definición de hackatón - ChatGPT",
  domTitle: "New chat",
  conversationId: "chat-2",
  previous: { id: "chat-1", title: "Definición de hackatón" },
});
if (staleTitle !== "") throw new Error(staleTitle);
const freshTitle = core.chooseChatTitle({
  pageTitle: "Definición de hackatón - ChatGPT",
  domTitle: "Conectar Supabase",
  conversationId: "chat-2",
  previous: { id: "chat-1", title: "Definición de hackatón" },
});
if (freshTitle !== "Conectar Supabase") throw new Error(freshTitle);
if (copilotSite.stableMs !== 1500) throw new Error("espera copilot");
const sameTurn = messages.turnKey("conv-1", "user", 0, "hola de nuevo");
if (sameTurn !== messages.turnKey("conv-1", "user", 0, "  hola   de nuevo ")) throw new Error("clave inestable");
if (sameTurn === messages.turnKey("conv-1", "user", 1, "hola de nuevo")) throw new Error("indice igual");
if (sameTurn === messages.turnKey("conv-1", "assistant", 0, "hola de nuevo")) throw new Error("rol igual");
for (const selector of ['[data-testid="chatOutput"]', '[data-testid="copilot-message-reply-div"]', '[data-testid="markdown-reply"]']) {
  if (!copilotSite.assistantSelectors.includes(selector)) throw new Error("respuesta copilot");
}
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

const rich = parseHTML(`<!doctype html><body>
  <div class="markdown">
    <p>Tablas:</p>
    <ul>
      <li><p>salas (<code>rooms</code>): <code>id</code>, <code>nombre</code>, <code>creador_id</code>, <code>created_at</code>.</p></li>
      <li><p>miembros (<code>room_members</code>): <code>id</code>.</p></li>
    </ul>
    <ol>
      <li><p>Crea el proyecto.</p></li>
      <li><p>Pega la <strong>clave</strong>.</p></li>
    </ol>
  </div>
</body>`);
const richText = messages.textFrom(rich.document.querySelector(".markdown"), [".markdown"]);
const richExpected = [
  "Tablas:",
  "",
  "- salas (`rooms`): `id`, `nombre`, `creador_id`, `created_at`.",
  "- miembros (`room_members`): `id`.",
  "",
  "1. Crea el proyecto.",
  "2. Pega la **clave**.",
].join("\n");
if (richText !== richExpected) throw new Error(richText);
const tableDom = parseHTML(`<!doctype html><body>
  <div class="markdown">
    <table>
      <tr><th>Tiempo</th><th>Sección</th><th>Qué debes decir / mostrar</th></tr>
      <tr><td>0:00 - 0:30</td><td><strong>1. El Gancho</strong></td><td>Presenta una historia breve.</td></tr>
    </table>
  </div>
</body>`);
const tableText = messages.textFrom(tableDom.document.querySelector(".markdown"), [".markdown"]);
const tableExpected = [
  "| Tiempo | Sección | Qué debes decir / mostrar |",
  "| --- | --- | --- |",
  "| 0:00 - 0:30 | **1. El Gancho** | Presenta una historia breve. |",
].join("\n");
if (tableText !== tableExpected) throw new Error(tableText);
if (tableText.includes("TiempoSección")) throw new Error(tableText);

const claudeCode = parseHTML(`<!doctype html><body>
  <div data-testid="assistant-message">
    <div class="standard-markdown">
      <p>En el entorno:</p>
      <div class="code-block">
        <div class="code-block__header">
          <span aria-hidden="true">⍰</span>
          <span>bash</span>
          <button aria-label="Copy"><span aria-hidden="true">⍰</span>Copy</button>
        </div>
        <pre><code class="language-bash">npm install</code></pre>
      </div>
      <p>Supabase (Settings → API):</p>
      <div>
        <div class="code-block__header"><span>env</span><button aria-label="Copiar">Copiar</button></div>
        <pre><code>NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co</code></pre>
      </div>
    </div>
  </div>
</body>`);
const claudeRich = messages.listChatMessages(claudeCode.document, claudeSite).map((item) => item.text).join("\n");
if (claudeRich.includes("⍰") || /copy|copiar/i.test(claudeRich)) throw new Error(claudeRich);
if (!claudeRich.includes("```bash\nnpm install\n```")) throw new Error(claudeRich);
if (!claudeRich.includes("```env\nNEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\n```")) throw new Error(claudeRich);
if (!claudeRich.includes("En el entorno:\n\n```bash")) throw new Error(claudeRich);

const geminiRichDom = parseHTML(`<!doctype html><body>
  <user-query><div class="query-text">arma el esquema</div></user-query>
  <model-response>
    <message-content class="model-response-text markdown">
      <p>Pasos:</p>
      <ol>
        <li><p>Crea <code>rooms</code>.</p></li>
        <li><p>Agrega <strong>miembros</strong>.</p></li>
      </ol>
    </message-content>
  </model-response>
</body>`);
const geminiRich = messages.listChatMessages(geminiRichDom.document, geminiSite).map((item) => `${item.role}:${item.text}`).join("\n---\n");
if (!geminiRich.includes("user:arma el esquema")) throw new Error(geminiRich);
if (!geminiRich.includes("assistant:Pasos:\n\n1. Crea `rooms`.\n2. Agrega **miembros**.")) throw new Error(geminiRich);

const quoted = parseHTML(`<!doctype html><body>
  <div data-testid="conversation-turn-2" data-turn="user">
    <div data-user-message-bubble><div class="whitespace-pre-wrap">que es una hackaton</div></div>
  </div>
  <div data-testid="conversation-turn-3" data-turn="assistant">
    <div class="markdown">Una hackaton es un evento donde un equipo construye un prototipo.</div>
    <div data-message-author-role="user" class="sr-only">que es una hackaton</div>
    <button aria-label="Copiar"></button>
    <button aria-label="Regenerar"></button>
  </div>
</body>`);
const quotedLine = messages.listChatMessages(quoted.document, site).map((item) => `${item.role}:${item.text}`).join("|");
if (quotedLine !== "user:que es una hackaton|assistant:Una hackaton es un evento donde un equipo construye un prototipo.") {
  throw new Error(quotedLine);
}
const wrapped = parseHTML(`<!doctype html><body>
  <div data-turn-key="exchange">
    <div data-turn="user"><div data-user-message-bubble><div class="whitespace-pre-wrap">que es una hackaton</div></div></div>
    <div data-content-search-unit-key="a:assistant"><div class="markdown">Una hackaton es un evento.</div></div>
  </div>
</body>`);
const wrappedLine = messages.listChatMessages(wrapped.document, site).map((item) => `${item.role}:${item.text}`).join("|");
if (wrappedLine !== "user:que es una hackaton|assistant:Una hackaton es un evento.") throw new Error(wrappedLine);

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

const copilotDom = parseHTML(`<!doctype html><body>
  <div data-testid="chatQuestion">que hora es</div>
  <div data-testid="chatOutput">
    <div data-testid="copilot-message-reply-div">
      <div data-testid="markdown-reply">Son las tres.</div>
      <div data-testid="CopyButtonContainerTestId"></div>
    </div>
  </div>
  <span id="m365-chat-editor-target-element" contenteditable="true"></span>
</body>`);
const copilotMessages = messages.listChatMessages(copilotDom.document, copilotSite).map((item) => `${item.role}:${item.text}`);
if (copilotMessages.join("|") !== "user:que hora es|assistant:Son las tres.") throw new Error(copilotMessages.join("|"));

const echoDom = parseHTML(`<!doctype html><body>
  <div data-testid="chatQuestion"><div data-testid="markdown-reply">hoola</div></div>
  <div data-content="user-message"><div data-testid="markdown-reply">hoola</div></div>
  <div data-testid="chatOutput"><div data-testid="markdown-reply">hoola</div></div>
  <div data-content="ai-message"><div data-testid="markdown-reply">¡De nada!</div></div>
</body>`);
const echoLine = messages.listChatMessages(echoDom.document, copilotSite).map((item) => `${item.role}:${item.text}`).join("|");
if (echoLine !== "user:hoola|assistant:¡De nada!") throw new Error(echoLine);
const againDom = parseHTML(`<!doctype html><body>
  <div data-testid="chatQuestion">hola de nuevo</div>
  <div data-testid="chatQuestion">hola de nuevo</div>
  <div data-testid="chatOutput"><div data-testid="markdown-reply">Claro.</div></div>
</body>`);
const againLine = messages.listChatMessages(againDom.document, copilotSite).map((item) => `${item.role}:${item.text}`).join("|");
if (againLine !== "user:hola de nuevo|assistant:Claro.") throw new Error(againLine);
const msDom = parseHTML(`<!doctype html><body>
  <div data-content="user">probando una vez más</div>
  <div data-content="user">probando una vez más</div>
  <div data-content="assistant"><div class="ac-textBlock">Listo, ya quedó.</div></div>
</body>`);
const msLine = messages.listChatMessages(msDom.document, copilotSite).map((item) => `${item.role}:${item.text}`).join("|");
if (msLine !== "user:probando una vez más|assistant:Listo, ya quedó.") throw new Error(msLine);
const onlyReply = parseHTML(`<!doctype html><body>
  <div data-content="assistant"><div class="ac-textBlock">Respuesta sola.</div></div>
</body>`);
const onlyLine = messages.listChatMessages(onlyReply.document, copilotSite).map((item) => `${item.role}:${item.text}`).join("|");
if (onlyLine !== "assistant:Respuesta sola.") throw new Error(onlyLine);
const finished = parseHTML(`<!doctype html><body>
  <p>Hola.</p>
  <p>Prueba nueva recibida correctamente.</p>
  <p>En que te puedo ayudar hoy?</p>
  <div class="actions">
    <button aria-label="Copiar"></button>
    <button aria-label="Regenerar respuesta"></button>
    <button aria-label="Más opciones"></button>
  </div>
</body>`);
const finishedLine = messages.listChatMessages(finished.document, copilotSite).map((item) => `${item.role}:${item.text}`).join("|");
if (!finishedLine.includes("assistant:Hola. Prueba nueva recibida correctamente. En que te puedo ayudar hoy?")) {
  throw new Error(finishedLine);
}
if (copilotSite.conversationId("https://copilot.microsoft.com/chats/6aea3d77-c8d8-83e8-ada3-561359e03e25") !== "6aea3d77-c8d8-83e8-ada3-561359e03e25") {
  throw new Error("conversation microsoft");
}

const history = [
  { role: "user", text: "hoola" },
  { role: "assistant", text: "¡De nada!" },
];
const seen = messages.mergeSeen(history, []);
if (messages.freshMessages(history, seen).length !== 0) throw new Error("la línea de base no debía enviar");
const reloaded = messages.freshMessages(history, seen);
if (reloaded.length !== 0) throw new Error("la recarga reenvió un turno viejo");
const later = history.concat([
  { role: "user", text: "gracias" },
  { role: "assistant", text: "Con gusto." },
]);
const pending = messages.freshMessages(later, seen).map((item) => `${item.role}:${item.text}`).join("|");
if (pending !== "user:gracias|assistant:Con gusto.") throw new Error(pending);
if (messages.seenKey("user", "hoola") === messages.seenKey("assistant", "hoola")) throw new Error("la clave no distingue el rol");

const nestedCopilot = {
  userSelectors: ['[data-testid="chatQuestion"]'],
  assistantSelectors: ['[data-testid="chatOutput"]', '[data-testid="copilot-message-reply-div"]'],
  userTextSelectors: ['[data-testid="chatQuestion"]'],
  assistantTextSelectors: ['[data-testid="markdown-reply"]'],
};
const nestedDom = parseHTML(`<!doctype html><body>
  <div data-testid="chatQuestion">uno</div>
  <div data-testid="chatOutput">
    <div data-testid="copilot-message-div">
      <div data-testid="copilot-message-reply-div">
        <div data-testid="chat-response-message">
          <div data-testid="markdown-reply">respuesta uno</div>
        </div>
      </div>
    </div>
  </div>
  <div data-testid="copilot-message-reply-div">
    <div data-testid="markdown-reply">respuesta uno</div>
  </div>
  <div data-testid="chatQuestion">dos</div>
  <div data-testid="chatOutput">
    <div data-testid="copilot-message-reply-div">
      <div data-testid="markdown-reply">respuesta dos</div>
    </div>
  </div>
</body>`);
const nestedMessages = messages.listChatMessages(nestedDom.document, nestedCopilot).map((item) => `${item.role}:${item.text}`);
if (nestedMessages.join("|") !== "user:uno|assistant:respuesta uno|user:dos|assistant:respuesta dos") {
  throw new Error(nestedMessages.join("|"));
}
const repeated = parseHTML(`<!doctype html><body>
  <div data-testid="chatQuestion">uno</div>
  <div data-testid="chatOutput"><div data-testid="markdown-reply">Sí.</div></div>
  <div data-testid="chatQuestion">dos</div>
  <div data-testid="chatOutput"><div data-testid="markdown-reply">Sí.</div></div>
</body>`);
const repeatedMessages = messages.listChatMessages(repeated.document, nestedCopilot).map((item) => `${item.role}:${item.text}`);
if (repeatedMessages.join("|") !== "user:uno|assistant:Sí.|user:dos") {
  throw new Error(repeatedMessages.join("|"));
}
const microsoftDom = parseHTML(`<!doctype html><body>
  <div data-testid="chatQuestion"><span class="sr-only">You said:</span> gracias</div>
  <div data-testid="chatQuestion"><span class="fui-VisuallyHidden">Dijiste:</span> gracias</div>
  <div data-testid="copilot-message-reply-div">
    <div data-testid="markdown-reply">De nada.</div>
  </div>
  <div data-testid="chatOutput">
    <div data-testid="markdown-reply">De nada.</div>
  </div>
  <div data-testid="chatQuestion"><span class="sr-only">You said:</span> otra cosa</div>
  <div data-testid="markdown-reply">La segunda.</div>
</body>`);
const microsoftMessages = messages.listChatMessages(microsoftDom.document, copilotSite);
const microsoftLine = microsoftMessages.map((item) => `${item.role}:${item.text}`).join("|");
if (microsoftLine !== "user:gracias|assistant:De nada.|user:otra cosa|assistant:La segunda.") {
  throw new Error(microsoftLine);
}
const responseSelectors = microsoftMessages.filter((item) => item.role === "assistant").map((item) => item.selector);
if (!responseSelectors.includes('[data-testid="markdown-reply"]')) throw new Error(responseSelectors.join(","));
const saidDom = parseHTML(`<!doctype html><body>
  <div data-testid="chatQuestion">You said: gracias</div>
  <div data-testid="chatQuestion">Dijiste: otra</div>
  <div data-testid="markdown-reply">ok</div>
</body>`);
const saidLine = messages.listChatMessages(saidDom.document, copilotSite).map((item) => `${item.role}:${item.text}`).join("|");
if (saidLine !== "user:gracias|user:otra|assistant:ok") throw new Error(saidLine);
const shadowDoc = parseHTML(`<div id="chat-root"></div>`).document;
const chatRoot = shadowDoc.getElementById("chat-root");
const question = shadowDoc.createElement("div");
question.setAttribute("data-testid", "chatQuestion");
question.textContent = "uno";
chatRoot.append(question);
const output = shadowDoc.createElement("div");
output.setAttribute("data-testid", "chatOutput");
const host = shadowDoc.createElement("div");
output.append(host);
chatRoot.append(output);
const shadow = host.attachShadow({ mode: "open" });
const reply = shadowDoc.createElement("div");
reply.setAttribute("data-testid", "copilot-message-reply-div");
const markdown = shadowDoc.createElement("div");
markdown.setAttribute("data-testid", "markdown-reply");
markdown.textContent = "desde shadow";
reply.append(markdown);
shadow.append(reply);
if (!messages.inside(reply, output)) throw new Error("inside no cruza shadow");
const shadowMessages = messages.listChatMessages(chatRoot, nestedCopilot).map((item) => `${item.role}:${item.text}`);
if (shadowMessages.join("|") !== "user:uno|assistant:desde shadow") throw new Error(shadowMessages.join("|"));

const attached = parseHTML(`<!doctype html><body>
  <div class="ComposerLayoutAttachments-abc">
    <div class="flex flex-wrap items-end gap-2 p-1">
      <div class="composer-attachment-surface" aria-label="Captura de pantalla 2026-11-03 144840.png">
        <span class="composer-attachment-surface">
          <img class="size-full object-cover" alt="Captura de pantalla 2026-11-03 144840.png" src="data:image/png;base64,aaa" />
        </span>
      </div>
    </div>
  </div>
</body>`).document.querySelector(chatgpt.attachmentSelectors[0]);
if (!attached || attached.getAttribute("aria-label") !== "Captura de pantalla 2026-11-03 144840.png") {
  throw new Error("adjunto chatgpt");
}
const thumb = attached.querySelector("img");
if (!String(thumb.getAttribute("src")).startsWith("data:image/png")) throw new Error("miniatura chatgpt");

console.log("messages ok");
console.log(roles.join(" | "));
