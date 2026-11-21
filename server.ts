import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_INPUT_LENGTH = 5000;

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  signal?: AbortSignal
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      if (signal?.aborted) {
        throw err;
      }
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? Number((err as { status?: unknown }).status)
          : undefined;
      const isTransient = status === 429 || (status !== undefined && status >= 500);
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = 350 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function formatApiError(err: unknown): { status: number; message: string } {
  const rawMessage =
    err instanceof Error ? err.message : "Translation service encountered an unexpected error.";
  const errName = err instanceof Error ? err.name : "";
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status?: unknown }).status)
      : 500;

  if (
    errName === "TimeoutError" ||
    rawMessage === "TIMEOUT" ||
    rawMessage.toLowerCase().includes("aborted")
  ) {
    return {
      status: 504,
      message: "Translation request timed out. Please try again.",
    };
  }

  console.error("[Verba API Error]", { status, rawMessage });

  if (rawMessage.includes("GEMINI_API_KEY")) {
    return {
      status: 500,
      message: "Translation API key is missing. Please configure GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (status === 403 || rawMessage.includes("PERMISSION_DENIED")) {
    return {
      status: 403,
      message: "API key permission denied. Please verify your GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (rawMessage.includes("API_KEY_INVALID") || rawMessage.includes("API key not valid")) {
    return {
      status: 400,
      message: "Invalid Gemini API key. Please check GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (status === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "Translation rate limit reached. Please wait a moment and try again.",
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage,
  };
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.post("/api/translate", async (req: Request, res: Response) => {
    let clientDisconnected = false;
    try {
      const body = req.body as {
        text?: unknown;
        sourceLang?: unknown;
        sourceLangName?: unknown;
        targetLang?: unknown;
        targetLangName?: unknown;
        tone?: unknown;
      };

      const text = typeof body.text === "string" ? body.text.trim() : "";
      const sourceLang = typeof body.sourceLang === "string" ? body.sourceLang : "auto";
      const sourceLangName =
        typeof body.sourceLangName === "string" ? body.sourceLangName : "Auto-Detect";
      const targetLang = typeof body.targetLang === "string" ? body.targetLang : "es";
      const targetLangName =
        typeof body.targetLangName === "string" ? body.targetLangName : "Spanish";
      const tone = typeof body.tone === "string" ? body.tone : "Standard";

      if (!text) {
        res.status(400).json({ error: "Please enter text to translate." });
        return;
      }

      if (text.length > MAX_INPUT_LENGTH) {
        res.status(400).json({
          error: `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters.`,
        });
        return;
      }

      const ai = getGenAIClient();

      const toneInstructionMap: Record<string, string> = {
        Standard: "Use clear, accurate, idiomatic everyday phrasing faithful to the original tone.",
        Formal: "Use polished, respectful, professional register appropriate for business or official correspondence.",
        Casual: "Use relaxed, conversational, friendly everyday speech.",
        Concise: "Use tight, direct, concise phrasing without unnecessary filler words.",
      };

      const toneGuide = toneInstructionMap[tone] ?? toneInstructionMap.Standard;
      const sourceDirective =
        sourceLang === "auto"
          ? "Detect the source language automatically."
          : `The source language is ${sourceLangName} (${sourceLang}).`;

      const prompt = [
        sourceDirective,
        `Translate the following text into ${targetLangName} (${targetLang}).`,
        `Tone guidance: ${toneGuide}`,
        "Preserve paragraph breaks, punctuation, and formatting from the source text.",
        "If the target language uses a non-Latin script (e.g., Japanese, Chinese, Korean, Arabic, Russian, Hindi, Greek, Thai, Hebrew, Ukrainian), provide a helpful romanization/transliteration in the `transliteration` field; otherwise return an empty string.",
        "Provide up to 3 concise alternative translations in `alternatives` when meaningful phrasing variations exist (such as formal vs. colloquial options); if the text is a long multi-sentence passage, keep alternatives empty or provide 1-2 stylistic notes/variants for the opening phrase.",
        "",
        "Text to translate:",
        `"""\n${text}\n"""`,
      ].join("\n");

      const controller = new AbortController();
      const handleClientClose = () => {
        if (!res.writableEnded) {
          clientDisconnected = true;
          controller.abort();
        }
      };
      res.on("close", handleClientClose);
      const timeoutHandle = setTimeout(() => {
        controller.abort(new Error("TIMEOUT"));
      }, 45000);

      const startedAt = Date.now();
      try {
        const response = await withRetry(
          () =>
            ai.models.generateContent({
              model: "gemini-3.1-flash-lite",
              contents: prompt,
              config: {
                abortSignal: controller.signal,
                systemInstruction:
                  "You are a precision multilingual translation engine. Translate accurately while respecting tone, idioms, cultural nuance, and formatting. Never add commentary inside `translatedText`.",
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    translatedText: {
                      type: Type.STRING,
                      description: "The translated text in the target language only.",
                    },
                    detectedSourceLanguage: {
                      type: Type.STRING,
                      description: "Full English name of the detected or confirmed source language.",
                    },
                    detectedSourceCode: {
                      type: Type.STRING,
                      description:
                        "ISO 639-1 or BCP-47 language code of the source text (e.g., en, es, fr, ja).",
                    },
                    transliteration: {
                      type: Type.STRING,
                      description:
                        "Romanization or phonetic reading if the target uses a non-Latin script, otherwise empty string.",
                    },
                    alternatives: {
                      type: Type.ARRAY,
                      description: "Up to 3 alternative translations with register/nuance labels.",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          text: {
                            type: Type.STRING,
                            description: "Alternative phrasing in the target language.",
                          },
                          nuance: {
                            type: Type.STRING,
                            description:
                              "Short 1-3 word label describing nuance (e.g. Formal, Conversational, Literal).",
                          },
                        },
                        required: ["text", "nuance"],
                      },
                    },
                  },
                  required: [
                    "translatedText",
                    "detectedSourceLanguage",
                    "detectedSourceCode",
                    "transliteration",
                    "alternatives",
                  ],
                },
              },
            }),
          3,
          controller.signal
        );

        if (clientDisconnected || res.writableEnded) {
          return;
        }

        res.setHeader("X-Translation-Ms", String(Date.now() - startedAt));
        const rawJson = (response.text ?? "{}").trim();
        const parsed = JSON.parse(rawJson) as {
          translatedText?: string;
          detectedSourceLanguage?: string;
          detectedSourceCode?: string;
          transliteration?: string;
          alternatives?: Array<{ text: string; nuance: string }>;
        };

        res.json({
          translatedText: parsed.translatedText ?? "",
          detectedSourceLanguage: parsed.detectedSourceLanguage ?? sourceLangName,
          detectedSourceCode:
            parsed.detectedSourceCode ?? (sourceLang === "auto" ? "en" : sourceLang),
          transliteration: parsed.transliteration ?? "",
          alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 3) : [],
        });
      } finally {
        clearTimeout(timeoutHandle);
        res.off("close", handleClientClose);
      }
    } catch (err: unknown) {
      if (clientDisconnected || res.writableEnded || res.destroyed) {
        return;
      }
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post("/api/tts", async (req: Request, res: Response) => {
    try {
      const body = req.body as { text?: unknown; languageName?: unknown };
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const languageName =
        typeof body.languageName === "string" && body.languageName.trim()
          ? body.languageName.trim()
          : "target language";

      if (!text) {
        res.status(400).json({ error: "No text provided for speech synthesis." });
        return;
      }

      const clippedText = text.slice(0, 1500);
      const ai = getGenAIClient();

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Speak clearly in ${languageName}: ${clippedText}`,
              },
            ],
          },
        ],
        config: {
          abortSignal: AbortSignal.timeout(15000),
          responseModalities: ["AUDIO"],
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.json({ fallback: true });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
      });
    } catch {
      res.json({ fallback: true });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Verba translation server running on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
