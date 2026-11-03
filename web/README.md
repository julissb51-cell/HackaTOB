# web

**Responsable:** Persona A

App de Next.js para Enlaza. Se publica en Vercel. Usa Supabase para guardar la sala y la API de Grok como analista.

Aquí se reciben los eventos del equipo, se arma el contexto compartido y se devuelve a cada persona su parte, los avisos y un prompt listo para usar.

El script `scripts/fake-events/send-fake-events.mjs` manda eventos de prueba a `POST /api/rooms/:id/events`.
