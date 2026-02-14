/**
 * FLARE STACK — Shared LLM Utilities
 *
 * Provider detection + provider-agnostic LLM call.
 * Used by ticket-router, ticket-classifier, plan-judge, scope-guard.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ═══ Provider Detection ═══════════════════════════════════════

export interface DetectedProvider {
  name: "gemini" | "openai" | "anthropic";
  apiKey: string;
}

export function detectProvider(): DetectedProvider | null {
  const envCandidates = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "client", ".env"),
    join(process.cwd(), "server", ".env"),
  ];
  for (const envPath of envCandidates) {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const match = line.match(/^([A-Z_]+)=(.+)$/);
          if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].trim();
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  const gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (gemini) return { name: "gemini", apiKey: gemini };

  const openai = process.env.OPENAI_API_KEY;
  if (openai) return { name: "openai", apiKey: openai };

  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (anthropic) return { name: "anthropic", apiKey: anthropic };

  return null;
}

// ═══ LLM Call — Provider-Agnostic ═════════════════════════════

const LLM_TIMEOUT_MS = 30_000;

export async function callLLM(
  provider: DetectedProvider,
  prompt: string,
): Promise<string> {
  if (provider.name === "gemini") {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(provider.apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Gemini API timeout after ${LLM_TIMEOUT_MS}ms`)),
          LLM_TIMEOUT_MS,
        ),
      ),
    ]);
    return result.response.text();
  }

  if (provider.name === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 2048,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    if (!res.ok)
      throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0].message.content;
  }

  if (provider.name === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    if (!res.ok)
      throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as {
      content: { type: string; text: string }[];
    };
    const textBlock = data.content.find((c) => c.type === "text");
    return textBlock?.text || "";
  }

  throw new Error(`Unknown LLM provider: ${provider.name}`);
}
