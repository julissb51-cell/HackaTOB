// Gancho sin activar. No está en manifest.json.
// Cuando se conecte Claude Code, manda el evento al service worker:
//
// chrome.runtime.sendMessage({
//   type: "enlaza.capture",
//   capture: {
//     tipo: "respuesta",
//     ia: "claude",
//     texto: "...",
//     conversation_id: "id-que-ya-trae-claude",
//     nombre_chat: "Nombre del chat",
//   },
// });
(function () {
  "use strict";
  globalThis.EnlazaHooks = globalThis.EnlazaHooks || {};
  globalThis.EnlazaHooks.claude = { ia: "claude", active: false };
})();
