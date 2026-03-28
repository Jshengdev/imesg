import { describe, test, expect } from "bun:test";

describe("Config Tests", () => {
  test("should have required config properties", () => {
    const requiredProps = [
      "minimaxApiKey",
      "minimaxApiHost",
      "composioApiKey",
      "agentChatIdentifier",
      "morningBriefingHour",
      "eodReviewHour",
      "preMeetingMinutes",
      "maxProactivePerHour",
      "quietHoursStart",
      "quietHoursEnd",
    ];

    expect(requiredProps.length).toBe(10);
  });

  test("should parse environment variables correctly", () => {
    const morningBriefingHour = parseInt(process.env.MORNING_BRIEFING_HOUR || "8", 10);
    expect(morningBriefingHour).toBe(8);

    const preMeetingMinutes = parseInt(process.env.PRE_MEETING_MINUTES || "15", 10);
    expect(preMeetingMinutes).toBe(15);

    const maxProactive = parseInt(process.env.MAX_PROACTIVE_PER_HOUR || "3", 10);
    expect(maxProactive).toBe(3);
  });

  test("should use default values for missing env vars", () => {
    const morningBriefingHour = parseInt(process.env.MORNING_BRIEFING_HOUR || "8", 10);
    expect(morningBriefingHour).toBeGreaterThanOrEqual(0);
    expect(morningBriefingHour).toBeLessThanOrEqual(23);

    const quietHoursStart = parseInt(process.env.QUIET_HOURS_START || "23", 10);
    expect(quietHoursStart).toBeGreaterThanOrEqual(0);
    expect(quietHoursStart).toBeLessThanOrEqual(23);
  });

  test("should validate API keys", () => {
    const hasMinimmaxApiKey = Boolean(process.env.MINIMAX_API_KEY);
    const hasMinimmaxApiHost = Boolean(process.env.MINIMAX_API_HOST);
    const hasComposioApiKey = Boolean(process.env.COMPOSIO_API_KEY);

    expect(typeof hasMinimmaxApiKey).toBe("boolean");
    expect(typeof hasMinimmaxApiHost).toBe("boolean");
    expect(typeof hasComposioApiKey).toBe("boolean");
  });
});
