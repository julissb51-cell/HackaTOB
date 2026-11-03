import "server-only";

export type AiProviderName = "gemini" | "xai";

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const GEMINI_MODEL = "gemini-3.5-flash";
// Modelos gratis de respaldo, más livianos, para cuando el principal está saturado.
const GEMINI_FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const GEMINI_PRIMARY_TRIES = 3;
const GEMINI_ATTEMPT_MS = 20_000;
const GEMINI_FALLBACK_RESERVE_MS = 15_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const XAI_MODEL = "grok-4.7";
const XAI_URL = "https://api.x.ai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 120_000;

export type CompleteOptions = {
  json?: boolean;
  timeoutMs?: number;
};

export function getAiProvider(): AiProviderName {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase() ?? "";
  if (raw === "" || raw === "gemini") return "gemini";
  if (raw === "xai" || raw === "grok") return "xai";
  throw new Error("AI_PROVIDER no reconocido");
}

export function geminiModel(): string {
  const configured = process.env.GEMINI_MODEL?.trim() ?? "";
  if (/^[A-Za-z0-9._-]{1,80}$/.test(configured)) return configured;
  return GEMINI_MODEL;
}

export function geminiFallbackModels(primary: string): string[] {
  const configured = process.env.GEMINI_FALLBACK_MODEL?.trim() ?? "";
  const list = /^[A-Za-z0-9._-]{1,80}$/.test(configured) ? [configured, ...GEMINI_FALLBACK_MODELS] : GEMINI_FALLBACK_MODELS;
  return [...new Set(list)].filter((model) => model !== primary);
}

export async function complete(messages: AiMessage[], options: CompleteOptions = {}): Promise<string> {
  const provider = getAiProvider();
  if (provider === "gemini") return completeWithGemini(messages, options);
  return completeWithXai(messages, options);
}

type GeminiPart = { text?: string; thought?: boolean };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
};

async function completeWithGemini(messages: AiMessage[], options: CompleteOptions): Promise<string> {
  const apiKey = requiredEnv("GEMINI_API_KEY");
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
  const contents = dialogue(messages).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const body: {
    contents: typeof contents;
    systemInstruction?: { parts: Array<{ text: string }> };
    generationConfig?: { responseMimeType: string };
  } = { contents };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }
  if (options.json) {
    body.generationConfig = { responseMimeType: "application/json" };
  }

  const init: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  };
  const payload = (await withGeminiRetries(options.timeoutMs ?? REQUEST_TIMEOUT_MS, (model, timeoutMs) =>
    postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      init,
      "Gemini",
      timeoutMs,
    ),
  )) as GeminiResponse;

  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((part) => part.text && part.thought !== true)
    .map((part) => part.text)
    .join("")
    .trim();
  if (!text) throw new Error("Gemini respondió vacío");
  return text;
}

// Reintenta el modelo principal con espera exponencial y después prueba los
// modelos de respaldo, todo dentro del tiempo total pedido.
export async function withGeminiRetries<T>(
  totalMs: number,
  call: (model: string, timeoutMs: number) => Promise<T>,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  const deadline = now() + totalMs;
  const primary = geminiModel();
  const plan: Array<{ model: string; reserve: number }> = [];
  for (let i = 0; i < GEMINI_PRIMARY_TRIES; i += 1) plan.push({ model: primary, reserve: GEMINI_FALLBACK_RESERVE_MS });
  for (const model of geminiFallbackModels(primary)) plan.push({ model, reserve: 0 });

  let lastError: unknown = new Error("Gemini no respondió");
  let backoff = 1_000;
  for (let index = 0; index < plan.length; index += 1) {
    const step = plan[index];
    const budget = Math.min(GEMINI_ATTEMPT_MS, deadline - now() - step.reserve);
    if (budget < 3_000) continue;
    try {
      const result = await call(step.model, budget);
      if (index > 0) console.error("analisis", `Gemini respondió en el intento ${index + 1} con ${step.model}`);
      return result;
    } catch (error) {
      lastError = error;
      console.error("analisis", step.model, error instanceof Error ? error.message : error);
      if (!isRetryable(error)) throw error;
      const next = plan[index + 1];
      if (next && next.model === step.model) {
        const wait = Math.min(backoff, deadline - now() - next.reserve - 3_000);
        if (wait > 0) await sleep(wait);
        backoff *= 2;
      }
    }
  }
  throw lastError;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof ProviderError) return error.status === null || RETRYABLE_STATUS.has(error.status);
  return false;
}

class ProviderError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
  }
}

type XaiResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
};

async function completeWithXai(messages: AiMessage[], options: CompleteOptions): Promise<string> {
  const apiKey = requiredEnv("XAI_API_KEY");
  dialogue(messages);
  const chat = messages
    .map((message) => ({ role: message.role, content: message.content.trim() }))
    .filter((message) => message.content !== "");
  const payload = (await postJson(
    XAI_URL,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: chat,
        stream: false,
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      }),
    },
    "Grok",
    options.timeoutMs,
  )) as XaiResponse;

  const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Grok respondió vacío");
  return text;
}

function dialogue(messages: AiMessage[]): AiMessage[] {
  const turns = messages.filter((message) => message.role !== "system");
  if (turns.length === 0 || turns.every((message) => message.content.trim() === "")) {
    throw new Error("falta el mensaje");
  }
  return turns;
}

function requiredEnv(name: "GEMINI_API_KEY" | "XAI_API_KEY"): string {
  const value = (name === "GEMINI_API_KEY" ? process.env.GEMINI_API_KEY : process.env.XAI_API_KEY)?.trim();
  if (!value) throw new Error(`falta ${name}`);
  return value;
}

async function postJson(url: string, init: RequestInit, label: string, timeoutMs?: number): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs && timeoutMs > 0 ? timeoutMs : REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ProviderError("el analista no respondió a tiempo", null);
    }
    throw new ProviderError("el analista no respondió", null);
  }

  if (!response.ok) {
    throw new ProviderError(`${label} respondió ${response.status}`, response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`${label} respondió un cuerpo ilegible`);
  }
}
