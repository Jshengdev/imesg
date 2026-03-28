import "dotenv/config";

const REQUIRED_KEYS = [
  "MINIMAX_API_KEY",
  "MINIMAX_API_HOST",
  "COMPOSIO_API_KEY",
  "AGENT_CHAT_IDENTIFIER",
] as const;

function loadConfig() {
  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}. Check .env file.`);
  }

  const num = (key: string, fallback: number) =>
    process.env[key] ? parseInt(process.env[key]!, 10) : fallback;

  return {
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY!,
    MINIMAX_API_HOST: process.env.MINIMAX_API_HOST!,
    COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY!,
    AGENT_CHAT_IDENTIFIER: process.env.AGENT_CHAT_IDENTIFIER!,
    QUIET_HOURS_START: num("QUIET_HOURS_START", 23),
    QUIET_HOURS_END: num("QUIET_HOURS_END", 7),
    MAX_PROACTIVE_PER_HOUR: num("MAX_PROACTIVE_PER_HOUR", 3),
    MORNING_BRIEFING_HOUR: num("MORNING_BRIEFING_HOUR", 8),
    EOD_REVIEW_HOUR: num("EOD_REVIEW_HOUR", 18),
    PRE_MEETING_MINUTES: num("PRE_MEETING_MINUTES", 15),
    CALENDAR_POLL_MS: 5 * 60 * 1000,
    EMAIL_POLL_MS: 10 * 60 * 1000,
    MESSAGE_BATCH_MS: 30 * 1000,
  };
}

export const config = loadConfig();
