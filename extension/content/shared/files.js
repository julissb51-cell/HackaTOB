(function () {
  "use strict";

  const site = globalThis.EnlazaChatgptSite || globalThis.EnlazaGeminiSite || globalThis.EnlazaClaudeSite;
  if (!site || globalThis.__enlazaFilesStarted) return;
  globalThis.__enlazaFilesStarted = true;

  const dom = globalThis.EnlazaDom;
  const limits = globalThis.EnlazaFiles;
  const MAX_FILE_BYTES = limits?.MAX_FILE_BYTES || 10_485_760;
  const es = (navigator.language || "es").toLowerCase().startsWith("es");
  const copy = es
    ? {
        send: "Enviar a Enlaza",
        ok: "Enviado a Archivos de la sala",
        duplicate: "Ya estaba en la sala",
        needRoom: "Conecta una sala en Enlaza primero",
        unreadable: "No se pudo leer este archivo; descárgalo y súbelo desde la sala",
        tooBig: "el archivo pasa de 10 MB",
        generic: "No se pudo enviar. Puedes reintentar.",
        noFile: "No veo un archivo en el mensaje. Adjuntá uno con + y volvé a pulsar Enlaza.",
        reattach: "Volvé a adjuntarlo con + para que Enlaza lo pueda leer",
      }
    : {
        send: "Send to Enlaza",
        ok: "Sent to room files",
        duplicate: "Already in the room",
        needRoom: "Connect a room in Enlaza first",
        unreadable: "Could not read this file; download it and upload it from the room",
        tooBig: "el archivo pasa de 10 MB",
        generic: "Could not send. You can retry.",
        noFile: "No file in the message. Attach one with + and press Enlaza again.",
        reattach: "Attach it again with + so Enlaza can read it.",
      };

  const pickedFiles = new Map();

  const FILE_NAME = /^[^\s]{1,160}\.[a-z0-9]{2,5}$/i;

  function injectStyle() {
    if (document.getElementById("enlaza-file-style")) return;
    const style = document.createElement("style");
    style.id = "enlaza-file-style";
    style.textContent = [
      ".enlaza-send{display:inline-flex;align-items:center;height:24px;margin:0 0 0 6px;padding:0 8px;border:1px solid #06b6d4;border-radius:999px;background:rgba(6,182,212,.12);color:#06b6d4;font:600 11px/1 system-ui,sans-serif;cursor:pointer;vertical-align:middle;}",
      ".enlaza-send:disabled{opacity:.55;cursor:progress;}",
      ".enlaza-send-busy::after{content:'';width:10px;height:10px;margin-left:6px;border:2px solid #06b6d4;border-right-color:transparent;border-radius:50%;display:inline-block;animation:enlaza-spin .7s linear infinite;}",
      "@keyframes enlaza-spin{to{transform:rotate(360deg)}}",
      ".enlaza-toast{position:fixed;right:16px;bottom:16px;z-index:2147483646;max-width:280px;padding:10px 12px;border-radius:12px;background:#0c1016;color:#e8edf5;font:14px/1.35 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);}",
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function toast(message) {
    let node = document.getElementById("enlaza-toast");
    if (!node) {
      node = document.createElement("div");
      node.id = "enlaza-toast";
      node.className = "enlaza-toast";
      node.setAttribute("role", "status");
      (document.body || document.documentElement).appendChild(node);
    }
    node.textContent = message;
    clearTimeout(node._enlazaTimer);
    node._enlazaTimer = setTimeout(() => node.remove(), 3000);
  }

  function collect(selectors, root) {
    const found = [];
    const seen = new Set();
    for (const selector of selectors || []) {
      let nodes = [];
      try {
        nodes = dom.queryAllDeep(selector, root);
      } catch (error) {
        console.debug("enlaza archivos", error);
      }
      for (const node of nodes) {
        if (!node || seen.has(node) || node.dataset?.enlazaFile === "1") continue;
        seen.add(node);
        found.push(node);
      }
    }
    return found.filter((node) => !found.some((other) => other !== node && other.contains(node)));
  }

  function hrefOf(node) {
    return node?.href || node?.currentSrc || node?.src || node?.getAttribute?.("href") || "";
  }

  function looksLikeFile(node) {
    const href = hrefOf(node);
    if (node?.matches?.("a[download], a[href^='blob:'], img")) return true;
    return /backend-api|oaiusercontent|googleusercontent|\/files\/|\/file\/|blob:/i.test(href);
  }

  function fileName(node, href) {
    const download = node?.getAttribute?.("download");
    if (download && download !== "download") return download.slice(0, 200);
    const alt = node?.getAttribute?.("alt") || node?.getAttribute?.("aria-label") || "";
    if (FILE_NAME.test(alt.trim())) return alt.trim().slice(0, 200);
    try {
      const path = new URL(href, location.href).pathname.split("/").pop();
      if (path && FILE_NAME.test(decodeURIComponent(path))) return decodeURIComponent(path).slice(0, 200);
    } catch {
      // El nombre sale del texto visible.
    }
    const line = (node?.innerText || "").trim().split("\n")[0] || "";
    if (FILE_NAME.test(line)) return line.slice(0, 200);
    return "archivo";
  }

  function httpsUrl(raw) {
    const clean = limits?.cleanShareUrl(raw) || "";
    return clean.startsWith("http") ? clean : "";
  }

  function attach(node, info) {
    if (!node || node.dataset?.enlazaFile === "1" || node.classList?.contains("enlaza-send")) return;
    node.dataset.enlazaFile = "1";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "enlaza-send";
    button.setAttribute("aria-label", copy.send);
    button.textContent = "Enlaza";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      send(button, info);
    });
    node.insertAdjacentElement("afterend", button);
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function readBlob(url) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(String(response.status));
    return response.blob();
  }

  function show(response) {
    if (response?.duplicate) {
      toast(copy.duplicate);
      return;
    }
    if (response?.error === "no_session") {
      toast(copy.needRoom);
      return;
    }
    if (response?.ok) {
      toast(copy.ok);
      return;
    }
    toast(response?.error || copy.generic);
  }

  async function send(button, info) {
    button.disabled = true;
    button.classList.add("enlaza-send-busy");
    try {
      if (info.kind === "link") {
        show(await chrome.runtime.sendMessage({ type: "enlaza.link", url: info.url, name: info.name }));
        return;
      }
      let blob = null;
      try {
        if (info.src) blob = await readBlob(info.src);
      } catch (error) {
        console.debug("enlaza archivos", error);
      }
      if (!blob) {
        if (info.https) show(await chrome.runtime.sendMessage({ type: "enlaza.link", url: info.https, name: info.name }));
        else toast(copy.unreadable);
        return;
      }
      if (blob.size > MAX_FILE_BYTES) {
        toast(copy.tooBig);
        return;
      }
      if (!blob.size) {
        toast(copy.unreadable);
        return;
      }
      show(
        await chrome.runtime.sendMessage({
          type: "enlaza.file",
          file: {
            name: info.name,
            mime: blob.type || "application/octet-stream",
            size: blob.size,
            bytes: await blobToBase64(blob),
          },
        }),
      );
    } catch (error) {
      console.debug("enlaza archivos", error);
      toast(copy.generic);
    } finally {
      button.disabled = false;
      button.classList.remove("enlaza-send-busy");
    }
  }

  function filenameChips() {
    const chips = [];
    const roots = collect(site.userSelectors);
    for (const root of roots) {
      const cards = root.querySelectorAll?.("[data-testid*='file'], [data-testid*='attachment'], [class*='attachment'], [class*='file-chip']") || [];
      for (const card of cards) {
        if (card.dataset?.enlazaFile === "1") continue;
        const label = (card.innerText || "").trim().split("\n")[0] || "";
        if (!FILE_NAME.test(label)) continue;
        chips.push(card);
      }
    }
    return chips;
  }

  function onScreen(node) {
    if (!node?.getBoundingClientRect) return false;
    const rect = node.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(node) : null;
    if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    return true;
  }

  function queryLast(selectors, root) {
    for (const selector of selectors || []) {
      let nodes = [];
      try {
        nodes = dom.queryAllDeep(selector, root);
      } catch (error) {
        console.debug("enlaza archivos", error);
        continue;
      }
      const visible = nodes.filter(onScreen);
      const pool = visible.length ? visible : nodes;
      if (pool.length) return pool[pool.length - 1];
    }
    return null;
  }

  function makeComposerButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "enlaza-send";
    button.dataset.enlazaFiles = "1";
    button.setAttribute("aria-label", copy.send);
    button.textContent = "Enlaza";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      sendComposer(button);
    });
    return button;
  }

  function placeComposerButton() {
    if (!site.fileAnchorSelectors && !site.fileFooterSelectors) return;
    const current = document.querySelector("button[data-enlaza-files='1']");
    const plus = queryLast(site.fileAnchorSelectors);
    if (plus) {
      if (current?.isConnected && current.previousElementSibling === plus) return;
      if (current) current.remove();
      plus.insertAdjacentElement("afterend", makeComposerButton());
      return;
    }
    const footer = queryLast(site.fileFooterSelectors);
    if (!footer) return;
    if (current?.isConnected && footer.contains(current)) return;
    if (current) current.remove();
    footer.appendChild(makeComposerButton());
  }

  function rememberFile(file) {
    if (!file?.name || !file.size) return;
    pickedFiles.set(file.name, file);
  }

  function storedFile(name) {
    if (pickedFiles.has(name)) return pickedFiles.get(name);
    const wanted = String(name || "").trim().toLowerCase();
    for (const [key, file] of pickedFiles) {
      if (key.toLowerCase() === wanted) return file;
    }
    return null;
  }

  function eventHitsComposer(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    const selectors = [...(site.composerSelectors || []), ...(site.fileFooterSelectors || []), '[class*="ComposerLayoutRoot"]', "form"];
    return path.some((node) => {
      if (!node?.matches) return false;
      return selectors.some((selector) => {
        try {
          return node.matches(selector);
        } catch {
          return false;
        }
      });
    });
  }

  function onFileChosen(event) {
    const input = event.target;
    if (!input || input.type !== "file" || !input.files) return;
    for (const file of input.files) rememberFile(file);
  }

  function onDropFiles(event) {
    if (!eventHitsComposer(event)) return;
    const list = event.dataTransfer?.files;
    if (!list?.length) return;
    for (const file of list) rememberFile(file);
  }

  function onPasteFiles(event) {
    if (!eventHitsComposer(event)) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) rememberFile(file);
    }
  }

  function imageSrc(node) {
    const img = node?.matches?.("img") ? node : node?.querySelector?.("img");
    const src = img?.currentSrc || img?.src || img?.getAttribute?.("src") || "";
    return src.startsWith("data:") || src.startsWith("blob:") ? src : "";
  }

  function visibleAttachments() {
    const root = queryLast(['[class*="ComposerLayoutRoot"]', '[data-testid="chat-input"]']) || queryLast(site.fileFooterSelectors) || document;
    const selectors = site.attachmentSelectors || [
      '[class*="ComposerLayoutAttachments"] .composer-attachment-surface[aria-label]',
    ];
    return collect(selectors, root).filter((node) => onScreen(node) && !node.closest?.("[data-enlaza-files]"));
  }

  async function fileFromAttachment(node) {
    const name = (node.getAttribute?.("aria-label") || node.querySelector?.("img")?.getAttribute?.("alt") || "archivo").trim();
    const source = limits.chooseAttachmentSource(name, [...pickedFiles.keys()], imageSrc(node));
    if (source === "stored") return { file: storedFile(name) };
    if (source === "image") {
      const blob = await readBlob(imageSrc(node));
      const type = blob.type || "application/octet-stream";
      return { file: new File([blob], name, { type }) };
    }
    return { reattach: true, name };
  }

  async function sendFileObject(file) {
    if (file.size > MAX_FILE_BYTES) {
      toast(copy.tooBig);
      return;
    }
    if (!file.size) {
      toast(copy.unreadable);
      return;
    }
    show(
      await chrome.runtime.sendMessage({
        type: "enlaza.file",
        file: {
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          bytes: await blobToBase64(file),
        },
      }),
    );
  }

  async function sendComposer(button) {
    const nodes = visibleAttachments();
    if (!nodes.length) {
      toast(copy.noFile);
      return;
    }
    button.disabled = true;
    button.classList.add("enlaza-send-busy");
    let needsReattach = false;
    try {
      for (const node of nodes) {
        let resolved;
        try {
          resolved = await fileFromAttachment(node);
        } catch (error) {
          console.debug("enlaza archivos", error);
          needsReattach = true;
          continue;
        }
        if (resolved.reattach) {
          needsReattach = true;
          continue;
        }
        if (resolved.file) await sendFileObject(resolved.file);
      }
      if (needsReattach) toast(copy.reattach);
    } finally {
      button.disabled = false;
      button.classList.remove("enlaza-send-busy");
    }
  }

  function scan() {
    try {
      placeComposerButton();
      for (const node of collect(site.fileSelectors)) {
        const href = hrefOf(node);
        attach(node, {
          kind: "file",
          name: fileName(node, href),
          src: href.startsWith("blob:") || href.startsWith("data:") || href.startsWith("http") ? href : "",
          https: httpsUrl(href),
        });
      }
      for (const card of filenameChips()) {
        const href = hrefOf(card.querySelector("a, img") || card);
        attach(card, {
          kind: "file",
          name: fileName(card, href),
          src: href.startsWith("blob:") || href.startsWith("data:") || href.startsWith("http") ? href : "",
          https: httpsUrl(href),
        });
      }
      for (const node of collect(site.linkSelectors)) {
        if (looksLikeFile(node)) continue;
        const url = httpsUrl(node.href || node.getAttribute("href") || "");
        if (!url) continue;
        const name = (node.innerText || node.getAttribute("aria-label") || "").trim().split("\n")[0].slice(0, 200);
        attach(node, { kind: "link", url, name });
      }
    } catch (error) {
      console.debug("enlaza archivos", error);
    }
  }

  function boot() {
    injectStyle();
    let timer = 0;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(scan, 300);
    });
    const root = document.documentElement || document.body;
    if (root) observer.observe(root, { childList: true, subtree: true });
    setInterval(scan, 3000);
    document.addEventListener("change", onFileChosen, true);
    document.addEventListener("drop", onDropFiles, true);
    document.addEventListener("paste", onPasteFiles, true);
    scan();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
