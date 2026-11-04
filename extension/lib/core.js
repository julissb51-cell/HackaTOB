(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }
  root.EnlazaCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_BASE = "https://enlaza-green.vercel.app";
  const API_HOST = "enlaza-green.vercel.app";
  const TEXT_LIMIT = 100000;
  const AI_NAMES = ["chatgpt", "gemini", "cursor", "claude", "copilot", "grok"];
  const EVENT_TYPES = ["prompt", "respuesta", "archivo"];
  const ROOM_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
  const RESERVED_IDS = new Set(["new", "api", "auth", "join", "rooms", "room"]);
  const LOCAL_TIME =
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$/;
  const EVENT_ID_RE = /^[A-Za-z0-9_-]{1,200}$/;
  const CONTROL_TEST = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
  const CONTROL_STRIP = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
  const STOP_WORDS = new Set([
    "para", "como", "esta", "este", "esto", "desde", "hasta", "donde", "cuando",
    "porque", "sobre", "entre", "tambien", "puede", "hacer", "quiero", "necesito",
    "hola", "ayuda", "favor", "tiene", "tienen", "seria", "puedes", "podrias",
    "the", "and", "with", "that", "this", "from", "your", "have", "what",
  ]);

  function stripControl(value) {
    return String(value ?? "").replace(CONTROL_STRIP, "");
  }

  function clipPlain(value, max) {
    const cleaned = stripControl(value).trim().replace(/\s+/g, " ");
    if (!cleaned) return "";
    const chars = Array.from(cleaned);
    if (chars.length <= max) return cleaned;
    return chars.slice(0, max).join("").trim();
  }

  function truncateText(value) {
    const cleaned = stripControl(value);
    const chars = Array.from(cleaned);
    if (chars.length <= TEXT_LIMIT) return cleaned;
    return chars.slice(0, TEXT_LIMIT).join("");
  }

  function localIso(date) {
    const when = date instanceof Date ? date : new Date();
    const pad = (number) => String(number).padStart(2, "0");
    const offsetMinutes = -when.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absolute = Math.abs(offsetMinutes);
    return (
      `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}` +
      `T${pad(when.getHours())}:${pad(when.getMinutes())}:${pad(when.getSeconds())}` +
      `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
    );
  }

  function newEventId() {
    const bytes = new Uint8Array(16);
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }
    let hex = "";
    for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
    return `evt_${hex}`;
  }

  function hashText(text) {
    let hash = 2166136261;
    const value = String(text ?? "");
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  function consentKey(salaId, member) {
    return `${String(salaId || "").trim().toLowerCase()}::${String(member || "").trim().toLowerCase()}`;
  }

  function parseMember(raw) {
    const name = stripControl(raw).trim().replace(/\s+/g, " ");
    if (!name) return { ok: false, error: "Escribe tu nombre." };
    if (Array.from(name).length > 120) return { ok: false, error: "El nombre puede tener hasta 120 caracteres." };
    return { ok: true, name };
  }

  function parseInvite(raw) {
    let value = String(raw ?? "").trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    if (!value) return { ok: false, error: "Pega el enlace de invitación." };

    let url;
    try {
      url = new URL(value);
    } catch {
      return { ok: false, error: "El enlace no es válido." };
    }
    if (url.protocol !== "https:" || url.hostname !== API_HOST) {
      return { ok: false, error: "El enlace tiene que ser de enlaza-green.vercel.app." };
    }

    const parts = url.pathname.split("/").filter(Boolean).map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
    const head = (parts[0] || "").toLowerCase();
    if (parts.length < 2 || (head !== "join" && head !== "room")) {
      return { ok: false, error: "Ese enlace no es una invitación a una sala." };
    }

    const salaId = parts[1].trim().toLowerCase();
    if (!ROOM_ID_RE.test(salaId) || RESERVED_IDS.has(salaId)) {
      return { ok: false, error: "El id de la sala no es válido." };
    }

    const token = (url.searchParams.get("t") || url.searchParams.get("token") || "").trim();
    if (!token || token.length > 500 || CONTROL_TEST.test(token)) {
      return { ok: false, error: "El enlace no trae un token válido." };
    }
    return { ok: true, salaId, token };
  }

  function keywordFrom(text) {
    const words = stripControl(text)
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    const found = words.find((word) => word.length >= 4 && !STOP_WORDS.has(word));
    return clipPlain(found || "", 80);
  }

  function chatNameFrom(title, text) {
    let name = stripControl(title).replace(/\s[-|–—]\s*(ChatGPT|Gemini|Google Gemini).*/i, "").trim();
    if (/^(chatgpt|google gemini|gemini|nuevo chat|new chat|chat|inicio|home)$/i.test(name)) name = "";
    if (!name) name = stripControl(text).trim().split("\n")[0] || "";
    return clipPlain(name, 80);
  }

  function deriveChatFields(text, title) {
    const plain = stripControl(text).trim();
    return {
      nombre_chat: chatNameFrom(title, plain),
      resumen: clipPlain(plain.replace(/\s+/g, " "), 180),
      palabra_clave: keywordFrom(plain),
    };
  }

  function buildEvent(input) {
    const source = input && typeof input === "object" ? input : {};
    const texto = truncateText(source.texto ?? source.text ?? "");
    const event = {
      event_id: clipPlain(source.event_id, 200) || newEventId(),
      tipo: String(source.tipo || source.type || "").trim(),
      miembro: clipPlain(source.miembro || source.member, 120),
      ia: String(source.ia || source.ai || "").trim(),
      conversation_id: clipPlain(source.conversation_id, 500),
      texto,
      tiempo: source.tiempo || source.created_at || localIso(new Date()),
    };
    const nombre = clipPlain(source.nombre_chat || source.conversation_name, 200);
    const resumen = clipPlain(source.resumen, 2000);
    const palabra = clipPlain(source.palabra_clave, 80);
    const proyecto = clipPlain(source.proyecto || source.project, 200);
    if (nombre) event.nombre_chat = nombre;
    if (resumen) event.resumen = resumen;
    if (palabra) event.palabra_clave = palabra;
    if (proyecto) event.proyecto = proyecto;
    return event;
  }

  function validateEvent(event) {
    if (!event || typeof event !== "object") return "cuerpo no válido";
    if (!EVENT_ID_RE.test(event.event_id || "")) return "event_id no válido";
    if (!EVENT_TYPES.includes(event.tipo)) return "tipo no válido";
    if (!event.miembro || Array.from(event.miembro).length > 120 || CONTROL_TEST.test(event.miembro)) {
      return "miembro no válido";
    }
    if (!AI_NAMES.includes(event.ia)) return "ia no válida";
    if (!event.conversation_id || event.conversation_id.length > 500 || CONTROL_TEST.test(event.conversation_id)) {
      return "conversation_id no válido";
    }
    if (typeof event.texto !== "string" || !event.texto.trim()) return "falta texto";
    if (CONTROL_TEST.test(event.texto)) return "texto no válido";
    if (Array.from(event.texto).length > TEXT_LIMIT) return "texto demasiado largo";
    if (typeof event.tiempo !== "string" || event.tiempo.length > 40 || !LOCAL_TIME.test(event.tiempo)) {
      return "tiempo no válido";
    }
    return "";
  }

  function warningKind(tipo) {
    const value = String(tipo || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (value.startsWith("contrad")) return "contradiccion";
    if (value.startsWith("dupl")) return "duplicado";
    if (value.startsWith("falt")) return "falta";
    return "aviso";
  }

  function warningLabel(tipo) {
    const kind = warningKind(tipo);
    if (kind === "contradiccion") return "Contradicción";
    if (kind === "duplicado") return "Duplicado";
    if (kind === "falta") return "Falta";
    return "Aviso";
  }

  function explainHttp(status, serverError) {
    if (status === 401 || serverError === "no autorizado") {
      return "El token no es válido. Revisa el enlace de invitación.";
    }
    if (status === 0 || serverError === "sin conexión") {
      return "No hay conexión con la sala. Puedes reintentar.";
    }
    if (typeof serverError === "string" && serverError.trim()) return serverError.trim();
    return "No se pudo completar la acción.";
  }

  return {
    API_BASE,
    API_HOST,
    TEXT_LIMIT,
    AI_NAMES,
    EVENT_TYPES,
    LOCAL_TIME,
    stripControl,
    clipPlain,
    truncateText,
    localIso,
    newEventId,
    hashText,
    consentKey,
    parseMember,
    parseInvite,
    keywordFrom,
    chatNameFrom,
    deriveChatFields,
    buildEvent,
    validateEvent,
    explainHttp,
    warningKind,
    warningLabel,
  };
});
