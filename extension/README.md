# extension

**Responsable:** Persona B

Extensión de Chrome (Manifest V3) para Enlaza. Lee los prompts que envías y las respuestas que terminan en ChatGPT y Gemini en la web, los manda a la sala y pide el contexto al conectar y cada 30 segundos.

Los ganchos de Cursor y Claude Code están en `hooks/` y no se cargan: el manifiesto no los incluye.

`mock/context.json` es la respuesta de ejemplo de `GET /api/rooms/:id/context?member=Ana`, la misma del contrato.

## Instalar

1. Abre `chrome://extensions`.
2. Activa el **Modo de desarrollador**.
3. Elige **Cargar extensión sin empaquetar** (Load unpacked).
4. Selecciona la carpeta `extension` de este repo (la que contiene `manifest.json`).

El ícono de Enlaza queda en la barra. No hace falta compilar nada. Si ChatGPT o Gemini ya estaban abiertos, recarga esas pestañas.

## Actualizar

Después de un `git pull`:

1. Abre `edge://extensions` (o `chrome://extensions`).
2. En la tarjeta de Enlaza pulsa **Actualizar**. La versión tiene que decir 1.1.0.
3. Recarga la pestaña de ChatGPT con F5.

El ícono muestra cuántos eventos se enviaron. El panel, arriba, dice «Eventos enviados: N» y si el lector ve los mensajes de esa pestaña. El resumen de la sala también cuenta los eventos guardados («Hay N eventos») mientras el analista no lo reescriba; el número del ícono no depende de ese texto.

## Conectar

1. En la web, copia el enlace de invitación. Se ve así: `https://enlaza-green.vercel.app/join/{sala}?t={token}`.
2. Abre el popup de Enlaza.
3. Pega el enlace y escribe tu nombre.
4. Pulsa **Conectar**. La primera vez, Enlaza explica que va a compartir los prompts y las respuestas de ChatGPT y Gemini con la sala. Acepta para empezar.
5. **Ver contexto** abre el panel lateral: resumen, tu parte, avisos y el prompt sugerido.
6. **Copiar** copia el prompt. **Insertar en el chat** lo pone en la caja de ChatGPT o Gemini de la pestaña activa, sin enviarlo.
7. **Desconectar** deja de capturar. El enlace queda en el formulario por si quieres cambiar de sala o de nombre.

El token se guarda solo en `chrome.storage.local` de este navegador. No va en el repo.

Si el token no corresponde a la sala, ves: «El token no es válido. Revisa el enlace de invitación.»

## Sala de prueba

Enlace:

`https://enlaza-green.vercel.app/join/demo?t=token-de-prueba`

Nombre: `Ana`

Esa sala ya existe en producción (`salaId` `demo`, token `token-de-prueba`). El token de prueba es público; no es una clave del proyecto.

Para probar el formato sin abrir Chrome:

```bash
node extension/scripts/smoke.mjs
```

El script arma el evento con el mismo código que la extensión (`extension/lib/core.js`), hace `POST /api/rooms/demo/events` y `GET /api/rooms/demo/context?member=Ana`, reenvía el mismo `event_id` y prueba un token malo.

## Qué se envía

`POST /api/rooms/{salaId}/events` con el header `x-room-token`.

El cuerpo sigue el contrato: `event_id`, `tipo` (`prompt` o `respuesta`), `miembro`, `ia` (`chatgpt` o `gemini`), `conversation_id`, `texto` (como máximo 100.000 caracteres), `tiempo` (ISO 8601 con desfase) y, si salen, `nombre_chat`, `resumen` y `palabra_clave`.

El `event_id` se genera en el navegador. Si el envío falla, se reintenta hasta 3 veces con el mismo id. Un id repetido lo ignora el servidor. Después de 3 intentos, el popup muestra el error y **Reintentar envíos** vuelve a mandarlos.

Las peticiones salen del service worker, no de la página, para no depender de CORS.

El contexto (`resumen`, `parte`, `prompt_sugerido`, `advertencias`) se pide al conectar y otra vez cada 30 segundos.

Solo se captura con la sesión conectada y el consentimiento aceptado. Lo que ya estaba en el chat al conectar no se reenvía: cuentan los prompts y las respuestas que aparecen después.

## Limitaciones

- Los selectores del DOM están aislados en `content/chatgpt/selectors.js` y `content/gemini/selectors.js`. El chat de ChatGPT de noviembre 2026 usa `[data-user-message-bubble]` y `[data-content-search-unit-key$=":assistant"]`. Si la página cambia otra vez, se ajustan ahí. El prompt también se lee de la caja al pulsar Enter o Enviar, por si el globo cambia de nuevo.
- Si no aparece el botón de parar, la extensión espera a que el texto deje de cambiar unos 2,5 segundos antes de mandar la respuesta.
- En un chat nuevo, espera hasta 12 segundos a que la página ponga el id en la URL. Si no aparece, usa un id local de esa pestaña (`chatgpt_local_…` o `gemini_local_…`). Enlaza no inventa el id cuando el sitio sí lo trae.
- Insertar el prompt depende de la caja de texto (`#prompt-textarea` en ChatGPT, el editor de Gemini). No aprieta Enviar.
- No captura archivos (`tipo: archivo`) ni otras IAs. Cursor y Claude quedan como ganchos, sin activar.
- No cubre `chat.openai.com`. La página que vale es `https://chatgpt.com`.
- En Chrome anterior a la versión 120, la alarma del navegador puede despertar el service worker cada minuto en lugar de cada 30 segundos. Mientras el worker sigue vivo, el intervalo interno sigue siendo de 30 segundos.
