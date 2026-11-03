# web

**Responsable:** Persona A

App de Next.js (App Router, TypeScript y Tailwind) para Enlaza. Se publica en Vercel con el directorio raíz `web`. Supabase guarda la sala. El analista usa la API gratuita de Gemini. Para pasar a Grok basta con cambiar variables de entorno.

Los endpoints de [CONTRATO.md](../CONTRATO.md) viven en `app/api/rooms/[id]/events` y `app/api/rooms/[id]/context`. El contexto de esta fase se arma con los eventos guardados, sin llamar al analista. Gemini o Grok entran en una fase posterior.

El script `scripts/fake-events/send-fake-events.mjs` manda los tres eventos de ejemplo a `POST /api/rooms/:id/events`.

## Cómo correrlo en local

Desde la carpeta `web`:

```bash
npm install
cp ../.env.example .env.local
npm run dev
```

La app abre en [http://localhost:3000](http://localhost:3000). Completa `web/.env.local` con las claves reales. Ese archivo no se sube. Next.js lee las variables desde `web/`, no desde la raíz del repo.

## Esquema en Supabase

Base nueva:

1. Abre el proyecto en Supabase.
2. Entra al SQL Editor.
3. Pega el contenido de `supabase/schema.sql`.
4. Ejecuta la consulta.
5. Pega `supabase/seed-demo.sql` y ejecútalo para crear la sala de prueba.

Si las tablas ya existían con el esquema anterior, no vuelvas a correr `schema.sql`. Pega y ejecuta `supabase/phase-3-rooms.sql`. Ese archivo agrega `rooms.created_by`, `rooms.parts` y `members.user_id`, y se puede ejecutar más de una vez. La fecha de entrega sigue en `rooms.due_date`. No hay una columna `rooms.date`.

El script crea `rooms`, `members` y `events`, y activa Realtime en `events`.

`rooms.due_date` acepta una fecha `AAAA-MM-DD`, el texto `sin fecha`, o queda vacío. `events.created_at` guarda la hora local en ISO 8601 con desfase, por ejemplo `2026-11-03T09:15:00-06:00`. `events.text` admite hasta 100.000 caracteres. `events.type` es `prompt`, `respuesta` o `archivo`. `events.event_id` es el id del contrato, por ejemplo `evt_demo_001`. Si el envío se reintenta, usa el mismo id y no crea otra fila.

Si `events` ya existía con `event_id` de tipo uuid, `supabase/seed-demo.sql` lo pasa a text. Sin ese cambio, un id como `evt_demo_001` no se puede guardar.

Las tablas tienen Row Level Security. `anon` no puede leerlas ni escribirlas. `authenticated` solo puede leer, y solo las salas en las que participa: columnas de la sala sin `token`, y las filas de `members`. No puede insertar ni cambiar nada. Así `rooms.token` no queda abierto en la Data API. La API usa la clave de servicio, solo en el servidor, y compara `x-room-token` con `rooms.token`. La función `private.can_read_room` vive fuera de `public` para que la política no se llame a sí misma. No expongas el esquema `private` en la Data API.

Los endpoints de eventos y de contexto no cambian en esta fase.

## Cuenta de Google

Crear una sala y aceptar una invitación piden una cuenta de Google. La sesión usa Supabase Auth con `@supabase/ssr`. El id y el secreto del cliente de Google no van en `.env`. Se pegan en el panel de Supabase.

1. En [Google Auth Platform](https://console.cloud.google.com/auth/clients), crea un cliente OAuth de tipo aplicación web. Si el menú todavía dice Credenciales, el camino es APIs y servicios, Credenciales, Crear credenciales, ID de cliente de OAuth.
2. En orígenes de JavaScript autorizados agrega `http://localhost:3000` y `https://TU_DOMINIO.vercel.app`.
3. En URIs de redireccionamiento autorizados agrega solo el callback de Supabase: `https://TU_PROJECT_REF.supabase.co/auth/v1/callback`. No pongas ahí `localhost` ni el dominio de Vercel. Ese mismo valor aparece en Supabase → Authentication → Sign In / Providers → Google, como Callback URL.
4. En Data Access deja estos ámbitos: `openid`, `.../auth/userinfo.email` y `.../auth/userinfo.profile`.
5. Copia el Client ID y el Client Secret.
6. En Supabase → Authentication → Sign In / Providers → Google, activa el proveedor, pega el Client ID y el Client Secret, y guarda.
7. En Supabase → Authentication → URL Configuration:
   - Site URL en local: `http://localhost:3000`.
   - Site URL al publicar: `https://TU_DOMINIO.vercel.app`.
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://TU_DOMINIO.vercel.app/auth/callback`, `http://localhost:3000/**` y `https://TU_DOMINIO.vercel.app/**`.

Las dos direcciones con `/**` dejan volver a la invitación después de Google. La ruta de regreso es `/auth/callback`.

`/auth/login` manda a Google. `/auth/callback` cambia el código por la sesión. `/auth/logout` cierra la sesión. Sin `SUPABASE_URL` o `SUPABASE_ANON_KEY`, esas rutas responden que faltan las claves.

## Salas

Con la sesión iniciada, `/rooms/new` pide tema, partes y fecha de entrega. Las partes son la lista de tareas. Puede ir vacía. Si no hay fecha, se guarda `sin fecha`. El código de la sala es opcional: si se deja vacío, se genera solo. El token se genera una vez, es largo y no vence. Quien crea la sala queda como miembro, con el nombre de su cuenta de Google.

Después se muestra el enlace `/join/{id}?t={token}`, un botón para copiarlo, y el id y el token para la extensión. La web guarda el token al crear la sala y al abrir el enlace.

`/room/{id}?token={token}`, el enlace del contrato, entra por el mismo camino. También vale `?t=`.

Si la persona no tiene sesión, el enlace la manda a Google y la regresa. Al volver queda como miembro y la app abre `/rooms/{id}`. Esa pantalla lista miembros y partes. La vista en vivo llega en la siguiente fase.

## Endpoints

Las dos rutas exigen el header `x-room-token`. Si falta, si la sala no existe o si el token no coincide, la respuesta es 401:

```json
{ "error": "no autorizado" }
```

### `POST /api/rooms/:id/events`

Guarda un evento. El cuerpo es el del contrato. También acepta los nombres de columna (`type`, `ai`, `text`, `member`, `created_at`, `conversation_name`) si el cliente ya los manda así.

- `ia`: `chatgpt`, `gemini`, `cursor`, `claude` o `copilot`.
- `tipo`: `prompt`, `respuesta` o `archivo`.
- `texto`: texto de hasta 100.000 caracteres.
- `tiempo`: hora local en ISO 8601 con desfase, o `Z`.
- `event_id`: id del envío. Un reintento con el mismo id responde otra vez `{ "ok": true }` y no duplica la fila.

Si el token es válido y el cuerpo cumple esas reglas:

```json
{ "ok": true }
```

`proyecto`, `resumen` y `palabra_clave` se aceptan y se revisan, pero esta fase no los guarda. El nombre del chat se guarda en `events.conversation_name`. Si el miembro no tenía parte, ese nombre se usa como parte.

Un cuerpo imposible de leer o un campo inválido responde 400 con `{ "error": "..." }`.

### `GET /api/rooms/:id/context?member=Nombre`

Devuelve el contexto de esa persona. Las claves son las de CONTRATO.md:

- `resumen`
- `parte`
- `prompt_sugerido`
- `advertencias` (lista de avisos con `tipo`, `mensaje`, `destinatario`, `partes` y `prompt_sugerido`)

`tipo` de un aviso es `falta`, `contradiccion` o `duplicado`.

La lógica es fija, sin el analista:

- Falta la fecha, o alguien de la sala todavía no envió eventos.
- Dos textos dan cifras distintas para la misma palabra, por ejemplo `10.000 caracteres` y `100.000 caracteres`.
- Dos miembros mandaron prompts muy parecidos.

Con los tres eventos de ejemplo y la sala demo, Ana recibe esto:

```json
{
  "resumen": "El equipo trabaja en App para repartir tareas de un trabajo. Ana hace Pantalla de la sala. Luis hace Datos. Hay 3 eventos. El último es de Luis: # Datos Cada sala guarda tema, miembros, parte de cada uno y fecha de entrega.",
  "parte": "Pantalla de la sala",
  "prompt_sugerido": "Sigue con Pantalla de la sala. El trabajo es App para repartir tareas de un trabajo. No cambies Datos: eso lo está haciendo Luis.",
  "advertencias": []
}
```

Esos tres eventos no disparan avisos. La lista queda vacía y sigue siendo la forma del contrato.

### CORS

La extensión llama a estas rutas desde un origen `chrome-extension://` más su id (32 letras de la a a la p). La respuesta repite ese origen en `Access-Control-Allow-Origin` y permite los headers `Content-Type` y `x-room-token`. `OPTIONS` responde 204. Otro origen no recibe ese permiso. La llamada tiene que salir del service worker de la extensión, no de la página de la IA.

## Sala demo

Id `demo`, token `token-de-prueba`. Ana tiene la parte «Pantalla de la sala» y Luis tiene «Datos». El tema es «App para repartir tareas de un trabajo» y la fecha es `2026-11-06`.

Ese token es solo para pruebas. No lo uses en una sala real.

Con el esquema ya aplicado y las claves en `web/.env.local`:

```bash
npm run seed
```

Ese comando no cambia el tipo de `event_id`. Si la columna sigue siendo uuid, usa `supabase/seed-demo.sql` en el SQL Editor.

## Cómo probar

### Sin Supabase

Desde `web`:

```bash
npm test
```

Esas pruebas cubren el 200 `{ "ok": true }`, el 401 `{ "error": "no autorizado" }`, la validación de `ia`, `tipo` y el largo del texto, la forma del contexto y el CORS de la extensión. También cubren el alta de la sala, el enlace de invitación y el ingreso del miembro. No llaman a Supabase.

### Con el servidor

1. Aplica `supabase/schema.sql` y `supabase/seed-demo.sql`, o `npm run seed` si el esquema nuevo ya está aplicado.
2. Completa `web/.env.local`.
3. En una terminal: `npm run dev`.
4. En otra, desde `web`:

```bash
npm run test:api
node scripts/fake-events/send-fake-events.mjs
```

`npm run test:api` hace la prueba manual contra el servidor: 401 con token malo, 200 con token bueno, la misma respuesta al reintentar, y la forma del contexto. El script de eventos manda los tres ejemplos y termina con error si la respuesta no es `{ "ok": true }`.

También se puede mirar a mano:

```bash
curl -sS -i -X POST "http://localhost:3000/api/rooms/demo/events" \
  -H "content-type: application/json" \
  -H "origin: chrome-extension://abcdefghijklmnopabcdefghijklmnop" \
  -H "x-room-token: token-malo" \
  -d '{"event_id":"evt_curl_401","tipo":"prompt","miembro":"Ana","ia":"chatgpt","conversation_id":"chatgpt_abc123","texto":"Hola","tiempo":"2026-11-03T09:15:00-06:00"}'
```

La respuesta es 401, el cuerpo es `{"error":"no autorizado"}` y aparece `Access-Control-Allow-Origin` con el origen de la extensión.

```bash
curl -sS -X POST "http://localhost:3000/api/rooms/demo/events" \
  -H "content-type: application/json" \
  -H "x-room-token: token-de-prueba" \
  -d '{"event_id":"evt_demo_001","tipo":"prompt","miembro":"Ana","ia":"chatgpt","conversation_id":"chatgpt_abc123","texto":"Arma la pantalla de una sala compartida para un equipo de estudiantes.","tiempo":"2026-11-03T09:15:00-06:00","nombre_chat":"Pantalla de la sala"}'
```

La respuesta es `{"ok":true}`.

```bash
curl -sS "http://localhost:3000/api/rooms/demo/context?member=Ana" \
  -H "x-room-token: token-de-prueba"
```

La respuesta trae `resumen`, `parte`, `prompt_sugerido` y `advertencias`.

## Variables de entorno

En local van en `web/.env.local`. En Vercel se cargan en Environment Variables del proyecto.

- `SUPABASE_URL`: URL del proyecto de Supabase.
- `SUPABASE_ANON_KEY`: clave anónima. Puede usarse en el navegador. Con este esquema no abre las tablas.
- `SUPABASE_SERVICE_ROLE_KEY`: clave de servicio. Solo en el servidor (`lib/supabase/server.ts`). Las rutas de la sala la usan para leer y escribir.
- `AI_PROVIDER`: `gemini` o `xai`. Si se omite, queda `gemini`.
- `GEMINI_API_KEY`: clave de Gemini. Hace falta cuando el proveedor es `gemini`.
- `XAI_API_KEY`: clave de Grok. Hace falta cuando el proveedor es `xai`.

La clave gratuita de Gemini se crea en [Google AI Studio](https://aistudio.google.com/apikey).

`lib/ai.ts` lee `AI_PROVIDER`. Con `gemini` llama a la API de Gemini (`gemini-3.8-flash`). Con `xai` llama a `https://api.x.ai/v1/chat/completions` (compatible con OpenAI, modelo `grok-4.7`). No hace falta cambiar código para pasar de uno a otro. Estas rutas todavía no llaman al analista.

`lib/supabase/client.ts` crea el cliente con la clave anónima. `lib/supabase/server.ts` crea el cliente con la clave de servicio. La sesión de Google usa otro cliente, el de `@supabase/ssr`, con la misma clave anónima y cookies. La clave de servicio no entra en esa sesión.

El Client ID y el Client Secret de Google no son variables de esta app. Viven solo en el proveedor Google de Supabase.

## Vercel

1. Importa el repositorio de GitHub.
2. En la configuración del proyecto, pon Root Directory = `web`.
3. El framework es Next.js.
4. Carga las variables de la lista anterior.
5. Publica.

`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` y `XAI_API_KEY` se usan solo en el servidor. Sin la clave de servicio, las rutas de la sala responden que no pudieron leer o guardar.
