// Selectores de copilot.com. Revisados por Juliana el 4 de noviembre de 2026
// (Edge, español, un prompt y una respuesta ya terminada).
// El host viejo copilot.microsoft.com queda en el manifiesto por si redirige.
// No se vio el botón de enviar en vacío ni el de detener.
(function () {
  "use strict";

  globalThis.EnlazaCopilotSite = {
    ia: "copilot",
    placeholders: ["enviar un mensaje a copilot"],
    userSelectors: ['[data-testid="chatQuestion"]'],
    assistantSelectors: [
      '[data-testid="chatOutput"]',
      '[data-testid="copilot-message-reply-div"]',
    ],
    userTextSelectors: ['[data-testid="chatQuestion"]'],
    assistantTextSelectors: ['[data-testid="markdown-reply"]'],
    streamingSelectors: ['[data-testid="loading-message"]'],
    sendSelectors: [
      'button[aria-label="Enviar"]',
      'button[aria-label="Send"]',
      ".fai-BebopLiteChatInput button[type='submit']",
    ],
    stopSelectors: [
      'button[aria-label="Detener"]',
      'button[aria-label="Stop"]',
      'button[aria-label="Dejar de responder"]',
      'button[aria-label="Stop responding"]',
    ],
    fileAnchorSelectors: ['[data-testid="PlusMenuButton"]'],
    fileFooterSelectors: [".fai-BebopLiteChatInput"],
    composerSelectors: [
      "#m365-chat-editor-target-element",
      ".fai-EditorInput__input[contenteditable='true']",
    ],
    conversationId(href) {
      try {
        const match = new URL(href).pathname.match(/\/chat\/conversation\/([0-9a-fA-F-]+)/);
        return match ? match[1] : "";
      } catch {
        return "";
      }
    },
  };
})();
