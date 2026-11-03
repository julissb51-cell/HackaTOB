// Selectores de gemini.google.com. Si la página cambia, ajusta solo este archivo.
(function () {
  "use strict";

  globalThis.EnlazaGeminiSite = {
    ia: "gemini",
    placeholders: [
      "enter a prompt here",
      "enter a prompt for gemini",
      "ask gemini",
      "escribe un mensaje a gemini",
      "ingresa una instrucción",
      "preguntale a gemini",
    ],
    userSelectors: [
      "user-query",
      "user-query-content",
      ".query-text",
      ".query-text-line",
      '[data-test-id="user-query"]',
      ".user-query",
    ],
    assistantSelectors: [
      "model-response",
      "message-content.model-response-text",
      "message-content",
      '[data-test-id="model-response"]',
      ".model-response",
    ],
    userTextSelectors: [
      ".query-text",
      ".query-text-line",
      "user-query-content",
      ".query-content",
    ],
    assistantTextSelectors: [
      "message-content.model-response-text",
      "message-content",
      ".model-response-text",
      ".markdown",
      ".markdown-main-panel",
    ],
    sendSelectors: [
      'button[aria-label="Send message"]',
      'button[aria-label="Enviar mensaje"]',
      'button[aria-label="Send"]',
      'button[aria-label="Enviar"]',
      'button[data-test-id="send-button"]',
      "button.send-button",
      'button[data-testid="send-button"]',
    ],
    stopSelectors: [
      'button[aria-label="Stop response"]',
      'button[aria-label="Stop generating"]',
      'button[aria-label="Stop"]',
      'button[aria-label="Detener respuesta"]',
      'button[aria-label="Detener la respuesta"]',
      'button[aria-label="Detener"]',
      '[data-test-id="stop-button"]',
      "button.stop-button",
      'button[data-testid="stop-button"]',
      'mat-icon[fonticon="stop"]',
      'mat-icon[data-mat-icon-name="stop"]',
    ],
    composerSelectors: [
      "rich-textarea .ql-editor",
      "rich-textarea div[contenteditable='true']",
      '[aria-label="Enter a prompt for Gemini"]',
      '[aria-label="Ingresa una instrucción"]',
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
