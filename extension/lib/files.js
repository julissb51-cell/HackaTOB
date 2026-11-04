(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  root.EnlazaFiles = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_FILE_BYTES = 10_485_760;
  const MIME_RE = /^[\w.+-]+\/[\w.+-]+$/;

  function cleanShareUrl(raw) {
    if (typeof raw !== "string") return "";
    const value = raw.trim();
    if (!value || value.length > 2000 || /[\s\u0000-\u001F\u007F]/.test(value)) return "";
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      return "";
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    if (!parsed.hostname.includes(".") || parsed.username || parsed.password) return "";
    return parsed.toString();
  }

  function mimeOrDefault(mime) {
    if (typeof mime === "string" && MIME_RE.test(mime)) return mime.slice(0, 120);
    return "application/octet-stream";
  }

  function checkSize(size) {
    if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) return "size no válido";
    if (size > MAX_FILE_BYTES) return "el archivo pasa de 10 MB";
    return "";
  }

  return { MAX_FILE_BYTES, cleanShareUrl, mimeOrDefault, checkSize };
});
