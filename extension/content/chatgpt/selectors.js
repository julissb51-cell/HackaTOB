// Selectores de chatgpt.com. Hay dos DOM: el de la sesión iniciada (nov 2026,
// data-turn-key y data-chatgpt-search-unit-key) y el anterior
// (conversation-turn / data-message-author-role). Se aceptan los dos.
(function () {
  "use strict";

  globalThis.EnlazaChatgptSite = {
    ia: "chatgpt",
    turnSelectors: [
      "[data-turn-key]",
      "[data-content-search-turn-key]",
      "article[data-testid^='conversation-turn']",
      "[data-testid^='conversation-turn']",
      "article[data-turn]",
      "[data-turn='user']",
      "[data-turn='assistant']",
    ],
    userSelectors: [
      '[data-chatgpt-search-unit-key$=":user"]',
      "[data-user-message-bubble]",
      '[data-message-author-role="user"]',
      '[data-testid="user-message"]',
      '[data-turn="user"]',
    ],
    assistantSelectors: [
      '[data-chatgpt-search-unit-key$=":assistant"]',
      '[data-markdown-text-style="assistant-message"]',
      "[data-dil-source-message-id]",
      '[data-content-search-unit-key$=":assistant"]',
      '[data-message-author-role="assistant"]',
      '[data-testid="assistant-message"]',
      '[data-turn="assistant"]',
      ".agent-turn",
    ],
    userTextSelectors: [
      "[data-user-message-bubble]",
      ".whitespace-pre-wrap",
      ".text-message",
    ],
    assistantTextSelectors: [
      '[data-markdown-text-style="assistant-message"]',
      '[data-markdown-copy="contents"]',
      ".markdown",
      ".prose",
      '[class*="markdown"]',
      ".whitespace-pre-wrap",
    ],
    stopSelectors: [
      'button[data-testid="stop-button"]',
      'button[data-testid="composer-stop-button"]',
      'button[aria-label="Stop streaming"]',
      'button[aria-label="Stop generating"]',
      'button[aria-label="Detener respuesta"]',
      'button[aria-label="Detener la respuesta"]',
      'button[aria-label="Detener generación"]',
    ],
    sendSelectors: [
      'button[data-testid="send-button"]',
      'button[data-testid="composer-send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send message"]',
      'button[aria-label="Enviar prompt"]',
      'button[aria-label="Enviar mensaje"]',
      'button[aria-label="Enviar"]',
    ],
    fileAnchorSelectors: [
      'button[aria-label="Añadir archivos y más"]',
      'button[aria-label="Add files and more"]',
      '[data-testid="composer-plus-btn"]',
    ],
    fileFooterSelectors: [
      '[class*="ComposerLayoutFooter"]',
      '[class*="ComposerLayoutRoot"]',
    ],
    attachmentSelectors: [
      '[class*="ComposerLayoutAttachments"] .composer-attachment-surface[aria-label]',
    ],
    fileSelectors: [
      "a[download]",
      'a[href^="blob:"]',
      'a[href*="/backend-api/"]',
      'a[href*="oaiusercontent.com"]',
      'a[href*="/files/"]',
      '[data-testid*="attachment"]',
      '[data-testid*="file-thumbnail"]',
      '[data-user-message-bubble] img',
      '[data-message-author-role="user"] img',
    ],
    linkSelectors: [
      '[data-message-author-role="assistant"] a[href^="https://"]',
      '[data-content-search-unit-key$=":assistant"] a[href^="https://"]',
      '[data-turn="assistant"] a[href^="https://"]',
      ".markdown a[href^='https://']",
    ],
    composerSelectors: [
      'div.ProseMirror[contenteditable="true"][aria-label="Ask ChatGPT"]',
      'form div.ProseMirror[contenteditable="true"]',
      "#prompt-textarea",
      '[data-testid="prompt-textarea"]',
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
