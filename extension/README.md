# Enlaza, la extensión

La extensión de Chrome (Manifest V3) lee los prompts y las respuestas que terminan en ChatGPT y Gemini, y los manda a la sala compartida. El panel lateral muestra el resumen del equipo, los avisos y un prompt listo para copiar o insertar.

Los ganchos de Cursor y Claude Code hacen lo mismo desde el editor. No van en el manifiesto: son scripts de Node.

## Instalar

En Chrome o en Edge:

1. Abrí `chrome://extensions` o `edge://extensions`.
2. Activá el **Modo de desarrollador** (en Edge: **Opciones de desarrollador**).
3. Elegí **Cargar extensión sin empaquetar** (Load unpacked).
4. Seleccioná la carpeta `extension` de este repo, la que tiene `manifest.json`.

No hace falta compilar. La versión actual es 1.6.18. Si ChatGPT, Gemini, Claude o Copilot ya estaban abiertos, recargá esas pestañas.

<!-- TODO: captura de edge://extensions con Enlaza cargada -->
![Extensión cargada](docs/extensiones.png)

## Entrar a una sala

1. En la web, copiá el enlace de invitación. Se ve así: `https://enlaza-green.vercel.app/join/{salaId}?t={token}`. También sirve el del contrato, `/room/{salaId}?token={token}`.
2. Abrí el popup de Enlaza.
3. Pegá el enlace y escribí tu nombre. Si no tenés el enlace, el popup igual pide el enlace completo: de ahí salen el id de la sala y el token.
4. Pulsá **Conectar**. La primera vez, para esa sala y ese nombre, Enlaza pide consentimiento.
5. **Desconectar** deja de capturar y deja el enlace en el formulario por si querés cambiar de sala o de nombre.

El token queda solo en `chrome.storage.local` de este navegador. No va en el repo.

<!-- TODO: captura del popup con el enlace y el nombre -->
![Conectar](docs/conectar.png)

## Qué se captura

Solo con la sesión conectada y el consentimiento aceptado. Enlaza lee los prompts que enviás y las respuestas que ya terminaron en ChatGPT (`chatgpt.com`), Gemini (`gemini.google.com`), Claude (`claude.ai`) y Copilot (`copilot.com`). No lee otras páginas. Lo que ya estaba en el chat al conectar no se reenvía.

Cada evento sigue [CONTRATO.md](../CONTRATO.md): `event_id`, `tipo` (`prompt` o `respuesta`), `miembro`, `ia` (`chatgpt` o `gemini`), `conversation_id`, `texto` (máximo 100.000 caracteres) y `tiempo` (ISO 8601 con desfase). Si salen, también van `nombre_chat`, `resumen` y `palabra_clave`.

El envío sale del service worker, con el header `x-room-token`. Si falla, se reintenta hasta 3 veces con el mismo `event_id`. Lo que no salió queda en `chrome.storage` y se vuelve a intentar cuando el service worker despierta. **Reintentar envíos**, en el popup, lo manda a mano.

## Enviar a Enlaza

En ChatGPT el botón **Enlaza** queda al lado de «Añadir archivos y más». En Gemini queda al lado de «Cargas y herramientas». En Copilot queda al lado de «+». También aparece junto a un archivo o un enlace `https` del chat. Lo manda a Archivos de la sala conectada. Si no hay sesión, dice que primero conectes una sala. Si el enlace ya estaba, avisa sin tratarlo como error. Un archivo de más de 10 MB no se sube.

## Panel lateral

**Ver contexto**, o el ícono del panel de Chrome, abre el resumen de la sala.

- **Resumen** y **Mi parte**.
- **Avisos**, con tres tipos distintos: Falta (ámbar), Contradicción (rojo) y Duplicado (azul). Cada uno puede traer su prompt.
- **Prompt sugerido**, con **Copiar** e **Insertar en el chat**. Insertar lo pone en la caja de ChatGPT, Gemini, Claude o Copilot de la pestaña activa, sin enviarlo.
- **Eventos enviados: N** y si el lector ve los mensajes de esa pestaña.

El contexto se pide al conectar y otra vez cada 30 segundos. **Actualizar** lo pide en el momento. Los campos son `resumen`, `parte`, `prompt_sugerido` y `advertencias` (`tipo`, `partes`, `mensaje`).

<!-- TODO: captura del panel con resumen, un aviso de contradicción y el prompt sugerido -->
![Panel lateral](docs/panel.png)

El ícono de la barra muestra cuántos eventos se enviaron. Si el token no sirve, el ícono pasa a **!**.

## Sala de prueba

Enlace: `https://enlaza-green.vercel.app/join/demo?t=token-de-prueba`

Nombre: `Ana`

El token `token-de-prueba` es público. No es una clave del proyecto.

```bash
node extension/scripts/smoke.mjs
node extension/scripts/messages.test.mjs
```

`smoke.mjs` manda un prompt y una respuesta a la sala demo y lee el contexto. `messages.test.mjs` revisa el texto de los avisos y, si hay `linkedom` instalado, el DOM de ChatGPT y de Gemini.

## Hooks

Cursor y Claude Code mandan el mismo evento. `ia` es `cursor` o `claude`.

Copiá `hooks/enlaza.local.example.json` a `hooks/enlaza.local.json` y poné la sala, el token y tu nombre. Ese archivo está en `.gitignore`. También valen `ENLAZA_SALA`, `ENLAZA_TOKEN`, `ENLAZA_MEMBER` y `ENLAZA_BASE_URL`.

Cursor, en `.cursor/hooks.json` del proyecto. Los comandos corren desde la raíz. `beforeSubmitPrompt` manda el prompt y `afterAgentResponse` la respuesta. [Documentación](https://cursor.com/docs/hooks).

```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [
      { "command": "node extension/hooks/cursor.mjs prompt" }
    ],
    "afterAgentResponse": [
      { "command": "node extension/hooks/cursor.mjs response" }
    ]
  }
}
```

Claude Code, en `.claude/settings.json`. `UserPromptSubmit` manda el prompt. `Stop` manda la respuesta: usa `last_assistant_message` y, si no viene, lee la última respuesta de `transcript_path`. [Documentación](https://code.claude.com/docs/en/hooks).

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "node extension/hooks/claude.mjs", "timeout": 20 }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node extension/hooks/claude.mjs", "timeout": 20 }] }
    ]
  }
}
```

En Windows hace falta `node` en el PATH. Si el envío falla, el error queda en stderr y el agente sigue. Hay copias en `hooks/cursor.hooks.example.json` y `hooks/claude.settings.example.json`.

## Si algo falla

- **El ícono muestra !** y el panel dice que el token no es válido. El enlace no corresponde a la sala. Pegá de nuevo el enlace de invitación y conectá.
- **Eventos enviados no sube** después de un prompt nuevo. Recargá la pestaña del chat (F5). El panel debe decir que ChatGPT o Gemini ve mensajes. Si dice que no está el lector, en Extensiones pulsá **Actualizar** en Enlaza y volvé a recargar el chat.
- **Actualizaste el código** con `git pull`. En `edge://extensions` o `chrome://extensions`, pulsá **Actualizar**. La versión tiene que decir 1.6.18. Después recargá ChatGPT, Gemini, Claude y Copilot. Si Copilot no manda la respuesta, en la consola de la página pegá `await __enlazaDebug()` y mandá el JSON.
- **Insertar no pone el texto.** La pestaña activa tiene que ser ChatGPT o Gemini, y el chat tiene que estar recargado después de instalar.

## Limitaciones

- Los selectores viven en `content/chatgpt/selectors.js` y `content/gemini/selectors.js`. ChatGPT usa `[data-user-message-bubble]`. Gemini usa `user-query`, `model-response`, `message-content` y `rich-textarea .ql-editor`. Si la página cambia, se ajustan ahí.
- Si no aparece el botón de parar, la respuesta se manda cuando el texto deja de cambiar unos 2,5 segundos.
- En un chat nuevo, se espera hasta 12 segundos el id de la URL. Si no aparece, se usa un id local de esa pestaña.
- No se capturan archivos ni `chat.openai.com`.
- En Chrome anterior a la versión 120, la alarma puede despertar el worker cada minuto. Mientras el panel está abierto, igual pide el contexto cada 30 segundos.
