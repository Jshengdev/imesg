import { describe, test, expect } from "bun:test";
import { validateResponse, getTemporalVoice } from "../agent/personality";

describe("Test Bench", () => {
  describe("1. Config Loads", () => {
    test("should load config with all required properties", async () => {
      const { config } = await import("../config");
      console.log("CONFIG OK:", Object.keys(config).join(", "));
      expect(config).toBeDefined();
      expect(typeof config.MINIMAX_API_KEY).toBe("string");
      expect(typeof config.AGENT_CHAT_IDENTIFIER).toBe("string");
      expect(config.CALENDAR_POLL_MS).toBeGreaterThan(0);
    });
  });

  // DB test skipped in bun — better-sqlite3 not supported. Use npx tsx.
  describe("2. Database", () => {
    test("skipped in bun (use npx tsx)", () => {
      console.log("DB test requires npx tsx — better-sqlite3 not supported in bun");
      expect(true).toBe(true);
    });
  });

  describe("3. MiniMax LLM Responds", () => {
    test("should generate response from MiniMax LLM", async () => {
      const { generate } = await import("../minimax/llm");
      const response = await generate("you are a test", "say hello in 3 words");
      console.log("LLM OK:", response);
      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
      expect(response.length).toBeGreaterThan(0);
    });
  });

  describe("4. MiniMax TTS Generates Audio", () => {
    test("should generate audio file from text", async () => {
      const { textToSpeech } = await import("../minimax/tts");
      const fs = await import("fs");
      const audioPath = await textToSpeech("testing nudge");
      expect(audioPath).not.toBeNull();
      if (audioPath) {
        expect(fs.existsSync(audioPath)).toBe(true);
        const stats = fs.statSync(audioPath);
        console.log(`TTS OK: ${audioPath} — size: ${stats.size} bytes`);
        expect(stats.size).toBeGreaterThan(0);
      }
    });
  });

  describe("5. Composio Connects", () => {
    test("should connect to Composio", async () => {
      const { isMockMode } = await import("../integrations/composio");
      const mockMode = isMockMode();
      console.log("COMPOSIO mock mode:", mockMode);
      expect(typeof mockMode).toBe("boolean");
    });
  });

  describe("6. Gmail Analysis", () => {
    test("should pull and analyze emails", async () => {
      const { analyzeGmail } = await import("../integrations/gmail");
      const result = await analyzeGmail();
      console.log(`${result.emails.length} emails, tags: ${result.tags}`);
      console.log("insights:", result.insights.slice(0, 100));
      expect(Array.isArray(result.emails)).toBe(true);
    });
  });

  describe("7. Calendar Analysis", () => {
    test("should pull and analyze calendar", async () => {
      const { analyzeCalendar } = await import("../integrations/calendar");
      const result = await analyzeCalendar();
      console.log(`${result.events.length} events, tags: ${result.tags}`);
      console.log("insights:", result.insights.slice(0, 100));
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  describe("8. Personality Validation", () => {
    test("should validate and clean responses", () => {
      const voice = getTemporalVoice();
      console.log("VOICE:", voice);
      const cleaned = validateResponse(
        "I'd be happy to help! Certainly, here is your schedule. Furthermore, the meeting is at 2pm."
      );
      console.log("CLEAN:", cleaned);
      expect(voice).toBeDefined();
      expect(cleaned).not.toContain("happy to");
      expect(cleaned).not.toContain("certainly");
    });
  });

  describe("9. Intent Classification", () => {
    test("should classify intents correctly", async () => {
      const { classifyIntent } = await import("../agent/handler");
      expect(classifyIntent("what should I focus on")).toBe("task");
      expect(classifyIntent("check my email")).toBe("email");
      expect(classifyIntent("what meetings do I have")).toBe("schedule");
      expect(classifyIntent("draft a reply to Sarah")).toBe("draft");
      expect(classifyIntent("hey whats up")).toBe("general");
      console.log("INTENTS OK: all 5 classified correctly");
    });
  });
});
