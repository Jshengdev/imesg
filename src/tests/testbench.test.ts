import { describe, test, expect } from "bun:test";
import { validateResponse, getTemporalVoice } from "../agent/personality";
import fs from "fs";

describe("Test Bench", () => {
  describe("1. Config Loads", () => {
    test("should load config with all required properties", async () => {
      const { config } = await import("../config");
      console.log("CONFIG OK:", Object.keys(config).join(", "));
      expect(config).toBeDefined();
      expect(typeof config.MINIMAX_API_KEY).toBe("string");
    });
  });

  describe("2. Database Creates Tables", () => {
    test("should create all required database tables", async () => {
      const { getDb } = await import("../memory/db");
      const db = getDb();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];
      console.log("DB OK:", tables.map((t) => t.name).join(", "));
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  describe("3. MiniMax LLM Responds", () => {
    test("should generate response from MiniMax LLM", async () => {
      const { generate } = await import("../minimax/llm");
      const response = await generate(
        "you are a test",
        "say hello in 3 words"
      );
      console.log("LLM OK:", response);
      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
      expect(response.length).toBeGreaterThan(0);
    });
  });

  describe("4. MiniMax TTS Generates Audio", () => {
    test("should generate audio file from text", async () => {
      const { textToSpeech } = await import("../minimax/tts");
      const audioPath = await textToSpeech("testing nudge");
      expect(fs.existsSync(audioPath)).toBe(true);

      const stats = fs.statSync(audioPath);
      console.log(`TTS OK: ${audioPath} — size: ${stats.size} bytes`);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe("5. Composio Connects", () => {
    test("should check Composio mock mode status", async () => {
      const { isMockMode } = await import("../integrations/composio");
      const mockMode = isMockMode();
      console.log("COMPOSIO mock mode:", mockMode);
      expect(typeof mockMode).toBe("boolean");
    });
  });

  describe("6. Gmail Pulls Real Emails", () => {
    test("should pull unread emails from Gmail", async () => {
      const { pullUnreadEmails } = await import("../integrations/gmail");
      const emails = await pullUnreadEmails(3);
      console.log(`${emails.length} emails`);
      emails.forEach((em) =>
        console.log(` - ${em.from} : ${em.subject}`)
      );
      expect(Array.isArray(emails)).toBe(true);
    });
  });

  describe("7. Calendar Pulls Events", () => {
    test("should pull today's events from calendar", async () => {
      const { pullTodayEvents } = await import("../integrations/calendar");
      const events = await pullTodayEvents();
      console.log(`${events.length} events`);
      events.forEach((ev) => console.log(` - ${ev.title} ${ev.start}`));
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe("8. Personality Validation Works", () => {
    test("should validate personality and temporal voice", () => {
      const voice = getTemporalVoice();
      console.log("VOICE:", voice);

      const cleanedResponse = validateResponse(
        "I'd be happy to help! Certainly, here is your schedule. Furthermore, the meeting is at 2pm."
      );
      console.log("CLEAN:", cleanedResponse);

      expect(voice).toBeDefined();
      expect(typeof voice).toBe("string");
      expect(cleanedResponse).toBeDefined();
      expect(typeof cleanedResponse).toBe("string");
    });
  });
});
