# Enlaza

HackaToB 2026 · TEC Cartago · 2 al 6 de noviembre

**Video de la demo:** [TODO: enlace del video]

**App:** [TODO: enlace de la app]

## El problema

Hoy cada miembro del equipo trabaja con su propia IA, pero ninguna sabe lo que hacen las demás.

## Qué es

Enlaza es una plataforma web y una extensión de navegador.

Cada persona sigue usando su propia IA (ChatGPT, Gemini, Cursor, Claude o Copilot) con todas sus funciones. Los prompts y las respuestas aparecen en vivo en una sala compartida.

La plataforma arma un contexto común. Detecta partes que faltan, contradicciones y trabajo duplicado. Después envía a cada persona un prompt actualizado, listo para usar.

## Para quién es

Estudiantes universitarios de 18 a 25 años, en grupos de 3 a 5 personas. En el grupo hay un coordinador y el resto son miembros. También sirve para equipos de hackathon.

## Cómo funciona

1. Alguien crea una sala. El id lo elige o se genera solo, y se comparte como código de invitación.
2. Cada persona entra con su nombre. El enlace de la sala ya trae el token y se guarda solo.
3. En la extensión, la persona pega ese enlace una vez.
4. La extensión lee ChatGPT y Gemini en la web (y, si alcanza el tiempo, Cursor y Claude Code).
5. Prompts, respuestas y archivos llegan a la sala.
6. La plataforma resume el trabajo, marca lo que falta, lo que se contradice y lo que está duplicado.
7. Cada persona recibe su parte y un prompt sugerido para seguir.

Los detalles de datos, endpoints y el orden de corte están en [CONTRATO.md](CONTRATO.md).

## Estructura del repo

- `web/` — app de Next.js (Persona A). Vercel, Supabase y la API de Grok como analista.
- `extension/` — extensión de Chrome Manifest V3 (Persona B). ChatGPT y Gemini en la web, con ganchos para Cursor y Claude Code.
- `CONTRATO.md` — decisiones ya acordadas y ejemplos en JSON.
- `.env.example` — nombres de las variables. Las claves reales van en `.env` y no se suben.

## Cómo correrlo

TODO. Falta el paso a paso cuando la app y la extensión estén listas.

## Equipo

- **Persona A:** web e IA.
- **Persona B:** extensión y presentación.
