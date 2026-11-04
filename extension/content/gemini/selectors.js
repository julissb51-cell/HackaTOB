// Selectores de gemini.google.com. El compositor (nov 2026, Edge, español)
// es rich-textarea .ql-editor. El + se llama «Cargas y herramientas».
// La portada usa simplified-input-area; el chat abierto usa la misma caja.
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
    fileSelectors: [
      "user-query img",
      "user-query a[download]",
      'user-query a[href^="blob:"]',
      'a[href*="googleusercontent.com"]',
      "model-response a[download]",
      'model-response a[href^="blob:"]',
      '[data-test-id*="file"]',
      '[data-test-id*="attachment"]',
    ],
    linkSelectors: [
      "model-response a[href^='https://']",
      "message-content a[href^='https://']",
    ],
    composerSelectors: [
      "rich-textarea .ql-editor",
      "rich-textarea div[contenteditable='true']",
      ".text-input-field .ql-editor",
      "fieldset.input-area-fieldset .ql-editor",
      '[aria-label="Enter a prompt for Gemini"]',
      '[aria-label="Ingresa una instrucción"]',
      "div.ql-editor[contenteditable='true']",
      'div[role="textbox"][contenteditable="true"]',
    ],
    composerScopeSelectors: ["fieldset.input-area-fieldset", "input-area-v2"],
    preferPickedFiles: true,
    fileAnchorSelectors: [
      'button[aria-label="Cargas y herramientas"]',
      'button[aria-label="Upload and tools"]',
      'button[aria-label="Open upload file menu"]',
      'button[aria-label="Cerrar el menú de cargas"]',
      'button[aria-label="Cerrar el menu de cargas"]',
      'button[aria-label="Close upload menu"]',
      'button[aria-label="Close the upload menu"]',
      'button[aria-label="Subir archivos"]',
      'button[aria-label="Upload files"]',
      'button[aria-label="Subir archivo"]',
      'button[aria-label="Upload file"]',
    ],
    fileFooterSelectors: [
      ".textarea-wrapper",
      ".text-input-field",
      "fieldset.input-area-fieldset",
      ".input-area-container",
      "input-area-v2",
    ],
    attachmentRootSelectors: [
      "fieldset.input-area-fieldset",
      ".input-area-container",
      "input-area-v2",
      ".text-input-field",
    ],
    attachmentSelectors: [
      ".file-preview",
      "[class*='file-preview']",
      "[class*='preview-chip']",
      "[class*='file-chip']",
      "[class*='upload-preview']",
      "[class*='uploaded-file']",
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
