import 'dotenv/config';

const num = (key: string, fallback: number): number =>
  process.env[key] ? parseInt(process.env[key]!, 10) : fallback;

function loadConfig() {
  const required = ['MINIMAX_API_KEY', 'MINIMAX_API_HOST', 'COMPOSIO_API_KEY', 'AGENT_CHAT_IDENTIFIER'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
  }

  return {
    minimaxApiKey: process.env.MINIMAX_API_KEY!,
    minimaxApiHost: process.env.MINIMAX_API_HOST!,
    composioApiKey: process.env.COMPOSIO_API_KEY!,
    agentChatIdentifier: process.env.AGENT_CHAT_IDENTIFIER!,

    quietHoursStart: num('QUIET_HOURS_START', 23),
    quietHoursEnd: num('QUIET_HOURS_END', 7),
    maxProactivePerHour: num('MAX_PROACTIVE_PER_HOUR', 3),
    morningBriefingHour: num('MORNING_BRIEFING_HOUR', 8),
    eodReviewHour: num('EOD_REVIEW_HOUR', 18),
    preMeetingMinutes: num('PRE_MEETING_MINUTES', 15),

    calendarPollMs: 5 * 60 * 1000,
    emailPollMs: 10 * 60 * 1000,
    messageBatchMs: 30 * 1000,
  };
}

export const config = loadConfig();
