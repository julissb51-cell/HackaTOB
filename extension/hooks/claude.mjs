import { deliver, finish, lastAssistantFromTranscript, readStdin } from "./send.mjs";

// Gancho de Claude Code. Lee JSON por stdin.
// UserPromptSubmit manda el prompt. Stop manda la respuesta:
// primero last_assistant_message y, si no viene, la última línea
// assistant de transcript_path.
// Docs: https://code.claude.com/docs/en/hooks
const mode = process.argv[2] || "";

try {
  const input = await readStdin();
  const eventName = String(input.hook_event_name || mode || "");
  const isStop = eventName === "Stop" || eventName === "response";

  if (!isStop) {
    const texto = String(input.prompt || "").trim();
    if (texto) await deliver("claude", "prompt", texto, input, input.session_title || "");
  } else {
    let texto = String(input.last_assistant_message || "").trim();
    if (!texto && input.transcript_path) texto = lastAssistantFromTranscript(input.transcript_path);
    if (texto) await deliver("claude", "respuesta", texto, input, input.session_title || "");
  }
  finish({});
} catch (error) {
  console.error(`enlaza ${error instanceof Error ? error.message : error}`);
  finish({});
}
