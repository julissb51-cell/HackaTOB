// Selectores de chatgpt.com. Si la página cambia, ajusta solo este archivo.
(function () {
  "use strict";

  globalThis.EnlazaChatgptSite = {
    ia: "chatgpt",
    userSelectors: [
      '[data-message-author-role="user"]',
      '[data-turn="user"]',
    ],
    assistantSelectors: [
      '[data-message-author-role="assistant"]',
      '[data-turn="assistant"]',
    ],
    userTextSelectors: [
      ".whitespace-pre-wrap",
      ".text-message",
      '[data-message-author-role="user"]',
    ],
    assistantTextSelectors: [
      ".markdown",
      ".text-message",
      '[data-message-author-role="assistant"]',
    ],
    stopSelectors: [
      'button[data-testid="stop-button"]',
      'button[aria-label="Stop streaming"]',
      'button[aria-label="Stop generating"]',
      'button[aria-label="Detener"]',
      'button[aria-label="Detener la respuesta"]',
      'button[aria-label="Detener respuesta"]',
    ],
    composerSelectors: [
      "#prompt-textarea",
      "div.ProseMirror#prompt-textarea",
      'form div[contenteditable="true"]',
      "textarea#prompt-textarea",
    ],
    conversationId(href) {
      try {
        const match = new URL(href).pathname.match(/\/c\/([A-Za-z0-9-]+)/);
        return match ? match[1] : "";
      } catch {
        return "";
      }
    },
  };
})();
