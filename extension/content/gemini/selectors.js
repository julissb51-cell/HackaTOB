// Selectores de gemini.google.com. Si la página cambia, ajusta solo este archivo.
(function () {
  "use strict";

  globalThis.EnlazaGeminiSite = {
    ia: "gemini",
    userSelectors: [
      "user-query",
      ".user-query",
      ".query-content",
    ],
    assistantSelectors: [
      "model-response",
      "message-content.model-response-text",
      ".model-response",
    ],
    userTextSelectors: [
      ".query-text",
      ".query-text-line",
      ".query-content",
      "user-query-content",
    ],
    assistantTextSelectors: [
      "message-content",
      ".model-response-text",
      ".markdown",
      ".markdown-main-panel",
    ],
    stopSelectors: [
      'button[aria-label="Stop response"]',
      'button[aria-label="Stop generating"]',
      'button[aria-label="Detener respuesta"]',
      'button[aria-label="Detener la respuesta"]',
      'button[aria-label="Detener"]',
      "button.stop-button",
      'button[data-testid="stop-button"]',
    ],
    composerSelectors: [
      "rich-textarea .ql-editor",
      "rich-textarea div[contenteditable='true']",
      ".text-input-field .ql-editor",
      "div.ql-editor[contenteditable='true']",
      'div[role="textbox"][contenteditable="true"]',
    ],
    conversationId(href) {
      try {
        const match = new URL(href).pathname.match(/\/app\/([A-Za-z0-9_-]+)/);
        if (!match) return "";
        if (match[1] === "new" || match[1] === "none" || match[1] === "chat") return "";
        return match[1];
      } catch {
        return "";
      }
    },
  };
})();
