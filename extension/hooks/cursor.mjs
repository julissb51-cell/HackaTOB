import { deliver, finish, readStdin } from "./send.mjs";

// Gancho de Cursor. Lee JSON por stdin.
// beforeSubmitPrompt trae `prompt`. afterAgentResponse trae `text`.
// Docs: https://cursor.com/docs/hooks
const mode = process.argv[2] || "";

try {
  const input = await readStdin();
  const prompted = typeof input.prompt === "string";
  const answered = typeof input.text === "string";
  const kind = mode === "prompt" || mode === "response"
    ? mode
    : input.hook_event_name === "beforeSubmitPrompt" || (prompted && !answered)
      ? "prompt"
      : "response";

  if (kind === "prompt") {
    const texto = String(input.prompt || "").trim();
    if (texto) await deliver("cursor", "prompt", texto, input, "");
    finish({ continue: true });
  } else {
    const texto = String(input.text || "").trim();
    if (texto) await deliver("cursor", "respuesta", texto, input, "");
    finish({});
  }
} catch (error) {
  console.error(`enlaza ${error instanceof Error ? error.message : error}`);
  finish(mode === "response" ? {} : { continue: true });
}
