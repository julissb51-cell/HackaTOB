import assert from "node:assert/strict";
import test from "node:test";
import { getRoomContext, optionsResponse, postAnalyze, postEvent } from "./room-api";
import { createMemoryStore } from "./memory-room-store";
import type { RoomRecord, RoomStore } from "./room-types";

const ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const TOKEN = "token-de-prueba";

const DEMO_CONTEXT = {
  resumen:
    "El equipo trabaja en App para repartir tareas de un trabajo. Ana hace Pantalla de la sala. Luis hace Datos. Hay 3 eventos. El último es de Luis: # Datos Cada sala guarda tema, miembros, parte de cada uno y fecha de entrega.",
  parte: "Pantalla de la sala",
  prompt_sugerido:
    "Sigue con Pantalla de la sala. El trabajo es App para repartir tareas de un trabajo. No cambies Datos: eso lo está haciendo Luis.",
  advertencias: [],
};

test("POST con token bueno responde ok y no duplica el event_id", async () => {
  const { store, events } = demoStore();
  const first = await postEvent(eventRequest(anaPrompt()), "demo", store);
  const second = await postEvent(
    eventRequest({ ...anaPrompt(), texto: "Este reintento no debe reemplazar el texto." }),
    "demo",
    store,
  );

  assert.equal(first.status, 200);
  assert.equal(await first.text(), '{"ok":true}');
  assert.equal(second.status, 200);
  assert.equal(await second.text(), '{"ok":true}');
  assert.equal(events.length, 1);
  assert.equal(events[0]?.text, anaPrompt().texto);
  assert.equal(events[0]?.ai, "chatgpt");
  assert.equal(events[0]?.type, "prompt");
});

test("POST acepta respuesta, archivo y los nombres de columna", async () => {
  const { store, events } = demoStore();
  const respuesta = await postEvent(eventRequest(anaRespuesta()), "demo", store);
  const archivo = await postEvent(eventRequest(luisArchivo()), "demo", store);
  const english = await postEvent(
    eventRequest({
      event_id: "evt_demo_004",
      type: "prompt",
      member: "Luis",
      ai: "cursor",
      conversation_id: "cursor_extra",
      text: "Notas en inglés de campo.",
      created_at: "2026-11-03T09:30:00-06:00",
    }),
    "demo",
    store,
  );

  assert.equal(respuesta.status, 200);
  assert.equal(archivo.status, 200);
  assert.equal(english.status, 200);
  assert.deepEqual(
    events.map((event) => event.type),
    ["respuesta", "archivo", "prompt"],
  );
  assert.equal(events[2]?.member, "Luis");
});

test("POST rechaza token malo, token ausente y sala desconocida con el mismo 401", async () => {
  const { store } = demoStore();
  const bad = await postEvent(eventRequest(anaPrompt(), "token-malo"), "demo", store);
  const missing = await postEvent(eventRequest(anaPrompt(), ""), "demo", store);
  const unknown = await postEvent(eventRequest(anaPrompt()), "no-existe", store);

  for (const response of [bad, missing, unknown]) {
    assert.equal(response.status, 401);
    assert.equal(await response.text(), '{"error":"no autorizado"}');
  }
});

test("POST valida ia, tipo y el largo del texto", async () => {
  const { store } = demoStore();
  const badAi = await postEvent(eventRequest({ ...anaPrompt(), event_id: "evt_ai", ia: "bard" }), "demo", store);
  const badType = await postEvent(
    eventRequest({ ...anaPrompt(), event_id: "evt_tipo", tipo: "nota" }),
    "demo",
    store,
  );
  const tooLong = await postEvent(
    eventRequest({ ...anaPrompt(), event_id: "evt_largo", texto: "a".repeat(100_001) }),
    "demo",
    store,
  );
  const max = await postEvent(
    eventRequest({ ...anaPrompt(), event_id: "evt_max", texto: "a".repeat(100_000) }),
    "demo",
    store,
  );

  assert.equal(badAi.status, 400);
  assert.equal(await badAi.text(), '{"error":"ia no válida"}');
  assert.equal(badType.status, 400);
  assert.equal(await badType.text(), '{"error":"tipo no válido"}');
  assert.equal(tooLong.status, 400);
  assert.equal(await tooLong.text(), '{"error":"texto demasiado largo"}');
  assert.equal(max.status, 200);
});

test("POST con el mismo event_id en otra sala no se guarda", async () => {
  const { store } = createMemoryStore({
    rooms: [demoRoom(), { ...demoRoom(), id: "otra", token: "otro-token-de-prueba" }],
  });
  const first = await postEvent(eventRequest(anaPrompt()), "demo", store);
  const second = await postEvent(eventRequest(anaPrompt(), "otro-token-de-prueba"), "otra", store);
  assert.equal(first.status, 200);
  assert.equal(second.status, 409);
  assert.equal(await second.text(), '{"error":"evento repetido"}');
});

test("un fallo del almacén no devuelve la clave de servicio", async () => {
  const response = await postEvent(eventRequest(anaPrompt()), "demo", brokenStore());
  assert.equal(response.status, 500);
  assert.equal(await response.text(), '{"error":"no se pudo leer la sala"}');
});

test("CORS deja pasar el origen de la extensión y el header x-room-token", async () => {
  const { store } = demoStore();
  const denied = await postEvent(eventRequest(anaPrompt(), "token-malo", ORIGIN), "demo", store);
  const options = optionsResponse(
    new Request("http://localhost:3000/api/rooms/demo/events", {
      method: "OPTIONS",
      headers: {
        origin: ORIGIN,
        "access-control-request-headers": "content-type, x-room-token",
      },
    }),
  );
  const web = optionsResponse(
    new Request("http://localhost:3000/api/rooms/demo/events", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    }),
  );

  assert.equal(denied.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match(denied.headers.get("access-control-allow-headers") ?? "", /x-room-token/);
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match(options.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.match(options.headers.get("access-control-allow-headers") ?? "", /x-room-token/);
  assert.equal(web.headers.get("access-control-allow-origin"), null);
});

test("GET context responde la forma del contrato para Ana", async () => {
  const { store } = demoStore();
  assert.equal((await postEvent(eventRequest(anaPrompt()), "demo", store)).status, 200);
  assert.equal((await postEvent(eventRequest(anaRespuesta()), "demo", store)).status, 200);
  assert.equal((await postEvent(eventRequest(luisArchivo()), "demo", store)).status, 200);

  const response = await getRoomContext(contextRequest(), "demo", store);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.deepEqual(body, DEMO_CONTEXT);
  assert.equal(JSON.stringify(body).includes(TOKEN), false);
});

test("POST analyze exige el token y corre el analista", async () => {
  const { store } = demoStore();
  const calls: string[] = [];
  const bad = await postAnalyze(eventRequest(anaPrompt(), "token-malo"), "demo", store, async (roomId) => {
    calls.push(roomId);
    return true;
  });
  const missing = await postAnalyze(eventRequest(anaPrompt(), ""), "demo", store, async () => true);
  const ok = await postAnalyze(eventRequest(anaPrompt()), "demo", store, async (roomId) => {
    calls.push(roomId);
    return true;
  });
  const failed = await postAnalyze(eventRequest(anaPrompt()), "demo", store, async () => false);

  assert.equal(bad.status, 401);
  assert.equal(await bad.text(), '{"error":"no autorizado"}');
  assert.equal(missing.status, 401);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), '{"ok":true}');
  assert.deepEqual(calls, ["demo"]);
  assert.equal(failed.status, 500);
  assert.equal(await failed.text(), '{"error":"no se pudo analizar"}');
});

test("GET context con token malo responde 401 y con CORS", async () => {
  const { store } = demoStore();
  const response = await getRoomContext(contextRequest("token-malo", ORIGIN), "demo", store);
  assert.equal(response.status, 401);
  assert.equal(await response.text(), '{"error":"no autorizado"}');
  assert.equal(response.headers.get("access-control-allow-origin"), ORIGIN);
});

test("el contexto marca falta, contradicción y duplicado sin llamar a una IA", async () => {
  const { store } = createMemoryStore({
    rooms: [{ ...demoRoom(), dueDate: "sin fecha" }],
    members: [
      { roomId: "demo", name: "Ana", part: "Pantalla de la sala" },
      { roomId: "demo", name: "Luis", part: "Datos" },
    ],
  });

  await postEvent(
    eventRequest({
      ...anaPrompt(),
      event_id: "evt_contra_1",
      texto: "El máximo del texto es de 100.000 caracteres.",
    }),
    "demo",
    store,
  );
  await postEvent(
    eventRequest({
      ...anaPrompt(),
      event_id: "evt_contra_2",
      tipo: "respuesta",
      texto: "Dejé el máximo en 10.000 caracteres.",
    }),
    "demo",
    store,
  );
  await postEvent(
    eventRequest({
      ...anaPrompt(),
      event_id: "evt_dup_ana",
      texto: "Diseña la lista de miembros de la sala compartida",
    }),
    "demo",
    store,
  );
  await postEvent(
    eventRequest({
      ...luisArchivo(),
      event_id: "evt_dup_luis",
      tipo: "prompt",
      texto: "Diseña la lista de miembros para la entrega",
    }),
    "demo",
    store,
  );

  const body = await (await getRoomContext(contextRequest(), "demo", store)).json();
  const types = body.advertencias.map((warning: { tipo: string }) => warning.tipo);
  assert.ok(types.includes("falta"));
  assert.ok(types.includes("contradiccion"));
  assert.ok(types.includes("duplicado"));
  for (const warning of body.advertencias) {
    assert.deepEqual(Object.keys(warning).sort(), [
      "destinatario",
      "mensaje",
      "partes",
      "prioridad",
      "prompt_sugerido",
      "tipo",
    ]);
    assert.equal(warning.destinatario, "Ana");
    assert.ok(Array.isArray(warning.partes));
    assert.equal(typeof warning.mensaje, "string");
    assert.equal(typeof warning.prompt_sugerido, "string");
  }
  const contradiction = body.advertencias.find((warning: { tipo: string }) => warning.tipo === "contradiccion");
  assert.match(contradiction.mensaje, /100000/);
  assert.match(contradiction.mensaje, /10000/);
  assert.match(contradiction.mensaje, /caracteres/);
});

test("un miembro nuevo toma la parte del nombre del chat", async () => {
  const { store } = demoStore();
  const response = await postEvent(
    eventRequest({
      event_id: "evt_sol",
      tipo: "archivo",
      miembro: "Sol",
      ia: "gemini",
      conversation_id: "gemini_1",
      texto: "Notas de la API.",
      tiempo: "2026-11-03T11:00:00-06:00",
      nombre_chat: "API",
    }),
    "demo",
    store,
  );
  assert.equal(response.status, 200);
  const body = await (await getRoomContext(contextRequest(TOKEN, undefined, "Sol"), "demo", store)).json();
  assert.equal(body.parte, "API");
});

test("GET context usa el análisis de la IA y, si la fuente son reglas, conserva el cálculo local", async () => {
  const { store } = demoStore();
  const saved = {
    fuente: "ia" as const,
    resumen: "Resumen de la IA",
    miembros: [
      {
        nombre: "Ana",
        resumen: "Ana arma la pantalla.",
        parte: "Pantalla de la sala",
        prompt_sugerido: "Sigue con la pantalla.",
        advertencias: [],
      },
    ],
    alertas: [],
    chats: [],
    sugerencia: null,
    sugerenciaEstado: "ninguna" as const,
    consejo: "",
    idioma: "es" as const,
    pending: false,
    ranAt: "2026-11-03T12:00:00.000Z",
  };
  const withAi: RoomStore = { ...store, async readAnalysis() { return saved; } };
  const aiBody = await (await getRoomContext(contextRequest(), "demo", withAi)).json();
  assert.equal(aiBody.resumen, "Ana arma la pantalla.");
  assert.equal(aiBody.parte, "Pantalla de la sala");
  assert.equal(aiBody.prompt_sugerido, "Sigue con la pantalla.");
  assert.deepEqual(aiBody.advertencias, []);
  assert.deepEqual(Object.keys(aiBody).sort(), ["advertencias", "parte", "prompt_sugerido", "resumen"]);

  const withRules: RoomStore = {
    ...store,
    async readAnalysis() {
      return { ...saved, fuente: "reglas", resumen: "no debe usarse" };
    },
  };
  const rulesBody = await (await getRoomContext(contextRequest(), "demo", withRules)).json();
  assert.match(rulesBody.resumen, /El equipo trabaja en App para repartir/);
  assert.equal(rulesBody.resumen.includes("no debe usarse"), false);
});

function demoRoom(): RoomRecord {
  return {
    id: "demo",
    token: TOKEN,
    topic: "App para repartir tareas de un trabajo",
    projectName: "Enlaza",
    dueDate: "2026-11-06",
  };
}

function demoStore() {
  return createMemoryStore({
    rooms: [demoRoom()],
    members: [
      { roomId: "demo", name: "Ana", part: "Pantalla de la sala" },
      { roomId: "demo", name: "Luis", part: "Datos" },
    ],
  });
}

function brokenStore(): RoomStore {
  const fail = async (): Promise<never> => {
    throw new Error("faltan SUPABASE_SERVICE_ROLE_KEY");
  };
  return {
    getRoom: fail,
    insertEvent: fail,
    ensureMember: fail,
    listMembers: fail,
    listEvents: fail,
  };
}

function eventRequest(body: unknown, token = TOKEN, origin?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("x-room-token", token);
  if (origin) headers.set("origin", origin);
  return new Request("http://localhost:3000/api/rooms/demo/events", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function contextRequest(token = TOKEN, origin?: string, member = "Ana"): Request {
  const headers = new Headers();
  if (token) headers.set("x-room-token", token);
  if (origin) headers.set("origin", origin);
  return new Request(`http://localhost:3000/api/rooms/demo/context?member=${encodeURIComponent(member)}`, {
    headers,
  });
}

function anaPrompt() {
  return {
    event_id: "evt_demo_001",
    tipo: "prompt",
    miembro: "Ana",
    ia: "chatgpt",
    conversation_id: "chatgpt_abc123",
    texto: "Arma la pantalla de una sala compartida para un equipo de estudiantes.",
    tiempo: "2026-11-03T09:15:00-06:00",
    proyecto: "Enlaza",
    nombre_chat: "Pantalla de la sala",
    resumen: "Pedir la pantalla de la sala compartida",
    palabra_clave: "pantalla",
  };
}

function anaRespuesta() {
  return {
    event_id: "evt_demo_002",
    tipo: "respuesta",
    miembro: "Ana",
    ia: "chatgpt",
    conversation_id: "chatgpt_abc123",
    texto: "La pantalla puede mostrar el resumen, los avisos y un prompt listo para copiar.",
    tiempo: "2026-11-03T09:16:10-06:00",
    proyecto: "Enlaza",
    nombre_chat: "Pantalla de la sala",
    resumen: "La pantalla muestra resumen, avisos y prompt",
    palabra_clave: "pantalla",
  };
}

function luisArchivo() {
  return {
    event_id: "evt_demo_003",
    tipo: "archivo",
    miembro: "Luis",
    ia: "cursor",
    conversation_id: "cursor_def456",
    texto: "# Datos\n\nCada sala guarda tema, miembros, parte de cada uno y fecha de entrega.",
    tiempo: "2026-11-03T09:20:00-06:00",
    nombre_chat: "Modelo de la sala",
    resumen: "Notas de qué datos guarda una sala",
    palabra_clave: "datos",
  };
}
