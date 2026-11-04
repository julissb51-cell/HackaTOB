// Selectores de claude.ai. Revisados por Juliana el 4 de noviembre de 2026
// (Edge, español, un prompt «hola» y una respuesta ya terminada).
// No se vio el botón de detener: los aria-label de Stop quedan como candidatos.
(function () {
  "use strict";

  globalThis.EnlazaClaudeSite = {
    ia: "claude",
    placeholders: [
      "escribe un mensaje…",
      "escribe un mensaje...",
      "how can i help you today?",
      "reply to claude...",
    ],
    userSelectors: ['[data-testid="user-message"]'],
    assistantSelectors: [
      '[data-testid="assistant-message"]',
      '[data-is-streaming] .standard-markdown',
    ],
    userTextSelectors: ['[data-testid="user-message"]'],
    assistantTextSelectors: [".standard-markdown"],
    streamingSelectors: ['[data-is-streaming="true"]'],
    sendSelectors: [
      '[data-testid="chat-input-send"]',
      'button[aria-label="Enviar mensaje"]',
      'button[aria-label="Send message"]',
    ],
    stopSelectors: [
      'button[aria-label="Detener respuesta"]',
      'button[aria-label="Stop response"]',
      '[data-testid="stop-button"]',
    ],
    fileAnchorSelectors: [
      '[data-testid="chat-input-attach"]',
      'button[aria-label="Agregar archivos, conectores y más"]',
    ],
    fileFooterSelectors: ['[data-testid="chat-input"]'],
    fileSelectors: [
      '[data-testid="file-upload"] a',
      '[data-testid="file-upload"] img',
      'a[download]',
      'a[href^="blob:"]',
    ],
    linkSelectors: [
      '[data-testid="assistant-message"] a[href^="https://"]',
      ".standard-markdown a[href^='https://']",
    ],
    composerSelectors: [
      '[data-testid="chat-input"]',
      'div.ProseMirror[contenteditable="true"]',
    ],
    conversationId(href) {
      try {
        const match = new URL(href).pathname.match(/\/chat\/([0-9a-fA-F-]+)/);
        if (!match || match[1].toLowerCase() === "new") return "";
        return match[1];
      } catch {
        return "";
      }
    },
  };
})();
