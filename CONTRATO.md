# Contrato de Enlaza

Decisiones acordadas para HackaToB 2026 (TEC Cartago, 2 al 6 de noviembre). Este archivo es la referencia común de Persona A y Persona B.

## Producto

- El proyecto se llama **Enlaza**.
- El nombre en código de la sala es `room`.
- La interfaz está en español y en inglés. Hay un control para cambiar de idioma.

## Sala

- El id de la sala lo elige la persona o se genera solo.
- Ese id es el código de invitación.
- Un miembro es el nombre que la persona escribe al entrar. No hay cuentas.
- Los datos de la sala son: tema, miembros con su parte, y fecha de entrega.
- La fecha de entrega es obligatoria. Si no hay fecha, el valor es el texto `sin fecha`.
- La parte de cada persona se asigna sola a partir de su nombre y de lo que está haciendo. Se puede corregir a mano.

Ejemplo de sala:

```json
{
  "id": "demo",
  "tema": "App para repartir tareas de un trabajo",
  "fecha_entrega": "2026-11-06",
  "miembros": [
    { "nombre": "Ana", "parte": "Pantalla de la sala" },
    { "nombre": "Luis", "parte": "Datos" }
  ]
}
```

Con la opción sin fecha, `fecha_entrega` es `"sin fecha"`.

## IAs y eventos

Las IAs válidas son: `chatgpt`, `gemini`, `cursor`, `claude`, `copilot`.

Los tipos de evento son: `prompt`, `respuesta`, `archivo`.

Reglas de cada evento:

- `texto` va en Markdown. Máximo 100.000 caracteres.
- `tiempo` es la hora local, en ISO 8601, con el desfase. Ejemplo: `2026-11-03T09:15:00-06:00`.
- `conversation_id` es el id que ya trae esa IA. Enlaza no lo inventa.
- `event_id` se genera solo. La persona no lo elige. Si el envío falla, se reintenta con el mismo `event_id`.
- `proyecto` es opcional.
- Cada chat (un `conversation_id`) tiene `nombre_chat`, `resumen` y `palabra_clave`.
- Si el chat no tiene nombre, `nombre_chat` se arma solo a partir de lo que la persona preguntó.

Ejemplo de evento (`prompt`):

```json
{
  "event_id": "evt_demo_001",
  "tipo": "prompt",
  "miembro": "Ana",
  "ia": "chatgpt",
  "conversation_id": "chatgpt_abc123",
  "texto": "Arma la pantalla de una sala compartida para un equipo de estudiantes.",
  "tiempo": "2026-11-03T09:15:00-06:00",
  "proyecto": "Enlaza",
  "nombre_chat": "Pantalla de la sala",
  "resumen": "Pedir la pantalla de la sala compartida",
  "palabra_clave": "pantalla"
}
```

Ejemplo de evento (`respuesta`):

```json
{
  "event_id": "evt_demo_002",
  "tipo": "respuesta",
  "miembro": "Ana",
  "ia": "chatgpt",
  "conversation_id": "chatgpt_abc123",
  "texto": "La pantalla puede mostrar el resumen, los avisos y un prompt listo para copiar.",
  "tiempo": "2026-11-03T09:16:10-06:00",
  "proyecto": "Enlaza",
  "nombre_chat": "Pantalla de la sala",
  "resumen": "La pantalla muestra resumen, avisos y prompt",
  "palabra_clave": "pantalla"
}
```

Ejemplo de evento (`archivo`):

```json
{
  "event_id": "evt_demo_003",
  "tipo": "archivo",
  "miembro": "Luis",
  "ia": "cursor",
  "conversation_id": "cursor_def456",
  "texto": "# Datos\n\nCada sala guarda tema, miembros, parte de cada uno y fecha de entrega.",
  "tiempo": "2026-11-03T09:20:00-06:00",
  "nombre_chat": "Modelo de la sala",
  "resumen": "Notas de qué datos guarda una sala",
  "palabra_clave": "datos"
}
```

## Endpoints

### Enviar un evento

`POST /api/rooms/:id/events`

Header obligatorio: `x-room-token`.

El cuerpo es un evento como los de arriba.

Si el token es válido:

```json
{ "ok": true }
```

Si falta el token o no coincide:

HTTP 401

```json
{ "error": "no autorizado" }
```

### Pedir el contexto

`GET /api/rooms/:id/context?member=Nombre`

También lleva `x-room-token`.

La respuesta trae el resumen de la sala, los avisos, la parte de esa persona y un prompt sugerido.

`extension/mock/context.json` es este ejemplo, para `member=Ana`:

```json
{
  "resumen": "El equipo arma una app para repartir tareas de un trabajo. Ana hace la pantalla de la sala. Luis guarda los datos. Nadie definió todavía cómo se muestran los avisos.",
  "parte": "Pantalla de la sala",
  "prompt_sugerido": "Sigue con la pantalla de la sala en español. Muestra el resumen del equipo, los avisos y el prompt sugerido. No cambies cómo se guardan los datos: eso lo está haciendo Luis.",
  "advertencias": [
    {
      "tipo": "falta",
      "mensaje": "Nadie dijo cómo se entera el equipo cuando aparece un aviso nuevo.",
      "destinatario": "Ana",
      "partes": ["Pantalla de la sala", "Avisos"],
      "prompt_sugerido": "Propón una forma simple de mostrar un aviso nuevo en la sala y confírmala con el equipo."
    },
    {
      "tipo": "contradiccion",
      "mensaje": "Ana escribió que el texto máximo es de 10.000 caracteres. El acuerdo es 100.000.",
      "destinatario": "Ana",
      "partes": ["Pantalla de la sala", "Límites"],
      "prompt_sugerido": "Corrige el límite de texto a 100.000 caracteres, como quedó acordado."
    },
    {
      "tipo": "duplicado",
      "mensaje": "Ana y Luis pidieron a sus IAs el mismo diseño de la lista de miembros.",
      "destinatario": "Ana",
      "partes": ["Pantalla de la sala", "Datos"],
      "prompt_sugerido": "Deja la lista de miembros en la pantalla. Pide a Luis que no la vuelva a diseñar en la parte de datos."
    }
  ]
}
```

Cada aviso tiene:

- `tipo`: `falta`, `contradiccion` o `duplicado`
- `mensaje`
- `destinatario`
- `partes`
- `prompt_sugerido`

Las contradicciones se detectan solas y salen como aviso (`tipo`: `contradiccion`).

El contexto se entrega solo al entrar a la sala. La extensión lo pide al conectarse y otra vez cada 30 segundos.

## Token

- Se genera solo. Es largo y aleatorio. Hay uno por sala.
- Va dentro del enlace de invitación: `{URL}/room/{id}?token={token}`
- Al abrir el enlace, la web lo guarda sola.
- La extensión lo recibe cuando la persona pega el enlace una vez. Si queda tiempo, se captura solo.
- Es fijo. No se regenera y no vence.
- Viaja en el header `x-room-token`.

## Errores

Los mensajes de error son cortos y claros, como `no autorizado`.

Si un envío o una lectura falla, se reintenta hasta 3 veces. Después se muestra el error y se puede intentar de nuevo a mano.

## Pruebas sin el servidor real

- Persona B puede mandar eventos a [webhook.site](https://webhook.site) mientras no exista la API.
- La respuesta falsa del contexto está en `extension/mock/context.json`.
- Persona A puede disparar eventos de prueba con `web/scripts/fake-events/send-fake-events.mjs`.

## Reglas del repo

- Hay un solo repo público.
- Las dos personas empujan directo a `main`.
- Cada persona trabaja en su carpeta: Persona A en `web/`, Persona B en `extension/`.
- Nunca se suben claves. Van en `.env`. `.env.example` solo tiene nombres de ejemplo.
- Los commits salen de las dos personas.

## Si vamos tarde

Se corta en este orden:

1. Google Docs
2. Ganchos (Cursor y Claude Code)
3. Gemini
4. Exportar

No se corta la extensión de ChatGPT ni la detección de faltas, contradicciones y duplicados.
