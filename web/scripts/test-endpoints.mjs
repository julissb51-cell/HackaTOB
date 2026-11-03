// Prueba las rutas con el servidor en marcha y la sala demo creada.
//
// Desde web/, en otra terminal mientras corre `npm run dev`:
//   npm run test:api
//
// Variables:
//   BASE_URL   http://localhost:3000
//   ROOM_ID    demo
//   ROOM_TOKEN token-de-prueba

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const roomId = process.env.ROOM_ID || "demo";
const token = process.env.ROOM_TOKEN || "token-de-prueba";
const origin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const roomUrl = `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}`;

const event = {
  event_id: `evt_test_${Date.now()}`,
  tipo: "prompt",
  miembro: "Ana",
  ia: "chatgpt",
  conversation_id: "chatgpt_test",
  texto: "Prueba de la ruta de eventos.",
  tiempo: "2026-11-03T10:00:00-06:00",
  nombre_chat: "Prueba",
};

let failed = 0;

await check("OPTIONS permite el origen de la extensión y x-room-token", async () => {
  const response = await fetch(`${roomUrl}/events`, {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type, x-room-token",
    },
  });
  assert(response.status === 204, `estado ${response.status}`);
  assert(response.headers.get("access-control-allow-origin") === origin, "falta el origen");
  const allowHeaders = response.headers.get("access-control-allow-headers") ?? "";
  assert(/x-room-token/i.test(allowHeaders), `headers ${allowHeaders}`);
});

await check("POST con token malo responde 401", async () => {
  const { status, body } = await postEvent("token-malo", event);
  assert(status === 401, `estado ${status}`);
  assert(body.error === "no autorizado", JSON.stringify(body));
});

await check("POST con token bueno responde ok", async () => {
  const { status, body } = await postEvent(token, event);
  assert(status === 200, `estado ${status}`);
  assert(body.ok === true, JSON.stringify(body));
});

await check("repetir el mismo event_id sigue en ok", async () => {
  const { status, body } = await postEvent(token, event);
  assert(status === 200, `estado ${status}`);
  assert(body.ok === true, JSON.stringify(body));
});

await check("GET context con token malo responde 401", async () => {
  const response = await fetch(`${roomUrl}/context?member=Ana`, {
    headers: { "x-room-token": "token-malo", origin },
  });
  const body = await response.json();
  assert(response.status === 401, `estado ${response.status}`);
  assert(body.error === "no autorizado", JSON.stringify(body));
  assert(response.headers.get("access-control-allow-origin") === origin, "el 401 no trae CORS");
});

await check("GET context trae la forma del contrato", async () => {
  const response = await fetch(`${roomUrl}/context?member=${encodeURIComponent("Ana")}`, {
    headers: { "x-room-token": token },
  });
  const body = await response.json();
  assert(response.status === 200, `estado ${response.status} ${JSON.stringify(body)}`);
  assert(typeof body.resumen === "string" && body.resumen.length > 0, "falta resumen");
  assert(typeof body.parte === "string" && body.parte.length > 0, "falta parte");
  assert(typeof body.prompt_sugerido === "string" && body.prompt_sugerido.length > 0, "falta prompt");
  assert(Array.isArray(body.advertencias), "advertencias no es una lista");
  const keys = Object.keys(body).sort();
  assert(keys.join() === "advertencias,parte,prompt_sugerido,resumen", keys.join());
  for (const warning of body.advertencias) {
    assert(["falta", "contradiccion", "duplicado"].includes(warning.tipo), warning.tipo);
    assert(typeof warning.mensaje === "string", "falta mensaje");
    assert(typeof warning.destinatario === "string", "falta destinatario");
    assert(Array.isArray(warning.partes), "faltan partes");
    assert(typeof warning.prompt_sugerido === "string", "falta prompt del aviso");
  }
  console.log(JSON.stringify(body, null, 2));
});

if (failed > 0) {
  console.error(`${failed} prueba(s) fallaron.`);
  process.exit(1);
}
console.log("Pruebas de la API en orden.");

async function check(name, fn) {
  try {
    await fn();
    console.log(`ok  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`fallo  ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

async function postEvent(roomToken, payload) {
  const response = await fetch(`${roomUrl}/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-room-token": roomToken,
      origin,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
