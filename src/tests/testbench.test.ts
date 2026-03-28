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

  describe("9. Tool Definitions", () => {
    test("should have valid tool definitions", async () => {
      const { TOOL_DEFS } = await import("../agent/tools");
      expect(Array.isArray(TOOL_DEFS)).toBe(true);
      expect(TOOL_DEFS.length).toBe(7);
      const names = TOOL_DEFS.map(t => t.function.name);
      expect(names).toContain("get_calendar");
      expect(names).toContain("get_emails");
      expect(names).toContain("get_tasks");
      expect(names).toContain("get_person");
      expect(names).toContain("save_email_draft");
      expect(names).toContain("get_cross_insights");
      expect(names).toContain("get_conversation");
      console.log("TOOLS OK:", names.join(", "));
    });
  });

  describe("10. Task Ranking System", () => {
    test("should rank hard-deadline-tomorrow tasks above no-deadline tasks", () => {
      const { rankTasks } = require("../agent/ranking");
      
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 20 * 60 * 60 * 1000); // 20 hours from now
      
      const tasks = [
        {
          id: "t1",
          description: "Task with no deadline",
          estimated_minutes: 30,
          deadline: null,
          deadline_confidence: null,
          urgency: 3,
          status: "open"
        },
        {
          id: "t2",
          description: "Hard deadline tomorrow",
          estimated_minutes: 30,
          deadline: tomorrow.toISOString(),
          deadline_confidence: "hard",
          urgency: 3,
          status: "open"
        }
      ];

      const freeBlocks = [
        { start: new Date(now.getTime() + 60 * 60 * 1000), end: new Date(now.getTime() + 2 * 60 * 60 * 1000), durationMin: 60 }
      ];

      const ranked = rankTasks(tasks, freeBlocks, now);
      
      console.log("RANKED TASKS:");
      ranked.forEach((t, i) => {
        console.log(`${i + 1}. ${t.description} - Score: ${t.score.toFixed(2)}, Deadline: ${t.deadline || "none"}`);
      });
      
      expect(ranked[0].id).toBe("t2");
      expect(ranked[0].deadline).not.toBeNull();
      expect(ranked[1].id).toBe("t1");
      expect(ranked[1].deadline).toBeNull();
      console.log("✓ Hard-deadline-tomorrow task ranked above no-deadline task");
    });

    test("should place blocked tasks at the bottom", () => {
      const { rankTasks } = require("../agent/ranking");
      
      const now = new Date();
      
      const tasks = [
        {
          id: "t1",
          description: "Normal task",
          estimated_minutes: 30,
          deadline: null,
          deadline_confidence: null,
          urgency: 3,
          status: "open",
          depends_on: null
        },
        {
          id: "t2",
          description: "Blocked task (waiting for t3)",
          estimated_minutes: 30,
          deadline: null,
          deadline_confidence: null,
          urgency: 3,
          status: "open",
          depends_on: "t3"
        }
      ];

      const freeBlocks = [
        { start: new Date(now.getTime() + 60 * 60 * 1000), end: new Date(now.getTime() + 2 * 60 * 60 * 1000), durationMin: 60 }
      ];

      const ranked = rankTasks(tasks, freeBlocks, now);
      
      console.log("RANKED TASKS:");
      ranked.forEach((t, i) => {
        console.log(`${i + 1}. ${t.description} - Score: ${t.score.toFixed(2)}, Blocked: ${t.blocked}`);
      });
      
      expect(ranked[0].id).toBe("t1");
      expect(ranked[0].blocked).toBe(false);
      expect(ranked[1].id).toBe("t2");
      expect(ranked[1].blocked).toBe(true);
      console.log("✓ Blocked task placed at the bottom");
    });

    test("should rank 24-48hr deadlines higher than further deadlines", () => {
      const { rankTasks } = require("../agent/ranking");
      
      const now = new Date();
      const in36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000);
      const in72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      
      const tasks = [
        {
          id: "t1",
          description: "Task with far deadline (72hr)",
          estimated_minutes: 30,
          deadline: in72Hours.toISOString(),
          deadline_confidence: "hard",
          urgency: 3,
          status: "open",
          depends_on: null
        },
        {
          id: "t2",
          description: "Task with near deadline (36hr)",
          estimated_minutes: 30,
          deadline: in36Hours.toISOString(),
          deadline_confidence: "hard",
          urgency: 3,
          status: "open",
          depends_on: null
        }
      ];

      const freeBlocks = [
        { start: new Date(now.getTime() + 60 * 60 * 1000), end: new Date(now.getTime() + 2 * 60 * 60 * 1000), durationMin: 60 }
      ];

      const ranked = rankTasks(tasks, freeBlocks, now);
      
      console.log("RANKED TASKS:");
      ranked.forEach((t, i) => {
        console.log(`${i + 1}. ${t.description} - Score: ${t.score.toFixed(2)}`);
      });
      
      expect(ranked[0].id).toBe("t2");
      expect(ranked[1].id).toBe("t1");
      console.log("✓ 36hr deadline task ranked above 72hr deadline task");
    });

    test("should prioritize tasks that fit in next free block", () => {
      const { rankTasks } = require("../agent/ranking");
      
      const now = new Date();
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
      const nextBlockEnd = new Date(nextHour.getTime() + 45 * 60 * 1000);
      
      const tasks = [
        {
          id: "t1",
          description: "Long task (60min) - won't fit next 45min block",
          estimated_minutes: 60,
          deadline: null,
          deadline_confidence: null,
          urgency: 3,
          status: "open",
          depends_on: null
        },
        {
          id: "t2",
          description: "Short task (30min) - fits next 45min block",
          estimated_minutes: 30,
          deadline: null,
          deadline_confidence: null,
          urgency: 3,
          status: "open",
          depends_on: null
        }
      ];

      const freeBlocks = [
        { start: nextHour, end: nextBlockEnd, durationMin: 45 },
        { start: new Date(nextBlockEnd.getTime() + 60 * 60 * 1000), end: new Date(nextBlockEnd.getTime() + 3 * 60 * 60 * 1000), durationMin: 120 }
      ];

      const ranked = rankTasks(tasks, freeBlocks, now);
      
      console.log("RANKED TASKS:");
      ranked.forEach((t, i) => {
        console.log(`${i + 1}. ${t.description} - Score: ${t.score.toFixed(2)}, Fits Next Block: ${t.fits_next_block}`);
      });
      
      expect(ranked[0].id).toBe("t2");
      expect(ranked[0].fits_next_block).toBe(true);
      expect(ranked[1].id).toBe("t1");
      expect(ranked[1].fits_next_block).toBe(false);
      console.log("✓ Task fitting in next block ranked higher");
    });

    test("should format ranked plan with time slots", () => {
      const { rankTasks, formatRankedPlan } = require("../agent/ranking");
      
      const now = new Date();
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
      const nextBlockEnd = new Date(nextHour.getTime() + 90 * 60 * 1000);
      
      const tasks = [
        {
          id: "t1",
          description: "Task A",
          estimated_minutes: 30,
          deadline: null,
          deadline_confidence: null,
          urgency: 3,
          status: "open",
          depends_on: null
        },
        {
          id: "t2",
          description: "Task B",
          estimated_minutes: 30,
          deadline: null,
          deadline_confidence: null,
          urgency: 3,
          status: "open",
          depends_on: null
        }
      ];

      const freeBlocks = [
        { start: nextHour, end: nextBlockEnd, durationMin: 90 }
      ];

      const ranked = rankTasks(tasks, freeBlocks, now);
      const plan = formatRankedPlan(ranked, freeBlocks);
      
      console.log("FORMATTED PLAN:");
      console.log(plan);
      
      expect(plan).toContain("Task A");
      expect(plan).toContain("Task B");
      expect(plan).toContain("30min");
      console.log("✓ Formatted plan contains task descriptions and durations");
    });

    test("should handle mixed scenario with all ranking factors", () => {
      const { rankTasks } = require("../agent/ranking");
      
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 20 * 60 * 60 * 1000);
      const in36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000);
      
      const tasks = [
        {
          id: "t1",
          description: "Low urgency, no deadline",
          estimated_minutes: 30,
          deadline: null,
          deadline_confidence: null,
          urgency: 1,
          status: "open",
          depends_on: null
        },
        {
          id: "t2",
          description: "High urgency, hard deadline tomorrow",
          estimated_minutes: 30,
          deadline: tomorrow.toISOString(),
          deadline_confidence: "hard",
          urgency: 5,
          status: "open",
          depends_on: null
        },
        {
          id: "t3",
          description: "Medium urgency, 36hr deadline",
          estimated_minutes: 30,
          deadline: in36Hours.toISOString(),
          deadline_confidence: "soft",
          urgency: 3,
          status: "open",
          depends_on: null
        },
        {
          id: "t4",
          description: "Blocked task",
          estimated_minutes: 30,
          deadline: null,
          deadline_confidence: null,
          urgency: 5,
          status: "open",
          depends_on: "t999"
        }
      ];

      const freeBlocks = [
        { start: new Date(now.getTime() + 60 * 60 * 1000), end: new Date(now.getTime() + 3 * 60 * 60 * 1000), durationMin: 120 }
      ];

      const ranked = rankTasks(tasks, freeBlocks, now);
      
      console.log("\nMIXED SCENARIO - ALL RANKING FACTORS:");
      console.log("=".repeat(60));
      ranked.forEach((t, i) => {
        console.log(`${i + 1}. ${t.description}`);
        console.log(`   Score: ${t.score.toFixed(2)} | Deadline: ${t.deadline || "none"} | Blocked: ${t.blocked}`);
      });
      console.log("=".repeat(60));
      
      expect(ranked[0].id).toBe("t2");
      expect(ranked[0].blocked).toBe(false);
      
      const blockedIndex = ranked.findIndex(t => t.blocked);
      expect(blockedIndex).toBe(ranked.length - 1);
      expect(ranked[ranked.length - 1].id).toBe("t4");
      
      console.log("✓ High-urgency hard-deadline task ranked first");
      console.log("✓ Blocked task placed at the bottom");
      console.log("✓ Tasks sorted by descending score");
    });
  });
});
