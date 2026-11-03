# web

**Responsable:** Persona A

App de Next.js (App Router, TypeScript y Tailwind) para Enlaza. Se publica en Vercel con el directorio raíz `web`. Supabase guarda la sala. El analista usa la API gratuita de Gemini. Para pasar a Grok basta con cambiar variables de entorno.

Los endpoints de [CONTRATO.md](../CONTRATO.md) quedan para la fase siguiente. Esta fase deja la app, los clientes y el esquema.

El script `scripts/fake-events/send-fake-events.mjs` manda eventos de prueba a `POST /api/rooms/:id/events`. Esa ruta todavía no existe.

## Cómo correrlo en local

Desde la carpeta `web`:

```bash
npm install
cp ../.env.example .env.local
npm run dev
```

La app abre en [http://localhost:3000](http://localhost:3000). Completa `web/.env.local` con las claves reales. Ese archivo no se sube. Next.js lee las variables desde `web/`, no desde la raíz del repo.

## Esquema en Supabase

1. Abre el proyecto en Supabase.
2. Entra al SQL Editor.
3. Pega el contenido de `supabase/schema.sql`.
4. Ejecuta la consulta.

El script crea `rooms`, `members` y `events`, y activa Realtime en `events`.

`rooms.due_date` acepta una fecha `AAAA-MM-DD`, el texto `sin fecha`, o queda vacío. `events.created_at` guarda la hora local en ISO 8601 con desfase, por ejemplo `2026-11-03T09:15:00-06:00`. `events.text` admite hasta 100.000 caracteres. `events.type` es `prompt`, `respuesta` o `archivo`.

## Variables de entorno

En local van en `web/.env.local`. En Vercel se cargan en Environment Variables del proyecto.

- `SUPABASE_URL`: URL del proyecto de Supabase.
- `SUPABASE_ANON_KEY`: clave anónima. Puede usarse en el navegador.
- `SUPABASE_SERVICE_ROLE_KEY`: clave de servicio. Solo en el servidor (`lib/supabase/server.ts`).
- `AI_PROVIDER`: `gemini` o `xai`. Si se omite, queda `gemini`.
- `GEMINI_API_KEY`: clave de Gemini. Hace falta cuando el proveedor es `gemini`.
- `XAI_API_KEY`: clave de Grok. Hace falta cuando el proveedor es `xai`.

La clave gratuita de Gemini se crea en [Google AI Studio](https://aistudio.google.com/apikey).

`lib/ai.ts` lee `AI_PROVIDER`. Con `gemini` llama a la API de Gemini (`gemini-3.8-flash`). Con `xai` llama a `https://api.x.ai/v1/chat/completions` (compatible con OpenAI, modelo `grok-4.7`). No hace falta cambiar código para pasar de uno a otro.

`lib/supabase/client.ts` crea el cliente con la clave anónima. `lib/supabase/server.ts` crea el cliente con la clave de servicio.

## Vercel

1. Importa el repositorio de GitHub.
2. En la configuración del proyecto, pon Root Directory = `web`.
3. El framework es Next.js.
4. Carga las variables de la lista anterior.
5. Publica.

`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` y `XAI_API_KEY` se usan solo en el servidor.
