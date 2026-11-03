import "server-only";

export type AiProviderName = "gemini" | "xai";

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const XAI_MODEL = "grok-4.7";
const XAI_URL = "https://api.x.ai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 120_000;

export function getAiProvider(): AiProviderName {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase() ?? "";
  if (raw === "" || raw === "gemini") return "gemini";
  if (raw === "xai") return "xai";
  throw new Error("AI_PROVIDER no reconocido");
}

export async function complete(messages: AiMessage[]): Promise<string> {
  const provider = getAiProvider();
  if (provider === "gemini") return completeWithGemini(messages);
  return completeWithXai(messages);
}

type GeminiPart = { text?: string; thought?: boolean };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
};

async function completeWithGemini(messages: AiMessage[]): Promise<string> {
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
  } = { contents };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const payload = (await postJson(
    GEMINI_URL,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    },
    "Gemini",
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

type XaiResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
};

async function completeWithXai(messages: AiMessage[]): Promise<string> {
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
      }),
    },
    "Grok",
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

async function postJson(url: string, init: RequestInit, label: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("el analista no respondió a tiempo");
    }
    throw new Error("el analista no respondió");
  }

  if (!response.ok) {
    throw new Error(`${label} respondió ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`${label} respondió un cuerpo ilegible`);
  }
}
