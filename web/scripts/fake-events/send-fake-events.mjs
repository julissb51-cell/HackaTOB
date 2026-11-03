// Envía eventos de prueba a POST /api/rooms/:id/events
//
// Antes, crea la sala demo (id demo, token token-de-prueba):
//   npm run seed
// o pega web/supabase/seed-demo.sql en el SQL Editor.
//
// Uso, desde web/, con `npm run dev` en otra terminal:
//   node scripts/fake-events/send-fake-events.mjs
//
// BASE_URL por defecto: http://localhost:3000
// ROOM_ID por defecto: demo
// ROOM_TOKEN por defecto: token-de-prueba

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const roomId = process.env.ROOM_ID || "demo";
const token = process.env.ROOM_TOKEN || "token-de-prueba";

const events = [
  {
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
  },
  {
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
  },
  {
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
  },
];

const url = `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/events`;

for (const event of events) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-room-token": token,
      },
      body: JSON.stringify(event),
    });
    const body = await response.text();
    console.log(`${response.status} ${event.tipo} ${event.event_id}`);
    console.log(body);
    if (!accepted(response.status, body)) {
      if (response.status === 401) {
        console.error("El token no coincide con la sala. Crea la sala demo con npm run seed.");
      }
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`No se pudo enviar ${event.event_id}: ${error.message}`);
    process.exitCode = 1;
  }
}

function accepted(status, body) {
  if (status !== 200) return false;
  try {
    return JSON.parse(body).ok === true;
  } catch {
    return false;
  }
}
