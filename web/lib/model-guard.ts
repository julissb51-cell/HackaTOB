/** Espera mínima entre llamadas al modelo, guardada en la base. No es un plan de pago. */
export const ANALYSIS_INTERVAL_MS = 30_000;

/** Qué hacer con el plan gratis de Gemini. No es un cupo de pago ni un contador diario. */
export type AnalysisDecision = "run" | "cooldown" | "unchanged";

export function shouldAnalyze(input: {
  force: boolean;
  pending: boolean;
  ranAtMs: number | null;
  now: number;
  savedEvents: number | null;
  eventCount: number;
}): AnalysisDecision {
  if (input.ranAtMs !== null && !Number.isNaN(input.ranAtMs) && input.now - input.ranAtMs < ANALYSIS_INTERVAL_MS) {
    return "cooldown";
  }
  if (!input.force && !input.pending && input.savedEvents !== null && input.savedEvents === input.eventCount) {
    return "unchanged";
  }
  return "run";
}

const SECRET_LIKE: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bAIza[0-9A-Za-z\-_]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._\-]{20,}/g,
];

/** Quita formas obvias de secreto solo en la copia que va al modelo. No es una detección completa. */
export function redactForModel(text: string): { text: string; changed: boolean } {
  let next = text;
  for (const pattern of SECRET_LIKE) {
    next = next.replace(pattern, "[omitido]");
  }
  return { text: next, changed: next !== text };
}
