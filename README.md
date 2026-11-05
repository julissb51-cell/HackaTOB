# Enlaza

**Enlaza conecta las IAs de tu equipo para que todos avancen en la misma dirección.**

HackaTOB 2026 · TEC Cartago · 2 al 6 de noviembre · pista The Next Big Thing

- **App en vivo:** [https://enlaza-green.vercel.app](https://enlaza-green.vercel.app)
- **X:** [@enlazaxyz](https://x.com/enlazaxyz)
- **Video:** próximamente (enlace pendiente). Coming soon (link pending).

---

## El problema

La inteligencia artificial nos hizo más rápidos trabajando solos, pero más desordenados trabajando en grupo.

Hoy, cuando un equipo de estudiantes hace un proyecto con IA, cada persona trabaja en su propio chat (ChatGPT, Gemini, Claude o Cursor), y ninguna IA sabe lo que hacen las demás. Eso se descubre tarde, al unir el trabajo:

- **Trabajo repetido.**
- **Decisiones que se contradicen:** en una muestra, una persona describe `datos.json` y otra pide SQLite. No es una medición de usuarios de Enlaza.
- **Partes que nadie hizo.**

**Para quién es:** estudiantes y equipos de 2 a 5 que hacen un trabajo de curso o un hackathon. Cada quien usa su IA desde su computadora. El trabajo es seguir en el chat propio y, aun así, ver si el equipo se contradice, se repite o deja algo sin hacer.

### Evidencia

Ninguna de estas páginas dice que la persona use Enlaza. No miden disposición a pagar.

- **Uso de IA, no compra de Enlaza.** [HEPI y Kortext, Student Generative AI Survey 2025](https://www.hepi.ac.uk/reports/student-generative-ai-survey-2025/) (1 041 estudiantes de tiempo completo, diciembre de 2024): el 92 % dijo usar alguna herramienta de IA y el 88 % dijo usarla en evaluaciones. [Microsoft y LinkedIn, Work Trend Index 2024](https://www.microsoft.com/en-us/worklab/work-trend-index/ai-at-work-is-here-now-comes-the-hard-part) (31 000 trabajadores del conocimiento en 31 mercados, 15 de febrero a 28 de marzo de 2024): el 78 % de quienes usan IA en el trabajo lleva su propia herramienta. Eso no demuestra que un equipo necesite unir salidas de IAs distintas.
- **Comentarios públicos.** En el [foro de OpenAI](https://community.openai.com/t/feature-request-collaborative-projects-with-multiple-users-their-personal-chatgpts/1397310), @macklegragpie escribió que no quiere «two parallel ChatGPT conversations that we have to manually synchronize». Es un pedido de función dentro de ChatGPT. En [Hacker News](https://news.ycombinator.com/item?id=48841133), Jonathan, Ollie y Lucas presentan su propio producto y cuentan que uno construía una función y descubría que un compañero había hecho la misma, y que otro decidía algo contradictorio al mismo tiempo. No es un usuario independiente de Enlaza.
- **Lo que hace ChatGPT.** El [Centro de ayuda](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) dice que compartir un proyecto está en Free, Go, Plus, Pro, Business, Enterprise y Edu. En Free: hasta 5 archivos y 5 colaboradores. También dice: «Chats in shared projects can be branched, not collaborated on synchronously». Sigue dentro de ChatGPT. Enlaza observa trabajo capturado en IAs distintas (en la demo, ChatGPT, Gemini y Claude; Cursor en Windows con un gancho).

**Antes:** cada persona trabaja a ciegas y los choques aparecen al unir el trabajo. **Con Enlaza:** la sala junta lo capturado y puede avisar de contradicciones, duplicados y faltas. Si el modelo no responde, quedan reglas o el resumen anterior. No es el mismo aviso en cualquier conversación.

## Qué es

Enlaza es una **sala compartida** para un equipo que arma un proyecto con IAs distintas. Cada persona sigue en su chat. La sala junta lo que hicieron y se lo devuelve al equipo.

El ejemplo de la muestra, no una medición: **Ana** escribe el informe y describe `datos.json`. **Luis** programa y pide SQLite. En [el ensayo local](docs/ensayo-json-sqlite.md) las reglas marcan ese choque para las dos personas. Si el mensaje posterior de Ana cierra en SQLite, el choque de almacenamiento deja de salir. Gemini no está obligado a repetir ese texto.

Sirve para **ChatGPT, Gemini, Claude y Cursor**. Copilot no entra en esta demo.

## Cómo funciona

1. Alguien crea una sala (con inicio de sesión de Google), le pone un tema y comparte el enlace de invitación.
2. Cada integrante abre ese enlace. En la computadora conecta la [extensión de Chrome o Edge](extension/README.md). No está en la Chrome Web Store y no es una extensión del celular.
3. La extensión lee los prompts y las respuestas que ya terminaron, después del consentimiento, y puede mandar un archivo o un enlace a Archivos de la sala. En el teléfono se puede ver la sala.
4. En **Cursor** (programa de escritorio), un gancho de Windows manda el prompt y la respuesta del agente. No pasa por la extensión.
5. Todo llega a la sala con `POST /api/rooms/{salaId}/events`. El contrato de los campos está en [CONTRATO.md](CONTRATO.md).
6. Un **analista con IA** (Gemini por defecto; se puede pasar a Grok con `AI_PROVIDER`) lee la sala y arma el contexto de cada miembro: `GET /api/rooms/{salaId}/context`.
7. El panel de la extensión y la página de la sala muestran, en vivo:
   - **Resumen** del trabajo.
   - **Mi parte.**
   - **Avisos:** contradicción, duplicado o falta, con prioridad *Urgente*, *Pronto* o *Puede esperar*.
   - **Avance %** del proyecto y de cada parte.
   - **Prompt sugerido**, para copiar o insertar en el chat.
   - **Actividad:** los prompts y las respuestas.
   - **Archivos:** enlaces y archivos de hasta 10 MB. Si alguien pega un enlace `https` en un prompt, la sala lo guarda solo. Nunca abre ese enlace.

```mermaid
flowchart LR
  subgraph Navegador
    ext["Extensión MV3<br/>ChatGPT · Gemini · Claude"]
    web["Sala web<br/>Next.js"]
  end
  cursor["Gancho de Cursor"]
  api["API en Vercel<br/>/api/rooms/{salaId}/..."]
  db[("Supabase<br/>Postgres · Auth · Storage")]
  ai{"AI_PROVIDER"}
  gemini["Gemini (por defecto)"]
  grok["Grok (xai)"]

  ext -- "POST /events y archivos" --> api
  cursor -- "POST /events" --> api
  web <--> api
  api <--> db
  api --> ai
  ai --> gemini
  ai --> grok
  api -- "GET /context" --> ext
  api -- "contexto" --> web
```

## Capturas

El panel de la extensión, al lado de ChatGPT: resumen, mi parte, avisos y prompt sugerido.

![ChatGPT con el panel de Enlaza](docs/img/1-chatgpt-panel.png)

La sala: nombre del proyecto, avance y miembros.

![Sala de Enlaza](docs/img/2-sala.png)

La actividad junta prompts y respuestas de las IAs del equipo. Esta captura es provisional: se va a cambiar. Todavía se ve un prompt repetido y el markdown sin formato.

![Actividad de la sala, captura provisional](docs/img/3-actividad.png)

En Gemini, con un PDF en el compositor, Enlaza avisa que el archivo llegó a la sala.

![Gemini envía un PDF a Archivos](docs/img/4-gemini-archivo.png)

También están el inicio y la sala en claro y oscuro:

| Inicio | Sala (claro) |
|---|---|
| ![Inicio](docs/inicio.png) | ![Sala en modo claro](docs/sala-claro.png) |

| Sala (oscuro) | Archivos de la sala |
|---|---|
| ![Sala en modo oscuro](docs/sala-oscuro.png) | ![Archivos de la sala](docs/archivos.png) |

## Empezar

### Extensión (Chrome o Edge)

1. Abrí `chrome://extensions` o `edge://extensions`.
2. Activá el **Modo de desarrollador**.
3. Pulsá **Cargar extensión sin empaquetar** y elegí la carpeta `extension/` de este repo.
4. Recargá las pestañas de ChatGPT, Gemini o Claude.
5. En la web, copiá el enlace de invitación de tu sala.
6. Abrí el popup de Enlaza, pegá ese enlace, escribí tu nombre y pulsá **Conectar**.

El enlace se queda solo en el almacenamiento del navegador. Más detalle en [extension/README.md](extension/README.md).

### Cursor (Windows)

En la carpeta `cursor-hook/`, un solo comando instala el gancho. No hace falta Node ni Python. El enlace y el nombre van en el comando; no los dejes escritos en el repo.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Invite "https://enlaza-green.vercel.app/join/TU-SALA?t=TU-TOKEN" -Member "Ana"
```

Los pasos están en [cursor-hook/README.md](cursor-hook/README.md).

### Ver la sala

1. Abrí [https://enlaza-green.vercel.app](https://enlaza-green.vercel.app) e iniciá sesión con Google.
2. Creá una sala o entrá con el enlace que te pasó el equipo.
3. Mirá el avance, los avisos, tu siguiente paso y la actividad.
4. Abrí **Archivos** para ver enlaces y archivos, o agregá uno.
5. **Analizar ahora** vuelve a leer la sala con la IA.

El enlace de una sala de prueba lo da el equipo. No está en este archivo.

## Tecnología

- **Web:** Next.js 16 (App Router) en **Vercel**. Sala, inicio con Google y API.
- **Datos:** **Supabase** (Postgres con RLS, Auth y Storage privado para Archivos).
- **Analista:** **Gemini** en el nivel gratuito. Con `AI_PROVIDER=xai` pasa a Grok, sin cambiar código.
- **Extensión:** Chrome Manifest V3, sin compilar. Content scripts, service worker y panel lateral.

## Correr la web en tu computadora

Necesitás Node 20 o más reciente y un proyecto de Supabase. Los scripts SQL están en `web/supabase/`.

```bash
cd web
npm install
cp ../.env.example .env.local   # y completá los valores
npm run dev
```

Estas son las variables (solo los nombres; las claves no se suben):

| Variable | Para qué sirve |
|---|---|
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servidor (solo en el servidor) |
| `AI_PROVIDER` | `gemini` (por defecto) o `xai` |
| `GEMINI_API_KEY` | Clave de Google AI Studio |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Opcionales: modelo principal y de respaldo |
| `XAI_API_KEY` | Solo si `AI_PROVIDER=xai` |

Pruebas: `npm test`, `npm run lint` y `npm run build`. Más detalle en [web/README.md](web/README.md).

## Equipo

- **Jose (Persona A):** plataforma web y analista con IA.
- **Juliana Sanabria ([@julissb51-cell](https://github.com/julissb51-cell)) (Persona B):** extensión, integración con Cursor y presentación.

## Modelo de negocio (propuesta)

> Es una propuesta para la hackathon. Todavía no está validada con clientes. Estos precios no están en el producto.

- **Gratis:** la sala, la invitación, la captura y el trabajo en equipo. No hace falta pagar para usarlos.
- **Plus opcional:** una propuesta, no está en el producto. No hay cobro ni análisis ilimitado: hoy se usa el plan gratis de Gemini, con cupo. No ofrecemos un panel para docentes.

## Riesgos

- **Privacidad de los chats:** la extensión pide consentimiento y solo lee las páginas de las IAs que declara. Las salas son privadas y se entra por invitación. La base tiene reglas de seguridad (RLS). Los archivos van a un almacenamiento privado.
- **Límites del plan gratis de la IA:** hay reintentos y un modelo de respaldo (`GEMINI_FALLBACK_MODEL`). El avance % es una estimación, no una nota.
- **Cambios en las páginas de las IAs:** los selectores están en un archivo por sitio, con alternativas.

## Revisión interna

Recorrimos la app como si fuéramos usuarios y ajustamos lo que encontramos:

- **Fallas del servicio de la IA:** cuando Gemini no respondía, agregamos reintentos automáticos y modelos de respaldo.
- **Alertas que se escapaban:** reforzamos las instrucciones de la IA y sumamos reglas de respaldo para detectar las contradicciones y el trabajo repetido.
- **Textos confusos:** corregimos la gramática y las frases exageradas de los resúmenes.
- **Uso diario:** la sesión se inicia una sola vez, las salas se crean al instante, borrar una sala pide confirmación, se puede invitar por correo, y mejoramos el celular y la barra superior.
- **Seguridad:** solo el dueño puede borrar una sala, las salas de demostración están protegidas y ninguna clave queda en el código público.

## Limitaciones

- La demo de la extensión cubre ChatGPT, Gemini y Claude en el navegador. Copilot no entra en la demo. Si esas páginas cambian, hay que ajustar los selectores.
- Cursor no se captura con la extensión. En Windows se usa el gancho de `cursor-hook/`. Hay scripts de ganchos para Claude Code en `extension/hooks/`, aparte del manifiesto.
- Borrar un archivo pide la sesión de Google de quien lo agregó o del dueño de la sala. El enlace de invitación no alcanza para borrarlo.
- El análisis depende del nivel gratuito de Gemini, que tiene cupo.
- No hay app móvil. La web sí se adapta al celular.

## Hoja de ruta

- Avisos por correo cuando se acerca la fecha de entrega.
- Publicar la extensión en la Chrome Web Store. Todavía no está.

---

## English summary

**Enlaza** is a shared room for students and teams of 2 to 5 building a project with different AIs (ChatGPT, Gemini, Claude, and Cursor). Copilot is not part of this demo. A desktop Chrome or Edge extension captures finished prompts and replies after consent. It is not in the Chrome Web Store and it is not a mobile extension; the phone can open the room. Cursor on Windows uses a hook. The room runs a free Gemini analyst, which can fail over to rules or keep the previous summary, and can show a summary, parts, contradiction/duplicate/missing alerts, and a next prompt. That is not guaranteed for every chat. Sample, not a user study: Ana describes datos.json and Luis asks for SQLite ([local write-up](docs/ensayo-json-sqlite.md)). Proposed pricing only: the room, invites, capture, and collaboration stay free. An optional Plus is not in the product. There is no charge, no unlimited analysis, and no teacher panel. Public comments describe the pain; they are not Enlaza users or willingness to pay. HEPI and Kortext (1,041 full-time undergraduates, December 2024) report 92% using any AI tool and 88% using generative AI for assessments. Microsoft and LinkedIn (31,000 knowledge workers, 31 markets, 15 February–28 March 2024) report 78% of AI users bringing their own tool. ChatGPT project sharing is on Free (up to 5 files and 5 collaborators; [OpenAI Help Center](https://help.openai.com/en/articles/10169521-projects-in-chatgpt)): “Chats in shared projects can be branched, not collaborated on synchronously.” That stays inside ChatGPT. Enlaza is for captured work across different AIs. Demo video: coming soon (link pending). Live: https://enlaza-green.vercel.app · X: [@enlazaxyz](https://x.com/enlazaxyz)

## Licencia

MIT. El aviso está en [LICENSE](LICENSE). Enlaza está basado en ChatArchive, que también es MIT.
