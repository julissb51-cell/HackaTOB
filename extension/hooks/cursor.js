// Gancho sin activar. No está en manifest.json.
// Cuando se conecte Cursor, manda el evento al service worker con el mismo formato:
//
// chrome.runtime.sendMessage({
//   type: "enlaza.capture",
//   capture: {
//     tipo: "prompt",
//     ia: "cursor",
//     texto: "...",
//     conversation_id: "id-que-ya-trae-cursor",
//     nombre_chat: "Nombre del chat",
//   },
// });
(function () {
  "use strict";
  globalThis.EnlazaHooks = globalThis.EnlazaHooks || {};
  globalThis.EnlazaHooks.cursor = { ia: "cursor", active: false };
})();
