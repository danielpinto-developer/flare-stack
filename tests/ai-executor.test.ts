/**
 * FLARE STACK — AI Executor Tests
 *
 * Mocks all 4 AI providers to verify request format,
 * auth handling, response parsing, and error cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  executePrompt,
  logAIResponse,
  type AIResponse,
} from "../src/core/ai-executor.js";
import type { ModelPhaseConfig } from "../src/config/schema.js";

// ─── Test Helpers ────────────────────────────────────────

const makeConfig = (
  provider: string,
  model: string = "test-model",
): ModelPhaseConfig => ({
  provider: provider as ModelPhaseConfig["provider"],
  model,
  tier: "low" as const,
  temperature: 0.3,
  maxTokens: 1024,
});

// ─── Anthropic Tests ─────────────────────────────────────

describe("AI Executor — Anthropic", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key-anthropic";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("should send correct request to Anthropic API", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(
        JSON.stringify({
          content: [{ text: "AI response here" }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
        { status: 200 },
      );
    }) as any;

    const result = await executePrompt(
      "Test prompt",
      "Test context",
      makeConfig("anthropic", "claude-sonnet-4-20250514"),
    );

    expect(capturedUrl).toBe("https://api.anthropic.com/v1/messages");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key-anthropic");
    expect(headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(capturedInit?.body as string);
    expect(body.model).toBe("claude-sonnet-4-20250514");
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(1024);
    expect(body.messages[0].content).toContain("Test prompt");
    expect(body.messages[0].content).toContain("Test context");

    expect(result.content).toBe("AI response here");
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-sonnet-4-20250514");
    expect(result.tokensUsed).toBe(150);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("should throw on missing API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      executePrompt("prompt", "ctx", makeConfig("anthropic")),
    ).rejects.toThrow("Missing ANTHROPIC_API_KEY");
  });

  it("should throw on API error response", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("Rate limited", { status: 429 });
    }) as any;

    await expect(
      executePrompt("prompt", "ctx", makeConfig("anthropic")),
    ).rejects.toThrow("Anthropic API error (429)");
  });
});

// ─── OpenAI Tests ────────────────────────────────────────

describe("AI Executor — OpenAI", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key-openai";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("should send correct request to OpenAI API", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "OpenAI says hello" } }],
          usage: { total_tokens: 200 },
        }),
        { status: 200 },
      );
    }) as any;

    const result = await executePrompt(
      "prompt",
      "context",
      makeConfig("openai", "gpt-4o"),
    );

    expect(capturedUrl).toBe("https://api.openai.com/v1/chat/completions");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-key-openai");

    expect(result.content).toBe("OpenAI says hello");
    expect(result.provider).toBe("openai");
    expect(result.tokensUsed).toBe(200);
  });

  it("should throw on missing API key", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(
      executePrompt("prompt", "ctx", makeConfig("openai")),
    ).rejects.toThrow("Missing OPENAI_API_KEY");
  });

  it("should throw on API error response", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("Server error", { status: 500 });
    }) as any;

    await expect(
      executePrompt("prompt", "ctx", makeConfig("openai")),
    ).rejects.toThrow("OpenAI API error (500)");
  });
});

// ─── Local/Ollama Tests ──────────────────────────────────

describe("AI Executor — Local/Ollama", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("should call local endpoint with correct format", async () => {
    let capturedUrl = "";

    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({ response: "Local model output" }), {
        status: 200,
      });
    }) as any;

    const result = await executePrompt(
      "prompt",
      "context",
      makeConfig("local", "codellama"),
    );

    expect(capturedUrl).toBe("http://localhost:11434/api/generate");
    expect(result.content).toBe("Local model output");
    expect(result.provider).toBe("local");
  });

  it("should use custom LOCAL_MODEL_URL", async () => {
    process.env.LOCAL_MODEL_URL = "http://gpu-box:8080";
    let capturedUrl = "";

    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({ response: "Custom server" }), {
        status: 200,
      });
    }) as any;

    await executePrompt("p", "c", makeConfig("local"));
    expect(capturedUrl).toBe("http://gpu-box:8080/api/generate");
  });

  it("should throw on local model error", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("Not found", { status: 404 });
    }) as any;

    await expect(executePrompt("p", "c", makeConfig("local"))).rejects.toThrow(
      "Local model error (404)",
    );
  });
});

// ─── Google Gemini Tests ─────────────────────────────────

describe("AI Executor — Google Gemini", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should throw on missing GEMINI_API_KEY", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      executePrompt("prompt", "ctx", makeConfig("google")),
    ).rejects.toThrow("Missing GEMINI_API_KEY");
  });
});

// ─── General Tests ───────────────────────────────────────

describe("AI Executor — General", () => {
  it("should throw on unknown provider", async () => {
    await expect(
      executePrompt("p", "c", makeConfig("unknown-provider" as any)),
    ).rejects.toThrow("Unknown provider: unknown-provider");
  });

  it("logAIResponse should not throw", () => {
    const response: AIResponse = {
      content: "hello",
      model: "test",
      provider: "test",
      tokensUsed: 100,
      duration: 1500,
    };
    expect(() => logAIResponse(response)).not.toThrow();
  });

  it("logAIResponse should handle missing tokensUsed", () => {
    const response: AIResponse = {
      content: "hello",
      model: "test",
      provider: "test",
      duration: 500,
    };
    expect(() => logAIResponse(response)).not.toThrow();
  });
});
