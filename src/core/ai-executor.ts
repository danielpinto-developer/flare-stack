/**
 * FLARE STACK — AI Executor
 *
 * Actually invokes AI models via the Gemini API (Google AI Studio).
 * This is the "brain" that turns prompt files into real AI responses.
 *
 * Supports:
 *   - Google Gemini via Gemini API (Google AI Studio)
 *   - Anthropic Claude via direct REST API
 *   - OpenAI via direct REST API
 *
 * Environment Variables:
 *   GEMINI_API_KEY — Google AI Studio API key (for Gemini 3)
 *   ANTHROPIC_API_KEY — Anthropic API key
 *   OPENAI_API_KEY — OpenAI API key
 */

import chalk from "chalk";
import type { ModelPhaseConfig } from "../config/schema.js";

export interface AIResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed?: number;
  duration: number;
}

/**
 * Execute a prompt against an AI model.
 */
export async function executePrompt(
  prompt: string,
  context: string,
  modelConfig: ModelPhaseConfig,
): Promise<AIResponse> {
  const startTime = Date.now();

  switch (modelConfig.provider) {
    case "google":
      return executeGemini(prompt, context, modelConfig, startTime);
    case "anthropic":
      return executeAnthropic(prompt, context, modelConfig, startTime);
    case "openai":
      return executeOpenAI(prompt, context, modelConfig, startTime);
    case "local":
      return executeLocal(prompt, context, modelConfig, startTime);
    default:
      throw new Error(`Unknown provider: ${modelConfig.provider}`);
  }
}

/**
 * Google Gemini via Gemini API (Google AI Studio).
 * Uses GEMINI_API_KEY — gives direct access to latest models including Gemini 3.
 */
async function executeGemini(
  prompt: string,
  context: string,
  config: ModelPhaseConfig,
  startTime: number,
): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY environment variable.\n\n" +
        "   Get one at: https://aistudio.google.com/apikey\n" +
        "   Then add to your .env:\n\n" +
        "      GEMINI_API_KEY=your-key-here\n",
    );
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: config.model,
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens || 8192,
    },
  });

  const fullPrompt = `${prompt}\n\n---\n\n${context}`;

  console.log(chalk.gray(`   🧠 Calling ${config.model} via Gemini API...`));

  try {
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();
    const tokensUsed = response.usageMetadata?.totalTokenCount;

    return {
      content: text,
      model: config.model,
      provider: "google",
      tokensUsed,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("API_KEY") || message.includes("API key")) {
      throw new Error(
        "Invalid GEMINI_API_KEY. Get a new one at:\n\n" +
          "      https://aistudio.google.com/apikey\n",
      );
    }

    if (message.includes("not found") || message.includes("404")) {
      throw new Error(
        `Model "${config.model}" not available.\n` +
          "   Check available models at: https://ai.google.dev/gemini-api/docs/models\n" +
          "   Update model in flare.config.ts → models section.",
      );
    }

    throw error;
  }
}

/**
 * Anthropic Claude via REST API.
 */
async function executeAnthropic(
  prompt: string,
  context: string,
  config: ModelPhaseConfig,
  startTime: number,
): Promise<AIResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable");
  }

  console.log(chalk.gray(`   🧠 Calling ${config.model} via Anthropic...`));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens || 8192,
      temperature: config.temperature,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\n---\n\n${context}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    content: Array<{ text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  return {
    content: data.content[0]?.text || "",
    model: config.model,
    provider: "anthropic",
    tokensUsed: data.usage
      ? data.usage.input_tokens + data.usage.output_tokens
      : undefined,
    duration: Date.now() - startTime,
  };
}

/**
 * OpenAI via REST API.
 */
async function executeOpenAI(
  prompt: string,
  context: string,
  config: ModelPhaseConfig,
  startTime: number,
): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  console.log(chalk.gray(`   🧠 Calling ${config.model} via OpenAI...`));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens || 8192,
      temperature: config.temperature,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\n---\n\n${context}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { total_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content || "",
    model: config.model,
    provider: "openai",
    tokensUsed: data.usage?.total_tokens,
    duration: Date.now() - startTime,
  };
}

/**
 * Local model (Ollama or similar) via compatible API.
 */
async function executeLocal(
  prompt: string,
  context: string,
  config: ModelPhaseConfig,
  startTime: number,
): Promise<AIResponse> {
  const baseUrl = process.env.LOCAL_MODEL_URL || "http://localhost:11434";

  console.log(chalk.gray(`   🧠 Calling ${config.model} via local model...`));

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      prompt: `${prompt}\n\n---\n\n${context}`,
      stream: false,
      options: {
        temperature: config.temperature,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Local model error (${response.status})`);
  }

  const data = (await response.json()) as { response: string };

  return {
    content: data.response || "",
    model: config.model,
    provider: "local",
    duration: Date.now() - startTime,
  };
}

/**
 * Print AI response summary.
 */
export function logAIResponse(response: AIResponse): void {
  console.log(chalk.green(`   ✅ Response received`));
  console.log(chalk.gray(`      Provider: ${response.provider}`));
  console.log(chalk.gray(`      Model: ${response.model}`));
  console.log(
    chalk.gray(`      Duration: ${(response.duration / 1000).toFixed(1)}s`),
  );
  if (response.tokensUsed) {
    console.log(chalk.gray(`      Tokens: ${response.tokensUsed}`));
  }
  console.log(
    chalk.gray(`      Response length: ${response.content.length} chars`),
  );
}
