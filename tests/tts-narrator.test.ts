/**
 * FLARE STACK — TTS Narrator Tests
 *
 * Tests for the narration pipeline: script generation, TTS synthesis,
 * audio/video merge, and orchestration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NarrationScene } from "../src/extras/tts-narrator.js";

// ─── Mock Setup ───────────────────────────────────────────────────────────────

const mockCallLLM = vi.fn();
const mockDetectProvider = vi.fn(() => ({
  name: "gemini" as const,
  apiKey: "test-key",
}));
const mockExecFileSync = vi.fn();
const mockConfirm = vi.fn(() => Promise.resolve(true));

vi.mock("../src/core/llm.js", () => ({
  detectProvider: mockDetectProvider,
  callLLM: mockCallLLM,
}));

vi.mock("child_process", () => ({
  execFileSync: mockExecFileSync,
}));

vi.mock("@inquirer/prompts", () => ({
  confirm: mockConfirm,
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TTS Narrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectProvider.mockReturnValue({ name: "gemini", apiKey: "test-key" });
    mockConfirm.mockResolvedValue(true);
  });

  describe("generateScript", () => {
    it("should parse LLM response into NarrationScene array", async () => {
      const mockScenes: NarrationScene[] = [
        {
          agentInstruction: "Navigate to http://localhost:3000",
          narrationText: "Let's start by opening the application.",
          durationSec: 4,
        },
        {
          agentInstruction: "Click the 'Upload' button",
          narrationText: "Here we can upload CSV data for analysis.",
          durationSec: 5,
        },
      ];

      mockCallLLM.mockResolvedValue(JSON.stringify(mockScenes));

      const { generateScript } = await import("../src/extras/tts-narrator.js");
      const scenes = await generateScript(
        "CSV upload feature",
        "User can upload CSV files",
        "http://localhost:3000",
      );

      expect(scenes).toHaveLength(2);
      expect(scenes[0].agentInstruction).toBe(
        "Navigate to http://localhost:3000",
      );
      expect(scenes[0].narrationText).toBe(
        "Let's start by opening the application.",
      );
      expect(scenes[0].durationSec).toBe(4);
    });

    it("should handle LLM response wrapped in markdown code block", async () => {
      const mockScene: NarrationScene = {
        agentInstruction: "Navigate to http://localhost:3000",
        narrationText: "Opening the app.",
        durationSec: 3,
      };

      mockCallLLM.mockResolvedValue(
        "```json\n" + JSON.stringify([mockScene]) + "\n```",
      );

      const { generateScript } = await import("../src/extras/tts-narrator.js");
      const scenes = await generateScript(
        "Feature description",
        "AC: something",
        "http://localhost:3000",
      );

      expect(scenes).toHaveLength(1);
      expect(scenes[0].narrationText).toBe("Opening the app.");
    });

    it("should fall back to ticket-based script when LLM fails", async () => {
      mockCallLLM.mockRejectedValue(new Error("LLM unavailable"));

      const { generateScript } = await import("../src/extras/tts-narrator.js");
      const scenes = await generateScript(
        "Feature with some interesting details\nAnother line of description here",
        "AC: criteria",
        "http://localhost:3000",
      );

      expect(scenes.length).toBeGreaterThanOrEqual(1);
      expect(scenes[0].agentInstruction).toContain("http://localhost:3000");
    });

    it("should fall back when no AI provider is detected", async () => {
      mockDetectProvider.mockReturnValue(null);

      const { generateScript } = await import("../src/extras/tts-narrator.js");
      const scenes = await generateScript(
        "Some feature description text here",
        "AC",
        "http://localhost:3000",
      );

      expect(scenes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("presentScriptForReview", () => {
    it("should return scenes when user approves", async () => {
      mockConfirm.mockResolvedValue(true);

      const { presentScriptForReview } =
        await import("../src/extras/tts-narrator.js");
      const scenes: NarrationScene[] = [
        {
          agentInstruction: "Navigate to homepage",
          narrationText: "Opening the application.",
          durationSec: 3,
        },
      ];

      const result = await presentScriptForReview(scenes);
      expect(result).toEqual(scenes);
    });

    it("should throw when user rejects", async () => {
      mockConfirm.mockResolvedValue(false);

      const { presentScriptForReview } =
        await import("../src/extras/tts-narrator.js");
      const scenes: NarrationScene[] = [
        {
          agentInstruction: "Navigate to homepage",
          narrationText: "Opening the application.",
          durationSec: 3,
        },
      ];

      await expect(presentScriptForReview(scenes)).rejects.toThrow(
        "Script rejected by user",
      );
    });
  });

  describe("mergeAudioVideo", () => {
    it("should call ffmpeg with correct arguments", async () => {
      mockExecFileSync.mockReturnValue(Buffer.from(""));

      const { mergeAudioVideo } = await import("../src/extras/tts-narrator.js");
      const result = mergeAudioVideo(
        "/tmp/video.webm",
        "/tmp/audio.wav",
        "/tmp/output.webm",
      );

      expect(result).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalledWith("ffmpeg", [
        "-y",
        "-i",
        "/tmp/video.webm",
        "-i",
        "/tmp/audio.wav",
        "-c:v",
        "copy",
        "-c:a",
        "libopus",
        "-shortest",
        "/tmp/output.webm",
      ]);
    });

    it("should return false when ffmpeg is not installed", async () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error("ffmpeg not found");
      });

      const { mergeAudioVideo } = await import("../src/extras/tts-narrator.js");
      const result = mergeAudioVideo(
        "/tmp/video.webm",
        "/tmp/audio.wav",
        "/tmp/output.webm",
      );

      expect(result).toBe(false);
    });
  });

  describe("concatAudioSegments", () => {
    it("should call ffmpeg concat with correct arguments", async () => {
      mockExecFileSync.mockReturnValue(Buffer.from(""));

      const { concatAudioSegments } =
        await import("../src/extras/tts-narrator.js");
      const result = concatAudioSegments(
        ["/tmp/s1.wav", "/tmp/s2.wav"],
        "/tmp/output.wav",
      );

      expect(result).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalledWith("ffmpeg", [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        expect.stringContaining("-list.txt"),
        "-c",
        "copy",
        "/tmp/output.wav",
      ]);
    });

    it("should return false when ffmpeg is unavailable", async () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error("not found");
      });

      const { concatAudioSegments } =
        await import("../src/extras/tts-narrator.js");
      const result = concatAudioSegments(
        ["/tmp/s1.wav", "/tmp/s2.wav"],
        "/tmp/output.wav",
      );

      expect(result).toBe(false);
    });
  });

  describe("NarrationScene type", () => {
    it("should have required fields", () => {
      const scene: NarrationScene = {
        agentInstruction: "Go to /dashboard",
        narrationText: "Here is the dashboard.",
        durationSec: 5,
      };

      expect(scene.agentInstruction).toBeDefined();
      expect(scene.narrationText).toBeDefined();
      expect(scene.durationSec).toBeDefined();
    });
  });
});
